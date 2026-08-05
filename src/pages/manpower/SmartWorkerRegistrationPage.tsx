import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaste, faSave, faCheckCircle, faExclamationTriangle, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { manpowerService } from '../../services/manpowerService';
import Swal from 'sweetalert2';
import { teamService } from '../../services/teamService';

// Field Mapping Configuration
const FIELD_MAPPING: { [key: string]: string[] } = {
    name: ['이름', '성명', '근로자명', '작업자명'],
    idNumber: ['주민번호', '주민등록번호', '주민'],
    contact: ['연락처', '전화번호', '휴대폰', '전화'],
    address: ['주소', '거주지'],
    bankName: ['은행', '은행명'],
    accountNumber: ['계좌번호', '계좌'],
    accountHolder: ['예금주', '예금주명'],
    role: ['공종', '직종', '역할', '직책'],
    teamName: ['팀', '팀명', '소속', '업체'],
    companyName: ['회사', '회사명', '소속회사', '업체명'],
    leaderName: ['팀장', '팀장명', '직반장', '대표', '대표자'],
    unitPrice: ['단가', '일당', '임금'],
    payType: ['급여', '급여형태', '지급유형', '임금형태'],
    teamType: ['팀구분', '소속구분'],
    category: ['구분', '분류', '타입', '비고', '참고사항'] // New generic category
};

const FIELD_LABELS: { [key: string]: string } = {
    name: '이름',
    idNumber: '주민번호',
    contact: '연락처',
    address: '주소',
    bankName: '은행',
    accountNumber: '계좌번호',
    accountHolder: '예금주',
    role: '공종',
    teamName: '팀명',
    companyName: '회사명',
    leaderName: '대표',
    unitPrice: '단가',
    payType: '급여형태',
    teamType: '팀구분',
    category: '통합구분'
};

// Team Field Mapping
const TEAM_FIELD_MAPPING: { [key: string]: string[] } = {
    name: ['팀', '팀명', '팀이름', '업체', '업체명'],
    leaderName: ['팀장', '팀장명', '대표', '대표자', '직반장'],
    companyName: ['회사', '회사명', '소속회사'],
    type: ['팀구분', '구분', '유형', '팀타입'],
    contact: ['연락처', '전화번호', '팀장연락처']
};

const TEAM_FIELD_LABELS: { [key: string]: string } = {
    name: '팀명',
    leaderName: '팀장명',
    companyName: '소속회사',
    type: '팀구분',
    contact: '연락처'
};



