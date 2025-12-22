import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faTable, faKey, faLink, faCode, faList, faInfoCircle, faCheck, faCopy, faSitemap } from '@fortawesome/free-solid-svg-icons';

interface FieldDef {
    name: string;
    type: string;
    description: string;
    required?: boolean;
    isSystem?: boolean;
    fk?: string; // Foreign Key reference (e.g., "companies.id")
    note?: string;
}

interface TableDef {
    id: string;
    name: string;
    description: string;
    fields: FieldDef[];
}

const SCHEMA_DATA: TableDef[] = [
    {
        id: 'companies',
        name: 'Company (회사)',
        description: '협력사 및 발주처 정보 관리',
        fields: [
            { name: 'id', type: 'string', description: '고유 ID (Firestore Doc ID)', isSystem: true, required: true },
            { name: 'name', type: 'string', description: '회사명', required: true },
            { name: 'code', type: 'string', description: '회사 코드 (식별용)', required: true },
            { name: 'businessNumber', type: 'string', description: '사업자등록번호' },
            { name: 'ceoName', type: 'string', description: '대표자명' },
            { name: 'address', type: 'string', description: '주소' },
            { name: 'phone', type: 'string', description: '전화번호' },
            { name: 'type', type: 'enum', description: "'미지정' | '시공팀' | '건설사'", note: '팀은 건설사 타입 회사에만 소속 가능' },
            { name: 'siteName', type: 'string', description: '현장명 (추가됨)', note: '회사와 연관된 주 현장명' },
            { name: 'siteManager', type: 'string', description: '현장담당자 (추가됨)', note: '현장 관리 책임자' },
            { name: 'createdAt', type: 'timestamp', description: '생성일시', isSystem: true },
            { name: 'updatedAt', type: 'timestamp', description: '수정일시', isSystem: true }
        ]
    },
    {
        id: 'teams',
        name: 'Team (팀)',
        description: '작업 팀 조직 구조 관리',
        fields: [
            { name: 'id', type: 'string', description: '고유 ID', isSystem: true, required: true },
            { name: 'name', type: 'string', description: '팀명', required: true },
            { name: 'type', type: 'string', description: '팀 유형 (시공팀 등)' },
            { name: 'leaderId', type: 'string', description: '팀장 ID', fk: 'workers.id' },
            { name: 'leaderName', type: 'string', description: '팀장명 (Denormalized)' },
            { name: 'companyId', type: 'string', description: '소속 회사 ID', fk: 'companies.id', required: true },
            { name: 'companyName', type: 'string', description: '소속 회사명 (Denormalized)' },
            { name: 'parentTeamId', type: 'string', description: '상위 팀 ID', fk: 'teams.id', note: '계층형 팀 구조 지원' },
            { name: 'totalManDay', type: 'number', description: '누적 공수', isSystem: true },
            { name: 'createdAt', type: 'timestamp', description: '생성일시', isSystem: true },
            { name: 'updatedAt', type: 'timestamp', description: '수정일시', isSystem: true }
        ]
    },
    {
        id: 'sites',
        name: 'Site (현장)',
        description: '건설 현장 정보 관리',
        fields: [
            { name: 'id', type: 'string', description: '고유 ID', isSystem: true, required: true },
            { name: 'name', type: 'string', description: '현장명', required: true },
            { name: 'code', type: 'string', description: '현장 코드' },
            { name: 'address', type: 'string', description: '현장 주소' },
            { name: 'startDate', type: 'string', description: '공사 시작일 (YYYY-MM-DD)' },
            { name: 'endDate', type: 'string', description: '공사 종료일 (YYYY-MM-DD)' },
            { name: 'status', type: 'enum', description: "'active' | 'completed' | 'planned'" },
            { name: 'companyId', type: 'string', description: '발주처/시공사 ID', fk: 'companies.id' },
            { name: 'responsibleTeamId', type: 'string', description: '책임 팀 ID', fk: 'teams.id' },
            { name: 'totalManDay', type: 'number', description: '누적 공수', isSystem: true },
            { name: 'createdAt', type: 'timestamp', description: '생성일시', isSystem: true },
            { name: 'updatedAt', type: 'timestamp', description: '수정일시', isSystem: true }
        ]
    },
    {
        id: 'workers',
        name: 'Worker (작업자)',
        description: '인력 정보 및 근로 계약 관리',
        fields: [
            { name: 'id', type: 'string', description: '고유 ID', isSystem: true, required: true },
            { name: 'name', type: 'string', description: '이름', required: true },
            { name: 'idNumber', type: 'string', description: '주민등록번호', required: true },
            { name: 'contact', type: 'string', description: '연락처' },
            { name: 'address', type: 'string', description: '주소' },
            { name: 'teamId', type: 'string', description: '소속 팀 ID', fk: 'teams.id' },
            { name: 'teamName', type: 'string', description: '소속 팀명 (Denormalized)' },
            { name: 'role', type: 'string', description: '직책 (팀장, 반장, 기공 등)' },
            { name: 'status', type: 'enum', description: "'재직' | '퇴사' | '미배정'", note: '팀 배정 시 재직 상태 필수' },
            { name: 'unitPrice', type: 'number', description: '단가' },
            { name: 'salaryModel', type: 'string', description: '급여 형태 (일급제, 월급제)', note: '주급제 제외됨' },
            { name: 'totalManDay', type: 'number', description: '누적 공수', isSystem: true },
            { name: 'createdAt', type: 'timestamp', description: '생성일시', isSystem: true },
            { name: 'updatedAt', type: 'timestamp', description: '수정일시', isSystem: true }
        ]
    },
    {
        id: 'daily_reports',
        name: 'Daily Report (작업 일보)',
        description: '일별 작업 및 인력 투입 현황',
        fields: [
            { name: 'id', type: 'string', description: '고유 ID', isSystem: true, required: true },
            { name: 'date', type: 'string', description: '작업 일자 (YYYY-MM-DD)', required: true },
            { name: 'siteId', type: 'string', description: '현장 ID', fk: 'sites.id', required: true },
            { name: 'siteName', type: 'string', description: '현장명 (Denormalized)' },
            { name: 'teamId', type: 'string', description: '투입 팀 ID', fk: 'teams.id', required: true },
            { name: 'teamName', type: 'string', description: '투입 팀명 (Denormalized)' },
            { name: 'writerId', type: 'string', description: '작성자 ID', fk: 'users.id' },
            { name: 'totalManDay', type: 'number', description: '총 투입 공수', isSystem: true },
            { name: 'totalAmount', type: 'number', description: '총 노무비 (추가됨)', isSystem: true, note: 'worker.manDay * worker.unitPrice 합계' },
            { name: 'workerCount', type: 'number', description: '총 투입 인원 (추가됨)', isSystem: true },
            { name: 'workers', type: 'array<object>', description: '투입 인원 상세 목록', note: 'workerId, manDay, unitPrice, amount 포함' },
            { name: 'weather', type: 'string', description: '날씨' },
            { name: 'workContent', type: 'string', description: '작업 내용' },
            { name: 'createdAt', type: 'timestamp', description: '생성일시', isSystem: true },
            { name: 'updatedAt', type: 'timestamp', description: '수정일시', isSystem: true }
        ]
    }
];

