import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { normalizeString } from '../../utils/excelUtils';
import Swal from 'sweetalert2';

const TeamMassUploader: React.FC = () => {
    const [existingTeams, setExistingTeams] = useState<Map<string, Team>>(new Map());
    const [companies, setCompanies] = useState<Map<string, Company>>(new Map());
    const [workers, setWorkers] = useState<Map<string, Worker>>(new Map());
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [tData, cData, wData] = await Promise.all([
                    teamService.getTeams(),
                    companyService.getCompanies(),
                    manpowerService.getWorkers()
                ]);

                const tMap = new Map<string, Team>();
                tData.forEach(t => tMap.set(normalizeString(t.name).toLowerCase(), t));
                setExistingTeams(tMap);

                const cMap = new Map<string, Company>();
                cData.forEach(c => {
                    if (c.id) cMap.set(normalizeString(c.name).toLowerCase(), c);
                });
                setCompanies(cMap);

                // 작업자 맵 (이름 기준 - 팀장 매칭용)
                const wMap = new Map<string, Worker>();
                wData.forEach(w => {
                    if (w.id) wMap.set(normalizeString(w.name).toLowerCase(), w);
                });
                setWorkers(wMap);
            } catch (error) {
                console.error("Error loading cache:", error);
                Swal.fire('오류', '기초 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };
        loadCache();
    }, []);

