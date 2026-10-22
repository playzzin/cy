// Build with the Windows-included .NET Framework compiler; no downloaded dependencies.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const dir = __dirname, bin = path.join(dir, 'bin');
fs.mkdirSync(bin, { recursive: true });
const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const common = ['/nologo', '/optimize+', '/codepage:65001', '/platform:anycpu', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Web.Extensions.dll'];
function compile(args) { const result = cp.spawnSync(csc, [...common, ...args], { cwd: dir, encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stdout + result.stderr); }
compile(['/target:winexe', '/out:bin/CYPhotoClipboard.exe', 'Bridge.cs', 'NativeClipboard.cs', 'TemporaryPhotos.cs', 'Program.cs']);
compile(['/target:winexe', '/out:bin/CYPhotoClipboardSetup.exe', '/r:Microsoft.CSharp.dll', '/resource:bin/CYPhotoClipboard.exe,Helper', 'Setup.cs']);
compile(['/target:exe', '/out:bin/HelperTests.exe', '/main:CyPhotoClipboard.Tests', 'Bridge.cs', 'NativeClipboard.cs', 'TemporaryPhotos.cs', 'Tests.cs']);
compile(['/target:exe', '/out:bin/SetupPreview.exe', '/main:CyPhotoClipboard.SetupPreview', '/r:Microsoft.CSharp.dll', 'Setup.cs', 'SetupPreview.cs']);
if (process.argv.includes('--package')) {
    const destination = path.resolve(dir, '../../public/downloads');
    fs.mkdirSync(destination, { recursive: true });
    const data = fs.readFileSync(path.join(bin, 'CYPhotoClipboardSetup.exe'));
    fs.writeFileSync(path.join(destination, 'CYPhotoClipboardSetup.exe'), data);
    fs.writeFileSync(path.join(destination, 'CYPhotoClipboardSetup.sha256'), crypto.createHash('sha256').update(data).digest('hex') + '  CYPhotoClipboardSetup.exe\n');
}
console.log('Windows helper, setup and tests compiled.');
