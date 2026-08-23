import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export const CONSTRUCTION_PLAN_BRAND_LOGO_SHA256 =
    '80167b84b6d50a01b5b63f4eb085f360c831aa6482b19de7853f81c018f52084';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let cachedLogo: Buffer | undefined;

export const getConstructionPlanBrandLogoPng = (): Buffer => {
    if (cachedLogo) return cachedLogo;
    const filePath = join(__dirname, 'assets', 'cheongyeon-logo.png');
    const bytes = readFileSync(filePath);
    if (bytes.length < PNG_MAGIC.length || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        throw new Error('construction-plan-brand-logo-invalid-png');
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== CONSTRUCTION_PLAN_BRAND_LOGO_SHA256) {
        throw new Error('construction-plan-brand-logo-sha256-mismatch');
    }
    cachedLogo = bytes;
    return bytes;
};
