const { execSync } = require('child_process');
const fs = require('fs');

try {
    const result = execSync('git log --format="%H|%ad|%s" --date=iso', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const logs = lines.map(line => {
        const [hash, date, ...msgParts] = line.split('|');
        return { hash, date, msg: msgParts.join('|') };
    });
    fs.writeFileSync('git_log.json', JSON.stringify(logs, null, 2), 'utf8');
    console.log('Success');
} catch (e) {
    console.error(e);
}
