import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';

const TeamMassUploader: React.FC = () => {

    // Cache
    const [existingTeams, setExistingTeams] = useState<Map<string, Team>>(new Map());
    const [companies, setCompanies] = useState<Map<string, { id: string, name: string }>>(new Map());

    useEffect(() => {
        const loadCache = async () => {
            const [tData, cData] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies()
            ]);

            const tMap = new Map<string, Team>();
            tData.forEach(t => tMap.set(t.name, t));
            setExistingTeams(tMap);

            const cMap = new Map<string, { id: string, name: string }>();
            cData.forEach(c => {
                if (c.id) cMap.set(c.name, { id: c.id, name: c.name });
            });
            setCompanies(cMap);
        };
        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'name', label: '팀명', required: true, aliases: ['팀이름'] },
        { key: 'leaderName', label: '팀장명', required: false, aliases: ['팀장', '대표'] },
        { key: 'companyName', label: '소속회사', required: false, aliases: ['회사', '업체', '소속'] },
        { key: 'contact', label: '연락처', required: false },
        { key: 'type', label: '직종', required: false, example: '목수' }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        if (!row.name) errors.push('팀명 필수');

        // Validate Company
        if (row.companyName && !companies.has(row.companyName)) {
            warnings.push(`존재하지 않는 회사: ${row.companyName} (미지정 처리됨)`);
        }

        if (existingTeams.has(row.name)) {
            const existing = existingTeams.get(row.name)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                if (String(newVal || '').trim() !== String(oldVal || '').trim()) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('leaderName', row.leaderName, existing.leaderName);
            compare('companyName', row.companyName, existing.companyName);
            compare('type', row.type, existing.type);

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
                // Resolve Company
                let companyId = undefined;
                let companyName = undefined;
                if (row.companyName && companies.has(row.companyName)) {
                    const c = companies.get(row.companyName)!;
                    companyId = c.id;
                    companyName = c.name;
                }

                if (existingTeams.has(row.name)) {
                    if (!options?.overwrite) {
                        skipped++;
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingTeams.get(row.name)!;
                    const updates: any = {};

                    if (row.leaderName) updates.leaderName = row.leaderName;
                    if (row.type) updates.type = row.type;
                    if (companyId) {
                        updates.companyId = companyId;
                        updates.companyName = companyName;
                    }

                    if (Object.keys(updates).length > 0) {
                        await teamService.updateTeam(existing.id!, updates);
                        success++;
                    } else {
                        skipped++;
                    }
                } else {
                    // CREATE
                    await teamService.addTeam({
                        name: row.name,
                        leaderName: row.leaderName || '미지정',
                        leaderId: 'unknown',
                        type: row.type || 'unknown',
                        companyId,
                        companyName,
                        memberCount: 0
                    });
                    success++;
                    existingTeams.set(row.name, { name: row.name } as any);
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
            <h2 className="text-2xl font-bold mb-6 text-slate-800">팀(Team) 대량 등록</h2>
            <ExcelUploadWizard
                title="팀 목록 엑셀 업로드"
                description="팀명, 팀장명, 소속회사 등이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={saveBatch}
            />
        </div>
    );
};

export default TeamMassUploader;
