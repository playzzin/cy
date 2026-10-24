import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaste, faSave, faCheckCircle, faExclamationTriangle, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { teamService } from '../../services/teamService';
import Swal from 'sweetalert2';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { parseTeamImport, resolveTeamImportRow, TEAM_IMPORT_LABELS as FIELD_LABELS, TeamImportField, TeamImportRow } from '../../features/team-registration/teamImport';

const SmartTeamRegistrationPage: React.FC = () => {
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState<TeamImportRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappedFields, setMappedFields] = useState<Partial<Record<number, TeamImportField>>>({});
    const [loading, setLoading] = useState(false);
    const saving = useRef(false);

    const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const parsed = parseTeamImport(text);
        setPasteData(text);
        setHeaders(parsed.headers);
        setMappedFields(parsed.mappedFields);
        setParsedData(parsed.rows);
    };

    const handleSave = async () => {
        if (saving.current || !parsedData.length || parsedData.some(row => !row._valid)) return;
        saving.current = true;
        setLoading(true);
        try {
            const [teams, workers, companies] = await Promise.all([
                teamService.getTeams(),
                parsedData.some(row => row.leaderName) ? manpowerService.getWorkers() : Promise.resolve([]),
                parsedData.some(row => row.companyName) ? companyService.getCompanies() : Promise.resolve([]),
            ]);
            const references = { teams, workers, companies };
            const prepared = parsedData.map(row => {
                try { return { row, payload: resolveTeamImportRow(row, references) }; }
                catch (error) { return { row: { ...row, _valid: false, _errors: [error instanceof Error ? error.message : '연결 정보를 확인해 주세요.'] }, payload: null }; }
            });
            if (prepared.some(item => !item.payload)) {
                setParsedData(prepared.map(item => item.row));
                return;
            }
            const failed: TeamImportRow[] = [];
            for (const { row, payload } of prepared) {
                try { await teamService.addTeam(payload!); }
                catch { failed.push({ ...row, _errors: ['저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'] }); }
            }
            setParsedData(failed);
            setPasteData(failed.length ? [headers.join('\t'), ...failed.map(row => headers.map((_, index) => {
                const field = mappedFields[index];
                return field ? row[field] || '' : '';
            }).join('\t'))].join('\n') : '');
            if (!failed.length) setHeaders([]);
            await Swal.fire({ title: failed.length ? '일부 등록 실패' : '등록 완료',
                text: '성공: ' + (prepared.length - failed.length) + '건, 실패: ' + failed.length + '건. 실패한 행은 화면에 남겨두었습니다.',
                icon: failed.length ? 'warning' : 'success' });
        } catch {
            await Swal.fire('조회 실패', '기존 팀과 연결 정보를 불러오지 못했습니다. 등록하지 않았으니 잠시 후 다시 시도해 주세요.', 'error');
        } finally {
            saving.current = false;
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
                        disabled={loading || parsedData.length === 0 || parsedData.some(row => !row._valid)}
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

                {parsedData.some(row => row._errors.length) && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                    {parsedData.map((row, index) => row._errors.length ? <p key={index}>{index + 1}행: {row._errors.join(' ')}</p> : null)}
                    <p>입력 내용을 수정한 후 다시 등록해 주세요.</p>
                </div>}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                    {/* Input Area */}
                    <div className="lg:col-span-1 flex flex-col gap-2">
                        <label className="font-semibold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faPaste} className="text-blue-500" />
                            데이터 붙여넣기
                        </label>
                        <textarea
                            aria-label="팀 등록 데이터"
                            disabled={loading}
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
                                                                → {FIELD_LABELS[mappedFields[idx]!]}
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
