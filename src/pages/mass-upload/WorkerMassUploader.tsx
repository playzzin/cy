import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { normalizeString, normalizePhone, normalizeNumber, createDuplicateKey } from '../../utils/excelUtils';
import Swal from 'sweetalert2';

const WorkerMassUploader: React.FC = () => {
    const [existingWorkers, setExistingWorkers] = useState<Map<string, Worker>>(new Map());
    const [teams, setTeams] = useState<Map<string, Team>>(new Map());
    const [companies, setCompanies] = useState<Map<string, Company>>(new Map());
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [wData, tData, cData] = await Promise.all([
                    manpowerService.getWorkers(),
                    teamService.getTeams(),
                    companyService.getCompanies()
                ]);

                // 중복 체크: 이름 + 연락처 조합
                const wMap = new Map<string, Worker>();
                for (const w of wData) {
                    const key = createDuplicateKey(w.name, w.contact);
                    wMap.set(key, w);
                }
                setExistingWorkers(wMap);

                const tMap = new Map<string, Team>();
                for (const t of tData) {
                    if (t.id) tMap.set(normalizeString(t.name).toLowerCase(), t);
                }
                setTeams(tMap);

                const cMap = new Map<string, Company>();
                for (const c of cData) {
                    if (c.id) cMap.set(normalizeString(c.name).toLowerCase(), c);
                }
                setCompanies(cMap);
            } catch (error) {
                console.error("Error loading existing data:", error);
                Swal.fire('오류', '기존 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };

        loadCache();
    }, []);

