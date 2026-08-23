import { calculateIdentityStorageDimensions } from './identityImageCompression';

describe('identity image storage compression', () => {
  it('caps a landscape image at the configured longest edge', () => {
    expect(calculateIdentityStorageDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('caps a portrait image without changing its aspect ratio', () => {
    expect(calculateIdentityStorageDimensions(2400, 3600)).toEqual({ width: 1067, height: 1600 });
  });

  it('does not enlarge an already small image', () => {
    expect(calculateIdentityStorageDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

