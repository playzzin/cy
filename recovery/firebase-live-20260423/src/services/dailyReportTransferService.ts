import { collection, deleteDoc, doc, getDocs, query, limit, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { dailyReportService, type DailyReport, type DailyReportWorker, type DailyReportWorkerRow } from './dailyReportService';
import type { Team } from './teamService';
import type { Site } from './siteService';
import type { Worker } from './manpowerService';
import { resolvePayType, resolveReportPayType, syncPayTypeFields } from '../utils/payType';

const REPORT_COLLECTION = 'daily_reports';
const LEGACY_WORKER_COLLECTION = 'daily_report_workers';
const DB_SHEET_NAME = 'daily_reports';
const DB_DETAIL_SHEET_NAME = 'daily_report_rows';
const DB_META_SHEET_NAME = 'meta';
const EXCEL_SHEET_NAME = '일보목록V2';
const DELETE_BATCH_SIZE = 400;

type JsonRecord = Record<string, unknown>;

type DailyReportExcelImportContext = {
    teams: Team[];
    sites: Site[];
    workers: Worker[];
};

type DailyReportDbImportResult = {
    created: number;
    updated: number;
    skipped: number;
};

type DailyReportExcelImportResult = {
    created: number;
    updated: number;
    skipped: number;
    warnings: string[];
};

type EntityLookup<T extends { id?: string | null; legacyId?: string | null; name?: string | null }> = {
    byId: Map<string, T>;
    byName: Map<string, T[]>;
};

type ExcelImportGroup = {
    reportId?: string;
    date: string;
    teamId: string;
    teamName?: string;
    siteId: string;
    siteName?: string;
    siteType?: string;
    paymentType?: string;
    workers: Map<string, DailyReportWorker>;
};

const isRecord = (value: unknown): value is JsonRecord => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeLookupKey = (value: unknown): string => {
    return String(value ?? '').trim().toLowerCase();
};

const toOptionalText = (value: unknown): string | undefined => {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
};

const parseNumberValue = (value: unknown, fallback: number = 0): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    const text = String(value ?? '').trim();
    if (!text) return fallback;

    const normalized = text.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoString = (value: unknown): string | undefined => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }

    if (isRecord(value) && typeof value.toDate === 'function') {
        const converted = value.toDate();
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
            return converted.toISOString();
        }
    }

    if (isRecord(value) && typeof value.seconds === 'number') {
        const millis = (value.seconds as number) * 1000 + Math.floor(Number(value.nanoseconds ?? 0) / 1000000);
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    const text = String(value ?? '').trim();
    if (!text) return undefined;

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
};

const toDateObject = (value: unknown): Date | undefined => {
    const iso = toIsoString(value);
    return iso ? new Date(iso) : undefined;
};

const stripUndefinedDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => stripUndefinedDeep(entry));
    }

    if (!isRecord(value)) return value;

    return Object.fromEntries(
        Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
    );
};

const serializeJsonValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => serializeJsonValue(entry));
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (isRecord(value) && typeof value.toDate === 'function') {
        const converted = value.toDate();
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
            return converted.toISOString();
        }
    }

    if (isRecord(value) && typeof value.seconds === 'number') {
        const iso = toIsoString(value);
        return iso ?? value;
    }

    if (!isRecord(value)) return value;

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, serializeJsonValue(entry)])
    );
};

const serializeSheetCellValue = (value: unknown): string | number | boolean => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

    const iso = toIsoString(value);
    if (iso) return iso;

    if (Array.isArray(value) || isRecord(value)) {
        return JSON.stringify(serializeJsonValue(value));
    }

    return String(value);
};

const parseMaybeJson = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;

    const text = value.trim();
    if (!text) return [];
    if (!(text.startsWith('{') || text.startsWith('['))) return value;

    try {
        return JSON.parse(text);
    } catch {
        return value;
    }
};

const computeReportTotals = (workers: DailyReportWorker[]) => {
    return workers.reduce(
        (acc, worker) => {
            const manDay = parseNumberValue(worker.manDay, 0);
            const unitPrice = parseNumberValue(worker.unitPrice, 0);
            acc.totalManDay += manDay;
            acc.totalAmount += manDay * unitPrice;
            return acc;
        },
        { totalManDay: 0, totalAmount: 0 }
    );
};

