const fs = require('fs');
let code = fs.readFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', 'utf-8');

const regex = /<input[^>]+value=\{kbMemoSuffix\}[^>]+\/>\s*<\/div>/;

const replacement = `<input
                                        type="text"
                                        value={kbMemoSuffix}
                                        onChange={(e) => setKbMemoSuffix(e.target.value)}
                                        className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-semibold whitespace-nowrap">이체금액:</span>
                                    <select
                                        className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                        value={kbAmountType}
                                        onChange={(e) => setKbAmountType(e.target.value)}
                                    >
                                        <option value="totalAmount">실지급액 (전체)</option>
                                        <option value="invoiceNet">공제후 법인총액</option>
                                        <option value="laborNet">공제후 노무총액</option>
                                        <option value="invoiceAdvance">법인가불 총액</option>
                                        <option value="laborAdvance">노무가불 총액</option>
                                    </select>
                                </div>`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', code);
    console.log('done!');
} else {
    console.log('not found');
}
