const fs = require('fs');
const filePath = 'src/pages/payroll/MonthlyWageDraftPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    'const [ledgerInputs, setLedgerInputs] = useState<Record<string, any>>({});', 
    'const [ledgerInputs, setLedgerInputs] = useState<Record<string, any>>({});\n    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>(\'㈜다원\');\n    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>(\' 가불\');'
);

content = content.replace(
    /'㈜다원',\s*`\$\{item\.workerName\} 가불`/g, 
    'kbReceiverDisplay,\n            `${item.workerName}${kbMemoSuffix}`'
);

content = content.replace(
    /받는분통장표시:\s*'㈜다원',\s*내통장메모:\s*`\$\{item\.workerName\} 가불`/g,
    '받는분통장표시: kbReceiverDisplay,\n            내통장메모: `${item.workerName}${kbMemoSuffix}`'
);

const oldModalTop = `<div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h3 className="text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                            <button
                                onClick={() => setShowKBPreview(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>`;

const newModalTop = `<div className="p-4 border-b border-slate-200 flex flex-col gap-4 bg-amber-50">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                                <button
                                    onClick={() => setShowKBPreview(false)}
                                    className="text-slate-400 hover:text-slate-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="flex gap-4 items-center bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-slate-700">받는분통장표시:</label>
                                    <input
                                        type="text"
                                        value={kbReceiverDisplay}
                                        onChange={(e) => setKbReceiverDisplay(e.target.value)}
                                        className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-slate-700">내통장메모 (이름 뒤에 붙음):</label>
                                    <input
                                        type="text"
                                        value={kbMemoSuffix}
                                        onChange={(e) => setKbMemoSuffix(e.target.value)}
                                        className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>
                        </div>`;

content = content.replace(oldModalTop, newModalTop);
content = content.replace(oldModalTop.replace(/\r\n/g, '\n'), newModalTop);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update Complete.');