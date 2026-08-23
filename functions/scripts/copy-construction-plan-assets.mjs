import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const functionsDirectory = resolve(scriptDirectory, '..');
const source = resolve(functionsDirectory, '..', 'public', 'assets', 'estimate', 'cheongyeon-logo.png');
const destinationDirectory = join(functionsDirectory, 'lib', 'constructionPlans', 'assets');
const destination = join(destinationDirectory, 'cheongyeon-logo.png');
const expectedSha256 = '80167b84b6d50a01b5b63f4eb085f360c831aa6482b19de7853f81c018f52084';

const bytes = await readFile(source);
const actualSha256 = createHash('sha256').update(bytes).digest('hex');
if (actualSha256 !== expectedSha256) {
  throw new Error(`construction-plan-brand-logo-sha256-mismatch:${actualSha256}`);
}

await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, destination);
