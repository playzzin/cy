import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowsRotate,
    faBookOpen,
    faBullseye,
    faCircleInfo,
    faDatabase,
    faDiagramProject,
    faFileInvoiceDollar,
    faLink,
    faListCheck,
    faLock,
    faMoneyBillWave,
    faTableColumns
} from '@fortawesome/free-solid-svg-icons';

type TabId = 'overview' | 'data_model' | 'ux_flow' | 'integration' | 'mvp';
type ChargeTarget = 'worker' | 'team';
type ItemKind = 'advance' | 'deduction';

interface TabDef {
    id: TabId;
    label: string;
    icon: IconDefinition;
}

interface FieldDef {
    name: string;
    type: string;
    description: string;
    required?: boolean;
    note?: string;
}

interface CollectionDef {
    id: string;
    title: string;
    purpose: string;
    fields: FieldDef[];
}

interface FlowStep {
    id: string;
    title: string;
    description: string;
    keyOutputs: string[];
}

interface MockItem {
    id: string;
    name: string;
    kind: ItemKind;
    defaultChargeTo: ChargeTarget;
}

interface MockRow {
    workerName: string;
    role: string;
    items: Record<string, number>;
    chargeToOverride?: Partial<Record<string, ChargeTarget>>;
    memo?: string;
}

const formatCurrency = (value: number): string => value.toLocaleString('ko-KR');

const getKindLabel = (kind: ItemKind): string => {
    return kind === 'advance' ? '가불' : '공제';
};

const getChargeTargetLabel = (target: ChargeTarget): string => {
    return target === 'worker' ? '작업자' : '팀청구';
};

const AdvanceLedgerPlanningPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    const tabs: TabDef[] = useMemo(() => {
        return [
            { id: 'overview', label: '요약', icon: faBullseye },
            { id: 'data_model', label: '데이터 모델', icon: faDatabase },
            { id: 'ux_flow', label: '화면/업무 흐름', icon: faDiagramProject },
            { id: 'integration', label: '연동/정산', icon: faLink },
            { id: 'mvp', label: 'MVP 범위', icon: faListCheck }
        ];
    }, []);

    const collections: CollectionDef[] = useMemo(() => {
        return [
            {
                id: 'advance_items',
                title: 'advance_items (항목 마스터)',
                purpose: '가불/공제 항목을 생성/수정/정렬하고, 장부의 동적 컬럼을 구성합니다. 삭제 대신 비활성(isActive)로 이력 보존을 권장합니다.',
                fields: [
                    { name: 'name', type: 'string', description: '항목명', required: true },
                    { name: 'kind', type: "'advance' | 'deduction'", description: '구분(가불/공제)', required: true },
                    { name: 'defaultChargeTo', type: "'worker' | 'team'", description: '기본 청구 대상(작업자 공제 vs 팀 청구)', required: true },
                    { name: 'order', type: 'number', description: '정렬 순서(DnD)', required: true },
                    { name: 'isActive', type: 'boolean', description: '활성 여부(삭제 대신 비활성)', required: true },
                    { name: 'createdAt', type: 'timestamp', description: '생성일시', required: true },
                    { name: 'updatedAt', type: 'timestamp', description: '수정일시', required: true }
                ]
            },
            {
                id: 'advance_ledger_rows',
                title: 'advance_ledger_rows (월별 장부 Row)',
                purpose: '월(YYYY-MM) + 팀 + 작업자 단위로 장부 Row를 저장합니다. “작업자 공제”와 “팀 청구”를 분리 집계합니다.',
                fields: [
                    { name: 'yearMonth', type: 'string', description: '적용월(YYYY-MM)', required: true },
                    { name: 'teamId', type: 'string', description: '팀 ID', required: true },
                    { name: 'teamName', type: 'string', description: '팀명(스냅샷)', required: true },
                    { name: 'workerId', type: 'string', description: '작업자 ID', required: true },
                    { name: 'workerName', type: 'string', description: '작업자명(스냅샷)', required: true },
                    { name: 'items', type: 'Record<itemId, number>', description: '동적 항목 금액들', required: true },
                    { name: 'chargeToOverride', type: 'Record<itemId, worker|team>', description: '개별 작업자 예외 청구 대상(옵션)' },
                    { name: 'carryover', type: 'number', description: '전월 이월(정산 규칙 적용)', required: true },
                    { name: 'totalWorkerDeduction', type: 'number', description: '작업자 공제 합계(자동 계산)', required: true },
                    { name: 'totalTeamCharge', type: 'number', description: '팀 청구 합계(자동 계산)', required: true },
                    { name: 'status', type: "'draft' | 'locked'", description: '마감/잠금 상태', required: true },
                    { name: 'updatedAt', type: 'timestamp', description: '수정일시', required: true }
                ]
            },
            {
                id: 'advance_team_invoices',
                title: 'advance_team_invoices (팀 청구서)',
                purpose: '팀청구 대상 항목만 월별로 집계해 청구서를 생성/발행/완납까지 관리합니다.',
                fields: [
                    { name: 'yearMonth', type: 'string', description: '청구월(YYYY-MM)', required: true },
                    { name: 'teamId', type: 'string', description: '팀 ID', required: true },
                    { name: 'teamName', type: 'string', description: '팀명(스냅샷)', required: true },
                    { name: 'includedRowIds', type: 'string[]', description: '포함된 장부 Row 문서 ID', required: true },
                    { name: 'totalCharge', type: 'number', description: '총 청구 금액', required: true },
                    { name: 'status', type: "'draft' | 'issued' | 'paid'", description: '상태', required: true },
                    { name: 'issuedAt', type: 'timestamp', description: '발행일시(옵션)' },
                    { name: 'createdAt', type: 'timestamp', description: '생성일시', required: true },
                    { name: 'updatedAt', type: 'timestamp', description: '수정일시', required: true }
                ]
            }
        ];
    }, []);

    const flowSteps: FlowStep[] = useMemo(() => {
        return [
            {
                id: 'items',
                title: '항목 관리(마스터)',
                description: '관리자가 항목을 추가/수정/비활성 처리하고, 정렬을 변경합니다. 장부는 이 마스터를 그대로 컬럼으로 사용합니다.',
                keyOutputs: ['동적 컬럼 구성', '기본 청구 대상(작업자/팀) 지정', '이력 보존(비활성)']
            },
            {
                id: 'ledger',
                title: '월별 장부 입력(팀/월)',
                description: '팀 + 월을 선택하면 작업자 리스트가 로딩됩니다. 가불이 없는 작업자도 0으로 존재하며, 일부 항목은 팀청구로 처리할 수 있습니다.',
                keyOutputs: ['작업자 공제 합계', '팀 청구 합계', '수정/입력 단위 최소화(그리드)']
            },
            {
                id: 'lock',
                title: '마감(잠금) / 전월 이월',
                description: '급여 확정/청구서 발행 기준으로 장부를 잠금 처리합니다. 전월 잔액은 다음 달 carryover로 이어집니다(규칙 문서화 필요).',
                keyOutputs: ['잠금 상태 유지', '이월 자동 계산(초안)', '감사 추적 가능 구조']
            },
            {
                id: 'invoice',
                title: '팀 청구서 생성/발행',
                description: '팀청구 대상 금액만 집계해 청구서를 생성합니다. 발행/완납 상태를 관리하고, 근거 Row를 연결합니다.',
                keyOutputs: ['팀별 청구 합계', '발행/완납 상태', '근거 Row 링크']
            },
            {
                id: 'payroll',
                title: '급여/명세서 연동',
                description: '작업자 공제 대상만 급여 계산에서 차감하고, 팀청구는 급여와 분리합니다. 중복 차감 방지 규칙이 필요합니다.',
                keyOutputs: ['급여 차감(작업자 공제)', '팀 청구(별도)', '중복/누락 방지 룰']
            }
        ];
    }, []);

    const mockItems: MockItem[] = useMemo(() => {
        return [
            { id: 'prevCarry', name: '전월이월', kind: 'deduction', defaultChargeTo: 'worker' },
            { id: 'cashAdvance', name: '가불(현금)', kind: 'advance', defaultChargeTo: 'worker' },
            { id: 'accommodation', name: '숙소비', kind: 'deduction', defaultChargeTo: 'team' },
            { id: 'deposit', name: '보증금', kind: 'deduction', defaultChargeTo: 'worker' },
            { id: 'fines', name: '과태료', kind: 'deduction', defaultChargeTo: 'worker' }
        ];
    }, []);

    const mockRows: MockRow[] = useMemo(() => {
        return [
            {
                workerName: '남궁현',
                role: '팀장',
                items: { prevCarry: 0, cashAdvance: 300000, accommodation: 150000, deposit: 0, fines: 0 },
                memo: '가불(현금) 지급'
            },
            {
                workerName: '변오양',
                role: '기능공',
                items: { prevCarry: 100000, cashAdvance: 0, accommodation: 150000, deposit: 200000, fines: 0 },
                chargeToOverride: { accommodation: 'worker' },
                memo: '숙소비는 본인 부담'
            },
            {
                workerName: '노수신',
                role: '기능공',
                items: { prevCarry: 0, cashAdvance: 0, accommodation: 150000, deposit: 0, fines: 50000 },
                memo: ''
            }
        ];
    }, []);

    const calcRowTotals = (row: MockRow) => {
        return mockItems.reduce(
            (acc, item) => {
                const value = row.items[item.id] ?? 0;
                const chargeTo = row.chargeToOverride?.[item.id] ?? item.defaultChargeTo;

                if (chargeTo === 'team') {
                    return {
                        workerDeduction: acc.workerDeduction,
                        teamCharge: acc.teamCharge + value,
                        grand: acc.grand + value
                    };
                }

                return {
                    workerDeduction: acc.workerDeduction + value,
                    teamCharge: acc.teamCharge,
                    grand: acc.grand + value
                };
            },
            { workerDeduction: 0, teamCharge: 0, grand: 0 }
        );
    };

    const grandTotals = useMemo(() => {
        return mockRows.reduce(
            (acc, row) => {
                const t = calcRowTotals(row);
                return {
                    workerDeduction: acc.workerDeduction + t.workerDeduction,
                    teamCharge: acc.teamCharge + t.teamCharge,
                    grand: acc.grand + t.grand
                };
            },
            { workerDeduction: 0, teamCharge: 0, grand: 0 }
        );
    }, [mockRows, mockItems]);

    const renderSectionHeader = (title: string, subtitle: string, icon: IconDefinition) => {
        return (
            <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                            <FontAwesomeIcon icon={icon} />
                        </span>
                        {title}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 max-w-[1800px] mx-auto">
            <div className="mb-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <FontAwesomeIcon icon={faMoneyBillWave} className="text-indigo-600" />
                            가불/공제 장부 기획(시각화)
                        </h1>
                        <p className="text-slate-500 mt-2">
                            기능 구현 전, 팀 합의를 위한 설계 요약 페이지입니다. 현재 페이지는 저장/조회 기능이 없는 기획안 UI입니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="px-3 py-1 rounded-full bg-white border border-slate-200">Route: /planning/advance-ledger</span>
                        <span className="px-3 py-1 rounded-full bg-white border border-slate-200">Version: v0.1</span>
                    </div>
                </div>

                <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-2 flex flex-wrap gap-2">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 border ${isActive
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={tab.icon} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                        {renderSectionHeader(
                            '왜 새 장부 구조가 필요한가',
                            '현재는 고정 컬럼 기반이라 항목 확장/팀청구/마감/이월을 안정적으로 다루기 어렵습니다.',
                            faCircleInfo
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs font-bold text-slate-500 mb-2">현재 문제</div>
                                <div className="space-y-2 text-sm text-slate-700">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span>항목 추가/삭제가 코드/컬럼 구조에 묶임</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span>팀청구 vs 작업자 공제 분리가 어려움</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span>급여 확정 이후 수정 위험(잠금 부재)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-indigo-50 p-4">
                                <div className="text-xs font-bold text-indigo-700 mb-2">목표</div>
                                <div className="space-y-2 text-sm text-slate-700">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                        <span>동적 항목 마스터 기반 장부</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                        <span>작업자 공제/팀 청구 완전 분리</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                        <span>마감/잠금 + 이월 규칙으로 안정화</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4">
                                <div className="text-xs font-bold text-emerald-700 mb-2">핵심 결과물</div>
                                <div className="space-y-2 text-sm text-slate-700">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                        <span>월별 장부(팀/월) 입력 화면</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                        <span>팀 청구서 생성/발행 화면</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                        <span>급여/명세서 연동 룰 정의</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                        {renderSectionHeader(
                            '목업 장부 그리드(동적 항목)',
                            '동적 항목 + 청구 대상 분리(작업자/팀)를 시각화한 예시입니다. 실제 구현 시 항목/정렬/합계가 실데이터로 연결됩니다.',
                            faTableColumns
                        )}

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold text-slate-700 min-w-[180px]">작업자</th>
                                        {mockItems.map(item => (
                                            <th key={item.id} className="px-4 py-3 text-right font-bold text-slate-700 min-w-[140px]">
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="font-bold text-slate-800">{item.name}</div>
                                                    <div className="flex items-center gap-1 text-[11px]">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full border ${item.kind === 'advance'
                                                                ? 'bg-violet-50 border-violet-200 text-violet-700'
                                                                : 'bg-slate-100 border-slate-200 text-slate-600'
                                                                }`}
                                                        >
                                                            {getKindLabel(item.kind)}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full border ${item.defaultChargeTo === 'team'
                                                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                }`}
                                                        >
                                                            기본 {getChargeTargetLabel(item.defaultChargeTo)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-right font-black text-slate-800 min-w-[140px] bg-emerald-50">작업자 공제</th>
                                        <th className="px-4 py-3 text-right font-black text-slate-800 min-w-[140px] bg-amber-50">팀 청구</th>
                                        <th className="px-4 py-3 text-right font-black text-slate-800 min-w-[140px] bg-slate-100">총합</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-700 min-w-[220px]">메모</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {mockRows.map(row => {
                                        const totals = calcRowTotals(row);
                                        return (
                                            <tr key={row.workerName} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{row.workerName}</div>
                                                    <div className="text-xs text-slate-500">{row.role}</div>
                                                </td>
                                                {mockItems.map(item => {
                                                    const value = row.items[item.id] ?? 0;
                                                    const chargeTo = row.chargeToOverride?.[item.id] ?? item.defaultChargeTo;
                                                    const tone = chargeTo === 'team' ? 'bg-amber-50/40' : 'bg-emerald-50/30';
                                                    const textTone = value > 0 ? 'text-slate-700' : 'text-slate-300';

                                                    return (
                                                        <td key={item.id} className={`px-4 py-3 text-right font-mono ${textTone} ${tone}`}>
                                                            {formatCurrency(value)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-3 text-right font-black text-emerald-700 bg-emerald-50">
                                                    {formatCurrency(totals.workerDeduction)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-amber-700 bg-amber-50">
                                                    {formatCurrency(totals.teamCharge)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-slate-800 bg-slate-100">
                                                    {formatCurrency(totals.grand)}
                                                </td>
                                                <td className="px-4 py-3 text-left text-sm text-slate-600">
                                                    {row.memo && row.memo.trim().length > 0 ? row.memo : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-900 text-white">
                                    <tr>
                                        <td className="px-4 py-3 font-bold">합계</td>
                                        <td colSpan={mockItems.length} className="px-4 py-3 text-right text-slate-300">
                                            (항목별 합계는 구현 시 제공)
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-emerald-300">
                                            {formatCurrency(grandTotals.workerDeduction)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-amber-300">
                                            {formatCurrency(grandTotals.teamCharge)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black">
                                            {formatCurrency(grandTotals.grand)}
                                        </td>
                                        <td className="px-4 py-3" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                    <FontAwesomeIcon icon={faLock} className="text-slate-500" />
                                    마감(잠금)
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                    급여 확정/청구서 발행 이후에는 장부를 잠금 처리하여 수정 리스크를 줄입니다.
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                    <FontAwesomeIcon icon={faArrowsRotate} className="text-slate-500" />
                                    전월 이월
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                    전월 잔액을 다음 달 carryover로 자동 반영합니다(규칙은 팀 합의 필요).
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                    <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-slate-500" />
                                    팀 청구서
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                    팀청구 항목만 집계해 청구서를 생성하고, 발행/완납 상태로 관리합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'data_model' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    {renderSectionHeader(
                        'Firestore 컬렉션 설계(안)',
                        '항목 마스터 + 월별 장부 + 팀 청구서로 분리하여 확장성과 정산 안정성을 확보합니다.',
                        faDatabase
                    )}

                    <div className="space-y-6">
                        {collections.map(col => (
                            <div key={col.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-sm font-black text-slate-800">{col.title}</div>
                                            <div className="text-xs text-slate-500 mt-1">{col.purpose}</div>
                                        </div>
                                        <div className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full">
                                            {col.fields.length} fields
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white border-b border-slate-100 text-xs text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left w-[220px]">Field</th>
                                                <th className="px-4 py-3 text-left w-[220px]">Type</th>
                                                <th className="px-4 py-3 text-left">Description</th>
                                                <th className="px-4 py-3 text-center w-[100px]">Required</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {col.fields.map(field => (
                                                <tr key={`${col.id}:${field.name}`} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-mono text-slate-700">{field.name}</td>
                                                    <td className="px-4 py-3 font-mono text-slate-600">{field.type}</td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        <div className="font-medium">{field.description}</div>
                                                        {field.note && (
                                                            <div className="text-xs text-slate-500 mt-1">{field.note}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span
                                                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${field.required
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                                                }`}
                                                        >
                                                            {field.required ? '필수' : '옵션'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 font-black text-amber-800">
                                <FontAwesomeIcon icon={faCircleInfo} />
                                기존 advance_payments 컬렉션과의 관계
                            </div>
                            <div className="mt-2 text-sm text-amber-900/80">
                                현재 `AdvancePaymentPage`는 고정 필드(숙소비/장갑/보증금 등) 기반입니다. 새 장부는
                                `advance_items`로 컬럼을 동적으로 구성하고, 월별 Row를 별도 저장하여 확장성을 확보합니다.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ux_flow' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    {renderSectionHeader(
                        '화면/업무 흐름(안)',
                        '실제 개발 시에는 현재 “가불 관리” 페이지 옆에 “장부” 메뉴를 추가하는 형태를 권장합니다.',
                        faDiagramProject
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {flowSteps.map((step, idx) => (
                            <div key={step.id} className="rounded-2xl border border-slate-200 p-5 bg-white">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-lg font-black text-slate-800">{step.title}</div>
                                        <div className="text-sm text-slate-600 mt-1">{step.description}</div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {step.keyOutputs.map(out => (
                                                <span key={`${step.id}:${out}`} className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                                                    {out}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'integration' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    {renderSectionHeader(
                        '급여/청구 연동 포인트(안)',
                        '장부 데이터가 어디로 흘러가고, 무엇을 기준으로 정산되는지 합의가 필요합니다.',
                        faLink
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50">
                            <div className="flex items-center gap-2 font-black text-slate-800">
                                <FontAwesomeIcon icon={faMoneyBillWave} className="text-indigo-600" />
                                급여(작업자 공제 반영)
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                    <span>장부에서 chargeTo=worker 항목만 합산해 급여에서 차감</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                    <span>명세서에는 “공제 상세”로 표시(항목별)</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                    <span>중복 차감 방지: 기존 advance_payments와 병행 기간 룰 필요</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50">
                            <div className="flex items-center gap-2 font-black text-slate-800">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600" />
                                팀 청구(별도 인보이스)
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    <span>chargeTo=team 항목만 집계해 팀 청구서 생성</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    <span>청구서에 근거 Row 링크(추적/검증)</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    <span>발행/완납 상태로 미수금 관리 가능</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 p-5 bg-white">
                        <div className="flex items-center gap-2 font-black text-slate-800">
                            <FontAwesomeIcon icon={faBookOpen} className="text-slate-600" />
                            합의가 필요한 룰(추천)
                        </div>
                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm text-slate-700">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="font-bold">전월 이월 기준</div>
                                <div className="text-slate-600 mt-1">이월은 “잔액” 기준인지, 특정 항목(가불)만 이월인지</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="font-bold">퇴사자 정산</div>
                                <div className="text-slate-600 mt-1">퇴사 시 월 마감 방식(즉시 정산/차월 이월 금지 등)</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="font-bold">마감 권한/이력</div>
                                <div className="text-slate-600 mt-1">누가 언제 잠금했는지, 잠금 해제 승인 프로세스</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'mvp' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    {renderSectionHeader(
                        'MVP 범위(권장)',
                        '팀이 빠르게 만들 수 있도록 “필수 기능”과 “추후 고도화”를 분리합니다.',
                        faListCheck
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                            <div className="font-black text-emerald-800 mb-3">MVP(필수)</div>
                            <div className="space-y-2 text-sm text-emerald-900/80">
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" /><span>항목 마스터 CRUD + 정렬(order)</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" /><span>월별 장부 그리드 입력/저장(팀/월)</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" /><span>작업자 공제/팀 청구 합계 자동 계산</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" /><span>마감(locked) 처리로 수정 제한</span></div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="font-black text-slate-800 mb-3">추후 고도화(Out of Scope)</div>
                            <div className="space-y-2 text-sm text-slate-700">
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500" /><span>엑셀 템플릿 업/다운 + 검증</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500" /><span>감사 로그(누가 어떤 금액을 언제 수정)</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500" /><span>청구서 출력(인쇄/PDF) 및 서명</span></div>
                                <div className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500" /><span>권한/승인 워크플로(잠금 해제 승인)</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 font-black text-slate-800">
                            <FontAwesomeIcon icon={faBookOpen} className="text-slate-600" />
                            추천 메뉴 구성(예시)
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="font-bold text-slate-800">가불 관리(기존)</div>
                                <div className="text-slate-600 mt-1">현재 페이지 유지(병행/마이그레이션 기간)</div>
                            </div>
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                                <div className="font-bold text-indigo-800">가불/공제 장부(신규)</div>
                                <div className="text-indigo-900/80 mt-1">동적 항목 + 마감 + 이월 + 팀청구</div>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="font-bold text-emerald-800">팀 청구서(신규)</div>
                                <div className="text-emerald-900/80 mt-1">팀청구 항목 집계/발행/완납 관리</div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 flex items-start gap-3">
                            <span className="mt-1 text-slate-500">
                                <FontAwesomeIcon icon={faCircleInfo} />
                            </span>
                            <div>
                                현재 페이지는 “기획 시각화”이므로 저장 기능이 없습니다. 팀이 구현할 때는 `advancePaymentService`와
                                별도의 `advanceLedgerService`를 분리하고, 마감 상태에 따른 쓰기 제한을 강제하는 것을 권장합니다.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvanceLedgerPlanningPage;
