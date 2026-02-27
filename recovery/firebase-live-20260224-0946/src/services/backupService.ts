import { dc, db } from '../config/firebase';
import { collection, writeBatch, getDocs, limit, query } from 'firebase/firestore';
import * as DC from '@dataconnect/generated';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ==========================================
// 1. Interfaces & Types
// ==========================================

export interface BackupResult {
    total: number;
    success: number;
    failed: number;
    errors: Array<{ id?: string, error: string }>;
}

interface CollectionHandler {
    dataKey: string; // Key in the unwrapped response (e.g., 'companies')
    listFn?: (dc: any, vars?: any) => Promise<any>;
    listAllFn?: (dc: any, vars: any) => Promise<any>;
    createFn?: (dc: any, vars: any) => Promise<any>;
    updateFn?: (dc: any, vars: any) => Promise<any>;
    deleteFn?: (dc: any, vars: any) => Promise<any>;
    useFirestoreFallback: boolean; // For List/Delete if SDK is missing/incomplete
}

// ==========================================
// 2. Configuration Map (The "Brain")
// ==========================================

const HANDLERS: Record<string, CollectionHandler> = {
    'companies': {
        dataKey: 'companies',
        listFn: DC.listCompanies,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllCompanies(dcInstance, vars),
        createFn: DC.createCompany,
        updateFn: DC.updateCompany,
        deleteFn: DC.deleteCompany,
        useFirestoreFallback: false
    },
    'teams': {
        dataKey: 'teams',
        listFn: DC.listTeams,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllTeams(dcInstance, vars),
        createFn: DC.createTeam,
        updateFn: DC.updateTeam,
        deleteFn: DC.deleteTeam,
        useFirestoreFallback: false
    },
    'workers': {
        dataKey: 'workers',
        listFn: DC.listWorkers,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllWorkers(dcInstance, vars),
        createFn: DC.createWorker,
        updateFn: DC.updateWorker,
        deleteFn: DC.deleteWorker,
        useFirestoreFallback: false
    },
    'sites': {
        dataKey: 'sites',
        listFn: DC.listSites,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllSites(dcInstance, vars),
        createFn: DC.createSite,
        updateFn: DC.updateSite,
        deleteFn: DC.deleteSite,
        useFirestoreFallback: false
    },
    'positions': {
        dataKey: 'positions',
        listFn: DC.listPositions,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllPositions(dcInstance, vars),
        createFn: DC.createPosition,
        updateFn: DC.updatePosition,
        deleteFn: DC.deletePosition,
        useFirestoreFallback: false
    },
    'daily_reports': {
        dataKey: 'dailyReports',
        listFn: DC.listDailyReports,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllDailyReports(dcInstance, vars),
        createFn: DC.createDailyReport,
        // updateFn: undefined, // Missing in SDK
        deleteFn: DC.deleteDailyReport,
        useFirestoreFallback: false
    },
    'daily_report_workers': {
        dataKey: 'dailyReportWorkers',
        listFn: DC.listDailyReportWorkers,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllDailyReportWorkers(dcInstance, vars),
        createFn: DC.createDailyReportWorker,
        updateFn: DC.updateDailyReportWorker,
        deleteFn: DC.deleteDailyReportWorker,
        useFirestoreFallback: false
    },
    'app_users': {
        dataKey: 'appUsers',
        listFn: DC.listAppUsers,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllAppUsers(dcInstance, vars),
        // Missing Create/Update/Delete in SDK often
        useFirestoreFallback: true
    },
    'menu_configs': {
        dataKey: 'menuConfigs',
        listFn: DC.listMenuConfigs,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllMenuConfigs(dcInstance, vars),
        // Create/Update explicit missing based on previous analysis
        useFirestoreFallback: true
    },
    'system_logs': {
        dataKey: 'systemLogs',
        listFn: DC.listSystemLogs,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllSystemLogs(dcInstance, vars),
        createFn: DC.createSystemLog,
        useFirestoreFallback: true // Delete often safer in Firestore for logs
    },
    'vehicles': {
        dataKey: 'vehicles',
        listFn: DC.listAllVehicles,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllVehicles(dcInstance, vars),
        createFn: DC.createVehicle,
        updateFn: DC.updateVehicle,
        deleteFn: DC.deleteVehicle,
        useFirestoreFallback: false
    },
    'vehicle_assignments': {
        dataKey: 'vehicleAssignments',
        listFn: DC.listAllVehicleAssignments,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllVehicleAssignments(dcInstance, vars),
        createFn: DC.createVehicleAssignment,
        updateFn: DC.updateVehicleAssignment,
        // deleteFn: DC.deleteVehicleAssignment, // Missing in SDK
        useFirestoreFallback: true // Fallback to Firestore for delete
    },
    'vehicle_expenses': {
        dataKey: 'vehicleExpenses',
        listFn: DC.listAllVehicleExpenses,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllVehicleExpenses(dcInstance, vars),
        createFn: DC.createVehicleExpense,
        deleteFn: DC.deleteVehicleExpense,
        useFirestoreFallback: false
    },
    'vehicle_billing_documents': {
        dataKey: 'vehicleBillingDocuments',
        listFn: DC.listAllVehicleBillingDocuments,
        listAllFn: (dcInstance: any, vars: any) => DC.listAllVehicleBillingDocuments(dcInstance, vars),
        createFn: DC.createVehicleBillingDocument,
        updateFn: DC.updateVehicleBillingDocument,
        // deleteFn: DC.deleteVehicleBillingDocument, // Missing in SDK
        useFirestoreFallback: true
    },
    // Default fallback for others
    'settings': { dataKey: 'settings', listFn: DC.listSettings, listAllFn: (dcInstance: any, vars: any) => DC.listAllSettings(dcInstance, vars), useFirestoreFallback: true },
    'system_configs': { dataKey: 'systemConfigs', listFn: DC.listSystemConfigs, listAllFn: (dcInstance: any, vars: any) => DC.listAllSystemConfigs(dcInstance, vars), useFirestoreFallback: true },
    'accommodations': { dataKey: 'accommodations', listFn: DC.listAllAccommodations, listAllFn: (dcInstance: any, vars: any) => DC.listAllAccommodations(dcInstance, vars), createFn: DC.createAccommodation, deleteFn: DC.deleteAccommodation, useFirestoreFallback: false },
    'utility_records': { dataKey: 'utilityRecords', listFn: DC.listAllUtilityRecords, listAllFn: (dcInstance: any, vars: any) => DC.listAllUtilityRecords(dcInstance, vars), createFn: DC.createUtilityRecord, deleteFn: undefined, useFirestoreFallback: true },
    'accommodation_assignments': { dataKey: 'accommodationAssignments', listFn: DC.listAllAccommodationAssignments, listAllFn: (dcInstance: any, vars: any) => DC.listAllAccommodationAssignments(dcInstance, vars), createFn: DC.createAccommodationAssignment, deleteFn: DC.deleteAccommodationAssignment, useFirestoreFallback: false },
    'accommodation_billing_documents': { dataKey: 'accommodationBillingDocuments', listFn: DC.listAllAccommodationBillingDocuments, listAllFn: (dcInstance: any, vars: any) => DC.listAllAccommodationBillingDocuments(dcInstance, vars), createFn: DC.createAccommodationBillingDocument, deleteFn: DC.deleteAccommodationBillingDocument, useFirestoreFallback: false },
    'accommodation_billing_line_items': { dataKey: 'accommodationBillingLineItems', listFn: DC.listAllAccommodationBillingLineItems, listAllFn: (dcInstance: any, vars: any) => DC.listAllAccommodationBillingLineItems(dcInstance, vars), createFn: DC.createAccommodationBillingLineItem, deleteFn: DC.deleteAccommodationBillingLineItem, useFirestoreFallback: false },
    'advance_payments': { dataKey: 'advancePayments', listFn: DC.listAllAdvancePayments, listAllFn: (dcInstance: any, vars: any) => DC.listAllAdvancePayments(dcInstance, vars), createFn: DC.createAdvancePayment, deleteFn: DC.deleteAdvancePayment, useFirestoreFallback: false },
    'smart_memo_categories': { dataKey: 'smartMemoCategories', listFn: DC.listAllSmartMemoCategories, listAllFn: (dcInstance: any, vars: any) => DC.listAllSmartMemoCategories(dcInstance, vars), createFn: DC.createSmartMemoCategory, deleteFn: DC.deleteSmartMemoCategory, useFirestoreFallback: false },
    'smart_memos': { dataKey: 'smartMemos', listFn: DC.listAllSmartMemos, listAllFn: (dcInstance: any, vars: any) => DC.listAllSmartMemos(dcInstance, vars), createFn: DC.createSmartMemo, deleteFn: DC.deleteSmartMemo, useFirestoreFallback: false },
    'daily_dispatches': { dataKey: 'dailyDispatches', listFn: DC.listAllDailyDispatches, listAllFn: (dcInstance: any, vars: any) => DC.listAllDailyDispatches(dcInstance, vars), createFn: DC.createDailyDispatch, deleteFn: DC.deleteDailyDispatch, useFirestoreFallback: false },
    'payments': { dataKey: 'payments', listFn: DC.listAllPayments, listAllFn: (dcInstance: any, vars: any) => DC.listAllPayments(dcInstance, vars), createFn: DC.createPayment, deleteFn: DC.deletePayment, useFirestoreFallback: false },
    'tax_invoices': { dataKey: 'taxInvoices', listFn: DC.listAllTaxInvoices, listAllFn: (dcInstance: any, vars: any) => DC.listAllTaxInvoices(dcInstance, vars), createFn: DC.createTaxInvoice, deleteFn: DC.deleteTaxInvoice, useFirestoreFallback: false },
    'receivables': { dataKey: 'receivables', listFn: DC.listAllReceivables, listAllFn: (dcInstance: any, vars: any) => DC.listAllReceivables(dcInstance, vars), createFn: DC.createReceivable, deleteFn: DC.deleteReceivable, useFirestoreFallback: false },
    'agents': { dataKey: 'agents', listFn: DC.listAgents, listAllFn: (dcInstance: any, vars: any) => DC.listAllAgents(dcInstance, vars), createFn: DC.createAgent, updateFn: DC.updateAgent, useFirestoreFallback: true },
    'agent_conversations': { dataKey: 'agentConversations', listFn: DC.listAgentConversations, listAllFn: (dcInstance: any, vars: any) => DC.listAllAgentConversations(dcInstance, vars), createFn: DC.createAgentConversation, updateFn: DC.updateAgentConversation, useFirestoreFallback: true },
    'audit_logs': { dataKey: 'auditLogs', listFn: DC.listAuditLogs, listAllFn: (dcInstance: any, vars: any) => DC.listAllAuditLogs(dcInstance, vars), useFirestoreFallback: true },
};

