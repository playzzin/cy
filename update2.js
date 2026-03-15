const fs = require('fs');
let p = 'src/pages/payroll/MonthlyWageDraftPage.tsx';
let c = fs.readFileSync(p, 'utf-8');

const regex = /<div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">\s*<h3 className="text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기<\/h3>\s*<button\s*onClick=\{\(\) => setShowKBPreview\(false\)\}\s*className="text-slate-400 hover:text-slate-600 text-2xl"\s*>\s*×\s*<\/button>\s*<\/div>/g;

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

if(regex.test(c)) {
    c = c.replace(regex, newModalTop);
    fs.writeFileSync(p, c);
    console.log('UI updated successfully.');
} else {
    console.log('Could not find the target string by regex.');
}