const fields: FieldDef[] = [
    { key: 'name', label: '이름', required: true, aliases: ['성명', '작업자명'] },
    { key: 'idNumber', label: '주민번호', aliases: ['주민등록번호'] },
    { key: 'contact', label: '연락처', aliases: ['휴대폰', '전화번호'] },
    { key: 'address', label: '주소' },
    { key: 'role', label: '직종', aliases: ['역할', '공종'] },
    { key: 'teamName', label: '소속팀', aliases: ['팀명', '팀'] },
    { key: 'companyName', label: '소속회사', aliases: ['회사명'] },
    { key: 'unitPrice', label: '단가', aliases: ['일당', '임금'] },
    { key: 'salaryModel', label: '급여형태', aliases: ['급여방식', '구분'] },
    { key: 'payType', label: '급여방식' },
    { key: 'bankName', label: '은행명', aliases: ['은행'] },
    { key: 'accountNumber', label: '계좌번호' },
    { key: 'accountHolder', label: '예금주' },
    { key: 'employmentType', label: '고용형태' },
    { key: 'rank', label: '직급' },
    { key: 'bloodType', label: '혈액형' }
];


    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        const name = normalizeString(row.name);
        if (!name) {
            errors.push('이름 필수');
            return { isValid: false, errors, warnings, status, changes };
        }

        // 중복 체크 키: 이름 + 연락처
        const contact = normalizePhone(row.contact);
        const key = createDuplicateKey(name, contact);

        // 팀 검증
        if (row.teamName) {
            const teamKey = normalizeString(row.teamName).toLowerCase();
            if (!teams.has(teamKey)) {
                warnings.push(`존재하지 않는 팀: ${row.teamName} (미배정 처리)`);
            }
        }

        // 회사 검증
        if (row.companyName) {
            const companyKey = normalizeString(row.companyName).toLowerCase();
            if (!companies.has(companyKey)) {
                warnings.push(`존재하지 않는 회사: ${row.companyName} (미지정 처리)`);
            }
        }

        // 급여형태 검증
        if (row.salaryModel) {
            const validModels = ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'];
            if (!validModels.includes(normalizeString(row.salaryModel))) {
                warnings.push(`급여형태 확인 필요: ${row.salaryModel}`);
            }
        }

        // 단가 유효성 검증
        if (row.unitPrice) {
            const price = normalizeNumber(row.unitPrice);
            if (price < 50000 || price > 1000000) {
                warnings.push(`단가 범위 확인 필요: ${row.unitPrice} (일반적으로 5만~100만원)`);
            }
        }

        if (existingWorkers.has(key)) {
            const existing = existingWorkers.get(key)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                const newStr = normalizeString(newVal);
                const oldStr = normalizeString(oldVal);
                if (newStr && newStr !== oldStr) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('role', row.role, existing.role);
            compare('address', row.address, existing.address);
            compare('salaryModel', row.salaryModel, existing.salaryModel);
            compare('payType', row.payType, existing.payType);
            compare('bankName', row.bankName, existing.bankName);
            compare('accountNumber', row.accountNumber, existing.accountNumber);
            compare('teamName', row.teamName, existing.teamName);
            compare('unitPrice', row.unitPrice, existing.unitPrice);

            if (hasChanges) {
                status = 'UPDATE';
                warnings.push('기존 데이터에 새로운 정보가 추가/변경됩니다.');
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
                newLogs.push(`[실패] 이름 누락`);
                continue;
            }

            const contact = normalizePhone(row.contact);
            const key = createDuplicateKey(name, contact);

            try {
                // 관계 해결: 팀
                let teamId: string | undefined;
                let teamName: string | undefined;
                let teamType: string = '일용직';
                if (row.teamName) {
                    const teamKey = normalizeString(row.teamName).toLowerCase();
                    if (teams.has(teamKey)) {
                        const t = teams.get(teamKey)!;
                        teamId = t.id;
                        teamName = t.name;
                        teamType = t.type || '일용직';
                    }
                }

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

                const unitPrice = normalizeNumber(row.unitPrice);

                if (existingWorkers.has(key)) {
                    if (!options?.overwrite) {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (덮어쓰기 해제됨)`);
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingWorkers.get(key)!;
                    const updates: Partial<Worker> = {};

                    if (row.idNumber) updates.idNumber = normalizeString(row.idNumber);
                    if (contact) updates.contact = contact;
                    if (row.address) updates.address = normalizeString(row.address);
                    if (row.role) updates.role = normalizeString(row.role);
                    if (row.salaryModel) updates.salaryModel = normalizeString(row.salaryModel);
                    if (row.payType) updates.payType = normalizeString(row.payType);
                    if (row.bankName) updates.bankName = normalizeString(row.bankName);
                    if (row.accountNumber) updates.accountNumber = normalizeString(row.accountNumber);
                    if (row.accountHolder) updates.accountHolder = normalizeString(row.accountHolder);
                    if (row.employmentType) updates.employmentType = normalizeString(row.employmentType);
                    if (row.rank) updates.rank = normalizeString(row.rank);
                    if (row.bloodType) updates.bloodType = normalizeString(row.bloodType);
                    if (unitPrice > 0) updates.unitPrice = unitPrice;

                    if (teamId) {
                        updates.teamId = teamId;
                        updates.teamName = teamName;
                        updates.teamType = teamType;
                    }
                    if (companyId) {
                        updates.companyId = companyId;
                        updates.companyName = companyName;
                    }

                    if (Object.keys(updates).length > 0) {
                        await manpowerService.updateWorker(existing.id!, updates);
                        success++;
                        newLogs.push(`[수정] ${name}`);
                    } else {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (변경사항 없음)`);
                    }
                } else {
                    // CREATE
                    const newWorkerId = await manpowerService.addWorker({
                        name: name,
                        idNumber: normalizeString(row.idNumber) || '',
                        contact: contact || '',
                        address: normalizeString(row.address) || '',
                        role: normalizeString(row.role) || '작업자',
                        status: 'available',
                        unitPrice: unitPrice || 0,
                        salaryModel: normalizeString(row.salaryModel) || '일급제',
                        payType: normalizeString(row.payType) || '일급제',
                        teamId: teamId || '',
                        teamName: teamName,
                        teamType: teamType,
                        companyId,
                        companyName,
                        bankName: normalizeString(row.bankName) || '',
                        accountNumber: normalizeString(row.accountNumber) || '',
                        accountHolder: normalizeString(row.accountHolder) || name,
                        employmentType: normalizeString(row.employmentType) || '일용직',
                        rank: normalizeString(row.rank) || '',
                        bloodType: normalizeString(row.bloodType) || ''
                    });
                    success++;
                    existingWorkers.set(key, { id: newWorkerId, name } as Worker);
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
            <h2 className="text-2xl font-bold mb-6 text-slate-800">작업자(Worker) 대량 등록</h2>
            <ExcelUploadWizard
                title="작업자 명단 엑셀 업로드"
                description="작업자 이름, 주민번호, 연락처, 소속팀, 단가 등이 포함된 엑셀 파일을 업로드하세요."
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

export default WorkerMassUploader;
