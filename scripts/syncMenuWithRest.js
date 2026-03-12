const { execSync } = require('child_process');
const fs = require('fs');

async function sync() {
    try {
        console.log('Reading default menu config from local source...');
        // The file is TS, but we can just use a regex or transpile it, or even simpler:
        // just read the content and parse it, or compile it on the fly.
        // Actually, we can just use ts-node to execute a script!
    } catch(e) {
        console.error(e);
    }
}

sync();
