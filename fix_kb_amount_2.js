const fs = require('fs');
let code = fs.readFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', 'utf-8');

const newGetKBPreviewData = `const getKBPreviewData = () => {
        const sumSideAdvances = (side: any) => {
            if (!side) return 0;
            const toNum = (v: any) => typeof v === 'number' && !isNaN(v) ? v : 0;
            return toNum(side.carry) + toNum(side.carrySecond) + toNum(side.currentAdvance) + toNum(side.currentAdvanceSecond);
        };

        return filteredPaymentData.map((item) => {
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

            let memo = kbMemoSuffix;
            if (memo.includes('{이름}')) {
                memo = memo.replace('{이름}', item.workerName);
            } else if (memo.startsWith(' ')) { // Legacy prefix
                memo = item.workerName + memo;
            } else if (!memo) {
                memo = item.workerName;
            }

            return {
                은행코드: item.bankCode,
                계좌번호: item.accountNumber,
                이체금액: amount,
                받는분통장표시: kbReceiverDisplay,
                내통장메모: memo
            };
        });
    };`;

code = code.replace(/const getKBPreviewData\s*=\s*\(\)\s*=>\s*\{[\s\S]*?return filteredPaymentData\.map\([\s\S]*?\}\)\);\s*\};/, newGetKBPreviewData);

fs.writeFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', code);
console.log('done modifying MonthlyWageDraftPage');
