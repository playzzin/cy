import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { normalizeString, formatExcelDate } from '../../utils/excelUtils';
import Swal from 'sweetalert2';

const SiteMassUploader: React.FC = () => {
    const [existingSites, setExistingSites] = useState<Map<string, Site>>(new Map());
    const [companies, setCompanies] = useState<Map<string, Company>>(new Map());
    const [teams, setTeams] = useState<Map<string, Team>>(new Map());
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [sData, cData, tData] = await Promise.all([
                    siteService.getSites(),
                    companyService.getCompanies(),
                    teamService.getTeams()
                ]);

                const sMap = new Map<string, Site>();
                sData.forEach(s => sMap.set(normalizeString(s.name).toLowerCase(), s));
                setExistingSites(sMap);

                const cMap = new Map<string, Company>();
                cData.forEach(c => { if (c.id) cMap.set(normalizeString(c.name).toLowerCase(), c); });
                setCompanies(cMap);

                const tMap = new Map<string, Team>();
                tData.forEach(t => { if (t.id) tMap.set(normalizeString(t.name).toLowerCase(), t); });
                setTeams(tMap);
            } catch (error) {
                console.error("Error loading cache:", error);
                Swal.fire('오류', '기초 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };
        loadCache();
    }, []);

const fields: FieldDef[] = [
    { key: 'name', label: '현장명', required: true, aliases: ['현장', '공사명'] },
    { key: 'code', label: '현장코드', required: false },
    { key: 'address', label: '주소', required: false },
    { key: 'companyName', label: '회사명', required: false, aliases: ['발주처', '시공사'] },
    { key: 'responsibleTeamName', label: '담당팀', required: false, aliases: ['해당팀', '현장담당'] },
    { key: 'siteType', label: '현장유형', required: false, aliases: ['구분'] },
    { key: 'status', label: '상태', required: false },
    { key: 'startDate', label: '착공일', required: false },
    { key: 'endDate', label: '준공일', required: false }
];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        const name = normalizeString(row.name);
        if (!name) {
            errors.push('현장명 필수');
            return { isValid: false, errors, warnings, status, changes };
        }

        const key = name.toLowerCase();

        // 관계 검증
        if (row.companyName) {
            const companyKey = normalizeString(row.companyName).toLowerCase();
            if (!companies.has(companyKey)) {
                warnings.push(`존재하지 않는 회사: ${row.companyName} (미지정 처리)`);
            }
        }
        if (row.responsibleTeamName) {
            const teamKey = normalizeString(row.responsibleTeamName).toLowerCase();
            if (!teams.has(teamKey)) {
                warnings.push(`존재하지 않는 팀: ${row.responsibleTeamName} (미지정 처리)`);
            }
        }

        // 현장유형 검증
        if (row.siteType) {
            const validTypes = ['도급', '직영', '지원'];
            if (!validTypes.includes(normalizeString(row.siteType))) {
                warnings.push(`현장유형은 도급/직영/지원 중 하나입니다. (입력값: ${row.siteType})`);
            }
        }

        if (existingSites.has(key)) {
            const existing = existingSites.get(key)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                const newStr = normalizeString(newVal);
                const oldStr = normalizeString(oldVal);
                if (newStr && newStr !== oldStr) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('address', row.address, existing.address);
            compare('code', row.code, existing.code);
            compare('companyName', row.companyName, existing.companyName);
            compare('responsibleTeamName', row.responsibleTeamName, existing.responsibleTeamName);
            compare('siteType', row.siteType, existing.siteType);

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
                newLogs.push(`[실패] 현장명 누락`);
                continue;
            }

            const key = name.toLowerCase();

            try {
                // 관계 해결
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

                let responsibleTeamId: string | undefined;
                let responsibleTeamName: string | undefined;
                if (row.responsibleTeamName) {
                    const teamKey = normalizeString(row.responsibleTeamName).toLowerCase();
                    if (teams.has(teamKey)) {
                        const t = teams.get(teamKey)!;
                        responsibleTeamId = t.id;
                        responsibleTeamName = t.name;
                    }
                }

                if (existingSites.has(key)) {
                    if (!options?.overwrite) {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (덮어쓰기 해제됨)`);
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingSites.get(key)!;
                    const updates: Partial<Site> = {};

                    if (row.code) updates.code = normalizeString(row.code);
                    if (row.address) updates.address = normalizeString(row.address);
                    if (row.startDate) updates.startDate = formatExcelDate(row.startDate);
                    if (row.endDate) updates.endDate = formatExcelDate(row.endDate);
                    if (row.siteType) updates.siteType = normalizeString(row.siteType) as Site['siteType'];
                    if (row.status) updates.status = normalizeString(row.status) as Site['status'];

                    if (companyId) {
                        updates.companyId = companyId;
                        updates.companyName = companyName;
                    }
                    if (responsibleTeamId) {
                        updates.responsibleTeamId = responsibleTeamId;
                        updates.responsibleTeamName = responsibleTeamName;
                    }

                    if (Object.keys(updates).length > 0) {
                        await siteService.updateSite(existing.id!, updates);
                        success++;
                        newLogs.push(`[수정] ${name}`);
                    } else {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (변경사항 없음)`);
                    }
                } else {
                    // CREATE
                    const newSiteId = await siteService.addSite({
                        name: name,
                        code: normalizeString(row.code) || `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        address: normalizeString(row.address) || '',
                        status: (normalizeString(row.status) as Site['status']) || 'active',
                        siteType: (normalizeString(row.siteType) as Site['siteType']) || undefined,
                        companyId,
                        companyName,
                        responsibleTeamId,
                        responsibleTeamName
                    });
                    success++;
                    existingSites.set(key, { id: newSiteId, name } as Site);
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
            <h2 className="text-2xl font-bold mb-6 text-slate-800">현장(Site) 대량 등록</h2>
            <ExcelUploadWizard
                title="현장 목록 엑셀 업로드"
                description="현장명, 시공사, 담당팀, 주소, 현장유형 등이 포함된 엑셀 파일을 업로드하세요."
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

export default SiteMassUploader;
