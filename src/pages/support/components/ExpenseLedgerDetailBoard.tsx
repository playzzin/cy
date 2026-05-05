import React, { useMemo } from 'react';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import type { CardBillingDocument } from '../../../types/cardBilling';
import type { TeamExpenseClaim } from '../../../types/teamExpenseLedger';
import type { VehicleBillingDocument } from '../../../types/vehicleBilling';
import {
  formatCurrency,
  getBillingStatusLabel,
  getCategoryLabel,
  getStatusLabel,
  hexToRgba,
  summarizeVehicleBillingCosts
} from '../hooks/useExpenseLedgerData';

interface ExpenseLedgerDetailBoardProps {
  teamName: string;
  color: string;
  accommodationDocs: AccommodationBillingDocument[];
  vehicleDocs: VehicleBillingDocument[];
  cardDocs: CardBillingDocument[];
  receivableClaims: TeamExpenseClaim[];
  payableClaims: TeamExpenseClaim[];
  otherClaims: TeamExpenseClaim[];
}

type ClaimSection = {
  key: 'receivable' | 'payable' | 'other';
  title: string;
  description: string;
  colorClass: string;
  totalClass: string;
  rows: Array<TeamExpenseClaim & { counterparty: string }>;
};

const sortClaims = (rows: TeamExpenseClaim[]) =>
  rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'));