const normalizeWorkerPayload = (value: unknown): DailyReportWorker | null => {
    const raw = isRecord(value) ? value : {};
    const workerId = String(raw.workerId ?? '').trim();
    const workerName = String(raw.name ?? raw.workerName ?? '').trim();
    if (!workerId || !workerName) return null;

    const status = raw.status === 'absent' || raw.status === 'half' ? raw.status : 'attendance';
    const unitPrice = parseNumberValue(raw.unitPrice, 0);

    return {
        workerId,
        name: workerName,
        role: toOptionalText(raw.role),
        status,
        manDay: parseNumberValue(raw.manDay ?? raw.gongsu, 0),
        workContent: toOptionalText(raw.workContent),
        teamId: toOptionalText(raw.teamId),
        unitPrice,
        payType: resolveReportPayType(raw) || undefined,
        salaryModel: resolveReportPayType(raw) || undefined,
        siteType: toOptionalText(raw.siteType),
        paymentType: toOptionalText(raw.paymentType),
        workerTeamName: toOptionalText(raw.workerTeamName),
    };
};

const normalizeReportPayload = (raw: JsonRecord): DailyReport | null => {
    const date = String(raw.date ?? '').trim();
    const teamId = String(raw.teamId ?? '').trim();
    const siteId = String(raw.siteId ?? '').trim();
    if (!date || !teamId || !siteId) return null;

    const rawWorkers = parseMaybeJson(raw.workers);
    const workers = Array.isArray(rawWorkers)
        ? rawWorkers
            .map((worker) => normalizeWorkerPayload(worker))
            .filter((worker): worker is DailyReportWorker => !!worker)
        : [];

    const computed = computeReportTotals(workers);

    return {
        id: toOptionalText(raw.id),
        legacyId: toOptionalText(raw.legacyId),
        date,
        teamId,
        teamName: toOptionalText(raw.teamName),
        siteId,
        siteName: toOptionalText(raw.siteName),
        responsibleTeamId: toOptionalText(raw.responsibleTeamId),
        responsibleTeamName: toOptionalText(raw.responsibleTeamName),
        companyId: toOptionalText(raw.companyId),
        companyName: toOptionalText(raw.companyName),
        constructorCompanyId: toOptionalText(raw.constructorCompanyId),
        constructorCompanyName: toOptionalText(raw.constructorCompanyName),
        partnerId: toOptionalText(raw.partnerId),
        partnerName: toOptionalText(raw.partnerName),
        writerId: toOptionalText(raw.writerId),
        workers,
        totalManDay: raw.totalManDay === '' || raw.totalManDay === undefined
            ? computed.totalManDay
            : parseNumberValue(raw.totalManDay, computed.totalManDay),
        totalAmount: raw.totalAmount === '' || raw.totalAmount === undefined
            ? computed.totalAmount
            : parseNumberValue(raw.totalAmount, computed.totalAmount),
        weather: toOptionalText(raw.weather),
        workContent: toOptionalText(raw.workContent),
        siteType: toOptionalText(raw.siteType),
        paymentType: toOptionalText(raw.paymentType),
        createdAt: toDateObject(raw.createdAt),
        updatedAt: toDateObject(raw.updatedAt),
    };
};

const toReportGroupKey = (date: string, teamId: string, siteId: string): string => {
    return `${date}::${teamId}::${siteId}`;
};

const buildEntityLookup = <T extends { id?: string | null; legacyId?: string | null; name?: string | null }>(items: T[]): EntityLookup<T> => {
    const byId = new Map<string, T>();
    const byName = new Map<string, T[]>();

    items.forEach((item) => {
        const id = String(item.id ?? '').trim();
        const legacyId = String(item.legacyId ?? '').trim();
        const nameKey = normalizeLookupKey(item.name);

        if (id) byId.set(id, item);
        if (legacyId) byId.set(legacyId, item);

        if (nameKey) {
            const current = byName.get(nameKey) ?? [];
            current.push(item);
            byName.set(nameKey, current);
        }
    });

    return { byId, byName };
};

const resolveEntity = <T extends { id?: string | null; legacyId?: string | null; name?: string | null }>(
    lookup: EntityLookup<T>,
    rawId: unknown,
    rawName: unknown
): T | undefined => {
    const id = String(rawId ?? '').trim();
    if (id && lookup.byId.has(id)) {
        return lookup.byId.get(id);
    }

    const nameKey = normalizeLookupKey(rawName);
    if (!nameKey) return undefined;

    const matches = lookup.byName.get(nameKey) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
};

const pickRowValue = (row: JsonRecord, keys: string[]): unknown => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const value = row[key];
            if (value !== undefined && String(value ?? '').trim() !== '') {
                return value;
            }
        }
    }
    return '';
};