const SchemaDesignViewer: React.FC = () => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopyMarkdown = async () => {
        let markdown = `# Database Schema Design\n\n`;
        SCHEMA_DATA.forEach(table => {
            markdown += `## ${table.name} (${table.id})\n`;
            markdown += `${table.description}\n\n`;
            markdown += `| Field | Type | Description | Required | System | FK |\n`;
            markdown += `|---|---|---|---|---|---|\n`;
            table.fields.forEach(f => {
                markdown += `| ${f.name} | ${f.type} | ${f.description} ${f.note ? `(${f.note})` : ''} | ${f.required ? '✅' : ''} | ${f.isSystem ? '🤖' : ''} | ${f.fk ? `🔗 ${f.fk}` : ''} |\n`;
            });
            markdown += `\n`;
        });

        try {
            await navigator.clipboard.writeText(markdown);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faSitemap} className="text-blue-600" />
                        데이터베이스 설계도 (Schema Design)
                    </h1>
                    <p className="text-slate-600">
                        시스템의 데이터 모델링 및 엔티티 관계 정의서입니다. TypeScript 인터페이스와 Firestore 컬렉션 구조를 기반으로 합니다.
                    </p>
                </div>
                <button
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
                >
                    <FontAwesomeIcon icon={copySuccess ? faCheck : faCopy} className={copySuccess ? "text-green-500" : ""} />
                    {copySuccess ? "복사 완료" : "Markdown 복사"}
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {SCHEMA_DATA.map(table => (
                    <div key={table.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                                    <FontAwesomeIcon icon={faTable} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{table.name}</h3>
                                    <p className="text-xs text-slate-500 font-mono">{table.id}</p>
                                </div>
                            </div>
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                                {table.fields.length} fields
                            </span>
                        </div>

                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 text-sm text-slate-600">
                            {table.description}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 w-1/4">Field Name</th>
                                        <th className="px-4 py-3 w-1/6">Type</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 w-1/12 text-center">Attr</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {table.fields.map((field, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-slate-700 font-medium">
                                                {field.name}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-mono border ${field.type === 'string' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    field.type === 'number' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        field.type === 'timestamp' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                            field.type === 'boolean' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                                'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {field.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <div>{field.description}</div>
                                                {field.note && (
                                                    <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                                        <FontAwesomeIcon icon={faInfoCircle} />
                                                        {field.note}
                                                    </div>
                                                )}
                                                {field.fk && (
                                                    <div className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1 font-mono bg-indigo-50 w-fit px-1.5 rounded">
                                                        <FontAwesomeIcon icon={faLink} />
                                                        FK: {field.fk}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {field.isSystem && (
                                                        <span title="System Field (Auto)" className="text-slate-400">
                                                            <FontAwesomeIcon icon={faCode} />
                                                        </span>
                                                    )}
                                                    {field.required && (
                                                        <span title="Required" className="text-red-400">
                                                            <FontAwesomeIcon icon={faKey} className="text-[10px]" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SchemaDesignViewer;
