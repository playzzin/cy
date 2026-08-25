import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { requireCallableAuth } from '../auth';

const MAPS_STATIC_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';
const MAX_ADDRESS_LENGTH = 300;
const MAX_MAP_IMAGE_BYTES = 8 * 1024 * 1024;

const clean = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

export const buildConstructionPlanStaticMapUrl = (address: string, apiKey: string): string => {
    const params = new URLSearchParams({
        center: address,
        zoom: '16',
        size: '640x400',
        scale: '2',
        maptype: 'roadmap',
        markers: `color:0x0e7490|label:C|${address}`,
        language: 'ko',
        region: 'kr',
        key: apiKey,
    });
    return `${MAPS_STATIC_ENDPOINT}?${params.toString()}`;
};

const getGoogleMapsApiKey = async (): Promise<string> => {
    const settings = await admin.firestore().collection('server_settings').doc('ai').get();
    const data = settings.data() || {};
    return clean(
        data.mapsApiKey
        || process.env.GOOGLE_MAPS_API_KEY
        || process.env.GOOGLE_API_KEY,
    );
};

export const getConstructionPlanMapSnapshotServer = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        requireCallableAuth(context);
        const address = clean(data?.address);
        if (!address) {
            throw new functions.https.HttpsError('invalid-argument', '현장주소를 입력해주세요.');
        }
        if (address.length > MAX_ADDRESS_LENGTH) {
            throw new functions.https.HttpsError('invalid-argument', '현장주소는 300자 이하로 입력해주세요.');
        }

        const apiKey = await getGoogleMapsApiKey();
        if (!apiKey) {
            functions.logger.error('[referenceMapSnapshot] Google Maps API key is not configured.');
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Google Maps API 설정이 필요합니다.',
            );
        }

        const response = await fetch(buildConstructionPlanStaticMapUrl(address, apiKey), {
            signal: AbortSignal.timeout(20_000),
        });
        const contentType = clean(response.headers.get('content-type')).toLowerCase();
        if (!response.ok || !/^image\/(?:png|jpeg)/.test(contentType)) {
            functions.logger.warn('[referenceMapSnapshot] Static Maps request failed.', {
                status: response.status,
                contentType,
                addressLength: address.length,
            });
            throw new functions.https.HttpsError(
                'unavailable',
                '주소에 해당하는 Google 지도를 만들지 못했습니다.',
            );
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_MAP_IMAGE_BYTES) {
            throw new functions.https.HttpsError('resource-exhausted', '지도 이미지 크기가 허용 범위를 벗어났습니다.');
        }
        const mimeType = contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';
        return {
            address,
            imageDataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        };
    });
