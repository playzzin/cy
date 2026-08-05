const {
  CANONICAL_ALLOW,
  CANONICAL_FUNCTION,
  LEGACY_ALLOW,
  LEGACY_FUNCTION,
  applyScopedMenuRuleChange,
  countOccurrences,
} = require('../../scripts/prepare-menu-v12-rules-deployment.cjs');

describe('scoped menus_v12 rules deployment preparation', () => {
  it('changes only the legacy menu function and settings write rule', () => {
    const prefix = 'rules_version = \'2\';\nservice cloud.firestore {\n';
    const unchangedMiddle = '\n\n    function unchanged() { return true; }\n\n';
    const suffix = '\n}\n';
    const deployedRules = `${prefix}${LEGACY_FUNCTION}${unchangedMiddle}${LEGACY_ALLOW}${suffix}`;

    const updated = applyScopedMenuRuleChange(deployedRules);

    expect(updated).toContain(prefix);
    expect(updated).toContain(unchangedMiddle);
    expect(updated).toContain(suffix);
    expect(updated).toContain(CANONICAL_FUNCTION);
    expect(updated).toContain(CANONICAL_ALLOW);
    expect(updated).not.toContain('keepsDevRecruitingMenuChildren');
    expect(countOccurrences(updated, 'function unchanged()')).toBe(1);
    expect(countOccurrences(updated, "settingsId.matches('^menus_v[0-9]+$')")).toBe(1);
  });
});