const fields: FieldDef[] = [
    { key: 'name', label: '팀명', required: true, aliases: ['팀', '팀이름'] },
    { key: 'type', label: '팀구분', required: false, aliases: ['유형', '성격', '직종'] },
    { key: 'leaderName', label: '팀장명', required: false, aliases: ['팀장', '대표'] },
    { key: 'companyName', label: '소속회사', required: false, aliases: ['회사명', '회사'] },
    { key: 'parentTeamName', label: '상위팀', required: false, aliases: ['상위'] },
    { key: 'contact', label: '연락처', required: false, aliases: ['전화번호'] },
    { key: 'status', label: '상태', required: false },
    { key: 'role', label: '주요직종', required: false, aliases: ['공종'] }
];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        const name = normalizeString(row.name);
        if (!name) {
            errors.push('팀명 필수');
            return { isValid: false, errors, warnings, status, changes };
        }

        const key = name.toLowerCase();

        // 회사 검증
        if (row.companyName) {
            const companyKey = normalizeString(row.companyName).toLowerCase();
            if (!companies.has(companyKey)) {
                warnings.push(`존재하지 않는 회사: ${row.companyName} (미지정 처리)`);
            }
        }

        // 팀장 검증 - 작업자 DB에서 검색
        if (row.leaderName) {
            const leaderKey = normalizeString(row.leaderName).toLowerCase();
            if (!workers.has(leaderKey)) {
                warnings.push(`미등록 작업자: ${row.leaderName} (팀장 ID 미지정)`);
            }
        }

        // 상위팀 검증
        if (row.parentTeamName) {
            const parentKey = normalizeString(row.parentTeamName).toLowerCase();
            if (!existingTeams.has(parentKey)) {
                warnings.push(`존재하지 않는 상위팀: ${row.parentTeamName} (미지정 처리)`);
            }
        }

        // 팀구분 검증
        if (row.type) {
            const validTypes = ['시공팀', '지원팀', '용역팀', '목수', '철근', '형틀', '콘크리트', '설비', '전기', '미장'];
            const typeVal = normalizeString(row.type);
            if (!validTypes.some(vt => typeVal.includes(vt))) {
                warnings.push(`팀구분 확인 필요: ${row.type}`);
            }
        }

        // 상태 검증
        if (row.status) {
            const validStatuses = ['active', 'waiting', 'closed', '협업중', '대기', '폐업'];
            if (!validStatuses.includes(normalizeString(row.status))) {
                warnings.push(`상태는 active/waiting/closed 중 하나입니다. (입력값: ${row.status})`);
            }
        }

        if (existingTeams.has(key)) {
            const existing = existingTeams.get(key)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                const newStr = normalizeString(newVal);
                const oldStr = normalizeString(oldVal);
                if (newStr && newStr !== oldStr) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('leaderName', row.leaderName, existing.leaderName);
            compare('companyName', row.companyName, existing.companyName);
            compare('type', row.type, existing.type);
            compare('role', row.role, existing.role);
            compare('status', row.status, existing.status);

            if (hasChanges) {
                status = 'UPDATE';
                warnings.push('기존 데이터와 다른 정보가 있습니다.');
            } else {
                status = 'IDENTICAL';
                warnings.push('기존 데이터와 동일합니다.');
            }
        }

        return { isValid: errors.length === 0, errors, warnings, status, changes };
    };

    const saveBatch = async (rows: any[], options?: { overwrite: boolean }): Promise<{ success: number; failed: number; skipped: number }> => {
        let success = 0;
        let failed = 0;
        let skipped = 0;
        const newLogs: string[] = [];

        for (const row of rows) {
            const name = normalizeString(row.name);
            if (!name) {
                failed++;
                newLogs.push(`[실패] 팀명 누락`);
                continue;
            }

            const key = name.toLowerCase();

            try {
                // 관계 해결: 회사
                let companyId: string | undefined;
                let companyName: string | undefined;
                if (row.companyName) {
                    const companyKey = normalizeString(row.companyName).toLowerCase();
                    if (companies.has(companyKey)) {
                        const c = companies.get(companyKey)!;
                        companyId = c.id;
                        companyName = c.name;
                    }
                }

                // 관계 해결: 팀장 (작업자 DB에서 검색)
                let leaderId: string | undefined;
                let leaderName: string | undefined;
                if (row.leaderName) {
                    const leaderKey = normalizeString(row.leaderName).toLowerCase();
                    if (workers.has(leaderKey)) {
                        const w = workers.get(leaderKey)!;
                        leaderId = w.id;
                        leaderName = w.name;
                    } else {
                        leaderName = normalizeString(row.leaderName);
                    }
                }

                // 관계 해결: 상위팀
                let parentTeamId: string | undefined;
                let parentTeamName: string | undefined;
                if (row.parentTeamName) {
                    const parentKey = normalizeString(row.parentTeamName).toLowerCase();
                    if (existingTeams.has(parentKey)) {
                        const p = existingTeams.get(parentKey)!;
                        parentTeamId = p.id;
                        parentTeamName = p.name;
                    }
                }

                // 상태 변환
                const statusMap: { [key: string]: Team['status'] } = {
                    '협업중': 'active',
                    '대기': 'waiting',
                    '폐업': 'closed',
                    'active': 'active',
                    'waiting': 'waiting',
                    'closed': 'closed'
                };
                const statusVal = row.status ? statusMap[normalizeString(row.status)] || 'active' : 'active';

                if (existingTeams.has(key)) {
                    if (!options?.overwrite) {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (덮어쓰기 해제됨)`);
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingTeams.get(key)!;
                    const updates: Partial<Team> = {};

                    if (row.leaderName) {
                        if (leaderId) updates.leaderId = leaderId;
                        updates.leaderName = leaderName;
                    }
                    if (row.type) updates.type = normalizeString(row.type);
                    if (row.role) updates.role = normalizeString(row.role);
                    if (row.status) updates.status = statusVal;
                    if (companyId) {
                        updates.companyId = companyId;
                        updates.companyName = companyName;
                    }
                    if (parentTeamId) {
                        updates.parentTeamId = parentTeamId;
                        updates.parentTeamName = parentTeamName;
                    }

                    if (Object.keys(updates).length > 0) {
                        await teamService.updateTeam(existing.id!, updates);
                        success++;
                        newLogs.push(`[수정] ${name}`);
                    } else {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (변경사항 없음)`);
                    }
                } else {
                    // CREATE
                    const newTeamId = await teamService.addTeam({
                        name: name,
                        leaderName: leaderName || '미지정',
                        leaderId: leaderId || '',
                        type: normalizeString(row.type) || '미지정',
                        role: normalizeString(row.role) || undefined,
                        companyId,
                        companyName,
                        parentTeamId,
                        parentTeamName,
                        memberCount: 0,
                        status: statusVal
                    });
                    success++;
                    existingTeams.set(key, { id: newTeamId, name } as Team);
                    newLogs.push(`[신규] ${name}`);
                }
            } catch (e: any) {
                console.error(e);
                failed++;
                newLogs.push(`[실패] ${name}: ${e.message || '알 수 없는 오류'}`);
            }
        }

        setLogs(prev => [...newLogs, ...prev].slice(0, 100));
        return { success, failed, skipped };
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">팀(Team) 대량 등록</h2>
            <ExcelUploadWizard
                title="팀 목록 엑셀 업로드"
                description="팀명, 팀장명, 소속회사, 팀구분 등이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={saveBatch}
        />
            {logs.length > 0 && (
                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold mb-2 text-slate-700">처리 로그</h3>
                    <div className="max-h-60 overflow-y-auto font-mono text-sm text-slate-600">
                        {logs.map((log, i) => (
                            <div key={i} className={
                                log.includes('[실패]') ? 'text-red-600' :
                                log.includes('[신규]') ? 'text-green-600' :
                                log.includes('[수정]') ? 'text-blue-600' :
                                'text-slate-500'
                            }>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamMassUploader;
