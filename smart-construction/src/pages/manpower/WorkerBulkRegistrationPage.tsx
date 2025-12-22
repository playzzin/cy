import React, { useState, useRef, useCallback, useEffect } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlus, faTrash, faPaste, faKeyboard, faInfoCircle, faCheckCircle, faExclamationTriangle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { geminiService } from '../../services/geminiService';

// Register Handsontable modules
registerAllModules();

interface WorkerRow {
    name: string;
    idNumber: string;
    contact: string;
    address: string;
    role: string;
    teamName: string;
    companyName: string;
    unitPrice: number;
    salaryModel: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

const WorkerBulkRegistrationPage: React.FC = () => {
    const hotRef = useRef<any>(null);
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<any[]>([]);

    // Initial Empty Data
    const generateEmptyRows = (count: number): WorkerRow[] => {
        return Array(count).fill(null).map(() => ({
            name: '',
            idNumber: '',
            contact: '',
            address: '',
            role: '조공',
            teamName: '',
            companyName: '',
            unitPrice: 0,
            salaryModel: '일급제',
            bankName: '',
            accountNumber: '',
            accountHolder: ''
        }));
    };

    const [data, setData] = useState<WorkerRow[]>(generateEmptyRows(20));

    useEffect(() => {
        loadTeams();

        // Custom Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const loadTeams = async () => {
        const teamsData = await teamService.getTeams();
        setTeams(teamsData);
    };

    const handleSave = async () => {
        // Filter valid rows (must have Name and ID Number)
        const validRows = data.filter(row => row.name && row.name.trim() !== '' && row.idNumber && row.idNumber.trim() !== '');

        if (validRows.length === 0) {
            Swal.fire('알림', '저장할 데이터가 없습니다. (이름, 주민번호 필수)', 'warning');
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const row of validRows) {
                try {
                    // Determine team type based on input or logic
                    const teamType = row.teamName ? '팀소속' : '미배정';

                    await manpowerService.addWorker({
                        name: row.name,
                        idNumber: row.idNumber,
                        contact: row.contact || '',
                        address: row.address || '',
                        role: row.role || '조공',
                        teamName: row.teamName || '',
                        companyName: row.companyName || '',
                        leaderName: '', // Optional or inferred
                        teamType: teamType,
                        status: '재직',
                        unitPrice: Number(row.unitPrice) || 0,
                        salaryModel: row.salaryModel || '일급제',
                        bankName: row.bankName || '',
                        accountNumber: row.accountNumber || '',
                        accountHolder: row.accountHolder || row.name
                    }, false); // false = batch mode (no individual toast)
                    successCount++;
                } catch (err) {
                    console.error('Row failed', row, err);
                    failCount++;
                }
            }
            Swal.fire({
                title: '저장 완료',
                text: `성공: ${successCount}건, 실패: ${failCount}건`,
                icon: failCount > 0 ? 'warning' : 'success'
            });

            // Clear or Keep? Usually keep for review, but maybe clear succeed ones?
            // For now, reload empty
            if (successCount > 0 && failCount === 0) {
                setData(generateEmptyRows(20));
            }

        } catch (error) {
            console.error(error);
            Swal.fire('오류', '저장 중 문제가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Kakao/Text Parsing Logic
    const handlePasteSpecial = async () => {
        const apiKey = geminiService.getKey();
        const { value: formValues } = await Swal.fire({
            title: '카톡/텍스트 붙여넣기',
            html: `
                <textarea id="swal-input-text" class="swal2-textarea" placeholder="카톡 내용, 엑셀 텍스트, 또는 문장형 데이터를 붙여넣으세요..." style="height: 200px; width: 90%;"></textarea>
                <div style="margin-top: 15px; text-align: left; padding: 0 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="swal-input-use-ai" ${apiKey ? 'checked' : ''}>
                        <span style="font-weight: bold; color: #4f46e5;">Google Gemini AI 분석 사용 (추천)</span>
                    </label>
                    <p style="font-size: 0.85em; color: #64748b; margin-top: 4px; margin-left: 24px;">
                        AI를 사용하면 문맥을 파악하여 훨씬 정확하게 데이터를 추출합니다.
                    </p>
                    ${!apiKey ? '<p style="color: red; font-size: 0.8em; margin-top: 5px; margin-left: 24px;">⚠ API Key가 설정되지 않았습니다. 설정 페이지에서 키를 입력해주세요.</p>' : ''}
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '분석 및 적용',
            cancelButtonText: '취소',
            width: 600,
            preConfirm: () => {
                return {
                    text: (document.getElementById('swal-input-text') as HTMLTextAreaElement).value,
                    useAI: (document.getElementById('swal-input-use-ai') as HTMLInputElement).checked
                }
            }
        });

        if (formValues && formValues.text) {
            if (formValues.useAI) {
                if (!apiKey) {
                    Swal.fire('API Key 없음', 'Gemini API Key가 설정되지 않았습니다. 단순 패턴 분석으로 진행합니다.', 'warning');
                    parseAndPopulateRegex(formValues.text);
                    return;
                }

                setLoading(true);
                try {
                    const parsedData = await geminiService.analyzeWorkerRegistrationText(formValues.text);
                    applyParsedRows(parsedData);
                    Swal.fire({
                        title: 'AI 분석 완료',
                        text: `${parsedData.length}명의 데이터를 성공적으로 추출했습니다.`,
                        icon: 'success',
                        timer: 1500
                    });
                } catch (error) {
                    console.error("AI Analysis Failed", error);
                    let errMsg = '알 수 없는 오류';
                    if (error instanceof Error) errMsg = error.message;

                    Swal.fire({
                        title: 'AI 분석 실패',
                        text: `오류: ${errMsg}\n단순 패턴 분석을 대신 시도합니다.`,
                        icon: 'error'
                    }).then(() => {
                        parseAndPopulateRegex(formValues.text);
                    });
                } finally {
                    setLoading(false);
                }
            } else {
                parseAndPopulateRegex(formValues.text);
            }
        }
    };

    const applyParsedRows = (parsedItems: any[]) => {
        const newRows: WorkerRow[] = [...data];
        let insertIndex = 0;

        // Find first empty row
        while (insertIndex < newRows.length && newRows[insertIndex].name) {
            insertIndex++;
        }

        // If not enough space, expand
        if (insertIndex + parsedItems.length > newRows.length) {
            const needed = (insertIndex + parsedItems.length) - newRows.length;
            newRows.push(...generateEmptyRows(needed + 5));
        }

        parsedItems.forEach(item => {
            newRows[insertIndex] = {
                ...newRows[insertIndex],
                name: item.name || '',
                idNumber: item.idNumber || '',
                contact: item.contact || '',
                address: item.address || '',
                role: item.role || '조공',
                teamName: item.teamName || '',
                companyName: item.companyName || '',
                unitPrice: Number(item.unitPrice) || 0,
                salaryModel: item.salaryModel || '일급제',
                bankName: item.bankName || '',
                accountNumber: item.accountNumber || '',
                accountHolder: item.accountHolder || item.name || ''
            };
            insertIndex++;
        });

        setData(newRows);
    };

    const parseAndPopulateRegex = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim());
        const parsedItems: any[] = [];

        lines.forEach(line => {
            const spaceParts = line.split(/[\s,]+/);

            let name = '';
            let idNum = '';
            let contact = '';
            let role = '';

            spaceParts.forEach(part => {
                if (!name && /^[가-힣]{2,5}$/.test(part)) name = part;
                else if (!idNum && /(\d{6}[-]?\d{7})/.test(part)) idNum = part;
                else if (!contact && /010[-]?\d{3,4}[-]?\d{4}/.test(part)) contact = part;
                else if (!role && ['기공', '조공', '팀장', '준기공'].includes(part)) role = part;
            });

            if (name || idNum) {
                parsedItems.push({ name, idNumber: idNum, contact, role });
            }
        });

        if (parsedItems.length > 0) {
            applyParsedRows(parsedItems);
            Swal.fire('완료', `${parsedItems.length}건을 단순 분석했습니다.`, 'success');
        } else {
            Swal.fire('결과 없음', '인식된 데이터가 없습니다. 형식을 확인해주세요.', 'info');
        }
    };

    const addMoreRows = () => {
        setData(prev => [...prev, ...generateEmptyRows(10)]);
    };

    const clearData = () => {
        Swal.fire({
            title: '초기화 하시겠습니까?',
            text: "입력된 모든 데이터가 삭제됩니다.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: '예, 초기화합니다'
        }).then((result) => {
            if (result.isConfirmed) {
                setData(generateEmptyRows(20));
            }
        });
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <FontAwesomeIcon icon={faKeyboard} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">작업자 엑셀/그리드 대량 등록</h1>
                        <p className="text-sm text-slate-500">엑셀처럼 입력하고 단축키(Ctrl+S)로 저장하세요.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePasteSpecial} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold rounded-lg transition-colors flex items-center gap-2">
                        <FontAwesomeIcon icon={faPaste} />
                        카톡/텍스트 분석
                    </button>
                    <button onClick={addMoreRows} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-2">
                        <FontAwesomeIcon icon={faPlus} />
                        행 추가
                    </button>
                    <button onClick={clearData} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors flex items-center gap-2">
                        <FontAwesomeIcon icon={faTrash} />
                        초기화
                    </button>
                    <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2">
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        일괄 저장
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200 relative">
                <HotTable
                    ref={hotRef}
                    data={data}
                    colHeaders={['이름(필수)', '주민번호(필수)', '연락처', '주소', '공종', '팀명', '소속회사', '단가', '급여형태', '은행명', '계좌번호', '예금주']}
                    columns={[
                        { data: 'name', type: 'text' },
                        { data: 'idNumber', type: 'text' },
                        { data: 'contact', type: 'text' },
                        { data: 'address', type: 'text' },
                        { data: 'role', type: 'dropdown', source: ['기공', '조공', '팀장', '준기공'] },
                        { data: 'teamName', type: 'text' }, // Could be dropdown from teams
                        { data: 'companyName', type: 'text' },
                        { data: 'unitPrice', type: 'numeric', numericFormat: { pattern: '0,0' } },
                        { data: 'salaryModel', type: 'dropdown', source: ['일급제', '주급제', '월급제'] },
                        { data: 'bankName', type: 'text' },
                        { data: 'accountNumber', type: 'text' },
                        { data: 'accountHolder', type: 'text' },
                    ]}
                    rowHeaders={true}
                    width="100%"
                    height="100%"
                    stretchH="all"
                    contextMenu={true}
                    autoWrapRow={true}
                    autoWrapCol={true}
                    licenseKey="non-commercial-and-evaluation"
                    minSpareRows={1}
                />
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="mt-2 text-xs text-slate-400 text-right">
                <span className="mr-3">💡 <strong>Ctrl+C / Ctrl+V</strong>: 엑셀 복사/붙여넣기</span>
                <span className="mr-3">💡 <strong>Ctrl+S</strong>: 저장</span>
            </div>
        </div>
    );
};

export default WorkerBulkRegistrationPage;
