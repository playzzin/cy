const fs = require('fs');
let p = 'src/pages/payroll/MonthlyWageDraftPage.tsx';
let c = fs.readFileSync(p, 'utf-8');
c = c.replace(/    const \[kbReceiverDisplay, setKbReceiverDisplay\] = useState<string>\('㈜다원'\);\r?\n    const \[kbMemoSuffix, setKbMemoSuffix\] = useState<string>\(' 가불'\);\r?\n/, '');
fs.writeFileSync(p, c);
console.log('Fixed');