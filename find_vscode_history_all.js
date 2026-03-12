const fs = require('fs');
const path = require('path');
const os = require('os');

const historyDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'History');
const projectPath = 'c:\\Users\\playz\\cy';
const outputPath = path.join(projectPath, 'vscode_history_all.txt');

console.log('Searching for ALL VS Code history related to:', projectPath);

let results = [];

function searchDirectory(dir) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                const entriesFile = path.join(fullPath, 'entries.json');
                if (fs.existsSync(entriesFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
                        if (data.resource && (data.resource.includes('cy/src/') || data.resource.includes('cy\\src\\'))) {
                            if (data.entries && data.entries.length > 0) {
                                results.push({
                                    file: data.resource,
                                    historyDir: fullPath,
                                    entries: data.entries
                                });
                            }
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}

searchDirectory(historyDir);

let outputText = 'All VS Code History Search Results\n';
outputText += '=======================================================\n\n';

if (results.length === 0) {
    outputText += 'No history entries found at all.\n';
} else {
    results.forEach(res => {
        outputText += `File: ${res.file}\n`;
        outputText += `History Folder: ${res.historyDir}\n`;

        // 최신순으로 정렬해서 5개만 출력
        const sortedEntries = res.entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

        sortedEntries.forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            outputText += `  - [${date}] ID: ${entry.id}\n`;
        });
        outputText += `-------------------------------------------------------\n`;
    });
}

fs.writeFileSync(outputPath, outputText, 'utf8');
console.log('Done');
