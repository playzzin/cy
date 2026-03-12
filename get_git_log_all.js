const { execSync } = require('child_process');
const fs = require('fs');

try {
    const result = execSync('git log --all --format="%H|%ad|%s" --date=iso', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const logs = lines.map(line => {
        const [hash, date, ...msgParts] = line.split('|');
        return { hash, date, msg: msgParts.join('|') };
    });
    fs.writeFileSync('git_log_all.json', JSON.stringify(logs, null, 2), 'utf8');
    console.log('Success_all');
} catch (e) {
    console.error(e);
}
