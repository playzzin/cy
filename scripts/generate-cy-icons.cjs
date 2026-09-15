/* CY 아이콘 원본에서 정적 SVG와 미리보기를 재생성합니다. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = require('../src/components/icons/cy-icon-catalog.json');
const output = path.join(root, 'public/icons/cy');
const escapeXml = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const attributes = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

function pathsFor(icon, variant) {
    return icon.paths.map((item) => {
        const color = variant === 'duotone' && item.accent ? 'var(--cy-icon-accent, currentColor)' : 'currentColor';
        const fill = variant === 'duotone' && item.filled ? ` fill="${color}" fill-opacity="0.12"` : ' fill="none"';
        return `<path d="${escapeXml(item.d)}" stroke="${color}"${fill}/>`;
    }).join('');
}

fs.mkdirSync(output, { recursive: true });
for (const variant of ['duotone', 'outline']) {
    fs.mkdirSync(path.join(output, variant), { recursive: true });
    for (const [name, icon] of Object.entries(catalog)) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ${attributes} role="img" aria-label="${escapeXml(icon.label)}">${pathsFor(icon, variant)}</svg>\n`;
        fs.writeFileSync(path.join(output, variant, `${name}.svg`), svg);
    }
    const symbols = Object.entries(catalog).map(([name, icon]) => `<symbol id="cy-${name}" ${attributes}>${pathsFor(icon, variant)}</symbol>`).join('\n');
    fs.writeFileSync(path.join(output, `sprite-${variant}.svg`), `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols}\n</svg>\n`);
}

const template = fs.readFileSync(path.join(__dirname, 'cy-icons-preview.html'), 'utf8');
fs.writeFileSync(path.join(output, 'index.html'), template.replace('/* __CY_ICON_CATALOG__ */', `const catalog = ${JSON.stringify(catalog).replace(/</g, '\\u003c')};`));
fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
const total = Object.keys(catalog).length;
console.log(`CY icons: ${total} designs, ${total * 2} SVG files, 2 sprites and preview generated.`);
