const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const png = fs.readFileSync(path.join(root, 'public/icons/icon-192.png'));
const size = png.readUInt32BE(16);
if (size !== 192 || png.readUInt32BE(20) !== size) throw new Error('Expected the square 192px ERP icon');

// ICO supports an unmodified PNG payload. No artwork is redrawn or resized.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = size;
header[7] = size;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
fs.writeFileSync(path.join(root, 'public/icons/cy-erp.ico'), Buffer.concat([header, png]));

const drawableDir = path.join(root, 'android-erp-launcher/app/src/main/res/drawable-nodpi');
fs.mkdirSync(drawableDir, { recursive: true });
fs.copyFileSync(path.join(root, 'public/icons/icon-512.png'), path.join(drawableDir, 'ic_launcher.png'));
console.log('ERP desktop icon and Android launcher icon generated.');
