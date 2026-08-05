import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaste, faSave, faCheckCircle, faExclamationTriangle, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { teamService } from '../../services/teamService';
import Swal from 'sweetalert2';

// Field Mapping Configuration
const FIELD_MAPPING: { [key: string]: string[] } = {
    name: ['팀명', '팀이름', '팀'],
    type: ['팀구분', '유형', '구분', '성격', '팀성격'],
    leaderName: ['팀장', '팀장명', '대표'],
    companyName: ['소속회사', '회사명', '회사'],
    parentTeamName: ['상위팀', '원청팀']
};

const FIELD_LABELS: { [key: string]: string } = {
    name: '팀명',
    type: '팀구분',
    leaderName: '팀장명',
    companyName: '소속회사',
    parentTeamName: '상위팀'
};

const SmartTeamRegistrationPage: React.FC = () => {
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappedFields, setMappedFields] = useState<{ [index: number]: string }>({});
    const [loading, setLoading] = useState(false);

    const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setPasteData(text);
        parseData(text);
    };

    const parseData = (text: string) => {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return;

        // Detect delimiter based on the first line
        const firstLine = lines[0];
        let delimiter = '\t';
        if (!firstLine.includes('\t') && firstLine.match(/\s{2,}/)) {
            delimiter = '   '; // Use a regex or special marker for multiple spaces
        }

        const rows = lines.map(row => {
            if (delimiter === '   ') {
                return row.split(/\s{2,}/);
            }
            return row.split(delimiter);
        });
        if (rows.length === 0) return;

        // Assume first row is header
        const headerRow = rows[0];
        setHeaders(headerRow);

        // Auto-map headers
        const newMapping: { [index: number]: string } = {};
        headerRow.forEach((header, index) => {
            const cleanHeader = header.trim().replace(/\s+/g, '');
            for (const [field, synonyms] of Object.entries(FIELD_MAPPING)) {
                if (synonyms.some(s => cleanHeader.includes(s))) {
                    newMapping[index] = field;
                    break;
                }
            }
        });
        setMappedFields(newMapping);

        // Parse data rows
        const dataRows = rows.slice(1).map((row, _index) => {
            const rowData: any = { _valid: true, _errors: [] };

            // Map values to fields
            Object.entries(newMapping).forEach(([colIndex, field]) => {
                const val = row[parseInt(colIndex)]?.trim() || '';
                rowData[field] = val;
            });

            // Validation
            if (!rowData.name) {
                rowData._valid = false;
                rowData._errors.push('팀명 누락');
            }

            return rowData;
        });

        setParsedData(dataRows);
    };

    const handleSave = async () => {
        const validRows = parsedData.filter(r => r._valid);
        if (validRows.length === 0) {
            Swal.fire('Error', '저장할 유효한 데이터가 없습니다.', 'error');
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const row of validRows) {
                try {
                    await teamService.addTeam({
                        name: row.name,
                        type: row.type || '시공팀',
                        leaderId: '', // ID lookup not implemented yet, saving name only
                        leaderName: row.leaderName || '',
                        companyName: row.companyName || '',
                        parentTeamName: row.parentTeamName || ''
                    } as any);
                    successCount++;
                } catch (error) {
                    console.error("Failed to add team:", row.name, error);
                    failCount++;
                }
            }

            Swal.fire({
                title: '완료',
                text: `성공: ${successCount}건, 실패: ${failCount}건`,
                icon: failCount > 0 ? 'warning' : 'success'
            });

            if (successCount > 0) {
                setPasteData('');
                setParsedData([]);
                setHeaders([]);
            }

        } catch (error) {
            console.error("Batch save error:", error);
            Swal.fire('Error', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">팀 대량 등록 (Smart Excel)</h1>
                        <p className="text-slate-500 mt-1">엑셀 데이터를 복사하여 붙여넣으면 자동으로 인식합니다.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={loading || parsedData.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        일괄 등록하기
                    </button>
                </div>

                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-bold text-blue-800 mb-2">💡 사용 방법</h3>
                    <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                        <li>엑셀에서 <strong>헤더(항목 이름)를 포함하여</strong> 데이터를 복사한 후 아래 입력창에 붙여넣으세요.</li>
                        <li><strong>필수 항목:</strong> 팀명</li>
                        <li><strong>지원 항목:</strong> 팀명, 팀구분(시공팀/직영팀/지원팀/용역팀), 팀장명, 소속회사, 상위팀</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    {/* Input Area */}
                    <div className="lg:col-span-1 flex flex-col gap-2">
                        <label className="font-semibold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faPaste} className="text-blue-500" />
                            데이터 붙여넣기
                        </label>
                        <textarea
                            className="w-full h-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                            placeholder={`엑셀에서 헤더를 포함하여 복사 후 붙여넣으세요.\n\n[예시]\n팀명\t팀구분\t팀장명\nA팀\t시공팀\t김반장`}
                            value={pasteData}
                            onChange={handlePaste}
                        />
                    </div>

                    {/* Preview Area */}
                    <div className="lg:col-span-2 flex flex-col gap-2 overflow-hidden">
                        <label className="font-semibold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                            미리보기 ({parsedData.length}건)
                        </label>

                        <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-slate-50">
                            {parsedData.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 border-b">상태</th>
                                            {headers.map((header, idx) => (
                                                <th key={idx} className="px-4 py-3 border-b">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-slate-700">{header}</span>
                                                        {mappedFields[idx] ? (
                                                            <span className="text-blue-600 text-xs bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                                → {FIELD_LABELS[mappedFields[idx]]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">무시됨</span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {parsedData.map((row, rowIdx) => (
                                            <tr key={rowIdx} className={row._valid ? 'hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    {row._valid ? (
                                                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-red-500" title={row._errors.join(', ')}>
                                                            <FontAwesomeIcon icon={faExclamationTriangle} />
                                                            <span className="text-xs font-bold">오류</span>
                                                        </div>
                                                    )}
                                                </td>
                                                {headers.map((_, colIdx) => {
                                                    const field = mappedFields[colIdx];
                                                    return (
                                                        <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-slate-700">
                                                            {field ? row[field] : <span className="text-slate-300">-</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FontAwesomeIcon icon={faArrowRight} className="text-4xl mb-4 opacity-20" />
                                    <p>좌측 입력창에 엑셀 데이터를 붙여넣으세요.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartTeamRegistrationPage;