const SmartWorkerRegistrationPage: React.FC = () => {
    const [registrationMode, setRegistrationMode] = useState<'worker' | 'team'>('worker');
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
        const currentMapping = registrationMode === 'worker' ? FIELD_MAPPING : TEAM_FIELD_MAPPING;

        headerRow.forEach((header, index) => {
            const cleanHeader = header.trim().normalize('NFC').replace(/\s+/g, '');
            let bestMatchField = '';
            let maxMatchLength = 0;
            let exactMatchFound = false;

            for (const [field, synonyms] of Object.entries(currentMapping)) {
                if (exactMatchFound) break;

                for (const synonym of synonyms) {
                    // Exact Match Priority
                    if (cleanHeader === synonym) {
                        bestMatchField = field;
                        exactMatchFound = true;
                        break;
                    }

                    // Longest Partial Match
                    if (cleanHeader.includes(synonym)) {
                        if (synonym.length > maxMatchLength) {
                            maxMatchLength = synonym.length;
                            bestMatchField = field;
                        }
                    }
                }
            }

            if (bestMatchField) {
                newMapping[index] = bestMatchField;
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

            if (registrationMode === 'worker') {
                // Smart Category Parsing (Handle mixed data)
                if (rowData.category) {
                    const cat = rowData.category.trim();

                    // Check for Salary Model keywords
                    if (['일급', '일급제', '주급', '주급제', '월급', '월급제', '지원', '지원팀', '용역', '용역팀'].some(k => cat.includes(k))) {
                        if (!rowData.salaryModel) {
                            if (cat.includes('일급')) rowData.salaryModel = '일급제';
                            else if (cat.includes('주급')) rowData.salaryModel = '주급제';
                            else if (cat.includes('월급')) rowData.salaryModel = '월급제';
                            else if (cat.includes('지원')) rowData.salaryModel = '지원팀';
                            else if (cat.includes('용역')) rowData.salaryModel = '용역팀';
                        }
                    }

                    // Check for Team Type keywords
                    if (['직영', '직영팀', '시공', '시공팀'].some(k => cat.includes(k))) {
                        if (!rowData.teamType) {
                            if (cat.includes('직영')) rowData.teamType = '직영팀';
                            else if (cat.includes('시공')) rowData.teamType = '시공팀';
                        }
                    }
                }

                // Validation for Worker
                if (!rowData.name) {
                    rowData._valid = false;
                    rowData._errors.push('이름 누락');
                }
                if (!rowData.idNumber) {
                    rowData._valid = false;
                    rowData._errors.push('주민번호 누락');
                }
            } else {
                // Validation for Team
                if (!rowData.name) {
                    rowData._valid = false;
                    rowData._errors.push('팀명 누락');
                }
            }

            return rowData;
        });

        setParsedData(dataRows);
    };

    // Re-parse when mode changes
    React.useEffect(() => {
        if (pasteData) {
            parseData(pasteData);
        }
    }, [registrationMode]);

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
                    if (registrationMode === 'worker') {
                        await manpowerService.addWorker({
                            name: row.name,
                            idNumber: row.idNumber,
                            contact: row.contact || '',
                            address: row.address || '',
                            bankName: row.bankName || '',
                            accountNumber: row.accountNumber || '',
                            accountHolder: row.accountHolder || row.name,
                            role: row.role || '조공',
                            teamName: row.teamName || '',
                            companyName: row.companyName || '',
                            leaderName: row.leaderName || '',
                            teamType: row.teamType || (row.teamName ? '팀소속' : '미배정'),
                            status: '재직',
                            unitPrice: parseInt(row.unitPrice?.replace(/,/g, '')) || 0,
                            salaryModel: row.salaryModel || '일급제'
                        }, false);
                    } else {
                        // Team Registration
                        await teamService.addTeam({
                            name: row.name,
                            leaderName: row.leaderName || '',
                            leaderId: '', // Cannot resolve ID automatically in bulk
                            companyName: row.companyName || '',
                            type: row.type || (row.name.includes('지원') ? '지원팀' : '일반팀'),
                            memberCount: 0,
                            totalManDay: 0
                        });
                    }
                    successCount++;
                } catch (error) {
                    console.error("Failed to add item:", row.name, error);
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
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header - Full Width */}
            {/* Header & Toolbar - Single Row */}
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                        <FontAwesomeIcon icon={faPaste} className="text-blue-600" />
                        {registrationMode === 'worker' ? '작업자 대량 등록' : '팀 대량 등록'} (Smart Excel)
                    </h2>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setRegistrationMode('worker')}
                            className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${registrationMode === 'worker' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            작업자 등록
                        </button>
                        <button
                            onClick={() => setRegistrationMode('team')}
                            className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${registrationMode === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            팀 등록
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading || parsedData.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ml-auto xl:ml-0 ${registrationMode === 'worker' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        <span className="hidden sm:inline">일괄 등록하기</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 overflow-auto">
                <div className={`mb-6 border rounded-lg p-4 ${registrationMode === 'worker' ? 'bg-blue-50 border-blue-200' : 'bg-indigo-50 border-indigo-200'}`}>
                    <h3 className={`font-bold mb-2 ${registrationMode === 'worker' ? 'text-blue-800' : 'text-indigo-800'}`}>💡 사용 방법 ({registrationMode === 'worker' ? '작업자' : '팀'} 등록)</h3>
                    <ul className={`list-disc list-inside text-sm space-y-1 ${registrationMode === 'worker' ? 'text-blue-700' : 'text-indigo-700'}`}>
                        <li>엑셀에서 <strong>헤더(항목 이름)를 포함하여</strong> 데이터를 복사한 후 아래 입력창에 붙여넣으세요.</li>
                        <li>시스템이 헤더 이름을 분석하여 자동으로 항목을 매핑합니다.</li>
                        {registrationMode === 'worker' ? (
                            <>
                                <li><strong>필수 항목:</strong> 이름, 주민번호</li>
                                <li><strong>지원 항목:</strong> 이름, 주민번호, 연락처, 주소, 은행명, 계좌번호, 예금주, 공종, 팀명, 회사명, 단가, 급여형태, 팀구분</li>
                            </>
                        ) : (
                            <>
                                <li><strong>필수 항목:</strong> 팀명</li>
                                <li><strong>지원 항목:</strong> 팀명, 팀장명(대표), 소속회사, 팀구분(지원팀/일반팀), 연락처</li>
                            </>
                        )}
                        <li><strong>통합 지원:</strong> '구분' 또는 '비고' 열에 "일급제", "지원팀" 등의 내용이 섞여 있어도 자동으로 인식하여 분류합니다.</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    {/* Input Area */}
                    <div className="lg:col-span-1 flex flex-col gap-2">
                        <label className="font-semibold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faPaste} className={registrationMode === 'worker' ? 'text-blue-500' : 'text-indigo-500'} />
                            데이터 붙여넣기
                        </label>
                        <textarea
                            className={`w-full h-full p-4 border rounded-lg focus:ring-2 resize-none font-mono text-sm ${registrationMode === 'worker' ? 'border-slate-300 focus:ring-blue-500 focus:border-blue-500' : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                            placeholder={registrationMode === 'worker'
                                ? `엑셀에서 헤더를 포함하여 복사 후 붙여넣으세요.\n\n[예시]\n이름\t주민번호\t주소\t연락처\n홍길동\t800101-1234567\t서울시 강남구\t010-1234-5678`
                                : `엑셀에서 헤더를 포함하여 복사 후 붙여넣으세요.\n\n[예시]\n팀명\t팀장명\t소속회사\t팀구분\nA팀\t김철수\t현대건설\t시공팀`
                            }
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
                                                            <span className={`text-xs px-1.5 py-0.5 rounded border ${registrationMode === 'worker' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                                                                → {(registrationMode === 'worker' ? FIELD_LABELS : TEAM_FIELD_LABELS)[mappedFields[idx]]}
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

export default SmartWorkerRegistrationPage;
