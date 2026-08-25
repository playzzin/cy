import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';

export const GET_CONSTRUCTION_PLAN_MAP_SNAPSHOT_CALLABLE = 'getConstructionPlanMapSnapshotServer';

export type ConstructionPlanMapSnapshot = {
  address: string;
  imageDataUrl: string;
  googleMapsUrl: string;
};

type ConstructionPlanMapSnapshotResponse = Partial<ConstructionPlanMapSnapshot>;

type OpenStreetMapSearchResult = {
  lat?: string;
  lon?: string;
};

const OPEN_STREET_MAP_TILE_SIZE = 256;
const OPEN_STREET_MAP_SNAPSHOT_WIDTH = 960;
const OPEN_STREET_MAP_SNAPSHOT_HEIGHT = 600;
const OPEN_STREET_MAP_SNAPSHOT_ZOOM = 16;

const cleanAddress = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

export const createGoogleMapsSearchUrl = (rawAddress: string): string => {
  const address = cleanAddress(rawAddress);
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : '';
};

export const createGoogleMapsEmbedUrl = (rawAddress: string): string => {
  const address = cleanAddress(rawAddress);
  return address
    ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
    : '';
};

const longitudeToTileX = (longitude: number, zoom: number): number => (
  ((longitude + 180) / 360) * (2 ** zoom)
);

const latitudeToTileY = (latitude: number, zoom: number): number => {
  const limitedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = limitedLatitude * (Math.PI / 180);
  return (
    (1 - (Math.asinh(Math.tan(radians)) / Math.PI))
    / 2
    * (2 ** zoom)
  );
};

const loadOpenStreetMapTile = (x: number, y: number, zoom: number): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('construction-plan-map-tile-load-failed'));
    image.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
  })
);

const drawOpenStreetMapMarker = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
): void => {
  context.save();
  context.translate(centerX, centerY - 12);
  context.shadowColor = 'rgba(0, 0, 0, 0.28)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  context.fillStyle = '#d93025';
  context.beginPath();
  context.moveTo(0, 30);
  context.bezierCurveTo(-7, 18, -18, 7, -18, -5);
  context.arc(0, -5, 18, Math.PI, 0);
  context.bezierCurveTo(18, 7, 7, 18, 0, 30);
  context.fill();
  context.shadowColor = 'transparent';
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(0, -5, 6.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const renderOpenStreetMapSnapshot = async (address: string): Promise<string> => {
  const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
  searchUrl.searchParams.set('format', 'jsonv2');
  searchUrl.searchParams.set('limit', '1');
  searchUrl.searchParams.set('countrycodes', 'kr');
  searchUrl.searchParams.set('accept-language', 'ko');
  searchUrl.searchParams.set('q', address);
  const response = await fetch(searchUrl.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('construction-plan-map-geocoding-failed');
  const results = await response.json() as OpenStreetMapSearchResult[];
  const latitude = Number(results[0]?.lat);
  const longitude = Number(results[0]?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('construction-plan-map-address-not-found');
  }

  const canvas = document.createElement('canvas');
  canvas.width = OPEN_STREET_MAP_SNAPSHOT_WIDTH;
  canvas.height = OPEN_STREET_MAP_SNAPSHOT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('construction-plan-map-canvas-unavailable');

  const centerPixelX = longitudeToTileX(longitude, OPEN_STREET_MAP_SNAPSHOT_ZOOM) * OPEN_STREET_MAP_TILE_SIZE;
  const centerPixelY = latitudeToTileY(latitude, OPEN_STREET_MAP_SNAPSHOT_ZOOM) * OPEN_STREET_MAP_TILE_SIZE;
  const viewportLeft = centerPixelX - (canvas.width / 2);
  const viewportTop = centerPixelY - (canvas.height / 2);
  const firstTileX = Math.floor(viewportLeft / OPEN_STREET_MAP_TILE_SIZE);
  const lastTileX = Math.floor((viewportLeft + canvas.width - 1) / OPEN_STREET_MAP_TILE_SIZE);
  const firstTileY = Math.floor(viewportTop / OPEN_STREET_MAP_TILE_SIZE);
  const lastTileY = Math.floor((viewportTop + canvas.height - 1) / OPEN_STREET_MAP_TILE_SIZE);
  const tileCount = 2 ** OPEN_STREET_MAP_SNAPSHOT_ZOOM;
  const tiles: Array<Promise<{ image: HTMLImageElement; x: number; y: number }>> = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      const clampedTileY = Math.max(0, Math.min(tileCount - 1, tileY));
      tiles.push(loadOpenStreetMapTile(
        wrappedTileX,
        clampedTileY,
        OPEN_STREET_MAP_SNAPSHOT_ZOOM,
      ).then((image) => ({ image, x: tileX, y: tileY })));
    }
  }
  const loadedTiles = await Promise.all(tiles);
  loadedTiles.forEach(({ image, x, y }) => {
    context.drawImage(
      image,
      (x * OPEN_STREET_MAP_TILE_SIZE) - viewportLeft,
      (y * OPEN_STREET_MAP_TILE_SIZE) - viewportTop,
      OPEN_STREET_MAP_TILE_SIZE,
      OPEN_STREET_MAP_TILE_SIZE,
    );
  });

  drawOpenStreetMapMarker(context, canvas.width / 2, canvas.height / 2);
  const attribution = '© OpenStreetMap contributors';
  context.font = '600 16px Arial, sans-serif';
  const attributionWidth = context.measureText(attribution).width + 20;
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fillRect(canvas.width - attributionWidth - 10, canvas.height - 34, attributionWidth, 24);
  context.fillStyle = '#263746';
  context.fillText(attribution, canvas.width - attributionWidth, canvas.height - 16);
  return canvas.toDataURL('image/png');
};

export const fetchConstructionPlanMapSnapshot = async (
  rawAddress: string,
): Promise<ConstructionPlanMapSnapshot> => {
  const address = cleanAddress(rawAddress);
  if (!address) throw new Error('construction-plan-map-address-required');

  const callable = httpsCallable<{ address: string }, ConstructionPlanMapSnapshotResponse>(
    functions,
    GET_CONSTRUCTION_PLAN_MAP_SNAPSHOT_CALLABLE,
    { timeout: 30_000 },
  );
  try {
    const result = await callable({ address });
    const responseAddress = cleanAddress(result.data?.address) || address;
    const imageDataUrl = String(result.data?.imageDataUrl ?? '').trim();
    const googleMapsUrl = String(result.data?.googleMapsUrl ?? '').trim();
    if (!/^data:image\/(?:png|jpeg);base64,/i.test(imageDataUrl) || !/^https:\/\/www\.google\.com\/maps\/search\//i.test(googleMapsUrl)) {
      throw new Error('construction-plan-map-response-invalid');
    }
    return { address: responseAddress, imageDataUrl, googleMapsUrl };
  } catch (error) {
    console.info('[constructionPlanMapService] Google static map unavailable; using OpenStreetMap tiles', error);
    return {
      address,
      imageDataUrl: await renderOpenStreetMapSnapshot(address),
      googleMapsUrl: createGoogleMapsSearchUrl(address),
    };
  }
};