const resolveWorker = (
    workerLookup: EntityLookup<Worker>,
    teamLookup: EntityLookup<Team>,
    row: JsonRecord
): Worker | undefined => {
    const workerId = pickRowValue(row, ['작업자ID', 'workerId']);
    const workerName = pickRowValue(row, ['이름', 'workerName']);
    const direct = resolveEntity(workerLookup, workerId, workerName);
    if (direct) return direct;

    const nameKey = normalizeLookupKey(workerName);
    if (!nameKey) return undefined;

    const candidates = workerLookup.byName.get(nameKey) ?? [];
    if (candidates.length <= 1) return candidates[0];

    const rawWorkerTeamId = pickRowValue(row, ['소속팀ID', '작업팀ID', 'workerTeamId']);
    const rawWorkerTeamName = pickRowValue(row, ['소속팀', '작업팀', 'workerTeamName']);
    const resolvedTeam = resolveEntity(teamLookup, rawWorkerTeamId, rawWorkerTeamName);
    if (resolvedTeam?.id) {
        const resolvedTeamId = String(resolvedTeam.id);
        const narrowed = candidates.filter((candidate) => String(candidate.teamId ?? '') === resolvedTeamId);
        if (narrowed.length === 1) return narrowed[0];
    }

    return undefined;
};

const toDbExportRows = (reports: DailyReport[]) => {
    const ordered = [...reports].sort((a, b) => {
        const dateDiff = String(b.date ?? '').localeCompare(String(a.date ?? ''), 'en');
        if (dateDiff !== 0) return dateDiff;
        return String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''), 'ko');
    });

    return ordered.map((report) => {
        const raw: JsonRecord = {
            'ID': report.id ?? '',
            '레거시ID': report.legacyId ?? '',
            '날짜': report.date ?? '',
            '현장ID': report.siteId ?? '',
            '현장명': report.siteName ?? '',
            '담당팀ID': report.teamId ?? '',
            '담당팀명': report.teamName ?? '',
            '현장구분': report.siteType ?? '',
            '결제구분': report.paymentType ?? '',
            '작업자내역': report.workers ?? [],
            '총공수': report.totalManDay ?? 0,
            '총금액': report.totalAmount ?? 0,
            '날씨': report.weather ?? '',
            '작업내용': report.workContent ?? '',
            '생성일': report.createdAt ?? '',
            '수정일': report.updatedAt ?? '',
        };

        return Object.fromEntries(
            Object.entries(raw).map(([key, value]) => [key, serializeSheetCellValue(value)])
        );
    });
};

const toDbDetailRows = (reports: DailyReport[]) => {
    return reports.flatMap((report) => {
        return (report.workers ?? []).map((worker) => ({
            '일보ID': report.id ?? '',
            '날짜': report.date ?? '',
            '담당팀ID': report.teamId ?? '',
            '현장담당팀': report.teamName ?? '',
            '현장ID': report.siteId ?? '',
            '현장명': report.siteName ?? '',
            '작업자ID': worker.workerId ?? '',
            '이름': worker.name ?? '',
            '소속팀ID': worker.teamId ?? '',
            '소속팀': worker.workerTeamName ?? '',
            '직무': worker.role ?? '',
            '출결': worker.status ?? 'attendance',
            '공수': worker.manDay ?? 0,
            '단가': worker.unitPrice ?? 0,
            '금액': (worker.manDay ?? 0) * (worker.unitPrice ?? 0),
            '급여방식': resolveReportPayType(worker),
            '지급유형': resolveReportPayType(worker),
            '현장구분': worker.siteType ?? report.siteType ?? '',
            '결제구분': worker.paymentType ?? report.paymentType ?? '',
            '비고': worker.workContent ?? '',
        }));
    });
};

const buildHeaderOrder = (rows: JsonRecord[], preferred: string[]): string[] => {
    const headerSet = new Set<string>();
    rows.forEach((row) => {
        Object.keys(row).forEach((key) => headerSet.add(key));
    });

    return [
        ...preferred.filter((key) => headerSet.has(key)),
        ...Array.from(headerSet).filter((key) => !preferred.includes(key)),
    ];
};

const createWorksheetFromRows = async (rows: JsonRecord[], preferredHeaders: string[]) => {
    const XLSX = await import('xlsx');
    const headers = buildHeaderOrder(rows, preferredHeaders);
    if (rows.length === 0) {
        return XLSX.utils.aoa_to_sheet([headers]);
    }

    return XLSX.utils.json_to_sheet(rows, { header: headers });
};

