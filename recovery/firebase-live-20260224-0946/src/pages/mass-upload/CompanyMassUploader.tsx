import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { companyService, Company } from '../../services/companyService';
import { normalizeString, normalizeBusinessNumber, normalizePhone } from '../../utils/excelUtils';
import Swal from 'sweetalert2';

const CompanyMassUploader: React.FC = () => {
    const [existingCompanies, setExistingCompanies] = useState<Map<string, Company>>(new Map());
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const data = await companyService.getCompanies();
                const map = new Map<string, Company>();
                data.forEach(c => map.set(normalizeString(c.name).toLowerCase(), c));
                setExistingCompanies(map);
            } catch (error) {
                console.error("Error loading companies:", error);
                Swal.fire('오류', '기존 회사 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };
        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'name', label: '회사명', required: true, aliases: ['상호', '업체명', '회사'] },
        { key: 'type', label: '구분', required: false, aliases: ['업종', '타입', '회사구분'] },
        { key: 'ceoName', label: '대표자', required: false, aliases: ['대표', 'CEO', '사장', '대표자명'] },
        { key: 'businessNumber', label: '사업자번호', required: false, aliases: ['사업자등록번호', '사업자', '등록번호'] },
        { key: 'address', label: '주소', required: false, aliases: ['소재지', '사업장주소'] },
        { key: 'phone', label: '연락처', required: false, aliases: ['전화번호', '대표번호', '전화'] }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        const name = normalizeString(row.name);
        if (!name) {
            errors.push('회사명 필수');
            return { isValid: false, errors, warnings, status, changes };
        }

        const key = name.toLowerCase();
        if (existingCompanies.has(key)) {
            const existing = existingCompanies.get(key)!;

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                const newStr = normalizeString(newVal);
                const oldStr = normalizeString(oldVal);
                if (newStr && newStr !== oldStr) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('ceoName', row.ceoName, existing.ceoName);
            compare('businessNumber', row.businessNumber, existing.businessNumber);
            compare('address', row.address, existing.address);
            compare('type', row.type, existing.type);
            compare('phone', row.phone, existing.phone);

            if (hasChanges) {
                status = 'UPDATE';
                warnings.push('기존 데이터와 다른 정보가 있습니다.');
            } else {
                status = 'IDENTICAL';
                warnings.push('기존 데이터와 동일합니다.');
            }
        }

        // 사업자번호 형식 검증
        if (row.businessNumber) {
            const digits = String(row.businessNumber).replace(/\D/g, '');
            if (digits.length !== 10) {
                warnings.push('사업자번호는 10자리 숫자입니다.');
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
                newLogs.push(`[실패] 회사명 누락`);
                continue;
            }

            const key = name.toLowerCase();

            try {
                if (existingCompanies.has(key)) {
                    if (!options?.overwrite) {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (덮어쓰기 해제됨)`);
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingCompanies.get(key)!;
                    const updates: Partial<Company> = {};

                    if (row.ceoName) updates.ceoName = normalizeString(row.ceoName);
                    if (row.businessNumber) updates.businessNumber = normalizeBusinessNumber(row.businessNumber);
                    if (row.address) updates.address = normalizeString(row.address);
                    if (row.type) updates.type = normalizeString(row.type) as Company['type'];
                    if (row.phone) updates.phone = normalizePhone(row.phone);

                    if (Object.keys(updates).length > 0) {
                        await companyService.updateCompany(existing.id!, updates);
                        success++;
                        newLogs.push(`[수정] ${name}`);
                    } else {
                        skipped++;
                        newLogs.push(`[건너뜀] ${name} (변경사항 없음)`);
                    }
                } else {
                    // CREATE
                    const newCompanyId = await companyService.addCompany({
                        name: name,
                        ceoName: normalizeString(row.ceoName) || '',
                        businessNumber: normalizeBusinessNumber(row.businessNumber) || '',
                        address: normalizeString(row.address) || '',
                        type: (normalizeString(row.type) as Company['type']) || '미지정',
                        phone: normalizePhone(row.phone) || '',
                        email: '',
                        code: `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                    });
                    success++;
                    existingCompanies.set(key, { id: newCompanyId, name } as Company);
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
            <h2 className="text-2xl font-bold mb-6 text-slate-800">업체(Company) 대량 등록</h2>
            <ExcelUploadWizard
                title="협력업체 목록 엑셀 업로드"
                description="회사명, 사업자번호, 대표자, 연락처 등이 포함된 엑셀 파일을 업로드하세요."
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

export default CompanyMassUploader;
