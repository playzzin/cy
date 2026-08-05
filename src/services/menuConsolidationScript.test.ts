const {
  REQUIRED_CONFIRMATION,
  hashDocument,
  parseArgs,
} = require('../../scripts/consolidate-menu-docs.cjs');

describe('menu consolidation safety script', () => {
  it('hashes equivalent Firestore data independently of object key order', () => {
    expect(hashDocument({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hashDocument({ a: { c: 3, d: 4 }, b: 2 })
    );
  });

  it('defaults to dry-run mode', () => {
    expect(parseArgs(['--baseline', 'backup.json'])).toMatchObject({
      apply: false,
      baselinePath: 'backup.json',
      confirmation: ''
    });
  });

  it('requires an explicit, exact destructive-operation confirmation value', () => {
    expect(parseArgs([
      '--baseline',
      'backup.json',
      '--apply',
      '--confirmation',
      REQUIRED_CONFIRMATION
    ])).toMatchObject({
      apply: true,
      baselinePath: 'backup.json',
      confirmation: REQUIRED_CONFIRMATION
    });
  });
});
