import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { companyService } from '../../services/companyService';

const CompanyMassUploader: React.FC = () => {

    // Cache both Name and RegNum
    // Cache both Name and RegNum
    const [existingCompanies, setExistingCompanies] = useState<Map<string, any>>(new Map()); // Using any for Company to avoid import issues if not strict

    useEffect(() => {
        const loadCache = async () => {
            const data = await companyService.getCompanies();
            const map = new Map<string, any>();
            data.forEach(c => map.set(c.name, c));
            setExistingCompanies(map);
        };
        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'name', label: '회사명', required: true, aliases: ['상호', '업체명'] },
        { key: 'type', label: '구분', required: false, example: '협력사', aliases: ['업종', '타입'] },
        { key: 'ceoName', label: '대표자', required: false, aliases: ['대표', 'CEO', '사장'] },
        { key: 'businessNumber', label: '사업자번호', required: false, aliases: ['사업자등록번호'] },
        { key: 'address', label: '주소', required: false }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        if (!row.name) errors.push('회사명 필수');
        if (existingCompanies.has(row.name)) {
            const existing = existingCompanies.get(row.name);

            let hasChanges = false;
            const compare = (field: string, newVal: any, oldVal: any) => {
                if (String(newVal || '').trim() !== String(oldVal || '').trim()) {
                    hasChanges = true;
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            };

            compare('ceoName', row.ceoName, existing.ceoName);
            compare('businessNumber', row.businessNumber, existing.businessNumber);
            compare('address', row.address, existing.address);
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
                if (existingCompanies.has(row.name)) {
                    if (!options?.overwrite) {
                        skipped++;
                        continue;
                    }

                    // UPDATE (Smart Merge)
                    const existing = existingCompanies.get(row.name);
                    const updates: any = {};

                    if (row.ceoName) updates.ceoName = row.ceoName;
                    if (row.businessNumber) updates.businessNumber = row.businessNumber;
                    if (row.address) updates.address = row.address;
                    if (row.type) updates.type = row.type;

                    if (Object.keys(updates).length > 0) {
                        await companyService.updateCompany(existing.id, updates);
                        success++;
                    } else {
                        skipped++; // No changes to apply
                    }
                } else {
                    // CREATE
                    await companyService.addCompany({
                        name: row.name,
                        ceoName: row.ceoName || '',
                        businessNumber: row.businessNumber || '',
                        address: row.address || '',
                        type: (row.type as any) || '미지정', // Default if missing
                        phone: '',
                        email: '',
                        code: `COM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
                    });
                    success++;
                    existingCompanies.set(row.name, { name: row.name } as any);
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
            <h2 className="text-2xl font-bold mb-6 text-slate-800">업체(Company) 대량 등록</h2>
            <ExcelUploadWizard
                title="협력업체 목록 엑셀 업로드"
                description="회사명, 사업자번호 등이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={saveBatch}
            />
        </div>
    );
};

export default CompanyMassUploader;