// ==========================================
// 3. Mapping Utilities
// ==========================================

const KOREAN_TO_ENGLISH_MAP: Record<string, string> = {
    // Common
    '아이디': 'id', 'ID': 'id', '이름': 'name', '생성일': 'createdAt', '수정일': 'updatedAt', '상태': 'status',

    // Company / Team / Worker
    '회사코드': 'code', '사업자번호': 'businessNumber', '대표자명': 'ceoName', '대표자': 'ceoName',
    '유형': 'type', '주민번호': 'residentNumber', '전화번호': 'phone', '연락처': 'phone',
    '역할': 'role', '급여유형': 'payType', '회사ID': 'companyId', '팀ID': 'teamId', '직업': 'jobType',

    // Worker Details
    '예금주': 'accountHolder', '은행명': 'bankName', '계좌번호': 'bankAccount',
    '신분증': 'idCardImageUrl', '신분증사본': 'idCardImageUrl', '통장사본': 'fileNameSaved',
    '서명': 'signatureUrl', '혈액형': 'bloodType', '입사일': 'joinDate', '단가': 'unitPrice',

    // Site
    '현장코드': 'code', '주소': 'address', '시작일': 'startDate', '종료일': 'endDate',

    // Daily Report
    '날짜': 'date', '현장명': 'siteName', '담당팀명': 'responsibleTeamName',
    '총공수': 'totalManDay', '총금액': 'totalAmount', '현장ID': 'siteId',

    // Utility / Accommodation
    '비용': 'costs', '월': 'yearMonth', '년월': 'yearMonth', '숙소명': 'accommodationName',
    '숙소ID': 'accommodationId', '계약형태': 'contract', '현재거주자': 'currentOccupantName',
    '비고': 'memo', '메모': 'memo',

    // Position
    '직급': 'rank', '시스템권한': 'systemRole',

    // DailyReportWorker
    '작업자ID': 'workerId', '일보ID': 'dailyReportId', '공수': 'gongsu', '금액': 'amount', '작업자명': 'workerName',

    // Vehicle
    '차량번호': 'licensePlate', '모델': 'model', '차종': 'type',

    // SmartMemo
    '제목': 'title', '내용': 'content', '카테고리ID': 'categoryId', '사용자ID': 'userId',

    // Fallbacks
    '설명': 'description', '키': 'key', '값': 'value', '생년월일': 'birthDate',
    '팀명': 'name', '팀장': 'leaderName', '팀장ID': 'leaderId', '회사명': 'name',
    '공사기간': 'period', '담당자': 'manager',
};

