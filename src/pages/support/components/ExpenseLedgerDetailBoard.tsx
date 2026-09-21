import SecureExpenseReceipt from '../../../components/SecureExpenseReceipt';
import React, { useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import type { CardBillingDocument } from '../../../types/cardBilling';
import type { TeamExpenseClaim } from '../../../types/teamExpenseLedger';
import { getAccommodationExpenseBucket } from '../../../utils/accommodationExpenseClassification';
import type { VehicleBillingDocument } from '../../../types/vehicleBilling';
import {
  formatCurrency,
  getBillingStatusLabel,
  getCategoryLabel,
  getStatusLabel,
  hexToRgba,
  summarizeVehicleBillingCosts
} from '../hooks/useExpenseLedgerData';
import type { ExpenseCategoryOption } from '../hooks/useExpenseLedgerData';

interface ExpenseLedgerDetailBoardProps {
  teamName: string;
  color: string;
  accommodationDocs: AccommodationBillingDocument[];
  vehicleDocs: VehicleBillingDocument[];
  cardDocs: CardBillingDocument[];
  receivableClaims: TeamExpenseClaim[];
  payableClaims: TeamExpenseClaim[];
  otherClaims: TeamExpenseClaim[];
  officeClaims?: TeamExpenseClaim[];
  categoryOptions?: ExpenseCategoryOption[];
  showClaims?: boolean;
  showTeamColumn?: boolean;
  selectedItemKey?: ExpenseLedgerDetailItemKey;
  fitWidth?: boolean;
  centerContent?: boolean;
}

export type ExpenseLedgerDetailItemKey =
  | 'accommodation'
  | 'privateRoom'
  | 'electricity'
  | 'gas'
  | 'water'
  | 'internet'
  | 'accommodationOther'
  | 'vehicleRent'
  | 'vehicleLease'
  | 'vehicleFuel'
  | 'vehicleRepair'
  | 'vehicleToll'
  | 'vehicleFine'
  | 'vehicleOther'
  | 'card'
  | 'otherClaim'
  | 'officeExpense'
  | 'receivable'
  | 'payable';

type ClaimSection = {
  key: 'receivable' | 'payable' | 'other' | 'office';
  title: string;
  description: string;
  colorClass: string;
  totalClass: string;
  rows: Array<TeamExpenseClaim & { counterparty: string }>;
};

const sortClaims = (rows: TeamExpenseClaim[]) =>
  rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'));

const toAmount = (value: unknown) => Number(value) || 0;

const normalizeGroupKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

const accommodationLabelSuffixPattern =
  /\s*(월세|숙소비|개인숙소|전기세|전기요금|도시가스|가스비|수도세|수도요금|유선비|인터넷|통신비|벌금|과태료|보증금|장갑)\s*$/;

const getAccommodationAddress = (label?: string, memo?: string) => {
  const rawLabel = String(label ?? '').trim();
  const strippedLabel = rawLabel
    .replace(accommodationLabelSuffixPattern, '')
    .replace(/[\s·:：/-]+$/, '')
    .trim();
  return strippedLabel || String(memo ?? '').trim() || rawLabel || '주소 미지정';
};

const getLedgerAwareBillingStatusLabel = (status: unknown, lineItems?: Array<{ sourceType?: unknown }>) => {
  const raw = String(status ?? '').trim().toLowerCase();
  const hasLedgerLine = (lineItems ?? []).some((item) => String(item.sourceType ?? '').endsWith('_ledger'));
  if (raw === 'draft' && hasLedgerLine) return '원장청구';
  return getBillingStatusLabel(status);
};

const isPersonalBillingTarget = (issuedToType?: unknown) =>
  String(issuedToType ?? '').trim().toLowerCase() === 'worker';

const emptyVehicleBreakdown: ReturnType<typeof summarizeVehicleBillingCosts> = {
  rent: 0,
  lease: 0,
  fuel: 0,
  fine: 0,
  repair: 0,
  toll: 0,
  other: 0,
  total: 0
};

const accommodationDetailConfig: Partial<Record<ExpenseLedgerDetailItemKey, {
  title: string;
  description: string;
  amountKey: 'rent' | 'privateRoom' | 'electricity' | 'gas' | 'water' | 'internet' | 'other';
}>> = {
  accommodation: { title: '숙소비', description: '숙소별 월세와 기본 숙소 청구 금액', amountKey: 'rent' },
  privateRoom: { title: '개인숙소', description: '개인에게 배정된 숙소 청구 금액', amountKey: 'privateRoom' },
  electricity: { title: '전기세', description: '숙소별 전기요금 청구 금액', amountKey: 'electricity' },
  gas: { title: '도시가스', description: '숙소별 도시가스 청구 금액', amountKey: 'gas' },
  water: { title: '수도세', description: '숙소별 수도요금 청구 금액', amountKey: 'water' },
  internet: { title: '유선비', description: '숙소별 인터넷·통신비 청구 금액', amountKey: 'internet' },
  accommodationOther: { title: '숙소기타', description: '숙소에서 발생한 기타 청구 금액', amountKey: 'other' }
};

const vehicleDetailConfig: Partial<Record<ExpenseLedgerDetailItemKey, {
  title: string;
  description: string;
  amountKey: 'rent' | 'lease' | 'fuel' | 'repair' | 'toll' | 'fine' | 'other';
}>> = {
  vehicleRent: { title: '렌트비', description: '차량별 월 렌트 청구 금액', amountKey: 'rent' },
  vehicleLease: { title: '리스비', description: '차량별 월 리스 청구 금액', amountKey: 'lease' },
  vehicleFuel: { title: '주유비', description: '차량별 주유 청구 금액', amountKey: 'fuel' },
  vehicleRepair: { title: '수리비', description: '차량별 정비·수리 청구 금액', amountKey: 'repair' },
  vehicleToll: { title: '통행료', description: '차량별 통행료 청구 금액', amountKey: 'toll' },
  vehicleFine: { title: '과태료', description: '차량별 과태료 청구 금액', amountKey: 'fine' },
  vehicleOther: { title: '차량기타', description: '차량에서 발생한 기타 청구 금액', amountKey: 'other' }
};

const claimDetailSectionByItemKey: Partial<Record<ExpenseLedgerDetailItemKey, ClaimSection['key']>> = {
  receivable: 'receivable',
  payable: 'payable',
  otherClaim: 'other',
  officeExpense: 'office'
};

export const ExpenseLedgerDetailBoard: React.FC<ExpenseLedgerDetailBoardProps> = ({
  teamName,
  color,
  accommodationDocs,
  vehicleDocs,
  cardDocs,
  receivableClaims,
  payableClaims,
  otherClaims,
  officeClaims = [],
  categoryOptions = [],
  showClaims = true,
  showTeamColumn = false,
  selectedItemKey,
  fitWidth = false,
  centerContent = false
}) => {
  const teamSectionHeaderStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(color, 0.15),
    boxShadow: `inset 4px 0 0 ${color}`
  };
  const tableViewportClass = fitWidth
    ? `overflow-hidden [&_table]:min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_th]:break-words [&_th]:px-1 [&_th]:py-2 [&_td]:whitespace-normal [&_td]:break-words [&_td]:px-1 [&_td]:py-2 ${centerContent ? '[&_th]:!text-center [&_td]:!text-center' : ''}`
    : 'overflow-x-auto';

  const accommodationRows = useMemo(() => {
    const rowMap = new Map<string, {
      id: string;
      teamName: string;
      address: string;
      rent: number;
      privateRoom: number;
      electricity: number;
      gas: number;
      water: number;
      internet: number;
      other: number;
      total: number;
      userSet: Set<string>;
      statusSet: Set<string>;
    }>();

    accommodationDocs.forEach((doc) => {
      const isPersonalBilling = isPersonalBillingTarget(doc.issuedToType);
      (doc.lineItems || []).forEach((item, index) => {
        const rawAmount = toAmount(item.amount);
        if (rawAmount <= 0 && !isPersonalBilling) return;
        // 개인청구 금액은 팀 정산 합계에서는 제외되지만, 상세표에서는
        // 저장된 원장 금액을 그대로 보여 줘야 AI 청구서 반영 여부를
        // 사용자가 확인할 수 있다.
        const amount = rawAmount;

        const address = getAccommodationAddress(item.label, doc.memo);
        const team = doc.teamName || '팀 미지정';
        const groupId = item.sourceAccommodationId || `${doc.id}-${normalizeGroupKey(address) || index}`;
        const key = `${normalizeGroupKey(team)}-${normalizeGroupKey(groupId)}`;
        const row = rowMap.get(key) ?? {
          id: key,
          teamName: team,
          address,
          rent: 0,
          privateRoom: 0,
          electricity: 0,
          gas: 0,
          water: 0,
          internet: 0,
          other: 0,
          total: 0,
          userSet: new Set<string>(),
          statusSet: new Set<string>()
        };

        const expenseBucket = getAccommodationExpenseBucket(item);
        const rent = expenseBucket === 'accommodation' ? amount : 0;
        const privateRoom = expenseBucket === 'privateRoom' ? amount : 0;
        const electricity = expenseBucket === 'electricity' ? amount : 0;
        const gas = expenseBucket === 'gas' ? amount : 0;
        const water = expenseBucket === 'water' ? amount : 0;
        const internet = expenseBucket === 'internet' ? amount : 0;
        const other = expenseBucket === 'other' ? amount : 0;

        row.rent += rent;
        row.privateRoom += privateRoom;
        row.electricity += electricity;
        row.gas += gas;
        row.water += water;
        row.internet += internet;
        row.other += other;
        row.total += amount;
        row.userSet.add(doc.issuedToWorkerName || doc.teamName || '팀 공용');
        row.statusSet.add(isPersonalBilling ? '개인청구' : getLedgerAwareBillingStatusLabel(doc.status, [item]));
        rowMap.set(key, row);
      });
    });

    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        user: Array.from(row.userSet).join(', '),
        status: Array.from(row.statusSet).join(', ')
      }))
      .sort((a, b) => `${a.teamName} ${a.address}`.localeCompare(`${b.teamName} ${b.address}`, 'ko-KR'));
  }, [accommodationDocs]);

  const vehicleRows = useMemo(() => {
    const rowMap = new Map<string, {
      id: string;
      teamName: string;
      plate: string;
      rent: number;
      lease: number;
      fuel: number;
      fine: number;
      repair: number;
      toll: number;
      other: number;
      total: number;
      userSet: Set<string>;
      statusSet: Set<string>;
    }>();

    const addBreakdown = (
      doc: VehicleBillingDocument,
      breakdown: ReturnType<typeof summarizeVehicleBillingCosts>,
      lineItems?: Array<{ sourceType?: unknown }>
    ) => {
      const isPersonalBilling = isPersonalBillingTarget(doc.issuedToType);
      if (breakdown.total <= 0 && !isPersonalBilling) return;
      const appliedBreakdown = isPersonalBilling ? emptyVehicleBreakdown : breakdown;

      const team = doc.teamName || doc.assignedTeamName || '팀 미지정';
      const plate = doc.vehiclePlate || '차량 미지정';
      const vehicleKey = doc.vehicleId || plate;
      const key = `${normalizeGroupKey(team)}-${normalizeGroupKey(vehicleKey)}`;
      const row = rowMap.get(key) ?? {
        id: key,
        teamName: team,
        plate,
        rent: 0,
        lease: 0,
        fuel: 0,
        fine: 0,
        repair: 0,
        toll: 0,
        other: 0,
        total: 0,
        userSet: new Set<string>(),
        statusSet: new Set<string>()
      };

      row.rent += appliedBreakdown.rent;
      row.lease += appliedBreakdown.lease;
      row.fuel += appliedBreakdown.fuel;
      row.fine += appliedBreakdown.fine;
      row.repair += appliedBreakdown.repair;
      row.toll += appliedBreakdown.toll;
      row.other += appliedBreakdown.other;
      row.total += appliedBreakdown.total;
      row.userSet.add(doc.issuedToWorkerName || doc.teamName || doc.assignedTeamName || '팀 공용');
      row.statusSet.add(isPersonalBilling ? '개인청구' : getLedgerAwareBillingStatusLabel(doc.status, lineItems ?? doc.lineItems));
      rowMap.set(key, row);
    };

    vehicleDocs.forEach((doc) => {
      const items = doc.lineItems || [];
      if (items.length === 0) {
        addBreakdown(doc, summarizeVehicleBillingCosts(doc), doc.lineItems);
        return;
      }

      items.forEach((item) => {
        const amount = toAmount(item.amount);
        const breakdown = summarizeVehicleBillingCosts({
          ...doc,
          fixedCost: 0,
          variableCost: 0,
          totalAmount: amount,
          lineItems: [item]
        });
        addBreakdown(doc, breakdown, [item]);
      });
    });

    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        user: Array.from(row.userSet).join(', '),
        status: Array.from(row.statusSet).join(', ')
      }))
      .sort((a, b) => `${a.teamName} ${a.plate}`.localeCompare(`${b.teamName} ${b.plate}`, 'ko-KR'));
  }, [vehicleDocs]);

  const cardRows = useMemo(() => {
    const rowMap = new Map<string, {
      id: string;
      teamName: string;
      date: string;
      cardName: string;
      amount: number;
      userSet: Set<string>;
      statusSet: Set<string>;
    }>();

    const addAmount = (
      doc: CardBillingDocument,
      amount: number,
      lineItems?: Array<{ sourceType?: unknown }>
    ) => {
      const isPersonalBilling = isPersonalBillingTarget(doc.issuedToType);
      if (amount <= 0 && !isPersonalBilling) return;
      const appliedAmount = isPersonalBilling ? 0 : amount;

      const team = doc.teamName || doc.assignedTeamName || '팀 미지정';
      const cardName = doc.cardLabel || '카드 미지정';
      const cardKey = doc.cardId || cardName;
      const key = `${normalizeGroupKey(team)}-${normalizeGroupKey(cardKey)}`;
      const row = rowMap.get(key) ?? {
        id: key,
        teamName: team,
        date: doc.yearMonth,
        cardName,
        amount: 0,
        userSet: new Set<string>(),
        statusSet: new Set<string>()
      };

      row.amount += appliedAmount;
      row.userSet.add(doc.issuedToWorkerName || doc.teamName || doc.assignedTeamName || '팀 공용');
      row.statusSet.add(isPersonalBilling ? '개인청구' : getLedgerAwareBillingStatusLabel(doc.status, lineItems ?? doc.lineItems));
      rowMap.set(key, row);
    };

    cardDocs.forEach((doc) => {
      const items = doc.lineItems || [];
      if (items.length === 0) {
        addAmount(doc, toAmount(doc.totalAmount), doc.lineItems);
        return;
      }

      items.forEach((item) => {
        addAmount(doc, toAmount(item.amount), [item]);
      });
    });

    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        user: Array.from(row.userSet).join(', '),
        status: Array.from(row.statusSet).join(', ')
      }))
      .sort((a, b) => `${a.teamName} ${a.cardName}`.localeCompare(`${b.teamName} ${b.cardName}`, 'ko-KR'));
  }, [cardDocs]);

  const claimSections = useMemo<ClaimSection[]>(() => {
    return [
      {
        key: 'receivable',
        title: '받을 후청구',
        description: '이 팀이 먼저 사용하고 상대팀에 청구한 금액',
        colorClass: 'bg-emerald-50 text-emerald-800',
        totalClass: 'bg-emerald-50 text-emerald-800',
        rows: sortClaims(receivableClaims).map((claim) => ({
          ...claim,
          counterparty: claim.chargeToTeamName || '상대팀 미지정'
        }))
      },
      {
        key: 'payable',
        title: '내야 할 후청구',
        description: '다른 팀이 이 팀 담당 현장에 청구한 금액',
        colorClass: 'bg-rose-50 text-rose-800',
        totalClass: 'bg-rose-50 text-rose-800',
        rows: sortClaims(payableClaims).map((claim) => ({
          ...claim,
          counterparty: claim.payerTeamName || '사용팀 미지정'
        }))
      },
      {
        key: 'other',
        title: '기타청구',
        description: '해당 팀에게만 반영되는 보증금, 마이킹, 기타 청구 금액',
        colorClass: 'bg-amber-50 text-amber-800',
        totalClass: 'bg-amber-50 text-amber-800',
        rows: sortClaims(otherClaims).map((claim) => ({
          ...claim,
          counterparty: ''
        }))
      },
      {
        key: 'office',
        title: '사무실경비',
        description: '기타청구와 분리해 사무실 비용으로 별도 집계되는 금액',
        colorClass: 'bg-sky-50 text-sky-800',
        totalClass: 'bg-sky-50 text-sky-800',
        rows: sortClaims(officeClaims).map((claim) => ({
          ...claim,
          counterparty: ''
        }))
      }
    ];
  }, [officeClaims, otherClaims, payableClaims, receivableClaims]);

  if (selectedItemKey) {
    const accommodationDetail = accommodationDetailConfig[selectedItemKey];
    const vehicleDetail = vehicleDetailConfig[selectedItemKey];
    const claimSectionKey = claimDetailSectionByItemKey[selectedItemKey];
    const claimSection = claimSectionKey
      ? claimSections.find((section) => section.key === claimSectionKey)
      : undefined;
    const focusedAccommodationRows = accommodationDetail
      ? accommodationRows.filter((row) => toAmount(row[accommodationDetail.amountKey]) !== 0)
      : [];
    const focusedVehicleRows = vehicleDetail
      ? vehicleRows.filter((row) => toAmount(row[vehicleDetail.amountKey]) !== 0)
      : [];
    const focusedCardRows = selectedItemKey === 'card'
      ? cardRows.filter((row) => toAmount(row.amount) !== 0)
      : [];
    const focusedClaimRows = showClaims ? claimSection?.rows ?? [] : [];
    const focusedTitle = accommodationDetail?.title
      ?? vehicleDetail?.title
      ?? (selectedItemKey === 'card' ? '카드값' : claimSection?.title)
      ?? '상세내역';
    const focusedDescription = accommodationDetail?.description
      ?? vehicleDetail?.description
      ?? (selectedItemKey === 'card' ? '카드별 월 청구 금액' : claimSection?.description)
      ?? '선택한 항목의 상세 내역';
    const focusedRowCount = accommodationDetail
      ? focusedAccommodationRows.length
      : vehicleDetail
        ? focusedVehicleRows.length
        : selectedItemKey === 'card'
          ? focusedCardRows.length
          : focusedClaimRows.length;
    const focusedTotal = accommodationDetail
      ? focusedAccommodationRows.reduce((sum, row) => sum + toAmount(row[accommodationDetail.amountKey]), 0)
      : vehicleDetail
        ? focusedVehicleRows.reduce((sum, row) => sum + toAmount(row[vehicleDetail.amountKey]), 0)
        : selectedItemKey === 'card'
          ? focusedCardRows.reduce((sum, row) => sum + toAmount(row.amount), 0)
          : focusedClaimRows.reduce((sum, row) => sum + toAmount(row.amount), 0);

    return (
      <div
        id="team-expense-detail-panel"
        className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        aria-label={`${teamName} ${focusedTitle} 상세내역`}
      >
        <div
          className={fitWidth
            ? `flex flex-col gap-1.5 border-b border-slate-200 px-3 py-2.5 ${centerContent ? 'items-center text-center' : ''}`
            : 'flex flex-col gap-2 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between'}
          style={teamSectionHeaderStyle}
        >
          <div className="min-w-0">
            <div className={fitWidth ? 'truncate text-base font-black text-slate-950' : 'truncate text-lg font-black text-slate-950'}>
              {teamName} {focusedTitle} 상세내역
            </div>
            <div className={fitWidth ? 'mt-0.5 text-xs font-bold leading-snug text-slate-600' : 'mt-0.5 text-sm font-bold text-slate-600'}>{focusedDescription}</div>
          </div>
          <div className={fitWidth ? 'flex min-w-0 items-center justify-center gap-3' : 'flex shrink-0 items-center gap-3 sm:text-right'}>
            <span className="rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-xs font-black text-slate-600">
              {focusedRowCount.toLocaleString('ko-KR')}건
            </span>
            <span className={fitWidth ? 'min-w-0 text-center text-lg font-black tabular-nums text-slate-950' : 'text-xl font-black tabular-nums text-slate-950'}>{formatCurrency(focusedTotal)}</span>
          </div>
        </div>

        <div className={tableViewportClass}>
          {accommodationDetail && (
            <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[680px] border-collapse text-sm'}>
              <thead>
                <tr className="bg-slate-100 text-slate-700 shadow-[0_1px_0_#cbd5e1]">
                  {showTeamColumn && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">팀</th>}
                  <th className="border-r border-slate-200 px-3 py-2.5 text-left font-black">주소</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">사용자</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">상태</th>
                  <th className="px-3 py-2.5 text-right font-black">{focusedTitle}</th>
                </tr>
              </thead>
              <tbody>
                {focusedAccommodationRows.length > 0 ? focusedAccommodationRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                    {showTeamColumn && <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                    <td className="border-r border-slate-200 px-3 py-2.5 font-bold text-slate-900">{row.address}</td>
                    <td className="border-r border-slate-200 bg-emerald-50/60 px-3 py-2.5 text-center font-bold text-emerald-800">{row.user}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-600">{row.status}</td>
                    <td className="bg-slate-50 px-3 py-2.5 text-right text-base font-black tabular-nums text-slate-950">
                      {formatCurrency(row[accommodationDetail.amountKey])}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={showTeamColumn ? 5 : 4} className="px-5 py-16 text-center text-base font-bold text-slate-400">
                      {focusedTitle} 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {focusedAccommodationRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-white shadow-[0_-1px_0_#cbd5e1]">
                    <td colSpan={showTeamColumn ? 4 : 3} className="px-3 py-3 text-center text-sm font-black text-slate-700">합계</td>
                    <td className="bg-rose-50 px-3 py-3 text-right text-base font-black tabular-nums text-rose-700">{formatCurrency(focusedTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {vehicleDetail && (
            <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[680px] border-collapse text-sm'}>
              <thead>
                <tr className="bg-slate-100 text-slate-700 shadow-[0_1px_0_#cbd5e1]">
                  {showTeamColumn && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">팀</th>}
                  <th className="border-r border-slate-200 px-3 py-2.5 text-left font-black">차량번호</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">사용자</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">상태</th>
                  <th className="px-3 py-2.5 text-right font-black">{focusedTitle}</th>
                </tr>
              </thead>
              <tbody>
                {focusedVehicleRows.length > 0 ? focusedVehicleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                    {showTeamColumn && <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                    <td className="border-r border-slate-200 px-3 py-2.5 text-base font-black text-slate-950">{row.plate}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.user}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-600">{row.status}</td>
                    <td className="bg-slate-50 px-3 py-2.5 text-right text-base font-black tabular-nums text-slate-950">
                      {formatCurrency(row[vehicleDetail.amountKey])}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={showTeamColumn ? 5 : 4} className="px-5 py-16 text-center text-base font-bold text-slate-400">
                      {focusedTitle} 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {focusedVehicleRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-white shadow-[0_-1px_0_#cbd5e1]">
                    <td colSpan={showTeamColumn ? 4 : 3} className="px-3 py-3 text-center text-sm font-black text-slate-700">합계</td>
                    <td className="bg-rose-50 px-3 py-3 text-right text-base font-black tabular-nums text-rose-700">{formatCurrency(focusedTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {selectedItemKey === 'card' && (
            <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[620px] border-collapse text-sm'}>
              <thead>
                <tr className="bg-slate-100 text-slate-700 shadow-[0_1px_0_#cbd5e1]">
                  {showTeamColumn && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">팀</th>}
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">결제월</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-left font-black">카드명</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">사용자</th>
                  <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">상태</th>
                  <th className="px-3 py-2.5 text-right font-black">금액</th>
                </tr>
              </thead>
              <tbody>
                {focusedCardRows.length > 0 ? focusedCardRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                    {showTeamColumn && <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.date}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-base font-black text-blue-700">{row.cardName}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{row.user}</td>
                    <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-600">{row.status}</td>
                    <td className="bg-slate-50 px-3 py-2.5 text-right text-base font-black tabular-nums text-slate-950">{formatCurrency(row.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={showTeamColumn ? 6 : 5} className="px-5 py-16 text-center text-base font-bold text-slate-400">카드값 내역이 없습니다.</td>
                  </tr>
                )}
              </tbody>
              {focusedCardRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-white shadow-[0_-1px_0_#cbd5e1]">
                    <td colSpan={showTeamColumn ? 5 : 4} className="px-3 py-3 text-center text-sm font-black text-slate-700">합계</td>
                    <td className="bg-rose-50 px-3 py-3 text-right text-base font-black tabular-nums text-rose-700">{formatCurrency(focusedTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {claimSection && (() => {
            const isStandaloneSection = claimSection.key === 'other' || claimSection.key === 'office';
            const emptyColSpan = isStandaloneSection ? 5 : 8;
            const footerLabelColSpan = isStandaloneSection ? 3 : 6;
            return (
              <table className={fitWidth
                ? 'w-full table-fixed border-collapse text-xs'
                : `w-full ${isStandaloneSection ? 'min-w-[620px]' : 'min-w-[820px]'} border-collapse text-sm`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-700 shadow-[0_1px_0_#cbd5e1]">
                    <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">날짜</th>
                    {!isStandaloneSection && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">상대팀</th>}
                    {!isStandaloneSection && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">현장</th>}
                    <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">구분</th>
                    <th className="border-r border-slate-200 px-3 py-2.5 text-left font-black">내용</th>
                    {!isStandaloneSection && <th className="border-r border-slate-200 px-3 py-2.5 text-center font-black">결제</th>}
                    <th className="border-r border-slate-200 px-3 py-2.5 text-right font-black">금액</th>
                    <th className="px-3 py-2.5 text-center font-black">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {focusedClaimRows.length > 0 ? focusedClaimRows.map((claim) => (
                    <tr key={`${claimSection.key}-${claim.id}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold">{claim.date?.slice(5) || '-'}</td>
                      {!isStandaloneSection && <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold text-slate-700">{claim.counterparty || '-'}</td>}
                      {!isStandaloneSection && <td className="border-r border-slate-200 px-3 py-2.5 text-center">{claim.siteName || '-'}</td>}
                      <td className="border-r border-slate-200 px-3 py-2.5 text-center font-bold">{getCategoryLabel(claim.category, categoryOptions)}</td>
                      <td className="border-r border-slate-200 px-3 py-2.5 font-bold text-slate-900">
                        <div>{claim.description}</div>
                        {(claim.attachments ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(claim.attachments ?? []).map((attachment) => (
                              attachment.fullPath?.startsWith('team-expense-receipts/') ? <SecureExpenseReceipt key={attachment.id} fullPath={attachment.fullPath} name={attachment.name} /> : attachment.url ? (
                                <a
                                  key={attachment.id || attachment.fullPath || attachment.url}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={attachment.name}
                                  className="inline-flex h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-white"
                                >
                                  <img src={attachment.url} alt={attachment.name || '첨부 사진'} className="h-full w-full object-cover" />
                                </a>
                              ) : (
                                <span
                                  key={attachment.id || attachment.fullPath || attachment.name}
                                  title={attachment.name}
                                  className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-500"
                                >
                                  <ImageIcon size={13} />
                                  {attachment.name || '첨부'}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </td>
                      {!isStandaloneSection && <td className="border-r border-slate-200 px-3 py-2.5 text-center text-slate-600">{claim.cardLabel || '-'}</td>}
                      <td className="border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-base font-black tabular-nums">{formatCurrency(claim.amount)}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-600">{getStatusLabel(claim.status)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={emptyColSpan} className="px-5 py-16 text-center text-base font-bold text-slate-400">{focusedTitle} 내역이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
                {focusedClaimRows.length > 0 && (
                  <tfoot>
                    <tr className={`${claimSection.totalClass} border-t-2 border-slate-300 shadow-[0_-1px_0_#cbd5e1]`}>
                      <td colSpan={footerLabelColSpan} className="px-3 py-3 text-center text-sm font-black">합계</td>
                      <td className="px-3 py-3 text-right text-base font-black tabular-nums">{formatCurrency(focusedTotal)}</td>
                      <td className="px-3 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className={fitWidth
      ? `flex h-full min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto pb-2 ${centerContent ? 'text-center' : ''}`
      : 'flex h-full min-w-0 flex-col gap-4 overflow-y-auto pb-4 pr-2'}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div
          className="border-b border-slate-200 px-4 py-2.5 text-center text-base font-black text-slate-900"
          style={teamSectionHeaderStyle}
        >
          {teamName} 숙소 상세내역
        </div>
        <div className={tableViewportClass}>
          <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[1120px] border-collapse text-xs'}>
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                {showTeamColumn && <th className="border border-slate-200 px-2 py-1.5 text-center">팀</th>}
                <th className="border border-slate-200 px-2 py-1.5 text-center">주소</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">숙소비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">개인숙소</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">전기세</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">도시가스</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">수도세</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">유선비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">합계</th>
              </tr>
            </thead>
            <tbody>
              {accommodationRows.length > 0 ? accommodationRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {showTeamColumn && <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-700">{row.address}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.privateRoom ? formatCurrency(row.privateRoom) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.electricity ? formatCurrency(row.electricity) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.gas ? formatCurrency(row.gas) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.water ? formatCurrency(row.water) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.internet ? formatCurrency(row.internet) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.other ? formatCurrency(row.other) : '-'}</td>
                  <td className="border border-slate-200 bg-green-50 px-2 py-1.5 text-center font-medium text-green-700">{row.user}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{row.status}</td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={showTeamColumn ? 12 : 11} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">숙소비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {accommodationRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={showTeamColumn ? 2 : 1} className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.privateRoom, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.electricity, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.gas, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.water, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.internet, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div
          className="border-b border-slate-200 px-4 py-2.5 text-center text-base font-black text-slate-900"
          style={teamSectionHeaderStyle}
        >
          차량 렌트 및 유지비 상세내역
        </div>
        <div className={tableViewportClass}>
          <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[1120px] border-collapse text-xs'}>
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                {showTeamColumn && <th className="border border-slate-200 px-2 py-1.5 text-center">팀</th>}
                <th className="border border-slate-200 px-2 py-1.5 text-center">차량번호</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">렌트비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">리스비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">주유비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">수리비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">통행료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">과태료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">합계</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.length > 0 ? vehicleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {showTeamColumn && <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                  <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">{row.plate}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.lease ? formatCurrency(row.lease) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.fuel ? formatCurrency(row.fuel) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.repair ? formatCurrency(row.repair) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.toll ? formatCurrency(row.toll) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums text-orange-600">{row.fine ? formatCurrency(row.fine) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.other ? formatCurrency(row.other) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">{row.user}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{row.status}</td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={showTeamColumn ? 12 : 11} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">차량비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {vehicleRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={showTeamColumn ? 2 : 1} className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.lease, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.fuel, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.repair, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.toll, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums text-orange-600">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.fine, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div
          className="border-b border-slate-200 px-4 py-2.5 text-center text-base font-black text-slate-900"
          style={teamSectionHeaderStyle}
        >
          카드 청구 상세내역
        </div>
        <div className={tableViewportClass}>
          <table className={fitWidth ? 'w-full table-fixed border-collapse text-xs' : 'w-full min-w-[640px] border-collapse text-xs'}>
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                {showTeamColumn && <th className="border border-slate-200 px-2 py-1.5 text-center">팀</th>}
                <th className="border border-slate-200 px-2 py-1.5 text-center">결제월</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">카드명</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">금액</th>
              </tr>
            </thead>
            <tbody>
              {cardRows.length > 0 ? cardRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {showTeamColumn && <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{row.teamName}</td>}
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{row.date}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-blue-700">{row.cardName}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">{row.user}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{row.status}</td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.amount)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={showTeamColumn ? 6 : 5} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">카드 청구 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {cardRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={showTeamColumn ? 5 : 4} className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(cardRows.reduce((sum, row) => sum + row.amount, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showClaims && claimSections.map((section) => {
        const subtotal = section.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const isStandaloneSection = section.key === 'other' || section.key === 'office';
        const tableMinWidth = isStandaloneSection ? 'min-w-[520px]' : 'min-w-[760px]';
        const emptyColSpan = isStandaloneSection ? 5 : 8;
        const footerLabelColSpan = isStandaloneSection ? 3 : 6;

        return (
          <div key={section.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className={`border-b border-slate-200 px-4 py-2 ${section.colorClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={fitWidth ? 'text-base font-black' : 'text-sm font-black'}>{teamName} {section.title}</div>
                  <div className={fitWidth ? 'mt-0.5 text-xs font-bold opacity-80' : 'mt-0.5 text-[11px] font-bold opacity-80'}>{section.description}</div>
                </div>
                <div className={fitWidth ? 'text-lg font-black tabular-nums' : 'text-base font-black tabular-nums'}>{formatCurrency(subtotal)}</div>
              </div>
            </div>
            <div className={tableViewportClass}>
              <table className={fitWidth
                ? 'w-full table-fixed border-collapse text-xs'
                : `w-full ${tableMinWidth} border-collapse text-xs`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="border border-slate-200 px-2 py-1.5 text-center">날짜</th>
                    {!isStandaloneSection && <th className="border border-slate-200 px-2 py-1.5 text-center">상대팀</th>}
                    {!isStandaloneSection && <th className="border border-slate-200 px-2 py-1.5 text-center">현장</th>}
                    <th className="border border-slate-200 px-2 py-1.5 text-center">구분</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-left">내용</th>
                    {!isStandaloneSection && <th className="border border-slate-200 px-2 py-1.5 text-center">결제</th>}
                    <th className="border border-slate-200 px-2 py-1.5 text-right">금액</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length > 0 ? section.rows.map((claim) => (
                    <tr key={`${section.key}-${claim.id}`} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.date?.slice(5) || '-'}</td>
                      {!isStandaloneSection && <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{claim.counterparty || '-'}</td>}
                      {!isStandaloneSection && <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.siteName || '-'}</td>}
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{getCategoryLabel(claim.category, categoryOptions)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                        <div>{claim.description}</div>
                        {(claim.attachments ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(claim.attachments ?? []).map((attachment) => (
                              attachment.fullPath?.startsWith('team-expense-receipts/') ? <SecureExpenseReceipt key={attachment.id} fullPath={attachment.fullPath} name={attachment.name} /> : attachment.url ? (
                                <a
                                  key={attachment.id || attachment.fullPath || attachment.url}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={attachment.name}
                                  className="inline-flex h-8 w-8 overflow-hidden rounded border border-slate-200 bg-white"
                                >
                                  <img src={attachment.url} alt={attachment.name || '첨부 사진'} className="h-full w-full object-cover" />
                                </a>
                              ) : (
                                <span
                                  key={attachment.id || attachment.fullPath || attachment.name}
                                  title={attachment.name}
                                  className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-500"
                                >
                                  <ImageIcon size={11} />
                                  {attachment.name || '첨부'}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </td>
                      {!isStandaloneSection && <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">{claim.cardLabel || '-'}</td>}
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-black tabular-nums">{formatCurrency(claim.amount)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{getStatusLabel(claim.status)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={emptyColSpan} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">내역이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
                {section.rows.length > 0 && (
                  <tfoot>
                    <tr className={section.totalClass}>
                      <td colSpan={footerLabelColSpan} className="border border-slate-200 px-2 py-2 text-center font-black">합계</td>
                      <td className="border border-slate-200 px-2 py-2 text-right font-black tabular-nums">{formatCurrency(subtotal)}</td>
                      <td className="border border-slate-200 px-2 py-2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