const persistReport = async (nextReportInput: DailyReport, existingReport?: DailyReport | null): Promise<'created' | 'updated'> => {
    const nextId = String(nextReportInput.id ?? existingReport?.id ?? '').trim() || doc(collection(db, REPORT_COLLECTION)).id;
    const nextWorkers = (nextReportInput.workers ?? [])
        .map((worker) => normalizeWorkerPayload(worker))
        .filter((worker): worker is DailyReportWorker => !!worker);
    const totals = computeReportTotals(nextWorkers);

    const nextReport: DailyReport = {
        ...nextReportInput,
        id: nextId,
        workers: nextWorkers,
        totalManDay: totals.totalManDay,
        totalAmount: totals.totalAmount,
    };

    if (existingReport) {
        await dailyReportService._updateStats(existingReport, -1);
    }

    const payload = stripUndefinedDeep({
        ...nextReport,
        id: undefined,
        createdAt: toDateObject(nextReport.createdAt) ?? toDateObject(existingReport?.createdAt) ?? new Date(),
        updatedAt: toDateObject(nextReport.updatedAt) ?? new Date(),
    });

    await setDoc(doc(db, REPORT_COLLECTION, nextId), payload as JsonRecord);
    await dailyReportService._updateStats(nextReport, 1);
    return existingReport ? 'updated' : 'created';
};

const clearCollection = async (collectionName: string): Promise<number> => {
    let deleted = 0;

    while (true) {
        const snapshot = await getDocs(query(collection(db, collectionName), limit(DELETE_BATCH_SIZE)));
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach((item) => batch.delete(item.ref));
        await batch.commit();
        deleted += snapshot.size;
    }

    return deleted;
};

