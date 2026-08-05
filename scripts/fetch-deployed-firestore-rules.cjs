const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cyee-9c1e4';
const RELEASE_ID = 'cloud.firestore';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function requestJson(url, accessToken) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Rules API request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function main() {
  const outputDirectory = path.resolve(
    process.argv[2] || path.join('backups', 'firestore-rules'),
  );
  const credentialPath = path.join(
    process.env.APPDATA || '',
    'gcloud',
    'application_default_credentials.json',
  );
  if (!fs.existsSync(credentialPath)) {
    throw new Error(`Application Default Credentials not found: ${credentialPath}`);
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
  const credential = admin.credential.applicationDefault();
  const { access_token: accessToken } = await credential.getAccessToken();
  const release = await requestJson(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/${RELEASE_ID}`,
    accessToken,
  );
  if (!release.rulesetName) throw new Error('Firestore release did not include a rulesetName');

  const ruleset = await requestJson(
    `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
    accessToken,
  );
  const files = ruleset.source?.files || [];
  if (files.length === 0) throw new Error('Deployed Firestore ruleset has no source files');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const writtenFiles = files.map((file, index) => {
    const safeName = path.basename(file.name || `firestore-${index}.rules`);
    const outputPath = path.join(outputDirectory, `deployed-${timestamp}-${safeName}`);
    const content = file.content || '';
    fs.writeFileSync(outputPath, content, 'utf8');
    return {
      sourceName: file.name || '',
      outputPath,
      sha256: sha256(content),
      bytes: Buffer.byteLength(content),
    };
  });
  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    releaseName: release.name,
    rulesetName: release.rulesetName,
    releaseUpdateTime: release.updateTime || null,
    rulesetCreateTime: ruleset.createTime || null,
    files: writtenFiles,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
  });
