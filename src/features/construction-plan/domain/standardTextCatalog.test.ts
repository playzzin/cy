import {
  SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
  SYSTEM_SHORING_TEMPLATE_MANIFEST,
} from './templateManifest';
import {
  buildStandardTextDiff,
  getStandardTextCatalogEntry,
  getStandardTextSectionCatalogEntry,
  STANDARD_TEXT_CATALOG,
  standardTextEquals,
} from './standardTextCatalog';

describe('construction plan standard text catalog', () => {
  it.each([
    ['system-shoring', SYSTEM_SHORING_TEMPLATE_MANIFEST],
    ['system-scaffold', SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST],
  ] as const)('covers every editable and locked static standard section for %s', (tradeType, manifest) => {
    const standardPages = manifest.pages.filter((page) => (
      page.dataStrategy === 'template-with-override'
      || page.dataStrategy === 'template-catalog'
    ));

    expect(standardPages).not.toHaveLength(0);
    standardPages.forEach((page) => {
      const entry = getStandardTextSectionCatalogEntry({
        tradeType,
        sectionKey: page.sectionKey,
        templateId: manifest.id,
        templateVersion: manifest.version,
      });
      expect(entry).toEqual(expect.objectContaining({
        pageNumber: page.pageNumber,
        strategy: page.dataStrategy,
        editable: page.dataStrategy === 'template-with-override',
      }));
      expect(entry?.originalText).toContain(entry?.rows[0].label);
      expect(entry?.standardTextVersion).toContain(`${manifest.id}@${manifest.version}`);
    });
  });

  it('formalizes the field-use PAGE_STANDARD_COPY meaning for structured reference pages too', () => {
    const material = getStandardTextCatalogEntry({
      tradeType: 'system-shoring',
      sectionKey: 'material-plan',
    });

    expect(material).toEqual(expect.objectContaining({
      pageNumber: 8,
      strategy: 'structured-input',
      editable: false,
    }));
    expect(material?.originalText).toContain('수직재·수평재·가새·잭·받침·연결핀');
    expect(getStandardTextSectionCatalogEntry({
      tradeType: 'system-shoring',
      sectionKey: 'material-plan',
    })).toBeUndefined();
  });

  it('provides scaffold-specific copy and section identities rather than reusing shoring wording', () => {
    const scaffoldGeneral = getStandardTextSectionCatalogEntry({
      tradeType: 'system-scaffold',
      sectionKey: 'general',
    });
    const scaffoldAssembly = getStandardTextSectionCatalogEntry({
      tradeType: 'system-scaffold',
      sectionKey: 'base-standard-assembly',
    });

    expect(scaffoldGeneral?.originalText).toContain('시스템비계');
    expect(scaffoldGeneral?.originalText).not.toContain('시스템동바리');
    expect(scaffoldAssembly?.pageNumber).toBe(19);
    expect(scaffoldAssembly?.originalText).toContain('받침철물');
  });

  it('exports a frozen, versioned catalog', () => {
    expect(Object.isFrozen(STANDARD_TEXT_CATALOG)).toBe(true);
    expect(Object.isFrozen(STANDARD_TEXT_CATALOG[0])).toBe(true);
    expect(Object.isFrozen(STANDARD_TEXT_CATALOG[0].rows)).toBe(true);
    expect(Object.isFrozen(STANDARD_TEXT_CATALOG[0].rows[0])).toBe(true);
  });

  it('builds a deterministic line diff and normalizes line endings', () => {
    expect(standardTextEquals('A\r\nB\n', 'A\nB')).toBe(true);
    expect(buildStandardTextDiff('A\nB\nC', 'A\nX\nC')).toEqual([
      { type: 'unchanged', value: 'A' },
      { type: 'removed', value: 'B' },
      { type: 'added', value: 'X' },
      { type: 'unchanged', value: 'C' },
    ]);
  });
});

