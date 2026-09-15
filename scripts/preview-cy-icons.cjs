const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../public/icons/cy');
const port = Number(process.env.CY_ICONS_PORT || 4187);
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
http.createServer((request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
    }
    fs.readFile(file, (error, body) => {
        if (error) {
            response.writeHead(404).end();
            return;
        }
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(body);
    });
}).listen(port, '127.0.0.1', () => console.log(`CY icons preview: http://127.0.0.1:${port}`));
