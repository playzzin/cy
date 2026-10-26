import { ID_CARD_ANALYSIS_MAX_BYTES, prepareIdCardAnalysisImage } from './idCardAnalysisImage';

afterEach(() => jest.restoreAllMocks());

it('preserves a supported photo without reducing its quality', async () => {
  const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
  expect(await prepareIdCardAnalysisImage(file)).toBe(file);
});

it.each([['fixture.PNG', '', 'image/png'], ['fixture.jpg', 'image/jpg', 'image/jpeg'],
  ['fixture.webp', 'application/octet-stream', 'image/webp'], ['fixture.heic', '', 'image/heic']])(
  'resolves the image format for %s (%s)', async (name, type, expected) => {
    const actual = await prepareIdCardAnalysisImage(new File(['fixture'], name, { type }));
    expect(actual.type).toBe(expected);
    expect(actual.size).toBe(7);
  },
);

it.each([new File([], 'empty.jpg', { type: 'image/jpeg' }), new File(['fixture'], 'fixture.pdf', { type: 'application/pdf' })])(
  'rejects empty and unsupported inputs before reading them', async file => {
    await expect(prepareIdCardAnalysisImage(file)).rejects.toThrow();
  },
);

const mockImage = (fails = false) => {
  URL.createObjectURL = jest.fn(() => 'blob:fixture');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(4000);
  jest.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(3000);
  jest.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
    this.dispatchEvent(new Event(fails ? 'error' : 'load'));
  });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: jest.fn(), drawImage: jest.fn() } as any);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpeg fixture'], { type: 'image/jpeg' })));
};

it.each(['image/png', 'image/bmp'])('converts oversized or unsupported gateway images (%s)', async type => {
  mockImage();
  const file = new File([new Uint8Array(type === 'image/png' ? ID_CARD_ANALYSIS_MAX_BYTES + 1 : 10)], 'fixture.image', { type });
  const actual = await prepareIdCardAnalysisImage(file);
  expect(actual.type).toBe('image/jpeg');
  expect(actual.size).toBeLessThanOrEqual(ID_CARD_ANALYSIS_MAX_BYTES);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
  const canvas = (HTMLCanvasElement.prototype.toBlob as jest.Mock).mock.instances[0];
  expect([canvas.width, canvas.height]).toEqual([2400, 1800]);
});

it('cleans up and explains an unreadable image', async () => {
  mockImage(true);
  await expect(prepareIdCardAnalysisImage(new File(['fixture'], 'fixture.bmp', { type: 'image/bmp' }))).rejects.toThrow('사진을 열지 못했습니다');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
});
