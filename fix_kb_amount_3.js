const fs = require('fs');
let code = fs.readFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', 'utf-8');

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

code = code.replace(/<Input[^>]+value=\{kbMemoSuffix\}[^>]*\/>\s*<\/InputGroup>/, newModalInputs);

fs.writeFileSync('src/pages/payroll/MonthlyWageDraftPage.tsx', code);
console.log('done!');
