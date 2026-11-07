import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { hashVehicleImportSource, normalizeVehicleImportSourceSha256 } from './vehicleImportIdentity';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const vehicleFineSourcePath = (hash: unknown): string => {
    const normalized = normalizeVehicleImportSourceSha256(hash);
    if (!normalized) throw new functions.https.HttpsError('not-found', '이 내역에는 원본 파일 정보가 없습니다. AI 등록으로 저장한 고지서의 사진을 볼 수 있습니다.');
    return `vehicle-fine-notices/${normalized}`;
};

export const fineSourceMimeType = (bytes: Buffer): string => {
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
    throw new functions.https.HttpsError('invalid-argument', 'JPG, PNG, WEBP, PDF 원본 파일을 확인해 주세요.');
};

export async function saveVehicleFineSource(source: { base64: string; sourceSha256: string }) {
    const bytes = Buffer.from(source.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_SOURCE_BYTES || hashVehicleImportSource(source.base64) !== source.sourceSha256) {
        throw new functions.https.HttpsError('invalid-argument', '고지서 원본 파일을 확인해 주세요.');
    }
    const contentType = fineSourceMimeType(bytes);
    const file = admin.storage().bucket().file(vehicleFineSourcePath(source.sourceSha256));
    try {
        await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
            metadata: { contentType, cacheControl: 'private, no-store', metadata: { sha256: source.sourceSha256 } } });
    } catch (error) {
        // Identical concurrent imports/re-analysis reuse the immutable original.
        if (Number((error as { code?: unknown }).code) !== 412) throw error;
        const [metadata] = await file.getMetadata();
        if (metadata.metadata?.sha256 !== source.sourceSha256 || Number(metadata.size) !== bytes.length) throw error;
    }
}

export async function readVehicleFineSource(hash: unknown) {
    const file = admin.storage().bucket().file(vehicleFineSourcePath(hash));
    try {
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size) > MAX_SOURCE_BYTES) throw new functions.https.HttpsError('failed-precondition', '고지서 파일 크기를 확인해 주세요.');
        const [bytes] = await file.download();
        const base64 = bytes.toString('base64');
        if (hashVehicleImportSource(base64) !== normalizeVehicleImportSourceSha256(hash)) {
            throw new functions.https.HttpsError('failed-precondition', '고지서 원본을 확인할 수 없습니다. 다시 분석해 주세요.');
        }
        return { base64, mimeType: fineSourceMimeType(bytes) };
    } catch (error) {
        if (Number((error as { code?: unknown }).code) === 404) {
            throw new functions.https.HttpsError('not-found', '이전 등록 건은 사진이 저장되지 않았습니다. 과태료 AI 등록에서 같은 고지서를 다시 분석하면 기존 내역에 사진이 연결됩니다.');
        }
        throw error;
    }
}
