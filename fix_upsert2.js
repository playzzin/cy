const fs = require('fs');
let text = fs.readFileSync('src/services/menuServiceV11.ts', 'utf8');

text = text.replace(
  "import { listSettings, listAllSettings } from './dataconnectCompat';",
  "import { listSettings, listAllSettings } from './dataconnectCompat';\nimport { createSetting, updateSetting } from '../dataconnect-generated';"
);

const oldUpsert = /async function upsertSettingData\(id: string, dataObj: any\) \{[\s\S]*?throw err;\n    \}\n\}/;

const newUpsert = `async function upsertSettingData(id: string, dataObj: any) {
    console.log('[MenuService] upsertSettingData:', id);
    const data = JSON.stringify(dataObj);
    try {
        try {
            await updateSetting(dc, { id, data });
            console.log('[MenuService] updateSetting success for', id);
        } catch (e) {
            console.log('[MenuService] updateSetting failed, trying createSetting for', id);
            await createSetting(dc, { id, data });
            console.log('[MenuService] createSetting success for', id);
        }
        return true;
    } catch (err: any) {
        console.error('[MenuService] upsertSettingData failed for', id, err);
        throw err;
    }
}`;

text = text.replace(oldUpsert, newUpsert);

fs.writeFileSync('src/services/menuServiceV11.ts', text, 'utf8');
