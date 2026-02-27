const fs = require('fs');
let text = fs.readFileSync('src/services/dataconnectCompat.ts', 'utf8');

text = text.replace(/\} catch \{/g, '} catch (err) { console.error("[dataconnectCompat] Error:", err);');

fs.writeFileSync('src/services/dataconnectCompat.ts', text, 'utf8');