const mapRowToVariables = (row: any) => {
    const result: any = {};
    Object.keys(row).forEach(k => {
        const trimmedKey = k.trim();
        const engKey = KOREAN_TO_ENGLISH_MAP[trimmedKey] || trimmedKey;
        // Clean up some common excel issues
        let val = row[k];
        if (typeof val === 'string' && (val === 'TRUE' || val === 'FALSE')) {
            val = val === 'TRUE';
        }
        result[engKey] = val;
    });
    return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const normalizeForExportRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};

    Object.entries(row)
        .filter(([k]) => k !== '__typename')
        .forEach(([key, raw]) => {
            if (raw == null) {
                out[key] = raw;
                return;
            }

            if (raw instanceof Date) {
                out[key] = raw.toISOString();
                return;
            }

            if (Array.isArray(raw)) {
                out[key] = JSON.stringify(raw);
                return;
            }

            if (isRecord(raw) && typeof raw.id === 'string') {
                out[`${key}Id`] = raw.id;
                if (typeof raw.name === 'string') {
                    out[`${key}Name`] = raw.name;
                }
                return;
            }

            if (isRecord(raw)) {
                out[key] = JSON.stringify(raw);
                return;
            }

            out[key] = raw;
        });

    return out;
};

// ==========================================
// 4. Core Services
// ==========================================

