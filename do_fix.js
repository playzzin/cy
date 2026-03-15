const fs = require('fs');
let code = fs.readFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', 'utf-8');

if (!code.includes('rowKey: string;')) {
    code = code.replace(/interface PaymentData \{/, 'interface PaymentData {\n    rowKey: string;');
}
if (!code.includes('rowKey: `${agg.month}__${agg.workerId}__${agg.teamId}__${agg.salaryModel}`,')) {
    code = code.replace(/processedData\.push\(\{/, 'processedData.push({\n                        rowKey: `${agg.month}__${agg.workerId}__${agg.teamId}__${agg.salaryModel}`,');
}

if (!code.includes('const [kbAmountType, setKbAmountType]')) {
    code = code.replace(/const \[kbMemoSuffix, setKbMemoSuffix\][^;]+;/, 'const [kbMemoSuffix, setKbMemoSuffix] = useState<string>(\'{이름} 가불\');\n    const [kbAmountType, setKbAmountType] = useState<string>(\'totalAmount\');');
}

const newGetKBPreviewData = `const getKBPreviewData = () => {
        const sumSideAdvances = (side: any) => {
            if (!side) return 0;
            const toNum = (v: any) => typeof v === 'number' && !isNaN(v) ? v : 0;
            return toNum(side.carry) + toNum(side.carrySecond) + toNum(side.currentAdvance) + toNum(side.currentAdvanceSecond);
        };

        return filteredPaymentData.map((item, index) => {
            let amount = item.totalAmount;
            if (kbAmountType === 'invoiceNet') {
                amount = item.invoiceNetAmount || 0;
            } else if (kbAmountType === 'laborNet') {
                amount = item.laborNetAmount || 0;
            } else if (kbAmountType === 'invoiceAdvance') {
                const manual = ledgerInputs[item.rowKey];
                amount = manual ? sumSideAdvances(manual.invoice) : 0;
            } else if (kbAmountType === 'laborAdvance') {
                const manual = ledgerInputs[item.rowKey];
                amount = manual ? sumSideAdvances(manual.labor) : 0;
            }

            return {
                index: index + 1,
                date: '',
                bankName: item.bankName,
                accountNumber: item.accountNumber,
                amount: amount,
                fee: 0,
                sender: bulkSender,
                senderDisplay: '',
                memo: kbMemoSuffix ? kbMemoSuffix.replace('{이름}', item.workerName) : \`\${item.month.split('-')[1]}월급여\`,
                receiverDisplay: kbReceiverDisplay,
                companyNumber: '',
                cmsCode: '',
                salaryTarget: '',
                accountHolder: item.accountHolder,
                companyId: item.companyId,
                companyName: item.companyName,
                workerId: item.workerId,
                workerName: item.workerName,
                teamName: item.teamName,
            };
        });
    };`;
code = code.replace(/const getKBPreviewData\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?return filteredPaymentData\.map\(\(item,\s*index\)\s*=>\s*\{[\s\S]*?\}\);\s*\};/, newGetKBPreviewData);

const newModalInputs = `<Input
                                type="text"
                                size="sm"
                                value={kbMemoSuffix}
                                onChange={(e) => setKbMemoSuffix(e.target.value)}
                                placeholder="예: {이름} 가불"
                            />
                        </InputGroup>
                        <div className="flex items-center space-x-4 mb-4">
                            <span className="w-32 text-sm font-semibold">이체금액 적용:</span>
                            <Radio.Group inline value={kbAmountType} onChange={(val) => setKbAmountType(val.toString())}>
                                <Radio value="totalAmount">실지급액 (전체)</Radio>
                                <Radio value="invoiceNet">공제후 법인총액</Radio>
                                <Radio value="laborNet">공제후 노무총액</Radio>
                                <Radio value="invoiceAdvance">법인가불 총액</Radio>
                                <Radio value="laborAdvance">노무가불 총액</Radio>
                            </Radio.Group>
                        </div>`;
code = code.replace(/<Input[^>]+value=\{kbMemoSuffix\}[^>]+onChange=\{\(e\)\s*=>\s*setKbMemoSuffix\(e\.target\.value\)\}[^>]+placeholder="예:\s*\{이름\}\s*가불"[\s\S]*?\/>\s*<\/InputGroup>/, newModalInputs);

if (!code.match(/<MonthlyAdvanceLedger[^>]+onInputsChange=\{setLedgerInputs\}[^>]*\/>/)) {
    code = code.replace(/<MonthlyAdvanceLedger([\s\S]*?)\/>/, '<MonthlyAdvanceLedger$1 onInputsChange={setLedgerInputs} />');
}

fs.writeFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', code);
console.log('done modifying MonthlyWageDraftPage');
