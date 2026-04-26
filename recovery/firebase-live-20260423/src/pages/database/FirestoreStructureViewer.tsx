import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faTable, faCode, faLayerGroup, faInfoCircle, faQuestionCircle, faRobot, faAsterisk, faLink, faCopy, faCheck, faGhost } from '@fortawesome/free-solid-svg-icons';

type ClipboardCollectionSchemaPayloadV1 = {
    __type: 'firestore_schema_collection';
    version: 1;
    collectionId: string;
    collectionName: string;
    schema: CollectionSchema;
    copiedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isClipboardCollectionSchemaPayloadV1 = (value: unknown): value is ClipboardCollectionSchemaPayloadV1 => {
    if (!isRecord(value)) return false;

    return (
        value.__type === 'firestore_schema_collection' &&
        value.version === 1 &&
        typeof value.collectionId === 'string' &&
        typeof value.collectionName === 'string' &&
        isRecord(value.schema) &&
        typeof value.copiedAt === 'string'
    );
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy using Clipboard API', err);
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const ok = document.execCommand('copy');
            return ok;
        } catch (fallbackErr) {
            console.error('Fallback: Oops, unable to copy', fallbackErr);
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
};

interface SchemaField {
    name: string;
    type: string;
    example: string;
    description?: string;
    isSystem?: boolean;
    isRequired?: boolean;
    relatedCollection?: string;
    isMissing?: boolean;
    hasChildren?: boolean;
    children?: SchemaField[];
}

interface CollectionSchema {
    name: string;
    docCount: number;
    fields: SchemaField[];
    lastUpdated: Date | null;
}

const COLLECTIONS = [
    { id: 'users', name: '사용자 (users)' },
    { id: 'audit_logs', name: '활동 로그 (audit_logs)' }
];

const SYSTEM_FIELDS = [
    'id', 'createdAt', 'updatedAt', 'totalManDay', 'memberCount', 'fileNameSaved', 'timestamp'
];

const REQUIRED_FIELDS: { [key: string]: string[] } = {
    workers: ['name', 'idNumber'],
    teams: ['name', 'type'],
    sites: ['name', 'startDate'],
    companies: ['name'],
    dailyReports: ['date', 'siteId'],
    users: ['username', 'email'],
    audit_logs: ['action', 'actorId', 'timestamp']
};

const KNOWN_FIELDS: { [key: string]: string[] } = {
    workers: [
        'name', 'idNumber', 'contact', 'address', 'email', 'birthDate', 'gender',
        'teamId', 'teamName', 'teamType', 'companyId', 'companyName',
        'role', 'status', 'salaryModel', 'unitPrice',
        'bankName', 'accountNumber', 'accountHolder', 'fileNameSaved', 'totalManDay'
    ],
    teams: [
        'name', 'type', 'leaderId', 'leaderName', 'parentTeamId', 'parentTeamName',
        'companyId', 'companyName', 'memberCount'
    ],
    sites: [
        'name', 'startDate', 'endDate', 'status', 'address',
        'responsibleTeamId', 'companyId', 'companyName'
    ],
    companies: [
        'name', 'code', 'businessNumber', 'ceoName', 'address', 'contact', 'email',
        'bankName', 'accountNumber', 'accountHolder'
    ],
    dailyReports: [
        'date', 'siteId', 'siteName', 'writerId', 'workers', 'manDay', 'workContent', 'weather'
    ],
    users: [
        'username', 'email', 'role', 'department', 'position', 'phoneNumber', 'photoURL'
    ],
    audit_logs: [
        'action', 'actorId', 'actorEmail', 'targetId', 'details', 'timestamp'
    ]
};

const RELATIONSHIPS: { [key: string]: string } = {
    'workers.teamId': 'teams',
    'workers.companyId': 'companies',
    'teams.leaderId': 'workers',
    'teams.parentTeamId': 'teams',
    'sites.responsibleTeamId': 'teams',
    'dailyReports.siteId': 'sites',
    'dailyReports.writerId': 'users',
    'audit_logs.actorId': 'users'
};

const ENUMS: { [key: string]: string[] } = {
    'workers.teamType': ['본팀', '관리팀', '새끼팀', '지원팀', '용역팀', '미배정'],
    'workers.role': ['관리자', '운영자', '메니저', '팀장', '반장', '작업자', '미배정'],
    'workers.status': ['재직', '퇴사', '미배정'],
    'workers.salaryModel': ['일급제', '주급제', '월급제', '가지급'],
    'teams.type': ['본팀', '관리팀', '새끼팀', '지원팀', '용역팀']
};

const FIELD_DESCRIPTIONS: { [key: string]: string } = {
    // Common
    id: '고유 ID',
    createdAt: '생성일시',
    updatedAt: '수정일시',

    // Worker
    name: '이름',
    birthDate: '생년월일',
    gender: '성별',
    phone: '연락처',
    address: '주소',
    type: '유형',
    role: '직책/역할',
    status: '상태 (재직/퇴사 등)',
    teamId: '소속 팀 ID',
    teamName: '소속 팀명',
    teamType: '팀 유형',
    companyId: '소속 회사 ID',
    companyName: '소속 회사명',
    salaryModel: '급여 형태',
    unitPrice: '단가',
    bankName: '은행명',
    accountNumber: '계좌번호',
    accountHolder: '예금주',
    idNumber: '주민등록번호',
    contact: '연락처',
    email: '이메일',
    totalManDay: '누적 공수',
    fileNameSaved: '저장된 파일명',

    // Team
    leaderId: '팀장 ID',
    leaderName: '팀장명',
    memberCount: '팀원 수',
    parentTeamId: '상위 팀 ID',
    parentTeamName: '상위 팀명',

    // Site
    startDate: '시작일',
    endDate: '종료일',
    responsibleTeamId: '담당 팀 ID',

    // Company
    code: '회사 코드',
    businessNumber: '사업자번호',
    ceoName: '대표자명',

    // Daily Report
    date: '날짜',
    siteId: '현장 ID',
    siteName: '현장명',
    writerId: '작성자 ID',
    workers: '작업자 목록',
    manDay: '공수',
    workContent: '작업 내용',
    weather: '날씨',

    // User
    username: '사용자명',
    department: '부서',
    position: '직위',
    photoURL: '프로필 사진 URL',
    phoneNumber: '전화번호',

    // Audit Log
    action: '활동 유형',
    actorId: '수행자 ID',
    actorEmail: '수행자 이메일',
    targetId: '대상 ID',
    details: '상세 내용',
    timestamp: '발생 일시'
};

const FirestoreStructureViewer: React.FC = () => {
    const [schemas, setSchemas] = useState<{ [key: string]: CollectionSchema }>({});
    const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
    const [showHelp, setShowHelp] = useState(true);
    const [copySuccess, setCopySuccess] = useState(false);
    const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [pasteError, setPasteError] = useState<string | null>(null);
    const [pastedItems, setPastedItems] = useState<ClipboardCollectionSchemaPayloadV1[]>([]);

    useEffect(() => {
        COLLECTIONS.forEach(col => {
            setLoading(prev => ({ ...prev, [col.id]: true }));
            const inferredFields = inferSchema({}, col.id);
            setSchemas(prev => ({
                ...prev,
                [col.id]: {
                    name: col.name,
                    docCount: 0,
                    fields: inferredFields,
                    lastUpdated: new Date()
                }
            }));
            setLoading(prev => ({ ...prev, [col.id]: false }));
        });
    }, []);

    const inferSchema = (data: any, collectionId?: string): SchemaField[] => {
        const fields: SchemaField[] = [];
        const existingKeys = new Set(Object.keys(data));

        // 1. Process existing data fields
        Object.keys(data).sort().forEach(key => {
            const value = data[key];
            let type: string = typeof value;
            let example = String(value);
            let children: SchemaField[] | undefined = undefined;

            if (value === null) {
                type = 'null';
                example = 'null';
            } else if (Array.isArray(value)) {
                type = 'array';
                example = `Array(${value.length})`;
                if (value.length > 0) {
                    const firstItem = value[0];
                    if (typeof firstItem === 'object' && firstItem !== null) {
                        children = inferSchema(firstItem);
                    }
                }
            } else if (value instanceof Date) {
                type = 'timestamp';
                example = value.toISOString();
            } else if (typeof value === 'object') {
                if (value.seconds !== undefined && value.nanoseconds !== undefined) {
                    type = 'timestamp';
                    example = new Date(value.seconds * 1000).toLocaleString();
                } else {
                    type = 'map';
                    example = '{...}';
                    children = inferSchema(value);
                }
            } else if (type === 'string') {
                if (value.length > 30) example = value.substring(0, 30) + '...';
            }

            const isRequired = collectionId ? REQUIRED_FIELDS[collectionId]?.includes(key) : false;
            const relatedCollection = collectionId ? RELATIONSHIPS[`${collectionId}.${key}`] : undefined;

            fields.push({
                name: key,
                type,
                example,
                description: FIELD_DESCRIPTIONS[key],
                isSystem: SYSTEM_FIELDS.includes(key),
                isRequired,
                relatedCollection,
                isMissing: false,
                hasChildren: !!children,
                children
            });
        });

        // 2. Add missing known fields
        if (collectionId && KNOWN_FIELDS[collectionId]) {
            KNOWN_FIELDS[collectionId].forEach(key => {
                if (!existingKeys.has(key)) {
                    const isRequired = REQUIRED_FIELDS[collectionId]?.includes(key) || false;
                    const relatedCollection = RELATIONSHIPS[`${collectionId}.${key}`];

                    fields.push({
                        name: key,
                        type: 'unknown',
                        example: 'No Data',
                        description: FIELD_DESCRIPTIONS[key],
                        isSystem: SYSTEM_FIELDS.includes(key),
                        isRequired,
                        relatedCollection,
                        isMissing: true,
                        hasChildren: false
                    });
                }
            });
        }

        return fields;
    };

    const getTypeColor = (type: string, isMissing?: boolean) => {
        if (isMissing) return 'text-slate-400 bg-slate-50 border-slate-100';

        switch (type) {
            case 'string': return 'text-green-600 bg-green-50 border-green-100';
            case 'number': return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'boolean': return 'text-purple-600 bg-purple-50 border-purple-100';
            case 'timestamp': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'array': return 'text-pink-600 bg-pink-50 border-pink-100';
            case 'map': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    const generateAIContext = () => {
        let markdown = `# Project Database Schema (Firestore)\n\n`;
        markdown += `Generated at: ${new Date().toLocaleString()}\n\n`;

        // 1. Collections & Fields
        Object.entries(schemas).forEach(([colId, schema]) => {
            markdown += `## Collection: ${schema.name} (ID: ${colId})\n`;
            schema.fields.forEach(field => {
                const flags = [];
                if (field.isRequired) flags.push('Required');
                if (field.isSystem) flags.push('System/Auto');
                if (field.relatedCollection) flags.push(`Link -> ${field.relatedCollection}`);
                if (field.isMissing) flags.push('Optional/Empty');

                const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
                const desc = field.description ? ` - ${field.description}` : '';

                markdown += `- \`${field.name}\` (${field.type}): ${field.example}${flagStr}${desc}\n`;
            });
            markdown += `\n`;
        });

        // 2. Relationships
        markdown += `## Relationships (Foreign Keys)\n`;
        Object.entries(RELATIONSHIPS).forEach(([key, target]) => {
            markdown += `- \`${key}\` references \`${target}\` collection\n`;
        });
        markdown += `\n`;

        // 3. Enums
        markdown += `## Enums (Allowed Values)\n`;
        Object.entries(ENUMS).forEach(([key, values]) => {
            markdown += `- \`${key}\`: ${values.join(', ')}\n`;
        });

        return markdown;
    };

    const handleCopyAIContext = async () => {
        const context = generateAIContext();
        const ok = await copyTextToClipboard(context);
        if (!ok) {
            alert('복사하기 실패');
            return;
        }

        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

     const markCopied = (id: string) => {
         setCopiedActionId(id);
         window.setTimeout(() => setCopiedActionId(null), 1500);
     };

     const handleCopyCollectionItem = async (collectionId: string, collectionName: string) => {
         const schema = schemas[collectionId];
         if (!schema) {
             alert('아직 스키마를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
             return;
         }

         const payload: ClipboardCollectionSchemaPayloadV1 = {
             __type: 'firestore_schema_collection',
             version: 1,
             collectionId,
             collectionName,
             schema,
             copiedAt: new Date().toISOString()
         };

         const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
         if (!ok) {
             alert('복사 실패');
             return;
         }

         markCopied(`collection-item:${collectionId}`);
     };

     const handleCopyFieldLocation = async (
         collectionId: string,
         collectionName: string,
         field: SchemaField
     ) => {
         const context =
             `[Context: Field '${collectionId}.${field.name}']\n` +
             `Collection: ${collectionName} (ID: ${collectionId})\n` +
             `Field: ${field.name}\n` +
             `Type: ${field.type}\n` +
             `Example: ${field.example}\n` +
             `Description: ${field.description ?? ''}\n` +
             `Required: ${field.isRequired ? 'true' : 'false'}\n` +
             `System: ${field.isSystem ? 'true' : 'false'}\n` +
             `RelatedCollection: ${field.relatedCollection ?? ''}`;

         const ok = await copyTextToClipboard(context);
         if (!ok) {
             alert('복사 실패');
             return;
         }

         markCopied(`field-location:${collectionId}:${field.name}`);
     };

     const tryParseJson = (text: string): unknown | null => {
         try {
             return JSON.parse(text);
         } catch {
             return null;
         }
     };

     const handlePasteConfirm = () => {
         const trimmed = pasteText.trim();
         if (trimmed.length === 0) {
             setPasteError('붙여넣을 내용이 비어있습니다.');
             return;
         }

         const parsed = tryParseJson(trimmed);
         if (!isClipboardCollectionSchemaPayloadV1(parsed)) {
             setPasteError('붙여넣기 형식이 올바르지 않습니다. (항목 복사로 생성된 JSON만 지원)');
             return;
         }

         setPastedItems(prev => {
             const existsIndex = prev.findIndex(p => p.collectionId === parsed.collectionId);
             if (existsIndex === -1) return [parsed, ...prev];

             const next = prev.slice();
             next[existsIndex] = parsed;
             return next;
         });

         setPasteError(null);
         setPasteText('');
         setIsPasteModalOpen(false);
     };

    const renderFields = (
        fields: SchemaField[],
        meta: { collectionId: string; collectionName: string },
        level = 0
    ) => {
        return (
            <div className={`space-y-1 ${level > 0 ? 'ml-4 border-l-2 border-slate-100 pl-2 mt-1' : ''}`}>
                {fields.map((field) => (
                    <div
                        key={field.name}
                        className={`text-sm group hover:bg-slate-50 p-1 rounded transition-colors ${field.isMissing ? 'opacity-60' : ''}`}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold min-w-[100px] flex items-center gap-1 ${field.isMissing ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                {field.name}
                                {field.isRequired && (
                                    <span title="필수 입력 항목" className="text-red-500 text-[10px]">
                                        <FontAwesomeIcon icon={faAsterisk} />
                                    </span>
                                )}
                                {field.isSystem && (
                                    <span title="시스템 자동 생성 데이터" className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded flex items-center gap-1">
                                        <FontAwesomeIcon icon={faRobot} className="text-[8px]" />
                                        Auto
                                    </span>
                                )}
                                {field.relatedCollection && (
                                    <span title={`연결된 컬렉션: ${field.relatedCollection}`} className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded flex items-center gap-1 cursor-help">
                                        <FontAwesomeIcon icon={faLink} className="text-[8px]" />
                                        {field.relatedCollection}
                                    </span>
                                )}
                                {field.isMissing && (
                                    <span title="데이터 없음 (Optional)" className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded flex items-center gap-1">
                                        <FontAwesomeIcon icon={faGhost} className="text-[8px]" />
                                        Empty
                                    </span>
                                )}
                            </span>

                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${getTypeColor(field.type, field.isMissing)}`}>
                                {field.type}
                            </span>

                            {field.description && (
                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {field.description}
                                </span>
                            )}

                            <span className="text-slate-400 text-xs truncate max-w-[200px] font-mono">
                                {field.example}
                            </span>

                             <button
                                 type="button"
                                 onClick={() => void handleCopyFieldLocation(meta.collectionId, meta.collectionName, field)}
                                 className="ml-auto text-xs bg-white border border-slate-200 text-slate-500 hover:text-indigo-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                 title="필드 위치/정보 복사"
                             >
                                 <FontAwesomeIcon icon={copiedActionId === `field-location:${meta.collectionId}:${field.name}` ? faCheck : faCopy} />
                                 <span className="ml-1">복사</span>
                             </button>
                        </div>
                        {field.children && renderFields(field.children, meta, level + 1)}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-[1800px] mx-auto">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-brand-600" />
                        실시간 DB 구조도
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2 text-sm">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        실제 데이터베이스에 저장된 최신 데이터를 기반으로 구조를 시각화합니다.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopyAIContext}
                        className={`transition flex items-center gap-2 text-sm font-medium border px-3 py-2 rounded-lg shadow-sm ${copySuccess
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            }`}
                    >
                        <FontAwesomeIcon icon={copySuccess ? faCheck : faCopy} />
                        {copySuccess ? '복사 완료!' : 'AI 프롬프트 복사'}
                    </button>
                    <button
                        onClick={() => {
                            setPasteError(null);
                            setIsPasteModalOpen(true);
                        }}
                        className="transition flex items-center gap-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg shadow-sm"
                        title="항목 복사로 생성된 JSON을 붙여넣습니다"
                    >
                        <FontAwesomeIcon icon={faCopy} />
                        항목 붙여넣기
                    </button>
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className="text-slate-500 hover:text-brand-600 transition flex items-center gap-2 text-sm font-medium bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm"
                    >
                        <FontAwesomeIcon icon={faQuestionCircle} />
                        {showHelp ? '도움말 숨기기' : '도움말 보기'}
                    </button>
                </div>
            </div>

            {pastedItems.length > 0 && (
                <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div className="font-bold text-slate-800">붙여넣은 항목</div>
                        <button
                            type="button"
                            onClick={() => setPastedItems([])}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                            전체 비우기
                        </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {pastedItems.map((item) => (
                            <div key={item.collectionId} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-bold text-slate-800 truncate">{item.collectionName}</div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPastedItems(prev => prev.filter(p => p.collectionId !== item.collectionId));
                                        }}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-700"
                                    >
                                        삭제
                                    </button>
                                </div>
                                <div className="mt-1 text-xs text-slate-500 font-mono">Collection ID: {item.collectionId}</div>
                                <div className="mt-1 text-xs text-slate-500">Fields: {item.schema.fields.length}</div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void copyTextToClipboard(JSON.stringify(item, null, 2)).then(ok => {
                                                if (!ok) {
                                                    alert('복사 실패');
                                                    return;
                                                }
                                                markCopied(`pasted-item:${item.collectionId}`);
                                            });
                                        }}
                                        className="text-xs bg-white border border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors"
                                    >
                                        <FontAwesomeIcon icon={copiedActionId === `pasted-item:${item.collectionId}` ? faCheck : faCopy} />
                                        <span className="ml-1">다시 복사</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showHelp && (
                <div className="mb-8 bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-fade-in">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCode} className="text-slate-400" />
                        데이터 타입 범례
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                        <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-100">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-xs font-medium text-green-700">String (문자열)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-blue-50 border border-blue-100">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-medium text-blue-700">Number (숫자)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-orange-50 border border-orange-100">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            <span className="text-xs font-medium text-orange-700">Timestamp (날짜)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-purple-50 border border-purple-100">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span className="text-xs font-medium text-purple-700">Boolean (참/거짓)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-pink-50 border border-pink-100">
                            <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                            <span className="text-xs font-medium text-pink-700">Array (배열/목록)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-indigo-50 border border-indigo-100">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="text-xs font-medium text-indigo-700">Map (객체)</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center gap-2 p-2 rounded bg-slate-100 border border-slate-200">
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded flex items-center gap-1">
                                <FontAwesomeIcon icon={faRobot} className="text-[8px]" />
                                Auto
                            </span>
                            <span className="text-xs text-slate-600">: 시스템 자동 생성 데이터</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-100">
                            <span className="text-red-500 text-[10px]">
                                <FontAwesomeIcon icon={faAsterisk} />
                            </span>
                            <span className="text-xs text-red-600">: 필수 입력 항목</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-indigo-50 border border-indigo-100">
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded flex items-center gap-1">
                                <FontAwesomeIcon icon={faLink} className="text-[8px]" />
                                teams
                            </span>
                            <span className="text-xs text-indigo-700">: 다른 컬렉션과 연결됨 (관계)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200 opacity-60">
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded flex items-center gap-1">
                                <FontAwesomeIcon icon={faGhost} className="text-[8px]" />
                                Empty
                            </span>
                            <span className="text-xs text-slate-400">: 데이터 없음 (선택 항목)</span>
                        </div>
                    </div>

                    <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">
                        <p className="mb-1">💡 <strong>참고사항:</strong></p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>이 화면은 Firestore 데이터베이스의 실제 구조를 보여줍니다.</li>
                            <li><strong>흐리게 표시된 항목</strong>은 현재 데이터가 없지만, 입력 가능한 필드입니다.</li>
                            <li>'설명' 태그는 개발 편의를 위해 추가된 것으로, 실제 DB에는 저장되지 않습니다.</li>
                            <li><strong>AI 프롬프트 복사</strong> 버튼을 누르면 현재 DB 구조를 AI가 이해하기 쉬운 텍스트로 복사합니다.</li>
                        </ul>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {COLLECTIONS.map(col => (
                    <div key={col.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faDatabase} className="text-slate-400" />
                                {col.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                {loading[col.id] && <span className="text-xs text-slate-400 animate-pulse">분석 중...</span>}
                                <button
                                    onClick={() => {
                                        const schema = schemas[col.id];
                                        if (!schema) return;

                                        const fieldNames = schema.fields.map(f => f.name).join(', ');
                                        const context = `[Context: Collection '${col.id}']\nName: ${col.name}\nFields: ${fieldNames}\nDescription: ${col.name} 컬렉션입니다.`;

                                        navigator.clipboard.writeText(context).then(() => {
                                            alert(`'${col.name}' 위치 정보가 복사되었습니다.\nAI에게 붙여넣어주세요.`);
                                        }).catch(err => {
                                            console.error('Copy failed', err);
                                            alert('복사 실패');
                                        });
                                    }}
                                    className="text-xs bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 px-2 py-1 rounded transition-colors"
                                    title="AI에게 알려줄 위치 정보 복사"
                                >
                                    <FontAwesomeIcon icon={faCopy} /> AI 위치 복사
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleCopyCollectionItem(col.id, col.name)}
                                    className="text-xs bg-white border border-slate-200 text-slate-500 hover:text-indigo-700 hover:border-indigo-200 px-2 py-1 rounded transition-colors"
                                    title="컬렉션 항목(JSON) 복사"
                                >
                                    <FontAwesomeIcon icon={copiedActionId === `collection-item:${col.id}` ? faCheck : faCopy} />
                                    <span className="ml-1">항목 복사</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-4 overflow-auto flex-1 max-h-[600px] min-h-[200px]">
                            {schemas[col.id]?.fields.length > 0 ? (
                                renderFields(schemas[col.id].fields, { collectionId: col.id, collectionName: col.name })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-10">
                                    <FontAwesomeIcon icon={faTable} className="text-3xl mb-2 opacity-20" />
                                    <p>데이터가 없습니다</p>
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-right text-slate-400 font-mono">
                            Collection ID: {col.id}
                        </div>
                    </div>
                ))}
            </div>

            {isPasteModalOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="font-bold text-slate-800">항목 붙여넣기</div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPasteModalOpen(false);
                                    setPasteError(null);
                                }}
                                className="text-xs font-bold text-slate-600 hover:text-slate-900"
                            >
                                닫기
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="text-sm text-slate-600">
                                컬렉션 카드의 <span className="font-bold">항목 복사</span>로 생성된 JSON을 아래에 붙여넣고 저장하세요.
                            </div>
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                className="mt-3 w-full h-56 border border-slate-200 rounded-lg p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="여기에 CTRL+V로 붙여넣기..."
                            />
                            {pasteError && (
                                <div className="mt-2 text-sm text-rose-600 font-bold">{pasteError}</div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPasteModalOpen(false);
                                    setPasteError(null);
                                    setPasteText('');
                                }}
                                className="px-4 py-2 rounded-lg font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handlePasteConfirm}
                                className="px-4 py-2 rounded-lg font-bold border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FirestoreStructureViewer;
