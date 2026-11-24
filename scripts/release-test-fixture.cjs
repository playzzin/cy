const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Fixtures here can resolve this checkout's installed packages without copying them.
// Windows app sandboxes can put a webpack-reserved "!" in the system temp path.
function releaseFixture(t, prefix) {
    const tmp = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const parent = fs.realpathSync(tmp);
    const directory = fs.mkdtempSync(path.join(parent, prefix));
    t.after(() => {
        assert.equal(path.dirname(directory), parent);
        assert.ok(path.basename(directory).startsWith(prefix));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    return directory;
}

function makeDirectoryLink(t, target, link) {
    try { fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
        t.skip('이 Windows 세션에 실제 디렉터리 연결을 만들 권한이 없습니다.');
        return false;
    }
    return true;
}

module.exports = { releaseFixture, makeDirectoryLink };
