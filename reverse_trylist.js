const fs = require('fs');
let text = fs.readFileSync('src/services/dataconnectCompat.ts', 'utf8');

text = text.replace(/tryList\(\['([^']+)', '([^']+)'\]/g, (match, p1, p2) => {
    // If the first is the short name and the second is the listAll name, flip them!
    if (p1.startsWith('list') && !p1.startsWith('listAll') && p2.startsWith('listAll')) {
        return `tryList(['${p2}', '${p1}']`;
    }
    return match;
});

fs.writeFileSync('src/services/dataconnectCompat.ts', text, 'utf8');
