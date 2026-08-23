import React, { useMemo } from 'react';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import type { VehicleBillingDocument } from '../../../types/vehicleBilling';
import type { CardBillingDocument } from '../../../types/cardBilling';
import type { TeamExpenseClaim } from '../../../types/teamExpenseLedger';
import { getAccommodationExpenseBucket } from '../../../utils/accommodationExpenseClassification';
import {
  formatCurrency,
  getBillingStatusLabel,
  getCategoryLabel,
  getStatusLabel,
  hexToRgba,
  summarizeVehicleBillingCosts
} from '../hooks/useExpenseLedgerData';
import type { ExpenseCategoryOption } from '../hooks/useExpenseLedgerData';

interface Props {
  teamName: string;
  color: string;
  accommodationDocs: AccommodationBillingDocument[];
  vehicleDocs: VehicleBillingDocument[];
  cardDocs: CardBillingDocument[];
  receivableClaims: TeamExpenseClaim[];
  payableClaims: TeamExpenseClaim[];
  otherClaims: TeamExpenseClaim[];
  categoryOptions?: ExpenseCategoryOption[];
}

export const ExpenseDetailBoard: React.FC<Props> = ({
  teamName,
  color,
  accommodationDocs,
  vehicleDocs,
  cardDocs,
  receivableClaims,
  payableClaims,
  otherClaims,
  categoryOptions = []
}) => {
  const accommRows = useMemo(() => {
    return accommodationDocs.map((doc) => {
      let rent = 0, electricity = 0, gas = 0, water = 0, internet = 0, other = 0;
      (doc.lineItems || []).forEach(item => {
        const amt = Number(item.amount) || 0;
        const expenseBucket = getAccommodationExpenseBucket(item);
        if (expenseBucket === 'accommodation' || expenseBucket === 'privateRoom') rent += amt;
        else if (expenseBucket === 'electricity') electricity += amt;
        else if (expenseBucket === 'gas') gas += amt;
        else if (expenseBucket === 'water') water += amt;
        else if (expenseBucket === 'internet') internet += amt;
        else other += amt;
      });

      const address = doc.memo || doc.lineItems?.[0]?.label || '상세 주소 미지정';
      const user = doc.issuedToWorkerName || '팀 공용';
      const total = rent + electricity + gas + water + internet + other;

      return { id: doc.id, address, rent, electricity, gas, water, internet, other, user, total };
    }).filter(r => r.total > 0);
  }, [accommodationDocs]);

  const vehicleRows = useMemo(() => {
    return vehicleDocs.map((doc) => {
      const breakdown = summarizeVehicleBillingCosts(doc);
      const plate = doc.vehiclePlate || '차량 미지정';
      const user = doc.issuedToWorkerName || doc.assignedTeamName || '팀 공용';

      return {
        id: doc.id,
        plate,
        rent: breakdown.rent,
        lease: breakdown.lease,
        fuel: breakdown.fuel,
        fine: breakdown.fine,
        repair: breakdown.repair,
        toll: breakdown.toll,
        other: breakdown.other,
        user,
        status: getBillingStatusLabel(doc.status),
        total: breakdown.total
      };
    }).filter(r => r.total > 0);
  }, [vehicleDocs]);

  const cardRows = useMemo(() => {
    return cardDocs.flatMap(doc => {
      const items = (doc.lineItems || []);
      if (items.length === 0) {
        if (Number(doc.totalAmount) > 0) {
          return [{
            id: doc.id,
            date: doc.yearMonth,
            cardName: doc.cardLabel || '카드 미지정',
            content: doc.memo || '상세 내역 없음',
            amount: Number(doc.totalAmount),
            user: doc.issuedToWorkerName || doc.assignedTeamName || '팀 공용'
          }];
        }
        return [];
      }
      return items.map(item => ({
        id: `${doc.id}-${item.id || item.label}`,
        date: doc.yearMonth,
        cardName: doc.cardLabel || '카드 미지정',
        content: item.label,
        amount: Number(item.amount) || 0,
        user: doc.issuedToWorkerName || doc.assignedTeamName || '팀 공용'
      }));
    }).filter(r => r.amount > 0);
  }, [cardDocs]);

  const claimGroups = useMemo(() => {
    const buildRows = (rows: TeamExpenseClaim[], direction: 'receivable' | 'payable' | 'other') =>
      rows
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'))
        .map((claim) => ({
          ...claim,
          direction,
          counterparty:
            direction === 'other'
              ? '청구대상 없음'
              : direction === 'receivable'
                ? claim.chargeToTeamName
                : claim.payerTeamName
        }));

    return [
      {
        key: 'receivable',
        title: '받을 후청구',
        description: '이 팀이 먼저 쓴 비용을 상대팀/현장 담당팀에 청구',
        tone: 'emerald',
        rows: buildRows(receivableClaims, 'receivable')
      },
      {
        key: 'payable',
        title: '내야 할 후청구',
        description: '다른 팀이 이 팀 담당 현장에서 쓴 비용',
        tone: 'rose',
        rows: buildRows(payableClaims, 'payable')
      },
      {
        key: 'other',
        title: '기타청구',
        description: '청구 대상 없이 사용팀 원장 비용으로 기록',
        tone: 'amber',
        rows: buildRows(otherClaims, 'other')
      }
    ];
  }, [otherClaims, payableClaims, receivableClaims]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2 pb-4">
      {/* 1. 개인숙소 (Accommodation Details) */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div
          className="border-b border-slate-300 px-4 py-2 text-center text-sm font-black text-slate-900"
          style={{ backgroundColor: hexToRgba(color, 0.15) }}
        >
          {teamName} 숙소 상세내역
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-200 px-2 py-1.5 text-center">주소/내용</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">월세</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">전기세</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">도시가스</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타(수도/유선 등)</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right font-bold text-slate-900 bg-slate-200">합계</th>
              </tr>
            </thead>
            <tbody>
              {accommRows.length > 0 ? accommRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5">{row.address}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.electricity ? formatCurrency(row.electricity) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.gas ? formatCurrency(row.gas) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{(row.water + row.internet + row.other) ? formatCurrency(row.water + row.internet + row.other) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-green-700 bg-green-50">{row.user}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums font-black text-slate-900 bg-slate-100">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="border border-slate-200 px-4 py-6 text-center text-slate-400 font-bold">숙소비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {accommRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(accommRows.reduce((s, r) => s + r.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(accommRows.reduce((s, r) => s + r.electricity, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(accommRows.reduce((s, r) => s + r.gas, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(accommRows.reduce((s, r) => s + r.water + r.internet + r.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-center"></td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-black text-red-600 bg-red-50">{formatCurrency(accommRows.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 2. 차량 (Vehicle Details) */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-300 bg-slate-200 px-4 py-2 text-center text-sm font-black text-slate-900">
          차량 렌트 및 유지비 상세내역
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-200 px-2 py-1.5 text-center">차량번호</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">렌트비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">리스비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">주유비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">수리비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">통행료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">과태료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right font-bold text-slate-900 bg-slate-200">합계</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.length > 0 ? vehicleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">{row.plate}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.lease ? formatCurrency(row.lease) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.fuel ? formatCurrency(row.fuel) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.repair ? formatCurrency(row.repair) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.toll ? formatCurrency(row.toll) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums text-orange-600">{row.fine ? formatCurrency(row.fine) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.other ? formatCurrency(row.other) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">
                    <div>{row.user}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-slate-400">{row.status}</div>
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums font-black text-slate-900 bg-slate-100">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="border border-slate-200 px-4 py-6 text-center text-slate-400 font-bold">차량비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {vehicleRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.lease, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.fuel, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.repair, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.toll, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold text-orange-600">{formatCurrency(vehicleRows.reduce((s, r) => s + r.fine, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(vehicleRows.reduce((s, r) => s + r.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-center"></td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-black text-red-600 bg-red-50">{formatCurrency(vehicleRows.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 3. 카드 (Card Details) */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-300 bg-slate-200 px-4 py-2 text-center text-sm font-black text-slate-900">
          카드 청구 상세내역
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-200 px-2 py-1.5 text-center">결제월/일</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">카드명</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">내용</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right font-bold text-slate-900 bg-slate-200">금액</th>
              </tr>
            </thead>
            <tbody>
              {cardRows.length > 0 ? cardRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{row.date}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center text-blue-700 font-bold">{row.cardName}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{row.content}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">{row.user}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums font-black text-slate-900 bg-slate-100">{formatCurrency(row.amount)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-4 py-6 text-center text-slate-400 font-bold">카드 청구 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {cardRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={4} className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right tabular-nums font-black text-red-600 bg-red-50">{formatCurrency(cardRows.reduce((s, r) => s + r.amount, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. 후청구 (Field Expense Claims) */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div
          className="border-b border-slate-300 px-4 py-2 text-center text-sm font-black text-slate-900"
          style={{ backgroundColor: hexToRgba(color, 0.1) }}
        >
          {teamName} 현장 경비 후청구
        </div>
        <div className="grid gap-0 xl:grid-cols-3">
          {claimGroups.map((group) => {
            const subtotal = group.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
            const headerClass =
              group.tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-800'
                : group.tone === 'amber'
                  ? 'bg-amber-50 text-amber-800'
                : 'bg-rose-50 text-rose-800';
            const totalClass =
              group.tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-800'
                : group.tone === 'amber'
                  ? 'bg-amber-50 text-amber-800'
                : 'bg-rose-50 text-rose-800';

            return (
              <div key={group.key} className="min-w-0 border-t border-slate-200 first:border-t-0 xl:border-t-0 xl:border-r xl:last:border-r-0">
                <div className={`border-b border-slate-200 px-3 py-2 ${headerClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black">{group.title}</div>
                    <div className="text-xs font-black tabular-nums">{formatCurrency(subtotal)}</div>
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold opacity-80">{group.description}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="border border-slate-200 px-2 py-1.5 text-center">날짜</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">상대팀</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">현장</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-left">내용</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-right">금액</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.length > 0 ? group.rows.map((claim) => (
                        <tr key={`${group.key}-${claim.id}`} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.date?.slice(5) || '-'}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{claim.counterparty || '-'}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.siteName || '-'}</td>
                          <td className="border border-slate-200 px-2 py-1.5">
                            <div className="font-bold text-slate-800">{claim.description}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">{getCategoryLabel(claim.category, categoryOptions)}{claim.cardLabel ? ` · ${claim.cardLabel}` : ''}</div>
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 text-right font-black tabular-nums">{formatCurrency(claim.amount)}</td>
                          <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{getStatusLabel(claim.status)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">
                            내역이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {group.rows.length > 0 && (
                      <tfoot>
                        <tr className={totalClass}>
                          <td colSpan={4} className="border border-slate-200 px-2 py-2 text-center font-black">합계</td>
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
      </div>
    </div>
  );
};