export const dailyReportTransferService = {
    async exportDbToExcel(): Promise<void> {
        const reports = await dailyReportService.getAllReports();
        const dbRows = toDbExportRows(reports);
        const detailRows = toDbDetailRows(reports);
        const metaRows: JsonRecord[] = [{
            downloadedAt: new Date().toISOString(),
            reportCount: reports.length,
            workerRowCount: detailRows.length,
        }];

        const XLSX = await import('xlsx');
        const { saveAs } = await import('file-saver');

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            await createWorksheetFromRows(dbRows, [
                'ID', '레거시ID', '날짜', '현장ID', '현장명', '담당팀ID', '담당팀명',
                '현장구분', '결제구분', '작업자내역', '총공수', '총금액', '날씨', '작업내용',
                '생성일', '수정일'
            ]),
            DB_SHEET_NAME
        );
        XLSX.utils.book_append_sheet(
            workbook,
            await createWorksheetFromRows(detailRows, [
                '일보ID', '날짜', '담당팀ID', '현장담당팀', '현장ID', '현장명',
                '작업자ID', '이름', '소속팀ID', '소속팀', '급여방식',
                '공수', '단가', '금액', '비고'
            ]),
            DB_DETAIL_SHEET_NAME
        );
        XLSX.utils.book_append_sheet(
            workbook,
            await createWorksheetFromRows(metaRows, ['다운로드일시', '일보수', '상세내역수']),
            DB_META_SHEET_NAME
        );

        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `일보_DB_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },

    async importDbFromExcel(file: File): Promise<DailyReportDbImportResult> {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames.includes(DB_SHEET_NAME) ? DB_SHEET_NAME : workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('DB 업로드 파일에서 시트를 찾지 못했습니다.');
        }

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<JsonRecord>(worksheet, {
            raw: false,
            defval: '',
        });

        if (rows.length === 0) {
            return { created: 0, updated: 0, skipped: 0 };
        }

        const existingReports = await dailyReportService.getAllReports();
        const existingById = new Map<string, DailyReport>(
            existingReports
                .filter((report) => report.id)
                .map((report) => [String(report.id), report])
        );

        const result: DailyReportDbImportResult = { created: 0, updated: 0, skipped: 0 };

        for (const row of rows) {
            const normalized = normalizeReportPayload(row);
            if (!normalized) {
                result.skipped += 1;
                continue;
            }

            const incomingId = String(normalized.id ?? '').trim();
            const existingReport = incomingId ? (existingById.get(incomingId) ?? null) : null;
            const mode = await persistReport(
                {
                    ...normalized,
                    id: incomingId || undefined,
                },
                existingReport
            );

            const savedId = incomingId || String(normalized.id ?? '');
            if (savedId) {
                existingById.set(savedId, {
                    ...normalized,
                    id: savedId,
                });
            }

            if (mode === 'created') {
                result.created += 1;
            } else {
                result.updated += 1;
            }
        }

        return result;
    },

    async resetDb(): Promise<{ reports: number; legacyRows: number }> {
        const reports = await dailyReportService.getAllReports();
        let deletedReports = 0;

        for (const report of reports) {
            if (!report.id) continue;
            await dailyReportService._updateStats(report, -1);
            await deleteDoc(doc(db, REPORT_COLLECTION, report.id));
            deletedReports += 1;
        }

        const legacyRows = await clearCollection(LEGACY_WORKER_COLLECTION);
        return { reports: deletedReports, legacyRows };
    },

    async exportRowsToExcel(rows: DailyReportWorkerRow[], rangeLabel: string): Promise<void> {
        const XLSX = await import('xlsx');

        const statusMap: Record<string, string> = {
            'attendance': '출근',
            'absent': '결근',
            'half': '반차'
        };

        const exportRows: JsonRecord[] = rows.map((row) => ({
            '날짜': row.date ?? '',
            '현장': row.siteName ?? '',
            '현장구분': row.siteType ?? '',
            '결제구분': row.paymentType ?? '',
            '현장담당팀': row.teamName ?? '',
            '이름': row.workerName ?? '',
            '소속팀': row.workerTeamName ?? '',
            '급여방식': resolveReportPayType(row),
            '상태': statusMap[row.status] || row.status,
            '공수': (Number.isFinite(row.manDay) ? row.manDay : 0).toFixed(1),
            '단가': row.unitPrice ?? 0,
            '금액': row.amount ?? 0,
            '비고': row.workContent ?? '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows, {
            header: [
                '날짜', '현장', '현장구분', '결제구분', '현장담당팀', '이름', '소속팀', '급여방식', '상태', '공수', '단가', '금액', '비고'
            ]
        });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_SHEET_NAME);
        XLSX.writeFile(workbook, `일보목록V2_${rangeLabel}.xlsx`);
    },

    async importRowsFromExcel(file: File, context: DailyReportExcelImportContext): Promise<DailyReportExcelImportResult> {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames.includes(EXCEL_SHEET_NAME) ? EXCEL_SHEET_NAME : workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('엑셀 파일에서 시트를 찾지 못했습니다.');
        }

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<JsonRecord>(worksheet, {
            raw: false,
            defval: '',
        });

        const teamLookup = buildEntityLookup(context.teams);
        const siteLookup = buildEntityLookup(context.sites);
        const workerLookup = buildEntityLookup(context.workers);

        const groups = new Map<string, ExcelImportGroup>();
        const warnings: string[] = [];
        let skipped = 0;
        const importedDates: string[] = [];

        rows.forEach((row, index) => {
            const lineNo = index + 2;
            const date = String(pickRowValue(row, ['날짜', 'date']) ?? '').trim();
            if (!date) {
                skipped += 1;
                warnings.push(`${lineNo}행: 날짜가 없어 건너뜀`);
                return;
            }

            const team = resolveEntity(teamLookup, pickRowValue(row, ['현장담당팀ID', '담당팀ID', 'teamId']), pickRowValue(row, ['현장담당팀', '담당팀', 'teamName']));
            if (!team?.id) {
                skipped += 1;
                warnings.push(`${lineNo}행: 현장담당팀을 찾지 못해 건너뜀`);
                return;
            }

            const site = resolveEntity(siteLookup, pickRowValue(row, ['현장ID', 'siteId']), pickRowValue(row, ['현장', 'siteName', '현장명']));
            if (!site?.id) {
                skipped += 1;
                warnings.push(`${lineNo}행: 현장을 찾지 못해 건너뜀`);
                return;
            }

            const worker = resolveWorker(workerLookup, teamLookup, row);
            if (!worker?.id) {
                skipped += 1;
                warnings.push(`${lineNo}행: 작업자를 찾지 못해 건너뜀`);
                return;
            }

            const reportId = String(pickRowValue(row, ['일보ID', 'reportId']) ?? '').trim() || undefined;
            const workerTeam = resolveEntity(teamLookup, pickRowValue(row, ['소속팀ID', '작업팀ID', 'workerTeamId']), pickRowValue(row, ['소속팀', '작업팀', 'workerTeamName']));
            const payType = resolvePayType(
                pickRowValue(row, ['급여방식', 'salaryModel', 'payType']),
                worker.salaryModel,
                worker.payType
            );
            const siteType = String(pickRowValue(row, ['현장구분', 'siteType']) ?? '').trim();
            const paymentType = String(pickRowValue(row, ['결제구분', 'paymentType']) ?? '').trim();
            const workContent = String(pickRowValue(row, ['비고', 'workContent']) ?? '').trim();
            const groupKey = reportId || toReportGroupKey(date, String(team.id), String(site.id));

            let group = groups.get(groupKey);
            if (!group) {
                group = {
                    reportId,
                    date,
                    teamId: String(team.id),
                    teamName: team.name ?? '',
                    siteId: String(site.id),
                    siteName: site.name ?? '',
                    siteType: siteType || undefined,
                    paymentType: paymentType || undefined,
                    workers: new Map<string, DailyReportWorker>(),
                };
                groups.set(groupKey, group);
            } else {
                if (group.date !== date || group.teamId !== String(team.id) || group.siteId !== String(site.id)) {
                    warnings.push(`${lineNo}행: 같은 일보 묶음에 날짜/팀/현장이 달라 첫 값 기준으로 처리`);
                }
                if (!group.siteType && siteType) group.siteType = siteType;
                if (!group.paymentType && paymentType) group.paymentType = paymentType;
            }

            group.workers.set(String(worker.id), syncPayTypeFields({
                workerId: String(worker.id),
                name: worker.name ?? String(pickRowValue(row, ['이름', 'workerName']) ?? '').trim(),
                role: worker.role,
                status: 'attendance',
                manDay: parseNumberValue(pickRowValue(row, ['공수', 'manDay']), 0),
                workContent: workContent || undefined,
                teamId: String(workerTeam?.id ?? worker.teamId ?? '').trim() || undefined,
                unitPrice: parseNumberValue(pickRowValue(row, ['단가', 'unitPrice']), parseNumberValue(worker.unitPrice, 0)),
                payType: payType || undefined,
                salaryModel: payType || undefined,
                siteType: siteType || undefined,
                paymentType: paymentType || undefined,
                workerTeamName: workerTeam?.name ?? worker.teamName ?? (String(pickRowValue(row, ['작업팀', 'workerTeamName']) ?? '').trim() || undefined),
            }, { returnUndefinedOnEmpty: true, priority: 'salaryModel' }));

            importedDates.push(date);
        });

        if (groups.size === 0) {
            return { created: 0, updated: 0, skipped, warnings };
        }

        importedDates.sort((a, b) => a.localeCompare(b, 'en'));
        const startDate = importedDates[0];
        const endDate = importedDates[importedDates.length - 1];
        const existingReports = await dailyReportService.getReports({ startDate, endDate });
        const existingById = new Map<string, DailyReport>(
            existingReports
                .filter((report) => report.id)
                .map((report) => [String(report.id), report])
        );
        const existingByGroupKey = new Map<string, DailyReport>(
            existingReports.map((report) => [toReportGroupKey(report.date, report.teamId, report.siteId), report])
        );

        let created = 0;
        let updated = 0;

        for (const group of groups.values()) {
            const groupWorkers = Array.from(group.workers.values());
            const existingReport = (group.reportId && existingById.get(group.reportId))
                || existingByGroupKey.get(toReportGroupKey(group.date, group.teamId, group.siteId))
                || null;

            const mergedWorkers = existingReport
                ? (() => {
                    const workerMap = new Map<string, DailyReportWorker>(
                        (existingReport.workers ?? []).map((worker) => [String(worker.workerId), worker])
                    );
                    groupWorkers.forEach((worker) => {
                        const previous = workerMap.get(String(worker.workerId));
                        workerMap.set(String(worker.workerId), { ...previous, ...worker });
                    });
                    return Array.from(workerMap.values());
                })()
                : groupWorkers;

            const nextReport: DailyReport = {
                ...(existingReport ?? {}),
                id: group.reportId ?? existingReport?.id,
                date: group.date,
                teamId: group.teamId,
                teamName: group.teamName ?? existingReport?.teamName,
                siteId: group.siteId,
                siteName: group.siteName ?? existingReport?.siteName,
                siteType: group.siteType ?? existingReport?.siteType,
                paymentType: group.paymentType ?? existingReport?.paymentType,
                workers: mergedWorkers,
                totalManDay: 0,
                totalAmount: 0,
                createdAt: existingReport?.createdAt,
            };

            const mode = await persistReport(nextReport, existingReport);
            if (mode === 'created') {
                created += 1;
            } else {
                updated += 1;
            }
        }

        return { created, updated, skipped, warnings };
    },
};