export const ExpenseLedgerDetailBoard: React.FC<ExpenseLedgerDetailBoardProps> = ({
  teamName,
  color,
  accommodationDocs,
  vehicleDocs,
  cardDocs,
  receivableClaims,
  payableClaims,
  otherClaims
}) => {
  const accommodationRows = useMemo(() => {
    return accommodationDocs
      .map((doc) => {
        let rent = 0;
        let electricity = 0;
        let gas = 0;
        let water = 0;
        let internet = 0;
        let other = 0;

        (doc.lineItems || []).forEach((item) => {
          const amount = Number(item.amount) || 0;
          if (item.targetField === 'accommodation' || item.targetField === 'privateRoom') rent += amount;
          else if (item.targetField === 'electricity') electricity += amount;
          else if (item.targetField === 'gas') gas += amount;
          else if (item.targetField === 'water') water += amount;
          else if (item.targetField === 'internet') internet += amount;
          else other += amount;
        });

        const address = doc.memo || doc.lineItems?.[0]?.label || '상세 주소 미지정';
        const user = doc.issuedToWorkerName || '팀 공용';
        const total = rent + electricity + gas + water + internet + other;

        return { id: doc.id, address, rent, electricity, gas, water, internet, other, user, total };
      })
      .filter((row) => row.total > 0);
  }, [accommodationDocs]);

  const vehicleRows = useMemo(() => {
    return vehicleDocs
      .map((doc) => {
        const breakdown = summarizeVehicleBillingCosts(doc);

        return {
          id: doc.id,
          plate: doc.vehiclePlate || '차량 미지정',
          rent: breakdown.rent,
          fine: breakdown.fine,
          repair: breakdown.repair,
          other: breakdown.other,
          user: doc.issuedToWorkerName || doc.assignedTeamName || '팀 공용',
          status: getBillingStatusLabel(doc.status),
          total: breakdown.total
        };
      })
      .filter((row) => row.total > 0);
  }, [vehicleDocs]);

  const cardRows = useMemo(() => {
    return cardDocs
      .flatMap((doc) => {
        const items = doc.lineItems || [];
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

        return items.map((item) => ({
          id: `${doc.id}-${item.id || item.label}`,
          date: doc.yearMonth,
          cardName: doc.cardLabel || '카드 미지정',
          content: item.label,
          amount: Number(item.amount) || 0,
          user: doc.issuedToWorkerName || doc.assignedTeamName || '팀 공용'
        }));
      })
      .filter((row) => row.amount > 0);
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
        description: '상대팀 청구 없이 사용팀 비용으로 반영된 금액',
        colorClass: 'bg-amber-50 text-amber-800',
        totalClass: 'bg-amber-50 text-amber-800',
        rows: sortClaims(otherClaims).map((claim) => ({
          ...claim,
          counterparty: '청구대상 없음'
        }))
      }
    ];
  }, [otherClaims, payableClaims, receivableClaims]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4 pr-2">
      <div className="overflow-hidden border border-slate-300 bg-white shadow-sm">
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
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">합계</th>
              </tr>
            </thead>
            <tbody>
              {accommodationRows.length > 0 ? accommodationRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5">{row.address}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.electricity ? formatCurrency(row.electricity) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.gas ? formatCurrency(row.gas) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {row.water + row.internet + row.other ? formatCurrency(row.water + row.internet + row.other) : '-'}
                  </td>
                  <td className="border border-slate-200 bg-green-50 px-2 py-1.5 text-center font-medium text-green-700">{row.user}</td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">숙소비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {accommodationRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.electricity, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.gas, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.water + row.internet + row.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(accommodationRows.reduce((sum, row) => sum + row.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="overflow-hidden border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-200 px-4 py-2 text-center text-sm font-black text-slate-900">
          차량 렌트 및 유지비 상세내역
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-200 px-2 py-1.5 text-center">차량번호</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">렌트료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">과태료</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">수리비</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">기타</th>
                <th className="border border-slate-200 px-2 py-1.5 text-center">사용자</th>
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">합계</th>
              </tr>
            </thead>
            <tbody>
              {vehicleRows.length > 0 ? vehicleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">{row.plate}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.rent ? formatCurrency(row.rent) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums text-orange-600">{row.fine ? formatCurrency(row.fine) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.repair ? formatCurrency(row.repair) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">{row.other ? formatCurrency(row.other) : '-'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">
                    <div>{row.user}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-slate-400">{row.status}</div>
                  </td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">차량비 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {vehicleRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.rent, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums text-orange-600">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.fine, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.repair, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-bold tabular-nums">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.other, 0))}</td>
                  <td className="border border-slate-200 px-2 py-2" />
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(vehicleRows.reduce((sum, row) => sum + row.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="overflow-hidden border border-slate-300 bg-white shadow-sm">
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
                <th className="border border-slate-200 bg-slate-200 px-2 py-1.5 text-right font-bold text-slate-900">금액</th>
              </tr>
            </thead>
            <tbody>
              {cardRows.length > 0 ? cardRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{row.date}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-blue-700">{row.cardName}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-slate-700">{row.content}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-medium text-slate-700">{row.user}</td>
                  <td className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-right font-black tabular-nums text-slate-900">{formatCurrency(row.amount)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">카드 청구 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
            {cardRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={4} className="border border-slate-200 px-2 py-2 text-center font-black">총 합계</td>
                  <td className="border border-slate-200 bg-red-50 px-2 py-2 text-right font-black tabular-nums text-red-600">{formatCurrency(cardRows.reduce((sum, row) => sum + row.amount, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {claimSections.map((section) => {
        const subtotal = section.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

        return (
          <div key={section.key} className="overflow-hidden border border-slate-300 bg-white shadow-sm">
            <div className={`border-b border-slate-300 px-4 py-2 ${section.colorClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{teamName} {section.title}</div>
                  <div className="mt-0.5 text-[11px] font-bold opacity-80">{section.description}</div>
                </div>
                <div className="text-base font-black tabular-nums">{formatCurrency(subtotal)}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="border border-slate-200 px-2 py-1.5 text-center">날짜</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">상대팀</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">현장</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">구분</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-left">내용</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">결제</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-right">금액</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length > 0 ? section.rows.map((claim) => (
                    <tr key={`${section.key}-${claim.id}`} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.date?.slice(5) || '-'}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700">{claim.counterparty || '-'}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{claim.siteName || '-'}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{getCategoryLabel(claim.category)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">{claim.description}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-500">{claim.cardLabel || '-'}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-black tabular-nums">{formatCurrency(claim.amount)}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-bold text-slate-500">{getStatusLabel(claim.status)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="border border-slate-200 px-4 py-6 text-center font-bold text-slate-400">내역이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
                {section.rows.length > 0 && (
                  <tfoot>
                    <tr className={section.totalClass}>
                      <td colSpan={6} className="border border-slate-200 px-2 py-2 text-center font-black">합계</td>
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
