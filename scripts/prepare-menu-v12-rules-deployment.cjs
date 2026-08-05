const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LEGACY_FUNCTION = `    function keepsDevRecruitingMenuChildren() {
      return !('pos_jhl2VTnk9V3C4EiZ4QQI' in request.resource.data)
        || !('menu' in request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI)
        || !(request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI.menu is list)
        || request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI.menu.size() <= 9
        || (
          ('sub' in request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI.menu[9])
          && request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI.menu[9].sub is list
          && request.resource.data.pos_jhl2VTnk9V3C4EiZ4QQI.menu[9].sub.size() >= 11
        );
    }`;

const CANONICAL_FUNCTION = `    function canWriteSettingsDocument(settingsId) {
      return !settingsId.matches('^menus_v[0-9]+$')
        || settingsId == 'menus_v12';
    }`;

const LEGACY_ALLOW = `      allow create, update: if isAdmin()
        && (settingsId != 'menus_v12' || keepsDevRecruitingMenuChildren());`;

const CANONICAL_ALLOW = '      allow create, update: if isAdmin() && canWriteSettingsDocument(settingsId);';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function countOccurrences(content, needle) {
  return content.split(needle).length - 1;
}

function applyScopedMenuRuleChange(deployedRules) {
  const normalized = deployedRules.replace(/\r\n/g, '\n');
  if (countOccurrences(normalized, LEGACY_FUNCTION) !== 1) {
    throw new Error('Expected exactly one legacy menu preservation function');
  }
  if (countOccurrences(normalized, LEGACY_ALLOW) !== 1) {
    throw new Error('Expected exactly one legacy settings write rule');
  }

  const functionUpdated = normalized.replace(LEGACY_FUNCTION, () => CANONICAL_FUNCTION);
  if (countOccurrences(functionUpdated, 'function keepsDevRecruitingMenuChildren()') !== 0) {
    throw new Error('Legacy menu preservation function remains after transformation');
  }
  const updated = functionUpdated.replace(LEGACY_ALLOW, () => CANONICAL_ALLOW);

  if (updated.includes('keepsDevRecruitingMenuChildren')) {
    throw new Error(`Legacy menu preservation reference remains after transformation: ${
      countOccurrences(updated, 'keepsDevRecruitingMenuChildren')
    }`);
  }
  if (!updated.includes(CANONICAL_FUNCTION) || !updated.includes(CANONICAL_ALLOW)) {
    throw new Error('Canonical menus_v12 rule was not applied');
  }

  return `${updated.trimEnd()}\n`;
}

function main() {
  const sourcePath = path.resolve(process.argv[2] || '');
  const outputDirectory = path.resolve(
    process.argv[3] || path.join('backups', 'firestore-rules', 'menu-v12-scoped-deploy'),
  );
  if (!fs.existsSync(sourcePath)) throw new Error(`Deployed rules backup not found: ${sourcePath}`);

  const deployedRules = fs.readFileSync(sourcePath, 'utf8');
  const scopedRules = applyScopedMenuRuleChange(deployedRules);
  fs.mkdirSync(outputDirectory, { recursive: true });

  const rulesPath = path.join(outputDirectory, 'firestore.rules');
  const configPath = path.join(outputDirectory, 'firebase.json');
  fs.writeFileSync(rulesPath, scopedRules, 'utf8');
  fs.writeFileSync(configPath, `${JSON.stringify({
    firestore: { rules: 'firestore.rules' },
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    sourcePath,
    sourceHash: sha256(deployedRules),
    rulesPath,
    rulesHash: sha256(scopedRules),
    configPath,
    changedByteCount: Buffer.byteLength(scopedRules) - Buffer.byteLength(deployedRules),
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exit(1);
  }
}

module.exports = {
  CANONICAL_ALLOW,
  CANONICAL_FUNCTION,
  LEGACY_ALLOW,
  LEGACY_FUNCTION,
  applyScopedMenuRuleChange,
  countOccurrences,
};
