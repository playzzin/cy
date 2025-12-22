import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { siteService, Site } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { teamService } from '../../services/teamService';

const SiteMassUploader: React.FC = () => {

    const [existingSites, setExistingSites] = useState<Map<string, Site>>(new Map());
    const [companies, setCompanies] = useState<Map<string, { id: string, name: string }>>(new Map());
    const [teams, setTeams] = useState<Map<string, { id: string, name: string }>>(new Map());

    useEffect(() => {
        const loadCache = async () => {
            const [sData, cData, tData] = await Promise.all([
                siteService.getSites(),
                companyService.getCompanies(),
                teamService.getTeams()
            ]);

            const sMap = new Map<string, Site>();
            sData.forEach(s => sMap.set(s.name, s));
            setExistingSites(sMap);

            const cMap = new Map<string, { id: string, name: string }>();
            cData.forEach(c => { if (c.id) cMap.set(c.name, { id: c.id, name: c.name }); });
            setCompanies(cMap);

            const tMap = new Map<string, { id: string, name: string }>();
            tData.forEach(t => { if (t.id) tMap.set(t.name, { id: t.id, name: t.name }); });
            setTeams(tMap);
        };
        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'name', label: '현장', required: true, aliases: ['현장명', '프로젝트명', '공사명'] },
        { key: 'responsibleTeamName', label: '해당팀', required: false, aliases: ['담당팀', '관리팀'] },
        { key: 'companyName', label: '회사명', required: false, aliases: ['발주/시공사', '회사', '건설사'] },
        { key: 'code', label: '현장코드', required: false },
        { key: 'address', label: '주소', required: false },
        { key: 'startDate', label: '착공일', required: false, example: '2025-01-01' },
        { key: 'endDate', label: '준공일', required: false }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        if (!row.name) errors.push('현장명 필수');

        // Validate Relations
        if (row.companyName && !companies.has(row.companyName)) {
            warnings.push(`존재하지 않는 회사: ${row.companyName} (미지정 처리)`);
        }
        if (row.responsibleTeamName && !teams.has(row.responsibleTeamName)) {
            warnings.push(`존재하지 않는 팀: ${row.responsibleTeamName} (미지정 처리)`);
        }

        if (existingSites.has(row.name)) {
            const existing = existingSites.get(row.name)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                if (String(newVal || '').trim() !== String(oldVal || '').trim()) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('address', row.address, existing.address);
            compare('code', row.code, existing.code);
            compare('startDate', row.startDate, existing.startDate);
            compare('endDate', row.endDate, existing.endDate);
            compare('companyName', row.companyName, existing.companyName);
            compare('responsibleTeamName', row.responsibleTeamName, existing.responsibleTeamName);

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

        for (const row of rows) {
            try {
                // Relations
                let companyId = undefined;
                let companyName = undefined;
                if (row.companyName && companies.has(row.companyName)) {
                    const c = companies.get(row.companyName)!;
                    companyId = c.id;
                    companyName = c.name;
                }

                let responsibleTeamId = undefined;
                let responsibleTeamName = undefined;
                if (row.responsibleTeamName && teams.has(row.responsibleTeamName)) {
                    const t = teams.get(row.responsibleTeamName)!;
                    responsibleTeamId = t.id;
                    responsibleTeamName = t.name;
                }

                if (existingSites.has(row.name)) {
                    if (!options?.overwrite) {
                        skipped++;
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingSites.get(row.name)!;
                    const updates: any = {};

                    if (row.code) updates.code = row.code;
                    if (row.address) updates.address = row.address;
                    if (row.startDate) updates.startDate = row.startDate;
                    if (row.endDate) updates.endDate = row.endDate;

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
                    } else {
                        skipped++;
                    }
                } else {
                    // CREATE
                    await siteService.addSite({
                        name: row.name,
                        code: row.code || `SITE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        address: row.address || '주소 미입력',
                        startDate: row.startDate || new Date().toISOString().split('T')[0],
                        endDate: row.endDate || '2099-12-31',
                        status: 'active',
                        companyId,
                        companyName,
                        responsibleTeamId,
                        responsibleTeamName
                    });
                    success++;
                    existingSites.set(row.name, { name: row.name } as any);
                }
            } catch (e) {
                console.error(e);
                failed++;
            }
        }
        return { success, failed, skipped };
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">현장(Site) 대량 등록</h2>
            <ExcelUploadWizard
                title="현장 목록 엑셀 업로드"
                description="현장명, 회사(발주처), 담당팀, 주소 등이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={saveBatch}
            />
        </div>
    );
};

export default SiteMassUploader;
