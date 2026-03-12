const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const historyDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'History');
const targetDateStr = '2026-02-24';
const projectPath = 'c:\\Users\\playz\\cy';
const outputPath = path.join(projectPath, 'vscode_history_search.txt');

console.log('Searching for VS Code history related to:', projectPath);
console.log('Target date:', targetDateStr);

let results = [];

function searchDirectory(dir) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Check entries.json in this directory
                const entriesFile = path.join(fullPath, 'entries.json');
                if (fs.existsSync(entriesFile)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
                        // Check if this history entry belongs to our project
                        if (data.resource && data.resource.includes('cy/src/') || data.resource && data.resource.includes('cy\\src\\')) {

                            // Filter entries by date (Feb 24, 2026)
                            const relevantEntries = data.entries.filter(entry => {
                                const entryDate = new Date(entry.timestamp);
                                // Convert to KST (UTC+9) for comparison, or just check string
                                const kstDateString = new Date(entry.timestamp + (9 * 60 * 60 * 1000)).toISOString();
                                return kstDateString.startsWith(targetDateStr);
                            });

                            if (relevantEntries.length > 0) {
                                results.push({
                                    file: data.resource,
                                    historyDir: fullPath,
                                    entries: relevantEntries
                                });
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error reading directory:', dir, err);
    }
}

searchDirectory(historyDir);

let outputText = 'VS Code History Search Results for ' + targetDateStr + '\n';
outputText += '=======================================================\n\n';

if (results.length === 0) {
    outputText += 'No history entries found for this date.\n';
} else {
    results.forEach(res => {
        outputText += `File: ${res.file}\n`;
        outputText += `History Folder: ${res.historyDir}\n`;
        res.entries.forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            outputText += `  - [${date}] ID: ${entry.id}\n`;
        });
        outputText += `-------------------------------------------------------\n`;
    });
}

fs.writeFileSync(outputPath, outputText, 'utf8');
console.log('Search complete. Results saved to:', outputPath);
