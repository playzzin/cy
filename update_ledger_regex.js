const fs = require('fs');
const filePath = 'c:/Users/playz/cy/src/pages/payroll/components/MonthlyAdvanceLedger.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const topRegex = /<td rowSpan=\{2\} className="border border-slate-300 px-1 text-center bg-white">\s*<select\s*value=\{row\.manual\.assignmentType \?\? row\.assignmentType \?\? 'labor'\}\s*onChange=\{\(e\) => updateAssignmentType\(row\.rowKey, e\.target\.value as 'corporate' \| 'labor'\)\}\s*className="[^"]*"\s*>\s*<option value="corporate">법인 \(Invoice\)<\/option>\s*<option value="labor">노무 \(Labor\)<\/option>\s*<\/select>\s*<\/td>/;

const newTop = `<td className="border border-slate-300 px-1.5 py-1 text-center bg-blue-50/20">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer h-full">
                                                        <input 
                                                            type="radio" 
                                                            name={\`assign-\${row.rowKey}\`}
                                                            checked={(row.manual.assignmentType ?? row.assignmentType ?? 'labor') === 'corporate'}
                                                            onChange={() => updateAssignmentType(row.rowKey, 'corporate')}
                                                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-[11px] font-bold text-blue-800 tracking-wide">법인</span>
                                                    </label>
                                                </td>`;

if(topRegex.test(content)) {
    content = content.replace(topRegex, newTop);
    console.log('Top replaced!');
} else {
    console.log('Top not matched!');
}

const bottomRegex = /<tr className="odd:bg-white even:bg-slate-50\/60">\s*<td className="border border-slate-300 px-2 text-right bg-yellow-300 font-bold">\{formatManDay\(row\.laborManDay\)\}<\/td>/g;

const newBottom = `<tr className="odd:bg-white even:bg-slate-50/60">
                                                <td className="border border-slate-300 px-1.5 py-1 text-center bg-emerald-50/20">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer h-full">
                                                        <input 
                                                            type="radio" 
                                                            name={\`assign-\${row.rowKey}\`}
                                                            checked={(row.manual.assignmentType ?? row.assignmentType ?? 'labor') === 'labor'}
                                                            onChange={() => updateAssignmentType(row.rowKey, 'labor')}
                                                            className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                        <span className="text-[11px] font-bold text-emerald-800 tracking-wide">노무</span>
                                                    </label>
                                                </td>
                                                <td className="border border-slate-300 px-2 text-right bg-yellow-300 font-bold">{formatManDay(row.laborManDay)}</td>`;

if(bottomRegex.test(content)) {
    content = content.replace(bottomRegex, newBottom);
    console.log('Bottom replaced!');
} else {
    console.log('Bottom not matched!');
}

fs.writeFileSync(filePath, content, 'utf8');
