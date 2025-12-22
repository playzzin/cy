import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import Swal from 'sweetalert2';

const WorkerMassUploader: React.FC = () => {
    // State
    const [existingWorkers, setExistingWorkers] = useState<Map<string, Worker>>(new Map());
    const [teams, setTeams] = useState<Map<string, string>>(new Map()); // Name -> ID
    const [sites, setSites] = useState<Map<string, string>>(new Map()); // Name -> ID
    const [saving, setSaving] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [wData, tData, sData] = await Promise.all([
                    manpowerService.getWorkers(),
                    teamService.getTeams(),
                    siteService.getSites()
                ]);

                // Map by Name+Contact for duplicate checking
                const wMap = new Map<string, Worker>();
                for (const w of wData) {
                    wMap.set(`${w.name}_${w.contact || ''}`, w);
                }
                setExistingWorkers(wMap);

                // Map by Name -> ID for looking up foreign keys
                const tMap = new Map<string, string>();
                for (const t of tData) {
                    if (t.id) tMap.set(t.name, t.id);
                }
                setTeams(tMap);

                const sMap = new Map<string, string>();
                for (const s of sData) {
                    if (s.id) sMap.set(s.name, s.id);
                }
                setSites(sMap);
            } catch (error) {
                console.error("Error loading existing data:", error);
                Swal.fire('오류', '기존 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };

        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'name', label: '이름', required: true, aliases: ['성명', '작업자명'] },
        { key: 'teamType', label: '팀구분', required: false, aliases: ['직종구분', '고용형태'] },
        { key: 'companyName', label: '회사명', required: false, aliases: ['소속회사', '업체'] }, // Reference only
        { key: 'birthDate', label: '주민번호', required: false, aliases: ['생년월일', '주민등록번호', '주민등록번호앞자리'], example: '800101' },
        { key: 'address', label: '주소', required: false, aliases: ['거주지'] },
        { key: 'phone', label: '연락처', required: false, aliases: ['전화번호', '휴대폰', 'Mobile'], example: '010-1234-5678' },
        { key: 'payType', label: '급여방식', required: false, example: '일급제', aliases: ['임금유형', '급여구분', '급여형태'] },

        // Optional extras
        { key: 'role', label: '직종', required: false, aliases: ['역할', '포지션'] },
        { key: 'teamName', label: '소속팀', required: false, aliases: ['팀명', '팀'] },
        { key: 'bankName', label: '은행명', required: false, aliases: ['은행'] },
        { key: 'accountNumber', label: '계좌번호', required: false, aliases: ['계좌'] },
        { key: 'accountHolder', label: '예금주', required: false },
        { key: 'unitPrice', label: '단가', required: false, example: '150000', aliases: ['일당', '임금', '급여'] }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        if (!row.name) errors.push('이름 필수');

        // Check Duplicate
        const key = `${row.name}_${row.phone || ''}`;
        if (existingWorkers.has(key)) {
            const existing = existingWorkers.get(key)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                if (newVal && String(newVal).trim() !== String(oldVal || '').trim()) {
                    // Only compare if newVal exists (Smart Merge Check)
                    // If excel value is empty, we don't consider it a change because we won't update it
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('role', row.role, existing.role);
            compare('payType', row.payType, existing.payType);
            compare('address', row.address, existing.address);
            compare('bankName', row.bankName, existing.bankName);
            compare('accountNumber', row.accountNumber, existing.accountNumber);

            if (hasChanges) {
                status = 'UPDATE';
                warnings.push('기존 데이터에 새로운 정보가 추가/변경됩니다.');
            } else {
                status = 'IDENTICAL';
                warnings.push('기존 데이터와 동일합니다.');
            }
        }

        // Check Team Validity
        if (row.teamName && !teams.has(row.teamName)) {
            warnings.push(`존재하지 않는 팀: ${row.teamName} (미배정 처리)`);
        }

        return { isValid: errors.length === 0, errors, warnings, status, changes };
    };

    const handleSave = async (data: any[], options?: { overwrite: boolean }) => {
        setSaving(true);
        setLogs([]);
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        const newLogs: string[] = [];
        const BATCH_SIZE = 50;

        // Group into batches
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batchChunk = data.slice(i, i + BATCH_SIZE);

            for (const row of batchChunk) {
                if (!row.name) {
                    failCount++;
                    newLogs.push(`[실패] 이름 누락: ${JSON.stringify(row)}`);
                    continue;
                }

                const key = `${row.name}_${row.phone || ''}`;
                const existing = existingWorkers.get(key);

                try {
                    // Base Data for CREATE
                    const baseData = {
                        name: row.name,
                        contact: row.phone || '',
                        idNumber: row.birthDate || '',
                        address: row.address || '',
                        role: row.role || '작업자',
                        unitPrice: row.unitPrice ? Number(String(row.unitPrice).replace(/[^0-9]/g, '')) : 0,
                        payType: row.payType || '일급제',
                        bankName: row.bankName || '',
                        accountNumber: row.accountNumber || '',
                        accountHolder: row.accountHolder || row.name,
                        teamId: row.teamName ? teams.get(row.teamName) || '' : undefined,
                        teamType: '일용직',
                    };

                    if (existing && existing.id) {
                        // UPDATE Logic (Smart Merge)
                        if (!options?.overwrite) {
                            skippedCount++;
                            newLogs.push(`[건너뜀] ${row.name} (덮어쓰기 해제됨)`);
                            continue;
                        }

                        // Smart Merge: Only update fields that are present in the Excel
                        const updates: any = { updatedAt: new Date() };

                        const mergeField = (key: string, rowVal: any, existVal: any) => {
                            if (rowVal !== undefined && rowVal !== '' && rowVal !== null) {
                                updates[key] = rowVal;
                            }
                        };

                        mergeField('contact', row.phone, existing.contact);
                        mergeField('idNumber', row.birthDate, existing.idNumber);
                        mergeField('address', row.address, existing.address);
                        mergeField('role', row.role, existing.role);
                        mergeField('unitPrice', row.unitPrice ? Number(String(row.unitPrice).replace(/[^0-9]/g, '')) : undefined, existing.unitPrice);
                        mergeField('payType', row.payType, existing.payType);
                        mergeField('bankName', row.bankName, existing.bankName);
                        mergeField('accountNumber', row.accountNumber, existing.accountNumber);
                        mergeField('accountHolder', row.accountHolder, existing.accountHolder);

                        if (row.teamName) {
                            const tid = teams.get(row.teamName);
                            if (tid) updates.teamId = tid;
                        }

                        await manpowerService.updateWorker(existing.id, updates);
                        successCount++;
                        newLogs.push(`[수정] ${row.name} (정보 업데이트 완료)`);
                    } else {
                        // CREATE Logic
                        await manpowerService.addWorker({
                            ...baseData,
                            teamId: baseData.teamId || '',
                            status: 'available',
                        });
                        successCount++;
                        existingWorkers.set(key, { name: row.name, id: 'temp' } as any);
                    }

                } catch (e: any) {
                    console.error(e);
                    failCount++;
                    newLogs.push(`[실패] ${row.name}: ${e.message}`);
                }
            }
        }

        setLogs(newLogs);
        setSaving(false);
        return { success: successCount, failed: failCount, skipped: skippedCount };
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">작업자 대량 등록</h2>
            <ExcelUploadWizard
                title="작업자 명단 엑셀 업로드"
                description="작업자 이름, 연락처, 팀명 등이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={handleSave}
            />
            {logs.length > 0 && (
                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold mb-2">처리 로그</h3>
                    <div className="max-h-60 overflow-y-auto font-mono text-sm text-slate-600">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkerMassUploader;
