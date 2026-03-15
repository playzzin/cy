const fs = require('fs');

const path = 'c:/Users/playz/cy/src/pages/payroll/MonthlyWageDraftPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const th현장 = '<th className="px-3 py-2 text-left font-medium border-b border-slate-100">현장</th>';
const newHead = `<th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-16">분류</th>
                                                                            <th className="px-3 py-2 text-left font-medium border-b border-slate-100">현장</th>`;
content = content.replace(th현장, newHead);

const td현장 = '<td className="px-3 py-2 text-slate-700">{entry.siteName}</td>';
const newBody = `<td className="px-3 py-2">
                                                                                    {entry.assignmentType === 'corporate' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                                                            법인
                                                                                        </span>
                                                                                    ) : entry.assignmentType === 'labor' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                                                                            노무
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 text-center block">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-slate-700">{entry.siteName}</td>`;
content = content.replace(td현장, newBody);

content = content.replace('<td colSpan={3} className="px-3 py-2 text-right">합계</td>', '<td colSpan={4} className="px-3 py-2 text-right">합계</td>');
content = content.replace('<td colSpan={5} className="px-3 py-1 text-right">', '<td colSpan={6} className="px-3 py-1 text-right">');

fs.writeFileSync(path, content, 'utf8');
console.log('Done');