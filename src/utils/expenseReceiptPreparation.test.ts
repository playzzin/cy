import { prepareExpenseReceipt } from './expenseReceiptPreparation';

const largeReceipt = (type = 'image/jpeg', name = 'receipt.jpg') => new File(
  [new Uint8Array(2 * 1024 * 1024)], name, { type, lastModified: 123456 },
);

describe('prepareExpenseReceipt', () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const originalCreateUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  let bitmap: { width: number; height: number; close: jest.Mock };
  let decode: jest.Mock;
  let drawImage: jest.Mock;
  let fillRect: jest.Mock;
  let toBlob: jest.SpyInstance;
  let encoded: Blob | null;
  let canvas: HTMLCanvasElement | undefined;

  beforeEach(() => {
    bitmap = { width: 4032, height: 3024, close: jest.fn() };
    decode = jest.fn().mockResolvedValue(bitmap);
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: decode });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:receipt') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    drawImage = jest.fn();
    fillRect = jest.fn();
    encoded = new Blob([new Uint8Array(200 * 1024)], { type: 'image/jpeg' });
    canvas = undefined;
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      canvas = this;
      return { drawImage, fillRect } as unknown as CanvasRenderingContext2D;
    });
    toBlob = jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(encoded));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBitmap) Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
    if (originalCreateUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevokeUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('returns small images and PDFs without allocating image resources', async () => {
    const small = new File([new Uint8Array(768 * 1024)], 'small.png', { type: 'image/png' });
    const pdf = largeReceipt('application/pdf', 'receipt.pdf');
    expect(await prepareExpenseReceipt(small)).toBe(small);
    expect(await prepareExpenseReceipt(pdf)).toBe(pdf);
    expect(decode).not.toHaveBeenCalled();
    expect(toBlob).not.toHaveBeenCalled();
  });

  it.each([
    ['image/jpeg', 'receipt.jpeg'],
    ['image/png', 'receipt.png'],
    ['image/webp', 'receipt.webp'],
  ])('compresses large %s images with the displayed orientation and preserves receipt metadata', async (type, name) => {
    const original = largeReceipt(type, name);
    const result = await prepareExpenseReceipt(original);
    expect(result.name).toBe('receipt.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBe(encoded!.size);
    expect(result.lastModified).toBe(original.lastModified);
    expect(decode).toHaveBeenCalledWith(original);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2000, 1500);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 2000, 1500);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvas!.width).toBe(0);
    expect(canvas!.height).toBe(0);
  });

  it('resizes portrait photos proportionally and never enlarges small dimensions', async () => {
    bitmap.width = 3024;
    bitmap.height = 4032;
    await prepareExpenseReceipt(largeReceipt());
    expect(drawImage).toHaveBeenLastCalledWith(bitmap, 0, 0, 1500, 2000);
    bitmap.width = 800;
    bitmap.height = 600;
    await prepareExpenseReceipt(largeReceipt());
    expect(drawImage).toHaveBeenLastCalledWith(bitmap, 0, 0, 800, 600);
  });

  it.each([
    [1200, 8000, 1000, 6667],
    [8000, 1200, 6667, 1000],
    [800, 8000, 800, 8000],
    [2400, 3600, 1333, 2000],
  ])('preserves readable receipt width without enlarging %sx%s photos', async (width, height, outputWidth, outputHeight) => {
    bitmap.width = width;
    bitmap.height = height;
    await prepareExpenseReceipt(largeReceipt());
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, outputWidth, outputHeight);
  });

  it.each(['larger', 'equal', 'empty', 'unsupported', 'null'])('keeps the source when conversion produces a %s result', async (outcome) => {
    const original = largeReceipt();
    encoded = outcome === 'null' ? null : new Blob([
      new Uint8Array(outcome === 'larger' ? original.size + 1 : outcome === 'equal' ? original.size : outcome === 'empty' ? 0 : 500),
    ], { type: outcome === 'unsupported' ? 'image/png' : 'image/jpeg' });
    expect(await prepareExpenseReceipt(original)).toBe(original);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvas!.width).toBe(0);
  });

  it('keeps the source and releases decoded resources when canvas encoding throws', async () => {
    const original = largeReceipt();
    toBlob.mockImplementation(() => { throw new Error('encoding failed'); });
    expect(await prepareExpenseReceipt(original)).toBe(original);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvas!.height).toBe(0);
  });

  it.each([true, false])('uses image-element fallback when ImageBitmap support is available: %s', async (available) => {
    if (available) decode.mockRejectedValue(new Error('format unsupported'));
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: 3000 });
    Object.defineProperty(image, 'naturalHeight', { value: 4000 });
    const setSource = jest.spyOn(image, 'src', 'set').mockImplementation((source) => {
      if (source) image.dispatchEvent(new Event('load'));
    });
    jest.spyOn(globalThis, 'Image').mockImplementation(() => image);
    expect((await prepareExpenseReceipt(largeReceipt())).type).toBe('image/jpeg');
    expect(setSource).toHaveBeenCalledWith('blob:receipt');
    expect(setSource).toHaveBeenLastCalledWith('');
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1500, 2000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  });

  it('keeps undecodable photos and releases their object URLs', async () => {
    decode.mockRejectedValue(new Error('invalid image'));
    const image = document.createElement('img');
    jest.spyOn(image, 'src', 'set').mockImplementation((source) => {
      if (source) image.dispatchEvent(new Event('error'));
    });
    jest.spyOn(globalThis, 'Image').mockImplementation(() => image);
    const original = largeReceipt();
    expect(await prepareExpenseReceipt(original)).toBe(original);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
    expect(toBlob).not.toHaveBeenCalled();
  });
});