const BATCH_SIZE = 1000;

export const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                const mappedData = jsonData.map(item => mapRowToVariables(item));
                resolve(mappedData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

const unwrap = (response: any, key: string) => {
    if (response?.data?.[key]) return response.data[key];
    if (response?.data?.data?.[key]) return response.data.data[key];
    if (response?.[key]) return response[key];
    return [];
};

export const fetchCollectionData = async (collectionId: string): Promise<any[]> => {
    const handler = HANDLERS[collectionId];
    if (!handler) {
        // Unmapped collection, try direct Firestore
        console.warn(`No handler for ${collectionId}, using Firestore fallback.`);
        const snapshot = await getDocs(collection(db, collectionId));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Direct Firestore Override
    if (handler.useFirestoreFallback && !handler.listFn) {
        const snapshot = await getDocs(collection(db, collectionId));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // DataConnect Query
    // - listAll* 계열: (dcOrVars, vars)로 페이지네이션 가능
    // - list* 계열: (dc) 단일 호출(추가 인자 무시)로 전체 조회
    const supportsPaging = typeof handler.listFn === 'function' && handler.listFn.length >= 2;

    if (!supportsPaging) {
        try {
            // list* 계열은 전체 조회 쿼리로 생성되어 vars가 없습니다.
            // @ts-ignore
            const response = await handler.listFn(dc);
            return unwrap(response, handler.dataKey);
        } catch (error) {
            if (handler.useFirestoreFallback) {
                console.warn(`DataConnect list failed for ${collectionId}, falling back to Firestore.`, error);
                const snapshot = await getDocs(collection(db, collectionId));
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            throw new Error(`Failed to fetch ${collectionId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    const allData: any[] = [];
    let offset = 0;
    while (true) {
        try {
            // @ts-ignore
            const response = await handler.listFn(dc, { limit: BATCH_SIZE, offset });
            const results = unwrap(response, handler.dataKey);

            if (!results || results.length === 0) break;
            allData.push(...results);
            if (results.length < BATCH_SIZE) break;
            offset += BATCH_SIZE;
        } catch (error) {
            if (handler.useFirestoreFallback) {
                console.warn(`DataConnect list failed for ${collectionId}, falling back to Firestore.`, error);
                const snapshot = await getDocs(collection(db, collectionId));
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            throw new Error(`Failed to fetch ${collectionId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return allData;
};

export const fetchCollectionSample = async (collectionId: string, sampleSize: number = 20): Promise<any[]> => {
    const fetchFromFirestore = async (): Promise<any[]> => {
        const q = query(collection(db, collectionId), limit(sampleSize));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const handler = HANDLERS[collectionId];
    if (!handler) {
        return fetchFromFirestore();
    }

    if (handler.useFirestoreFallback && !handler.listFn && !handler.listAllFn) {
        return fetchFromFirestore();
    }

    if (handler.listAllFn) {
        try {
            // @ts-ignore
            const response = await handler.listAllFn(dc, { limit: sampleSize, offset: 0 });
            const rows = unwrap(response, handler.dataKey);
            return Array.isArray(rows) ? rows : [];
        } catch {
            // ignore and fallback
        }
    }

    if (handler.listFn) {
        try {
            const supportsVars = typeof handler.listFn === 'function' && handler.listFn.length >= 2;
            // @ts-ignore
            const response = supportsVars ? await handler.listFn(dc, { limit: sampleSize, offset: 0 }) : await handler.listFn(dc);
            const rows = unwrap(response, handler.dataKey);
            return Array.isArray(rows) ? rows.slice(0, sampleSize) : [];
        } catch (error) {
            if (handler.useFirestoreFallback) {
                return fetchFromFirestore();
            }
            throw new Error(`Failed to fetch sample for ${collectionId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return fetchFromFirestore();
};

export const exportCollectionToExcel = async (collectionId: string, data?: any[]) => {
    const dataToExport = data ?? await fetchCollectionData(collectionId);
    if (!dataToExport) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(collectionId.substring(0, 31));

    if (dataToExport.length === 0) {
        worksheet.addRow(['No Data']);
    } else {
        const normalizedRows = dataToExport
            .map((row) => (isRecord(row) ? normalizeForExportRow(row) : {}));

        const headerSet = new Set<string>();
        normalizedRows.forEach((row) => {
            Object.keys(row).forEach((k) => headerSet.add(k));
        });

        const headerCandidates = Array.from(headerSet);
        const headers = [
            ...['id', 'legacyId'].filter((k) => headerSet.has(k)),
            ...headerCandidates
                .filter((k) => k !== 'id' && k !== 'legacyId')
                .sort((a, b) => a.localeCompare(b))
        ];

        worksheet.addRow(headers);
        normalizedRows.forEach((row) => {
            worksheet.addRow(headers.map((header) => {
                const val = row[header];
                if (val == null) return val;
                if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
                return JSON.stringify(val);
            }));
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${collectionId}_backup_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const resetCollection = async (collectionId: string): Promise<number> => {
    const handler = HANDLERS[collectionId];
    let deletedCount = 0;

    // Strategy 1: DataConnect Delete
    if (handler && handler.deleteFn) {
        // Fetch all IDs first (DataConnect doesn't support "Delete All" usually)
        const items = await fetchCollectionData(collectionId);
        for (const item of items) {
            try {
                // Determine ID or Primary Key
                const pk: any = { id: item.id };
                if (collectionId === 'daily_report_workers' && item.dailyReport && item.worker) {
                    pk.dailyReportId = item.dailyReport.id;
                    pk.workerId = item.worker.id;
                }
                // @ts-ignore
                await handler.deleteFn(dc, pk);
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete ${collectionId} item via DC`, e);
            }
        }
        return deletedCount;
    }

    // Strategy 2: Firestore Batch Delete (Fallback)
    console.log(`Using Firestore batch delete for ${collectionId}`);
    const colRef = collection(db, collectionId);
    const batchSize = 500;

    while (true) {
        const snapshot = await getDocs(query(colRef, limit(batchSize)));
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedCount += snapshot.size;
    }

    return deletedCount;
};

export const restoreBatchData = async (
    collectionId: string,
    data: any[],
    onProgress?: (current: number, total: number) => void
): Promise<BackupResult> => {
    const handler = HANDLERS[collectionId];
    const result: BackupResult = { total: data.length, success: 0, failed: 0, errors: [] };

    if (!handler || !handler.createFn) {
        result.errors.push({ error: `No create handler configured for ${collectionId}` });
        result.failed = data.length;
        return result;
    }

    console.log(`Restoring ${data.length} items to ${collectionId}...`);
    let processed = 0;

    for (const row of data) {
        const variables = mapRowToVariables(row);

        try {
            await upsertHelper(variables, handler.createFn, handler.updateFn);
            result.success++;
        } catch (error: any) {
            console.error(`Restore failed for ${collectionId} item:`, variables.id, error);
            result.failed++;
            result.errors.push({
                id: variables.id ?? 'unknown',
                error: error.message || String(error)
            });
        }

        processed++;
        if (onProgress) onProgress(processed, data.length);
    }

    return result;
};

// Internal Helper
const upsertHelper = async (
    item: any,
    createFn: (dc: any, vars: any) => Promise<any>,
    updateFn?: (dc: any, vars: any) => Promise<any>
) => {
    // 1. Determine Identity
    const hasId = !!item.id;
    const hasDailyReportWorkerKey = !!item.dailyReportId && !!item.workerId;

    // 2. Try Update if we have an ID and an Update Function
    if ((hasId || hasDailyReportWorkerKey) && updateFn) {
        try {
            // @ts-ignore
            await updateFn(dc, item);
            return; // Success
        } catch (error) {
            // Assume failure means "Not Found" or "Partial Key Error" -> Fallback to Create
            // If it was a validation error, Create will likely fail too, which is fine (caught by caller)
        }
    }

    // 3. Fallback to Create
    // Remove null/undefined fields explicitly if needed, but SDK usually handles optional
    // @ts-ignore
    await createFn(dc, item);
};

export const getCollectionCapabilities = (collectionId: string) => {
    const handler = HANDLERS[collectionId];
    return {
        canRestore: !!handler && !!handler.createFn,
        canUpsert: !!handler && !!handler.createFn && !!handler.updateFn,
        canResetViaDataConnect: !!handler && !!handler.deleteFn,
        canResetViaFirestore: true
    };
};
