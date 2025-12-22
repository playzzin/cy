import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faCircleExclamation,
    faDownload,
    faExclamationTriangle,
    faFileLines,
    faFilter,
    faSpinner,
    faTable,
    faTriangleExclamation,
    faUserShield
} from '@fortawesome/free-solid-svg-icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supportClaimService, SupportClaimResult, SupportClaimSheet } from '../../services/supportClaimService';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);

const SupportClaimPage: React.FC = () => {
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [selectedContractorId, setSelectedContractorId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SupportClaimResult | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [pendingSheetId, setPendingSheetId] = useState<string | null>(null);
    const [showSensitiveModal, setShowSensitiveModal] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);

    const fetchMasterData = useCallback(async () => {
        try {
            const [companyList, teamList, siteList] = await Promise.all([
                companyService.getCompanies(),
                teamService.getTeams(),
                siteService.getSites()
            ]);
            setCompanies(companyList);
            setTeams(teamList);
            setSites(siteList);
        } catch (masterError) {
            console.error(masterError);
            setError('기준 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
        }
    }, []);

    const fetchClaims = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);
        setError(null);
        try {
            const claimResult = await supportClaimService.fetchClaims({
                month: selectedMonth,
                contractorCompanyIds: selectedContractorId ? [selectedContractorId] : undefined,
                teamIds: selectedTeamId ? [selectedTeamId] : undefined,
                siteIds: selectedSiteId ? [selectedSiteId] : undefined
            });
            setResult(claimResult);
        } catch (fetchError) {
            console.error(fetchError);
            setError('지원비 청구 데이터를 조회하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [selectedContractorId, selectedMonth, selectedSiteId, selectedTeamId]);

    useEffect(() => {
        void fetchMasterData();
    }, [fetchMasterData]);

    useEffect(() => {
        if (companies.length === 0 || teams.length === 0 || sites.length === 0) return;
        void fetchClaims();
    }, [companies.length, fetchClaims, sites.length, teams.length]);

    const contractorOptions = useMemo(
        () => companies.filter((company) => (company.type ?? '').includes('시공사')), [companies]
    );

    const supportTeams = useMemo(
        () => teams.filter((team) => (team.type ?? '').includes('지원')), [teams]
    );

    const monthDays = result?.period.daysInMonth ?? 31;
    const dayColumns = useMemo(() => Array.from({ length: monthDays }, (_, index) => index + 1), [monthDays]);

    const hasData = (result?.sheets.length ?? 0) > 0;
    const findSheetById = useCallback(
        (sheetId: string | null) => result?.sheets.find((sheet) => sheet.sheetId === sheetId),
        [result?.sheets]
    );

    const handleRequestDownload = (sheetId: string) => {
        setPendingSheetId(sheetId);
        setShowSensitiveModal(true);
    };

    const handleConfirmDownload = useCallback(async () => {
        if (!pendingSheetId) return;
        const targetSheet = findSheetById(pendingSheetId);
        if (!targetSheet) {
            setShowSensitiveModal(false);
            return;
        }
        setDownloadLoading(true);
        try {
            const daysInMonth = targetSheet.rows[0]?.dailyManDays.length ?? result?.period.daysInMonth ?? 31;
            await exportSupportClaimSheet(targetSheet, daysInMonth);
        } catch (downloadError) {
            console.error(downloadError);
            window.alert('엑셀 파일 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setDownloadLoading(false);
            setShowSensitiveModal(false);
            setPendingSheetId(null);
        }
    }, [findSheetById, pendingSheetId, result?.period.daysInMonth]);

    const handleCancelDownload = () => {
        setShowSensitiveModal(false);
        setPendingSheetId(null);
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">지원비 청구 명세서</h1>
                    <p className="text-sm text-gray-500">일보 데이터를 기반으로 시공사 제출용 일용노무비 지급명세서를 생성합니다.</p>
                </div>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                    onClick={fetchClaims}
                >
                    <FontAwesomeIcon icon={faFilter} />
                    다시 집계
                </button>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-4">
                    <label className="text-sm font-medium text-gray-600">
                        정산 월
                        <div className="mt-1 flex items-center rounded-lg border border-gray-300 px-3">
                            <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-gray-400" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(event) => setSelectedMonth(event.target.value)}
                                className="flex-1 border-none bg-transparent py-2 text-gray-900 focus:outline-none"
                            />
                        </div>
                    </label>
                    <label className="text-sm font-medium text-gray-600">
                        시공사
                        <select
                            value={selectedContractorId}
                            onChange={(event) => setSelectedContractorId(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="">전체 시공사</option>
                            {contractorOptions.map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-medium text-gray-600">
                        지원팀
                        <select
                            value={selectedTeamId}
                            onChange={(event) => setSelectedTeamId(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="">전체 지원팀</option>
                            {supportTeams.map((team) => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-medium text-gray-600">
                        현장
                        <select
                            value={selectedSiteId}
                            onChange={(event) => setSelectedSiteId(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="">전체 현장</option>
                            {sites.map((site) => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <p className="mt-3 flex items-center text-xs text-amber-600">
                    <FontAwesomeIcon icon={faUserShield} className="mr-2" />
                    주민등록번호 등 민감정보가 표시됩니다. 열람 권한이 있는지 확인 후 사용하세요.
                </p>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
                {[
                    { label: '시트 수', value: formatNumber(result?.stats.totalSheets ?? 0), icon: faTable },
                    { label: '근로자 수', value: formatNumber(result?.stats.totalWorkers ?? 0), icon: faUserShield },
                    { label: '총 공수', value: formatNumber(result?.stats.totalManDay ?? 0), icon: faFileLines },
                    { label: '총 청구액', value: `${formatNumber(result?.stats.totalAmount ?? 0)}원`, icon: faDownload }
                ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                                <FontAwesomeIcon icon={card.icon} />
                            </span>
                            <div>
                                <p className="text-sm text-gray-500">{card.label}</p>
                                <p className="text-xl font-semibold text-gray-900">{card.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <FontAwesomeIcon icon={faCircleExclamation} className="mr-2" />
                    {error}
                </div>
            )}

            {result?.issues.length ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-700">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <p className="font-semibold">필수 정보 누락 {result.issues.length}건</p>
                    </div>
                    <div className="mt-3 max-h-40 overflow-y-auto text-sm text-amber-800">
                        <ul className="list-disc space-y-1 pl-4">
                            {result.issues.map((issue, index) => (
                                <li key={`${issue.type}-${index}`}>
                                    [{issue.contractorName} · {issue.teamName}] {issue.workerName} - {issue.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            <section className="space-y-6">
                {loading && (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-gray-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2 text-indigo-500" />
                        데이터를 불러오는 중입니다...
                    </div>
                )}

                {!loading && !hasData && (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-sm text-gray-500">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                        선택한 조건에 해당하는 명세서 데이터가 없습니다.
                    </div>
                )}

                {result?.sheets.map((sheet) => (
                    <div key={sheet.sheetId} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {sheet.contractorName} · {sheet.siteName} · {sheet.teamName}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    기간 {sheet.period.start} ~ {sheet.period.end} · 근로자 {sheet.stats.totalWorkers}명 · 공수 {formatNumber(sheet.stats.totalManDay)} · 청구 {formatNumber(sheet.stats.totalAmount)}원
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    onClick={() => handleRequestDownload(sheet.sheetId)}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    엑셀 다운로드
                                </button>
                            </div>
                        </div>
                        <div className="w-full overflow-auto">
                            <table className="min-w-[900px] text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-center text-xs font-semibold text-slate-600">
                                        <th className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-3 py-2">성명</th>
                                        <th className="sticky left-28 z-10 border border-slate-200 bg-slate-100 px-3 py-2">주민등록번호</th>
                                        <th className="border border-slate-200 px-3 py-2">주소</th>
                                        <th className="border border-slate-200 px-3 py-2">연락처</th>
                                        <th className="border border-slate-200 px-3 py-2">공종</th>
                                        {dayColumns.map((day) => (
                                            <th key={`day-${day}`} className="border border-slate-200 px-2 py-2 text-xs">{String(day).padStart(2, '0')}</th>
                                        ))}
                                        <th className="border border-slate-200 px-3 py-2">공수</th>
                                        <th className="border border-slate-200 px-3 py-2">단가</th>
                                        <th className="border border-slate-200 px-3 py-2">총액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sheet.rows.map((row) => (
                                        <tr key={row.workerId} className="border-b border-slate-100 text-center">
                                            <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-800">
                                                {row.name}
                                                {(row.flags.missingIdNumber || row.flags.missingAddress || row.flags.missingUnitPrice) && (
                                                    <span className="ml-2 rounded-md bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">보완</span>
                                                )}
                                            </td>
                                            <td className={`sticky left-28 z-10 bg-white px-3 py-2 font-mono text-left ${row.flags.missingIdNumber ? 'text-rose-600' : 'text-slate-700'}`}>
                                                {row.idNumber || '미등록'}
                                            </td>
                                            <td className={`px-3 py-2 text-left ${row.flags.missingAddress ? 'text-rose-600' : 'text-slate-700'}`}>
                                                {row.address || '미등록'}
                                            </td>
                                            <td className="px-3 py-2 text-left text-slate-700">{row.contact || '-'}</td>
                                            <td className="px-3 py-2 text-left text-slate-700">{row.role || '-'}</td>
                                            {row.dailyManDays.map((value, index) => (
                                                <td key={`${row.workerId}-day-${index}`} className="px-2 py-1 text-right font-mono text-xs text-slate-600">
                                                    {value > 0 ? value.toFixed(1) : ''}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-semibold text-slate-800">{row.totalManDay.toFixed(1)}</td>
                                            <td className={`px-3 py-2 text-right ${row.flags.missingUnitPrice ? 'text-rose-600 font-semibold' : 'text-slate-800'}`}>
                                                {row.unitPrice.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-indigo-600">{row.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-semibold text-slate-800">
                                        <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left" colSpan={5}>합계</td>
                                        <td colSpan={dayColumns.length} className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">{sheet.stats.totalManDay.toFixed(1)}</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">{sheet.stats.totalAmount.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}
            </section>

            {showSensitiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-start gap-3">
                            <span className="rounded-xl bg-rose-50 p-3 text-rose-600">
                                <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl" />
                            </span>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">민감정보 다운로드</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    주민등록번호 등 민감정보가 포함된 엑셀 파일을 다운로드합니다. 외부 유출 시 법적 책임이 발생할 수 있으며, 열람 기록이 저장됩니다. 계속 진행할까요?
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                                onClick={handleCancelDownload}
                                disabled={downloadLoading}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                                onClick={handleConfirmDownload}
                                disabled={downloadLoading}
                            >
                                {downloadLoading && <FontAwesomeIcon icon={faSpinner} spin />}
                                다운로드 진행
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupportClaimPage;

const exportSupportClaimSheet = async (sheet: SupportClaimSheet, daysInMonth: number) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('명세서', { properties: { defaultRowHeight: 18 } });

    const totalColumns = 5 + daysInMonth + 3;
    worksheet.mergeCells(1, 1, 1, totalColumns);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = '일용노무비 지급명세서';
    titleCell.font = { bold: true, size: 18 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 32;

    worksheet.mergeCells(2, 1, 2, Math.min(totalColumns, 6));
    worksheet.getCell('A2').value = `기간: ${sheet.period.start} ~ ${sheet.period.end}`;
    worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells(2, 7, 2, totalColumns);
    worksheet.getCell('G2').value = `현장명: ${sheet.siteName} / 공종(팀): ${sheet.teamName}`;
    worksheet.getCell('G2').alignment = { horizontal: 'right', vertical: 'middle' };

    const baseColumns = [
        { header: '성명', key: 'name', width: 14 },
        { header: '주민등록번호', key: 'idNumber', width: 20 },
        { header: '주소', key: 'address', width: 25 },
        { header: '연락처', key: 'contact', width: 16 },
        { header: '공종', key: 'role', width: 12 }
    ];
    const dayColumns = Array.from({ length: daysInMonth }, (_, index) => ({
        header: String(index + 1).padStart(2, '0'),
        key: `day-${index + 1}`,
        width: 4
    }));
    const totalColumnsDef = [
        { header: '공수', key: 'totalManDay', width: 8 },
        { header: '단가', key: 'unitPrice', width: 10 },
        { header: '총액', key: 'totalAmount', width: 12 }
    ];

    worksheet.columns = [...baseColumns, ...dayColumns, ...totalColumnsDef];

    const headerRowIndex = worksheet.lastRow?.number ? worksheet.lastRow.number + 1 : 3;
    const headerRow = worksheet.addRow(worksheet.columns?.map((column) => column.header));
    headerRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEFFC' } };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFBFC4D6' } },
            left: { style: 'thin', color: { argb: 'FFBFC4D6' } },
            bottom: { style: 'thin', color: { argb: 'FFBFC4D6' } },
            right: { style: 'thin', color: { argb: 'FFBFC4D6' } }
        };
    });

    sheet.rows.forEach((row) => {
        const rowData: Record<string, string | number> = {
            name: row.name,
            idNumber: row.idNumber ?? '미등록',
            address: row.address ?? '미등록',
            contact: row.contact ?? '',
            role: row.role ?? '',
            totalManDay: Number(row.totalManDay.toFixed(1)),
            unitPrice: row.unitPrice,
            totalAmount: row.totalAmount
        };
        dayColumns.forEach((column, index) => {
            const value = row.dailyManDays[index] ?? 0;
            rowData[column.key] = value > 0 ? Number(value.toFixed(1)) : '';
        });
        const excelRow = worksheet.addRow(rowData);
        excelRow.eachCell((cell, colNumber) => {
            const isNumericColumn = colNumber > baseColumns.length;
            cell.alignment = {
                horizontal: isNumericColumn ? 'right' : 'left',
                vertical: 'middle'
            };
            if (typeof cell.value === 'number') {
                cell.numFmt = colNumber >= baseColumns.length + dayColumns.length + 1 ? '#,##0' : '0.0';
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
        });
    });

    const summaryRow = worksheet.addRow({
        name: '합계',
        totalManDay: Number(sheet.stats.totalManDay.toFixed(1)),
        totalAmount: sheet.stats.totalAmount
    });
    summaryRow.font = { bold: true };
    summaryRow.getCell('totalAmount').numFmt = '#,##0';
    summaryRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFA3AED0' } },
            left: { style: 'thin', color: { argb: 'FFA3AED0' } },
            bottom: { style: 'thin', color: { argb: 'FFA3AED0' } },
            right: { style: 'thin', color: { argb: 'FFA3AED0' } }
        };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 5, ySplit: headerRowIndex + 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const safeContractor = sanitizeFileName(sheet.contractorName);
    const safeTeam = sanitizeFileName(sheet.teamName);
    const fileName = `일용노무비명세서_${safeContractor}_${safeTeam}_${sheet.period.month}.xlsx`;
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
};

const sanitizeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '_');
