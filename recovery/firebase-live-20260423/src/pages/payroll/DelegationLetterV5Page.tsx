import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faDownload, faExternalLinkAlt, faMagnifyingGlass, faSave, faSpinner, faTriangleExclamation, faUpload } from '@fortawesome/free-solid-svg-icons';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { saveAs } from 'file-saver';
import { toast } from '../../utils/swal';
import { app } from '../../config/firebase';
import { storage } from '../../config/firebase';
import { functions } from '../../config/firebase';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { poaV5TemplateService } from '../../services/poaV5TemplateService';
import { generatePoaExcelFromTemplate, PoaV5ExcelMapping, suggestPoaV5MappingFromTemplate } from '../../utils/excel/PoaV5ExcelGenerator';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { payrollService, PayrollData } from '../../services/payrollService';

import ExcelJS from 'exceljs';

const DelegationLetterV5Page: React.FC = () => {
    const { siteData, currentSite, effectiveSite } = useSiteMode();

    const configuredTemplatePath = useMemo(() => {
        const forCurrent = siteData?.[currentSite]?.delegationTemplatePath;
        const forEffective = siteData?.[effectiveSite]?.delegationTemplatePath;
        return (forCurrent || forEffective || '').trim();
    }, [siteData, currentSite, effectiveSite]);

    const [templatePath, setTemplatePath] = useState<string>(configuredTemplatePath);
    const [downloadUrl, setDownloadUrl] = useState<string>('');
    const [downloadUrlError, setDownloadUrlError] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    const [mappingJson, setMappingJson] = useState<string>('');
    const [mappingMeta, setMappingMeta] = useState<{ updatedAt: string; schemaVersion: number } | null>(null);
    const [mappingLoading, setMappingLoading] = useState(false);
    const [mappingSaving, setMappingSaving] = useState(false);
    const [mappingAutoDetecting, setMappingAutoDetecting] = useState(false);

    const [dataJson, setDataJson] = useState<string>('');
    const [excelGenerating, setExcelGenerating] = useState(false);
    const [quickGenerating, setQuickGenerating] = useState(false);

    const [excelPreviewLoading, setExcelPreviewLoading] = useState(false);
    type PreviewGrid = {
        sheetName: string;
        topRow: number;
        leftCol: number;
        rows: string[][];
    };

    const [excelPreview, setExcelPreview] = useState<null | PreviewGrid>(null);
    const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);
    const [templatePreview, setTemplatePreview] = useState<null | PreviewGrid>(null);
    const [previewMode, setPreviewMode] = useState<'template' | 'output'>('output');
    const [pickedCell, setPickedCell] = useState<null | { address: string; row: number; col: number; value: string }>(null);
    const [pickedCellPath, setPickedCellPath] = useState('');

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [workersLoading, setWorkersLoading] = useState(false);
    const [workerSearch, setWorkerSearch] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

    const [sites, setSites] = useState<Site[]>([]);
    const [sitesLoading, setSitesLoading] = useState(false);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportLoading, setReportLoading] = useState(false);

    type PoaV5WorkerRow = {
        id?: string;
        name: string;
        idNumber: string;
        address: string;
        gongsu: number;
        unitPrice: number;
        amount: number;
        signatureUrl: string;
    };

    const [reportWorkerRows, setReportWorkerRows] = useState<PoaV5WorkerRow[]>([]);
    const [bulkGongsuInput, setBulkGongsuInput] = useState('');
    const [bulkUnitPriceInput, setBulkUnitPriceInput] = useState('');

    const safeJsonParse = <T,>(raw: string): T | null => {
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    };

    const normalizeMapping = (raw: any): PoaV5ExcelMapping | null => {
        if (!raw || typeof raw !== 'object') return null;
        if (raw.version !== 1) return null;
        return {
            version: 1,
            sheetName: typeof raw.sheetName === 'string' ? raw.sheetName : undefined,
            outputFileName: typeof raw.outputFileName === 'string' ? raw.outputFileName : undefined,
            cells: Array.isArray(raw.cells) ? raw.cells : [],
            tables: Array.isArray(raw.tables) ? raw.tables : []
        };
    };

    const fetchTemplateBuffer = async (): Promise<ArrayBuffer> => {
        if (!downloadUrl) {
            const suffix = downloadUrlError ? ` (${downloadUrlError})` : '';
            throw new Error(`템플릿 파일을 먼저 업로드하거나 경로를 설정해주세요.${suffix}`);
        }
        const resp = await fetch(downloadUrl);
        if (!resp.ok) {
            throw new Error(`템플릿 다운로드 실패: ${resp.status}`);
        }
        const contentType = resp.headers.get('content-type') || '';
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);

        const isZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
        if (!isZip) {
            let head = '';
            try {
                const decoded = new TextDecoder('utf-8').decode(bytes.slice(0, 200));
                head = decoded.replace(/\s+/g, ' ').trim().slice(0, 120);
            } catch {
                head = '';
            }
            const ct = contentType ? ` content-type=${contentType}` : '';
            const headMsg = head ? ` head=${head}` : '';
            throw new Error(`템플릿이 .xlsx(Zip) 파일이 아닙니다.${ct}${headMsg}`);
        }

        return buf;
    };

    const isExcelTemplatePath = (path: string): boolean => {
        const v = String(path || '').toLowerCase();
        return v.includes('.xlsx') || v.includes('.xls');
    };

    const isXlsxTemplatePath = (path: string): boolean => {
        const v = String(path || '').toLowerCase();
        return v.includes('.xlsx');
    };

    const isXlsTemplatePath = (path: string): boolean => {
        const v = String(path || '').toLowerCase();
        return v.includes('.xls') && !v.includes('.xlsx');
    };

    const isLikelyNonExcelTemplate = (path: string): boolean => {
        const v = String(path || '').toLowerCase();
        return v.includes('.pdf') || v.includes('.png') || v.includes('.jpg') || v.includes('.jpeg') || v.includes('.webp');
    };

    const assertExcelTemplateOrToast = (contextLabel: string): boolean => {
        const p = (templatePath || '').trim();
        if (p && isLikelyNonExcelTemplate(p)) {
            toast.error(`${contextLabel}: 엑셀(.xlsx) 템플릿에서만 사용할 수 있습니다.`);
            return false;
        }
        if (!p && downloadUrl && isLikelyNonExcelTemplate(downloadUrl)) {
            toast.error(`${contextLabel}: 엑셀(.xlsx) 템플릿에서만 사용할 수 있습니다.`);
            return false;
        }
        return true;
    };

    const assertXlsxTemplateOrToast = (contextLabel: string): boolean => {
        const candidate = (templatePath || '').trim() || (downloadUrl || '').trim();
        if (!candidate) return true;
        if (isXlsTemplatePath(candidate)) {
            toast.error(`${contextLabel}: 현재는 .xls 형식은 지원하지 않습니다. .xlsx로 저장해서 업로드해주세요.`);
            return false;
        }
        if (isExcelTemplatePath(candidate) && !isXlsxTemplatePath(candidate)) {
            toast.error(`${contextLabel}: .xlsx 템플릿이 필요합니다.`);
            return false;
        }
        return true;
    };

    const buildReportWorkerRowsFromPayroll = (payrollList: PayrollData[], workersMaster: Worker[]): PoaV5WorkerRow[] => {
        const byId = new Map<string, Worker>();
        const byLegacyId = new Map<string, Worker>();
        for (const w of workersMaster) {
            if (w.id) byId.set(String(w.id), w);
            if (w.legacyId) byLegacyId.set(String(w.legacyId), w);
        }

        return payrollList
            .map((p) => {
                const key = String(p.id ?? '');
                const master = byId.get(key) ?? byLegacyId.get(key) ?? workersMaster.find((w) => String(w.name) === String(p.name));
                const gongsu = typeof p?.gongsu?.total === 'number' ? p.gongsu.total : 0;
                const unitPrice = typeof p?.unitPrice === 'number' ? p.unitPrice : 0;
                const amount = typeof p?.grossPay === 'number' ? p.grossPay : (gongsu * unitPrice);

                return {
                    id: master?.id ?? key,
                    name: master?.name ?? p.name,
                    idNumber: master?.idNumber ?? '',
                    address: master?.address ?? '',
                    gongsu,
                    unitPrice,
                    amount,
                    signatureUrl: master?.signatureUrl ?? ''
                };
            })
            .filter((r) => String(r.name || '').trim().length > 0);
    };

    const enrichRowsWithMasterIdentity = async (rows: PoaV5WorkerRow[]): Promise<PoaV5WorkerRow[]> => {
        const needs = rows
            .map((r, idx) => ({ r, idx }))
            .filter(({ r }) => !String(r.idNumber || '').trim() && String(r.id || '').trim());

        if (needs.length === 0) return rows;

        const results = await Promise.allSettled(
            needs.map(async ({ r, idx }) => {
                const rawId = String(r.id || '').trim();
                const w = await manpowerService.getWorker(rawId);
                return { idx, worker: w };
            })
        );

        const next = [...rows];
        let filled = 0;

        for (const res of results) {
            if (res.status !== 'fulfilled') continue;
            const { idx, worker } = res.value;
            if (!worker) continue;

            const current = next[idx];
            if (!current) continue;

            const nextItem: PoaV5WorkerRow = {
                ...current,
                name: current.name || worker.name,
                idNumber: String(current.idNumber || '').trim() ? current.idNumber : (worker.idNumber ?? ''),
                address: String(current.address || '').trim() ? current.address : (worker.address ?? ''),
                signatureUrl: String(current.signatureUrl || '').trim() ? current.signatureUrl : (worker.signatureUrl ?? '')
            };

            if (String(nextItem.idNumber || '').trim() && !String(current.idNumber || '').trim()) {
                filled += 1;
            }

            next[idx] = nextItem;
        }

        if (filled > 0) {
            toast.info(`주민번호 ${filled}건을 작업자 마스터에서 보강했습니다.`);
        }

        return next;
    };

    useEffect(() => {
        setTemplatePath(configuredTemplatePath);
    }, [configuredTemplatePath]);

    useEffect(() => {
        const run = async () => {
            setWorkersLoading(true);
            try {
                const list = await manpowerService.getWorkers();
                setWorkers(list);
            } catch (e) {
                console.error(e);
            } finally {
                setWorkersLoading(false);
            }
        };

        run();
    }, []);

    useEffect(() => {
        const run = async () => {
            setSitesLoading(true);
            try {
                const list = await siteService.getSites();
                setSites(list);
                if (list.length > 0) {
                    const first = list.find((s) => s.id) ?? list[0];
                    const firstId = first?.id ?? '';
                    setSelectedSiteId((prev) => (prev ? prev : firstId));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setSitesLoading(false);
            }
        };

        run();
    }, []);

    useEffect(() => {
        const run = async () => {
            setMappingLoading(true);
            try {
                const item = await poaV5TemplateService.loadSiteMapping(currentSite);
                if (!item) {
                    setMappingJson('');
                    setMappingMeta(null);
                    return;
                }
                setMappingJson(item.mappingJson || '');
                setMappingMeta({ updatedAt: item.updatedAt, schemaVersion: item.schemaVersion });

                if (!configuredTemplatePath && item.templatePath) {
                    setTemplatePath(String(item.templatePath));
                }

                // Seed sample data only if empty
                if (!dataJson.trim()) {
                    setDataJson(
                        JSON.stringify(
                            {
                                trustee: {
                                    name: '',
                                    idNumber: '',
                                    address: '',
                                    contact: '',
                                    bankName: '',
                                    accountNumber: '',
                                    accountHolder: ''
                                },
                                month: new Date().toISOString().slice(0, 7),
                                site: {
                                    name: ''
                                },
                                workers: []
                            },
                            null,
                            2
                        )
                    );
                }
            } catch (e) {
                console.error(e);
                setMappingJson('');
                setMappingMeta(null);
            } finally {
                setMappingLoading(false);
            }
        };
        run();
    }, [currentSite]);

    const toggleWorkerSelection = (workerId: string) => {
        setSelectedWorkerIds((prev) =>
            prev.includes(workerId)
                ? prev.filter((id) => id !== workerId)
                : [...prev, workerId]
        );
    };

    const handleApplySelectedWorkersToData = () => {
        try {
            const base = dataJson.trim() ? JSON.parse(dataJson) : {};
            const selected = workers.filter((w) => w.id && selectedWorkerIds.includes(w.id));

            const nextWorkers = selected.map((w) => ({
                id: w.id,
                name: w.name,
                idNumber: w.idNumber,
                address: w.address ?? '',
                contact: w.contact ?? '',
                gongsu: 0,
                unitPrice: typeof w.unitPrice === 'number' ? w.unitPrice : 0,
                amount: 0,
                signatureUrl: w.signatureUrl ?? ''
            }));

            const next = {
                ...base,
                workers: nextWorkers
            };

            setDataJson(JSON.stringify(next, null, 2));
            toast.success('선택한 작업자를 데이터 JSON에 반영했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '데이터 JSON 반영 실패');
        }
    };

    const handleAutoDetectTableMapping = async () => {
        if (!downloadUrl) {
            toast.error('템플릿 파일을 먼저 업로드하거나 경로를 설정해주세요.');
            return;
        }

        if (!assertExcelTemplateOrToast('자동 표 매핑')) return;
        if (!assertXlsxTemplateOrToast('자동 표 매핑')) return;

        setMappingAutoDetecting(true);
        try {
            const templateBuffer = await fetchTemplateBuffer();

            const suggested = await suggestPoaV5MappingFromTemplate({
                templateBuffer,
                sheetName: null
            });

            let existing: any = null;
            try {
                existing = mappingJson.trim() ? JSON.parse(mappingJson) : null;
            } catch {
                existing = null;
            }

            const next: PoaV5ExcelMapping = {
                version: 1,
                sheetName: (existing?.sheetName ?? suggested.sheetName) || undefined,
                outputFileName: (existing?.outputFileName ?? suggested.outputFileName) || undefined,
                cells: Array.isArray(existing?.cells) ? existing.cells : (suggested.cells ?? []),
                tables: Array.isArray(suggested?.tables) ? suggested.tables : []
            };

            setMappingJson(JSON.stringify(next, null, 2));
            toast.success('표 매핑을 자동으로 생성했습니다. (tables 갱신)');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '자동 매핑 실패');
        } finally {
            setMappingAutoDetecting(false);
        }
    };

    const handleLoadWorkersFromDailyReports = async () => {
        if (!selectedSiteId) {
            toast.error('현장을 선택해주세요.');
            return;
        }
        if (!selectedMonth) {
            toast.error('월을 선택해주세요.');
            return;
        }

        setReportLoading(true);
        try {
            const [yRaw, mRaw] = selectedMonth.split('-');
            const year = Number(yRaw);
            const month = Number(mRaw);
            if (!Number.isFinite(year) || !Number.isFinite(month)) {
                toast.error('월 형식이 올바르지 않습니다.');
                return;
            }

            const payrollList: PayrollData[] = await payrollService.getPayrollData(year, month, undefined, selectedSiteId);
            const baseRows = buildReportWorkerRowsFromPayroll(payrollList, workers);
            const nextRows = await enrichRowsWithMasterIdentity(baseRows);

            setReportWorkerRows(nextRows);
            if (nextRows.length === 0) {
                const siteName = sites.find((s) => String(s.id ?? '') === String(selectedSiteId))?.name ?? '';
                toast.warning(`일보 데이터가 없습니다. (현장: ${siteName || selectedSiteId}, 월: ${selectedMonth})`);
            } else {
                toast.success(`일보 기준으로 ${nextRows.length}명 데이터를 불러왔습니다.`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '일보 데이터 불러오기 실패');
        } finally {
            setReportLoading(false);
        }
    };

    const handleQuickGenerate = async () => {
        if (!selectedSiteId) {
            toast.error('현장을 선택해주세요.');
            return;
        }
        if (!selectedMonth) {
            toast.error('월을 선택해주세요.');
            return;
        }

        if (!assertExcelTemplateOrToast('원클릭 생성')) return;
        if (!assertXlsxTemplateOrToast('원클릭 생성')) return;

        setQuickGenerating(true);
        try {
            const templateBuffer = await fetchTemplateBuffer();

            const mappingParsed = mappingJson.trim() ? safeJsonParse<any>(mappingJson.trim()) : null;
            let mapping = mappingParsed ? normalizeMapping(mappingParsed) : null;

            if (!mapping) {
                const suggested = await suggestPoaV5MappingFromTemplate({ templateBuffer, sheetName: null });
                mapping = suggested;
                setMappingJson(JSON.stringify(mapping, null, 2));
                toast.info('매핑이 없어 자동으로 표 매핑을 생성했습니다.');
            } else if (!Array.isArray(mapping.tables) || mapping.tables.length === 0) {
                const suggested = await suggestPoaV5MappingFromTemplate({ templateBuffer, sheetName: mapping.sheetName ?? null });
                mapping = {
                    ...mapping,
                    sheetName: mapping.sheetName ?? suggested.sheetName,
                    outputFileName: mapping.outputFileName ?? suggested.outputFileName,
                    tables: Array.isArray(suggested.tables) ? suggested.tables : []
                };
                setMappingJson(JSON.stringify(mapping, null, 2));
                toast.info('표 매핑이 없어 자동으로 표 매핑을 생성했습니다.');
            }

            if (!mapping) {
                toast.error('매핑을 생성하지 못했습니다. 매핑 JSON을 확인해주세요.');
                return;
            }

            const [yRaw, mRaw] = selectedMonth.split('-');
            const year = Number(yRaw);
            const month = Number(mRaw);
            if (!Number.isFinite(year) || !Number.isFinite(month)) {
                toast.error('월 형식이 올바르지 않습니다.');
                return;
            }

            const payrollList: PayrollData[] = await payrollService.getPayrollData(year, month, undefined, selectedSiteId);
            const baseRows = buildReportWorkerRowsFromPayroll(payrollList, workers);
            const rows = await enrichRowsWithMasterIdentity(baseRows);
            setReportWorkerRows(rows);

            const base = dataJson.trim() ? JSON.parse(dataJson) : {};
            const selectedSiteName = sites.find((s) => String(s.id ?? '') === String(selectedSiteId))?.name ?? '';

            const nextWorkers = rows.map((r) => ({
                id: r.id,
                name: r.name,
                idNumber: r.idNumber,
                address: r.address,
                gongsu: Number(r.gongsu) || 0,
                unitPrice: Number(r.unitPrice) || 0,
                amount: Number(r.amount) || 0,
                signatureUrl: r.signatureUrl
            }));

            const nextData = {
                ...base,
                month: selectedMonth || base?.month,
                site: {
                    ...(base?.site || {}),
                    name: selectedSiteName || base?.site?.name || ''
                },
                workers: nextWorkers
            };

            setDataJson(JSON.stringify(nextData, null, 2));

            if (rows.length === 0) {
                toast.warning('일보 데이터가 0명이라 빈 표로 생성됩니다. (현장/월 또는 일보 입력 여부를 확인해주세요)');
            }

            const out = await generatePoaExcelFromTemplate({
                templateBuffer,
                mapping,
                data: nextData
            });

            const fileName = (mapping.outputFileName && String(mapping.outputFileName).trim())
                ? String(mapping.outputFileName).trim()
                : `위임장_v5_${currentSite}.xlsx`;

            saveAs(
                new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                fileName
            );

            toast.success('원클릭 생성 완료 (일보→데이터 반영 + 엑셀 생성)');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '원클릭 생성 실패');
        } finally {
            setQuickGenerating(false);
        }
    };

    const handleBulkApply = (kind: 'gongsu' | 'unitPrice') => {
        const raw = kind === 'gongsu' ? bulkGongsuInput : bulkUnitPriceInput;
        const v = Number(raw);
        if (!Number.isFinite(v)) {
            toast.error('숫자를 입력해주세요.');
            return;
        }

        setReportWorkerRows((prev) =>
            prev.map((r) => {
                const next = {
                    ...r,
                    gongsu: kind === 'gongsu' ? v : r.gongsu,
                    unitPrice: kind === 'unitPrice' ? v : r.unitPrice
                };
                return {
                    ...next,
                    amount: (Number(next.gongsu) || 0) * (Number(next.unitPrice) || 0)
                };
            })
        );
        toast.success(kind === 'gongsu' ? '공수를 일괄 수정했습니다.' : '단가를 일괄 수정했습니다.');
    };

    const handleApplyReportWorkersToData = () => {
        try {
            const base = dataJson.trim() ? JSON.parse(dataJson) : {};

            const selectedSiteName = sites.find((s) => String(s.id ?? '') === String(selectedSiteId))?.name ?? '';

            const nextWorkers = reportWorkerRows.map((r) => ({
                id: r.id,
                name: r.name,
                idNumber: r.idNumber,
                address: r.address,
                gongsu: Number(r.gongsu) || 0,
                unitPrice: Number(r.unitPrice) || 0,
                amount: Number(r.amount) || 0,
                signatureUrl: r.signatureUrl
            }));

            const next = {
                ...base,
                month: selectedMonth || base?.month,
                site: {
                    ...(base?.site || {}),
                    name: selectedSiteName || base?.site?.name || ''
                },
                workers: nextWorkers
            };

            setDataJson(JSON.stringify(next, null, 2));
            toast.success('일보 기반 작업자 데이터를 데이터 JSON에 반영했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '데이터 JSON 반영 실패');
        }
    };

    const handleGenerateExcel = async () => {
        if (!downloadUrl) {
            toast.error('템플릿 파일을 먼저 업로드하거나 경로를 설정해주세요.');
            return;
        }

        if (!assertExcelTemplateOrToast('엑셀 생성')) return;
        if (!assertXlsxTemplateOrToast('엑셀 생성')) return;

        const mappingRaw = mappingJson.trim();
        if (!mappingRaw) {
            toast.error('매핑 JSON이 비어있습니다.');
            return;
        }

        setExcelGenerating(true);
        try {
            const mappingParsed: PoaV5ExcelMapping = JSON.parse(mappingRaw);
            if (!mappingParsed || mappingParsed.version !== 1) {
                toast.error('매핑 JSON 형식이 올바르지 않습니다. (version=1 필요)');
                return;
            }
            const normalizedMapping: PoaV5ExcelMapping = {
                ...mappingParsed,
                cells: Array.isArray((mappingParsed as any).cells) ? (mappingParsed as any).cells : [],
                tables: Array.isArray((mappingParsed as any).tables) ? (mappingParsed as any).tables : []
            };

            const dataParsed = dataJson.trim() ? JSON.parse(dataJson) : {};

            const templateBuffer = await fetchTemplateBuffer();

            const out = await generatePoaExcelFromTemplate({
                templateBuffer,
                mapping: normalizedMapping,
                data: dataParsed
            });

            const fileName = (normalizedMapping.outputFileName && String(normalizedMapping.outputFileName).trim())
                ? String(normalizedMapping.outputFileName).trim()
                : `위임장_v5_${currentSite}.xlsx`;

            saveAs(
                new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                fileName
            );

            toast.success('엑셀 파일을 생성했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '엑셀 생성 실패');
        } finally {
            setExcelGenerating(false);
        }
    };

    useEffect(() => {
        const run = async () => {
            if (!templatePath) {
                setDownloadUrl('');
                setDownloadUrlError('');
                return;
            }

            const raw = templatePath.trim();
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                setDownloadUrl(raw);
                setDownloadUrlError('');
                return;
            }

            const normalizeGsUrlToObjectPath = (gsUrl: string): { objectPath: string; bucket: string } => {
                const withoutScheme = gsUrl.slice('gs://'.length);
                const slash = withoutScheme.indexOf('/');
                if (slash <= 0) {
                    throw new Error('Invalid gs:// URL');
                }
                const bucket = withoutScheme.slice(0, slash);
                const objectPath = withoutScheme.slice(slash + 1);
                if (!bucket || !objectPath) {
                    throw new Error('Invalid gs:// URL');
                }
                return { bucket, objectPath };
            };

            try {
                let storageInstance = storage;
                let objectPath = raw;

                if (raw.startsWith('gs://')) {
                    const parsed = normalizeGsUrlToObjectPath(raw);
                    storageInstance = getStorage(app, `gs://${parsed.bucket}`);
                    objectPath = parsed.objectPath;
                }

                const storageRef = ref(storageInstance, objectPath);
                const url = await getDownloadURL(storageRef);
                setDownloadUrl(url);
                setDownloadUrlError('');
            } catch (e) {
                console.error(e);
                setDownloadUrl('');
                setDownloadUrlError(e instanceof Error ? e.message : '템플릿 URL 생성 실패');
            }
        };

        run();
    }, [templatePath]);

    const handleLoadMapping = async () => {
        setMappingLoading(true);
        try {
            const item = await poaV5TemplateService.loadSiteMapping(currentSite);
            if (!item) {
                setMappingJson('');
                setMappingMeta(null);
                toast.success('저장된 매핑이 없습니다.');
                return;
            }
            setMappingJson(item.mappingJson || '');
            setMappingMeta({ updatedAt: item.updatedAt, schemaVersion: item.schemaVersion });

            if (item.templatePath) {
                setTemplatePath(String(item.templatePath));
            }
            toast.success('매핑을 불러왔습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '매핑 로드 실패');
        } finally {
            setMappingLoading(false);
        }
    };

    const handleSaveMapping = async () => {
        setMappingSaving(true);
        try {
            const text = String(mappingJson ?? '');
            const trimmed = text.trim();
            if (trimmed) {
                JSON.parse(trimmed);
            }

            await poaV5TemplateService.saveSiteMapping(currentSite, {
                mappingJson: text,
                templatePath: templatePath.trim() ? templatePath.trim() : undefined
            });
            setMappingMeta({ updatedAt: new Date().toISOString(), schemaVersion: 1 });
            toast.success('매핑을 저장했습니다.');
        } catch (e: any) {
            console.error(e);
            const msg = e?.message ? String(e.message) : '매핑 저장 실패';
            toast.error(msg);
        } finally {
            setMappingSaving(false);
        }
    };

    const handleAnalyze = async () => {
        const path = (templatePath || '').trim();
        if (!path) {
            toast.error('템플릿 경로가 없습니다.');
            return;
        }

        setAnalyzing(true);
        try {
            const fn = httpsCallable<any, any>(functions, 'analyzeDelegationTemplateV5');
            const res = await fn({ templatePath: path, siteKey: currentSite });
            setAnalysisResult(res.data);
            toast.success('분석 요청이 완료되었습니다.');

            const parsed = res?.data?.analysis?.gemini?.parsed;
            if (parsed && typeof parsed === 'object' && (parsed as any).version === 1) {
                try {
                    setMappingJson(JSON.stringify(parsed, null, 2));
                    toast.info('분석 결과(매핑)를 자동으로 적용했습니다.');
                } catch {
                    // ignore
                }
            }

            const hasParsedMapping = !!(parsed && typeof parsed === 'object' && (parsed as any).version === 1);
            if (!hasParsedMapping && downloadUrl && assertExcelTemplateOrToast('분석') && assertXlsxTemplateOrToast('분석')) {
                try {
                    const templateBuffer = await fetchTemplateBuffer();
                    const suggested = await suggestPoaV5MappingFromTemplate({ templateBuffer, sheetName: null });
                    setMappingJson(JSON.stringify(suggested, null, 2));
                    toast.info('분석 결과에 매핑이 없어, 템플릿 헤더를 스캔해 자동 표 매핑을 생성했습니다.');
                } catch (e) {
                    console.warn('[v5] analyze fallback auto mapping failed', e);
                }
            }

            const status = res?.data?.analysis?.status;
            if (status === 'stub') {
                toast.warning('Gemini 분석이 아직 연결되지 않아 분석 결과는 제한적입니다. (API Key 설정 필요)');
            }
        } catch (e: any) {
            console.error(e);
            const code = e?.code ? String(e.code) : '';
            const msg = e?.message ? String(e.message) : '분석에 실패했습니다.';
            toast.error(code ? `${code}: ${msg}` : msg);
        } finally {
            setAnalyzing(false);
        }
    };

    const extractPreviewGrid = (params: {
        workbook: ExcelJS.Workbook;
        mapping: PoaV5ExcelMapping;
        maxRows?: number;
        maxCols?: number;
    }): { sheetName: string; topRow: number; leftCol: number; rows: string[][] } => {
        const worksheet = params.mapping.sheetName
            ? params.workbook.getWorksheet(params.mapping.sheetName)
            : params.workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('Worksheet not found in output');
        }

        const maxRows = typeof params.maxRows === 'number' && params.maxRows > 0 ? params.maxRows : 40;
        const maxCols = typeof params.maxCols === 'number' && params.maxCols > 0 ? params.maxCols : 20;

        let minRow = Number.POSITIVE_INFINITY;
        let maxRow = 0;
        let minCol = Number.POSITIVE_INFINITY;
        let maxCol = 0;

        const a1ToRC = (address: string): { row: number; col: number } | null => {
            const m = /^([A-Za-z]+)(\d+)$/.exec(address.trim());
            if (!m) return null;
            const letters = m[1].toUpperCase();
            const row = Number(m[2]);
            if (!Number.isFinite(row) || row <= 0) return null;
            let col = 0;
            for (let i = 0; i < letters.length; i++) {
                col = col * 26 + (letters.charCodeAt(i) - 64);
            }
            if (!Number.isFinite(col) || col <= 0) return null;
            return { row, col };
        };

        for (const m of params.mapping.cells || []) {
            const addr = typeof m?.address === 'string' ? m.address : '';
            const rc = addr ? a1ToRC(addr) : null;
            if (!rc) continue;
            minRow = Math.min(minRow, rc.row);
            maxRow = Math.max(maxRow, rc.row);
            minCol = Math.min(minCol, rc.col);
            maxCol = Math.max(maxCol, rc.col);
        }

        for (const t of params.mapping.tables || []) {
            const start = typeof t?.startCell === 'string' ? t.startCell : '';
            const rc = start ? a1ToRC(start) : null;
            if (!rc) continue;

            const cols = Array.isArray(t.columns) ? t.columns : [];
            const offsets = cols
                .map((c) => (typeof (c as any)?.offset === 'number' ? (c as any).offset : NaN))
                .filter((v) => Number.isFinite(v)) as number[];
            const maxOffset = offsets.length > 0 ? Math.max(...offsets) : 0;

            const rowsCount = typeof t.maxRows === 'number' && t.maxRows > 0 ? t.maxRows : 10;
            const headerRow = rc.row > 1 ? rc.row - 1 : rc.row;

            minRow = Math.min(minRow, headerRow);
            maxRow = Math.max(maxRow, rc.row + rowsCount - 1);
            minCol = Math.min(minCol, rc.col);
            maxCol = Math.max(maxCol, rc.col + maxOffset);
        }

        if (!Number.isFinite(minRow) || minRow === Number.POSITIVE_INFINITY) {
            minRow = 1;
            maxRow = Math.min(worksheet.rowCount || 1, maxRows);
            minCol = 1;
            maxCol = Math.min(10, maxCols);
        }

        const topRow = minRow;
        const leftCol = minCol;
        const height = Math.min(maxRows, Math.max(1, maxRow - minRow + 1));
        const width = Math.min(maxCols, Math.max(1, maxCol - minCol + 1));

        const rows: string[][] = [];
        for (let r = 0; r < height; r++) {
            const rowIdx = topRow + r;
            const line: string[] = [];
            for (let c = 0; c < width; c++) {
                const colIdx = leftCol + c;
                const cell = worksheet.getCell(rowIdx, colIdx);
                const text = (cell as any)?.text ?? (cell.value ?? '');
                line.push(String(text ?? ''));
            }
            rows.push(line);
        }

        return { sheetName: worksheet.name, topRow, leftCol, rows };
    };

    const extractTemplateGrid = (params: {
        workbook: ExcelJS.Workbook;
        sheetName?: string | null;
        maxRows?: number;
        maxCols?: number;
    }): PreviewGrid => {
        const worksheet = params.sheetName
            ? params.workbook.getWorksheet(params.sheetName)
            : params.workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('Worksheet not found in template');
        }

        const maxRows = typeof params.maxRows === 'number' && params.maxRows > 0 ? params.maxRows : 40;
        const maxCols = typeof params.maxCols === 'number' && params.maxCols > 0 ? params.maxCols : 20;

        let minRow = Number.POSITIVE_INFINITY;
        let maxRow = 0;
        let minCol = Number.POSITIVE_INFINITY;
        let maxCol = 0;

        worksheet.eachRow({ includeEmpty: false }, (row) => {
            minRow = Math.min(minRow, row.number);
            maxRow = Math.max(maxRow, row.number);
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                if (cell.value === null || cell.value === undefined) return;
                minCol = Math.min(minCol, colNumber);
                maxCol = Math.max(maxCol, colNumber);
            });
        });

        if (!Number.isFinite(minRow) || !Number.isFinite(minCol) || maxRow <= 0 || maxCol <= 0) {
            minRow = 1;
            minCol = 1;
            maxRow = 1;
            maxCol = 1;
        }

        const topRow = Math.max(1, minRow - 2);
        const leftCol = Math.max(1, minCol - 2);

        const endRow = Math.min(maxRow + 2, topRow + maxRows - 1);
        const endCol = Math.min(maxCol + 2, leftCol + maxCols - 1);

        const rows: string[][] = [];
        for (let r = topRow; r <= endRow; r++) {
            const row: string[] = [];
            for (let c = leftCol; c <= endCol; c++) {
                const v = worksheet.getCell(r, c).value as any;
                const text = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                    ? String(v)
                    : (v?.text ? String(v.text) : '');
                row.push(text);
            }
            rows.push(row);
        }

        return { sheetName: worksheet.name, topRow, leftCol, rows };
    };

    const colToLetters = (col: number): string => {
        let n = col;
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    };

    const rcToA1 = (row: number, col: number): string => `${colToLetters(col)}${row}`;

    const handleAddPickedCellToMapping = (address: string, path: string) => {
        const trimmedPath = String(path || '').trim();
        if (!trimmedPath) {
            toast.error('추가할 path를 입력해주세요. (예: trustee.name)');
            return;
        }

        let existing: any = null;
        try {
            existing = mappingJson.trim() ? JSON.parse(mappingJson) : null;
        } catch {
            existing = null;
        }

        const base: any = existing && typeof existing === 'object'
            ? existing
            : { version: 1, sheetName: undefined, outputFileName: undefined, cells: [], tables: [] };

        const normalized: PoaV5ExcelMapping =
            normalizeMapping(base) ?? { version: 1, sheetName: undefined, outputFileName: undefined, cells: [], tables: [] };

        const previewSheetName = previewMode === 'template' ? templatePreview?.sheetName : excelPreview?.sheetName;
        if (!normalized.sheetName && previewSheetName) {
            normalized.sheetName = previewSheetName;
        }

        const nextCells = Array.isArray(normalized.cells) ? [...normalized.cells] : [];
        const upperAddress = String(address).trim().toUpperCase();
        const idx = nextCells.findIndex((c: any) => String(c?.address || '').trim().toUpperCase() === upperAddress);

        const nextItem = { address: upperAddress, path: trimmedPath };
        if (idx >= 0) nextCells[idx] = nextItem;
        else nextCells.push(nextItem);

        const next: PoaV5ExcelMapping = {
            ...normalized,
            cells: nextCells
        };

        setMappingJson(JSON.stringify(next, null, 2));
        toast.success(`셀 매핑 추가: ${upperAddress} → ${trimmedPath}`);
    };

    const handleSetWorkersTableStartCell = (address: string) => {
        let existing: any = null;
        try {
            existing = mappingJson.trim() ? JSON.parse(mappingJson) : null;
        } catch {
            existing = null;
        }

        const base: any = existing && typeof existing === 'object'
            ? existing
            : { version: 1, sheetName: undefined, outputFileName: undefined, cells: [], tables: [] };

        const normalized: PoaV5ExcelMapping =
            normalizeMapping(base) ?? { version: 1, sheetName: undefined, outputFileName: undefined, cells: [], tables: [] };
        const upperAddress = String(address).trim().toUpperCase();

        const nextTables = Array.isArray(normalized.tables) ? [...normalized.tables] : [];
        if (nextTables.length === 0) {
            nextTables.push({
                startCell: upperAddress,
                itemsPath: 'workers',
                maxRows: 30,
                columns: [
                    { offset: 0, path: 'name' },
                    { offset: 1, path: 'idNumber' },
                    { offset: 2, path: 'address' },
                    { offset: 3, path: 'gongsu' },
                    { offset: 4, path: 'unitPrice' },
                    { offset: 5, path: 'amount' },
                    { offset: 6, path: 'signatureUrl' }
                ]
            } as any);
        } else {
            nextTables[0] = { ...nextTables[0], startCell: upperAddress };
        }

        const next: PoaV5ExcelMapping = {
            ...normalized,
            tables: nextTables
        };

        setMappingJson(JSON.stringify(next, null, 2));
        toast.success(`표 시작셀 설정: ${upperAddress}`);
    };

    const handlePreviewTemplate = async () => {
        if (!downloadUrl) {
            toast.error('템플릿 파일을 먼저 업로드하거나 경로를 설정해주세요.');
            return;
        }

        if (!assertExcelTemplateOrToast('템플릿 미리보기')) return;
        if (!assertXlsxTemplateOrToast('템플릿 미리보기')) return;

        setTemplatePreviewLoading(true);
        try {
            const templateBuffer = await fetchTemplateBuffer();
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(templateBuffer);
            const grid = extractTemplateGrid({ workbook: wb, sheetName: null });
            setTemplatePreview(grid);
            setPreviewMode('template');
            setPickedCell(null);
            toast.success('템플릿 미리보기를 생성했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '템플릿 미리보기 생성 실패');
        } finally {
            setTemplatePreviewLoading(false);
        }
    };

    const handlePreviewExcel = async () => {
        if (!downloadUrl) {
            toast.error('템플릿 파일을 먼저 업로드하거나 경로를 설정해주세요.');
            return;
        }

        if (!assertExcelTemplateOrToast('미리보기')) return;
        if (!assertXlsxTemplateOrToast('미리보기')) return;
        const mappingRaw = mappingJson.trim();
        if (!mappingRaw) {
            toast.error('매핑 JSON이 비어있습니다.');
            return;
        }

        setExcelPreviewLoading(true);
        try {
            const mappingParsed: PoaV5ExcelMapping = JSON.parse(mappingRaw);
            if (!mappingParsed || mappingParsed.version !== 1) {
                toast.error('매핑 JSON 형식이 올바르지 않습니다. (version=1 필요)');
                return;
            }
            const normalizedMapping: PoaV5ExcelMapping = {
                ...mappingParsed,
                cells: Array.isArray((mappingParsed as any).cells) ? (mappingParsed as any).cells : [],
                tables: Array.isArray((mappingParsed as any).tables) ? (mappingParsed as any).tables : []
            };

            const dataParsed = dataJson.trim() ? JSON.parse(dataJson) : {};
            const templateBuffer = await fetchTemplateBuffer();

            const out = await generatePoaExcelFromTemplate({
                templateBuffer,
                mapping: normalizedMapping,
                data: dataParsed
            });

            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(out);
            const grid = extractPreviewGrid({ workbook: wb, mapping: normalizedMapping });
            setExcelPreview(grid);
            setPreviewMode('output');
            setPickedCell(null);
            toast.success('미리보기를 생성했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message ? String(e.message) : '미리보기 생성 실패');
        } finally {
            setExcelPreviewLoading(false);
        }
    };

    const handleApplyAnalysisToMapping = () => {
        const parsed = analysisResult?.analysis?.gemini?.parsed;
        if (!parsed) {
            toast.error('적용할 분석 JSON이 없습니다.');
            return;
        }

        try {
            const next = JSON.stringify(parsed, null, 2);
            setMappingJson(next);
            toast.success('분석 결과를 매핑에 적용했습니다.');
        } catch (e) {
            console.error(e);
            toast.error('매핑 적용에 실패했습니다.');
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(templatePath);
            toast.success('템플릿 경로를 복사했습니다.');
        } catch (e) {
            console.error(e);
            toast.error('복사에 실패했습니다.');
        }
    };

    const sanitizeFileName = (name: string) => {
        return name.replace(/[^a-zA-Z0-9._-]/g, '_');
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('업로드할 파일을 선택해주세요.');
            return;
        }

        setUploading(true);
        try {
            const safeName = sanitizeFileName(selectedFile.name);
            const objectPath = `delegation-templates/${currentSite}/${Date.now()}_${safeName}`;
            const storageRef = ref(storage, objectPath);
            await uploadBytes(storageRef, selectedFile);
            setTemplatePath(objectPath);
            toast.success('업로드 완료: 템플릿 경로가 갱신되었습니다.');
        } catch (e) {
            console.error(e);
            toast.error('업로드에 실패했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveToMenu = async () => {
        if (!siteData) {
            toast.error('메뉴 설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const nextPath = (templatePath || '').trim();

        setSaving(true);
        try {
            const next = JSON.parse(JSON.stringify(siteData));
            if (!next[currentSite]) {
                toast.error(`현재 모드(${currentSite}) 설정을 찾을 수 없습니다.`);
                return;
            }
            next[currentSite].delegationTemplatePath = nextPath;

            await menuServiceV11.saveMenuConfig(next);
            toast.success('메뉴 설정에 템플릿 경로를 저장했습니다.');
        } catch (e: any) {
            console.error(e);
            toast.error(`저장 실패: ${e?.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">위임장 생성기 v5</h1>
                        <div className="text-sm text-slate-500 mt-1">
                            현재 모드: <span className="font-mono">{currentSite}</span>
                            {' '}
                            (표시 메뉴: <span className="font-mono">{effectiveSite}</span>)
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-700">템플릿 경로</div>
                            <div className="text-xs text-slate-500 mt-1">
                                메뉴관리 → 사이트 모드 관리에서 설정한 값을 자동으로 불러옵니다.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopy}
                                disabled={!templatePath}
                                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faCopy} />
                                복사
                            </button>
                            <button
                                onClick={() => downloadUrl && window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                                disabled={!downloadUrl}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                                열기
                            </button>
                        </div>
                    </div>

                    <div className="mt-3">
                        <input
                            value={templatePath}
                            onChange={(e) => setTemplatePath(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                            placeholder="(설정되지 않음)"
                        />
                    </div>

                    <div className="mt-3 grid grid-cols-12 gap-2">
                        <div className="col-span-12 md:col-span-7">
                            <input
                                type="file"
                                accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                className="w-full text-sm"
                            />
                        </div>
                        <div className="col-span-12 md:col-span-5 flex items-center gap-2">
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={uploading ? faSpinner : faUpload} spin={uploading} />
                                업로드
                            </button>
                            <button
                                onClick={handleSaveToMenu}
                                disabled={saving || !siteData}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                                메뉴에 저장
                            </button>

                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing || !templatePath}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={analyzing ? faSpinner : faMagnifyingGlass} spin={analyzing} />
                                분석
                            </button>
                        </div>
                    </div>

                    {!templatePath && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
                            <div>
                                이 모드에 템플릿 경로가 설정되어 있지 않습니다.
                            </div>
                        </div>
                    )}

                    {configuredTemplatePath && templatePath.trim() !== configuredTemplatePath && (
                        <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm">
                            메뉴에 저장된 값: <span className="font-mono">{configuredTemplatePath}</span>
                        </div>
                    )}

                    {!!downloadUrl && (
                        <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm">
                            downloadUrl: <span className="font-mono break-all">{downloadUrl}</span>
                        </div>
                    )}

                    {!!downloadUrlError && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                            템플릿 URL 생성 실패: <span className="font-mono">{downloadUrlError}</span>
                        </div>
                    )}

                    {analysisResult && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="text-sm font-semibold text-slate-700">분석 결과</div>
                                <button
                                    onClick={handleApplyAnalysisToMapping}
                                    disabled={!analysisResult?.analysis?.gemini?.parsed}
                                    className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    매핑에 적용
                                </button>
                            </div>
                            <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto">
                                {JSON.stringify(analysisResult, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-700">매핑 JSON</div>
                            <div className="text-xs text-slate-500 mt-1">
                                저장 위치: <span className="font-mono">{poaV5TemplateService.getDocId()}</span>
                            </div>
                            {mappingMeta && (
                                <div className="text-xs text-slate-500 mt-1">
                                    최근 저장: <span className="font-mono">{mappingMeta.updatedAt}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAutoDetectTableMapping}
                                disabled={mappingAutoDetecting}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={mappingAutoDetecting ? faSpinner : faMagnifyingGlass} spin={mappingAutoDetecting} />
                                자동 표 매핑
                            </button>
                            <button
                                onClick={handleLoadMapping}
                                disabled={mappingLoading}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={mappingLoading ? faSpinner : faExternalLinkAlt} spin={mappingLoading} />
                                로드
                            </button>
                            <button
                                onClick={handleSaveMapping}
                                disabled={mappingSaving}
                                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={mappingSaving ? faSpinner : faSave} spin={mappingSaving} />
                                저장
                            </button>
                        </div>
                    </div>

                    <div className="mt-3">
                        <textarea
                            value={mappingJson}
                            onChange={(e) => setMappingJson(e.target.value)}
                            rows={14}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                            placeholder={'{\n  "version": 1,\n  "sheetName": null,\n  "outputFileName": "위임장_v5.xlsx",\n  "cells": [\n    {"address": "B5", "path": "trustee.name"}\n  ],\n  "tables": [\n    {\n      "startCell": "A10",\n      "itemsPath": "workers",\n      "maxRows": 30,\n      "columns": [\n        {"offset": 0, "path": "name"},\n        {"offset": 1, "path": "idNumber"},\n        {"offset": 2, "path": "address"},\n        {"offset": 3, "path": "gongsu"},\n        {"offset": 4, "path": "unitPrice"},\n        {"offset": 5, "path": "amount"},\n        {"offset": 6, "path": "signatureUrl"}\n      ]\n    }\n  ]\n}'}
                        />
                    </div>
                </div>

                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-700">데이터 JSON</div>
                            <div className="text-xs text-slate-500 mt-1">
                                매핑 JSON의 `path`가 이 데이터를 참조합니다.
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePreviewTemplate}
                                disabled={templatePreviewLoading}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={templatePreviewLoading ? faSpinner : faMagnifyingGlass} spin={templatePreviewLoading} />
                                템플릿 미리보기
                            </button>
                            <button
                                onClick={handlePreviewExcel}
                                disabled={excelPreviewLoading}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={excelPreviewLoading ? faSpinner : faMagnifyingGlass} spin={excelPreviewLoading} />
                                미리보기
                            </button>
                            <button
                                onClick={handleGenerateExcel}
                                disabled={excelGenerating}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={excelGenerating ? faSpinner : faDownload} spin={excelGenerating} />
                                엑셀 생성
                            </button>
                        </div>
                    </div>

                    <div className="mt-3">
                        <textarea
                            value={dataJson}
                            onChange={(e) => setDataJson(e.target.value)}
                            rows={12}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                            placeholder={'{\n  "trustee": {"name": "홍길동"}\n}'}
                        />
                    </div>

                    {(previewMode === 'template' ? templatePreview : excelPreview) && (
                        <div className="mt-3 border border-slate-200 rounded-lg overflow-auto">
                            <div className="px-3 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
                                모드: <span className="font-mono">{previewMode}</span>
                                {' '}|{' '}
                                시트: <span className="font-mono">{(previewMode === 'template' ? templatePreview : excelPreview)!.sheetName}</span>
                                {' '}
                                (R{(previewMode === 'template' ? templatePreview : excelPreview)!.topRow}, C{(previewMode === 'template' ? templatePreview : excelPreview)!.leftCol} 부터)
                            </div>
                            <table className="text-xs min-w-[720px] w-full">
                                <tbody>
                                    {(previewMode === 'template' ? templatePreview : excelPreview)!.rows.map((row, rIdx) => (
                                        <tr key={`r-${rIdx}`} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            {row.map((cell, cIdx) => (
                                                (() => {
                                                    const grid = (previewMode === 'template' ? templatePreview : excelPreview)!;
                                                    const rowNum = grid.topRow + rIdx;
                                                    const colNum = grid.leftCol + cIdx;
                                                    const address = rcToA1(rowNum, colNum);
                                                    const isPicked = pickedCell?.address === address;
                                                    return (
                                                        <td
                                                            key={`c-${cIdx}`}
                                                            onClick={() => {
                                                                setPickedCell({ address, row: rowNum, col: colNum, value: String(cell ?? '') });
                                                                if (!pickedCellPath) setPickedCellPath('');
                                                            }}
                                                            className={
                                                                `px-2 py-1 border-b border-slate-200 border-r border-slate-200 whitespace-pre cursor-pointer `
                                                                + (isPicked ? 'bg-yellow-100' : 'hover:bg-yellow-50')
                                                            }
                                                            title={address}
                                                        >
                                                            {cell}
                                                        </td>
                                                    );
                                                })()
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {pickedCell && (
                                <div className="p-3 border-t border-slate-200 bg-white">
                                    <div className="text-xs text-slate-700">
                                        선택된 셀: <span className="font-mono font-semibold">{pickedCell.address}</span>
                                        {' '}
                                        <span className="text-slate-500">(값: <span className="font-mono">{pickedCell.value}</span>)</span>
                                    </div>

                                    <div className="mt-2 grid grid-cols-12 gap-2">
                                        <div className="col-span-12 md:col-span-6">
                                            <input
                                                value={pickedCellPath}
                                                onChange={(e) => setPickedCellPath(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                                                placeholder="path 예: trustee.name"
                                            />
                                        </div>
                                        <div className="col-span-12 md:col-span-6 flex items-center gap-2">
                                            <button
                                                onClick={() => handleAddPickedCellToMapping(pickedCell.address, pickedCellPath)}
                                                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm"
                                            >
                                                셀 매핑 추가
                                            </button>
                                            <button
                                                onClick={() => handleSetWorkersTableStartCell(pickedCell.address)}
                                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
                                            >
                                                표 시작셀 지정
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(pickedCell.address);
                                                        toast.success('셀 주소를 복사했습니다.');
                                                    } catch (e) {
                                                        console.error(e);
                                                        toast.error('복사에 실패했습니다.');
                                                    }
                                                }}
                                                className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm"
                                            >
                                                주소 복사
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-700">작업자 선택 (표 자동 채우기용)</div>
                            <div className="text-xs text-slate-500 mt-1">
                                선택한 작업자를 `dataJson.workers[]`로 만들어줍니다.
                            </div>
                        </div>

                        <button
                            onClick={handleApplySelectedWorkersToData}
                            disabled={selectedWorkerIds.length === 0}
                            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            데이터에 반영
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">현장 (일보 기준)</div>
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                disabled={sitesLoading}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                            >
                                <option value="">현장 선택</option>
                                {sites.map((s) => (
                                    <option key={s.id || s.name} value={s.id || ''}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-1">월</div>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                onClick={handleLoadWorkersFromDailyReports}
                                disabled={reportLoading || !selectedSiteId}
                                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <FontAwesomeIcon icon={reportLoading ? faSpinner : faMagnifyingGlass} spin={reportLoading} />
                                일보 불러오기
                            </button>
                            <button
                                onClick={handleApplyReportWorkersToData}
                                disabled={reportWorkerRows.length === 0}
                                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                일보→데이터
                            </button>
                            <button
                                onClick={handleQuickGenerate}
                                disabled={quickGenerating}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={quickGenerating ? faSpinner : faDownload} spin={quickGenerating} />
                                원클릭 생성
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">공수 일괄 수정</div>
                            <div className="flex items-center gap-2">
                                <input
                                    value={bulkGongsuInput}
                                    onChange={(e) => setBulkGongsuInput(e.target.value)}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    placeholder="예: 1"
                                />
                                <button
                                    onClick={() => handleBulkApply('gongsu')}
                                    disabled={reportWorkerRows.length === 0}
                                    className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    적용
                                </button>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-1">단가 일괄 수정</div>
                            <div className="flex items-center gap-2">
                                <input
                                    value={bulkUnitPriceInput}
                                    onChange={(e) => setBulkUnitPriceInput(e.target.value)}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    placeholder="예: 200000"
                                />
                                <button
                                    onClick={() => handleBulkApply('unitPrice')}
                                    disabled={reportWorkerRows.length === 0}
                                    className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    적용
                                </button>
                            </div>
                        </div>
                        <div className="flex items-end">
                            <div className="text-xs text-slate-500">
                                일보 불러오기는 급여 집계 로직 기준으로 월/현장 공수와 단가를 합산합니다.
                            </div>
                        </div>
                    </div>

                    {reportWorkerRows.length > 0 && (
                        <div className="mt-3 overflow-auto border border-slate-200 rounded-lg">
                            <table className="min-w-[920px] w-full text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-2 border-b border-slate-200 text-left">이름</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-left">주민번호</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-left">주소</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-right">공수</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-right">단가</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-right">금액</th>
                                        <th className="px-2 py-2 border-b border-slate-200 text-center">서명</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportWorkerRows.map((r, idx) => (
                                        <tr key={`${r.id ?? r.name}-${idx}`} className="odd:bg-white even:bg-slate-50">
                                            <td className="px-2 py-2 border-b border-slate-200">{r.name}</td>
                                            <td className="px-2 py-2 border-b border-slate-200 font-mono">{r.idNumber}</td>
                                            <td className="px-2 py-2 border-b border-slate-200">{r.address}</td>
                                            <td className="px-2 py-2 border-b border-slate-200 text-right">
                                                <input
                                                    value={String(r.gongsu)}
                                                    onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setReportWorkerRows((prev) =>
                                                            prev.map((x, i) =>
                                                                i !== idx
                                                                    ? x
                                                                    : {
                                                                        ...x,
                                                                        gongsu: Number.isFinite(v) ? v : 0,
                                                                        amount: (Number.isFinite(v) ? v : 0) * (Number(x.unitPrice) || 0)
                                                                    }
                                                            )
                                                        );
                                                    }}
                                                    className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-b border-slate-200 text-right">
                                                <input
                                                    value={String(r.unitPrice)}
                                                    onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setReportWorkerRows((prev) =>
                                                            prev.map((x, i) =>
                                                                i !== idx
                                                                    ? x
                                                                    : {
                                                                        ...x,
                                                                        unitPrice: Number.isFinite(v) ? v : 0,
                                                                        amount: (Number(x.gongsu) || 0) * (Number.isFinite(v) ? v : 0)
                                                                    }
                                                            )
                                                        );
                                                    }}
                                                    className="w-28 bg-white border border-slate-200 rounded px-2 py-1 text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-b border-slate-200 text-right font-mono">
                                                {(Number(r.amount) || 0).toLocaleString('ko-KR')}
                                            </td>
                                            <td className="px-2 py-2 border-b border-slate-200 text-center">
                                                {r.signatureUrl ? '있음' : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                        <input
                            value={workerSearch}
                            onChange={(e) => setWorkerSearch(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="이름/주민번호 검색"
                        />
                        <button
                            onClick={() => setSelectedWorkerIds(workers.filter(w => w.id).map(w => w.id!) )}
                            disabled={workers.length === 0}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            전체 선택
                        </button>
                        <button
                            onClick={() => setSelectedWorkerIds([])}
                            disabled={selectedWorkerIds.length === 0}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            전체 해제
                        </button>
                    </div>

                    <div className="mt-3 max-h-[320px] overflow-auto border border-slate-200 rounded-lg">
                        {workersLoading ? (
                            <div className="p-3 text-sm text-slate-500">불러오는 중...</div>
                        ) : (
                            workers
                                .filter((w) => {
                                    const q = workerSearch.trim();
                                    if (!q) return true;
                                    return (
                                        (w.name || '').includes(q)
                                        || (w.idNumber || '').includes(q)
                                    );
                                })
                                .slice(0, 200)
                                .map((w) => {
                                    const id = w.id || '';
                                    const checked = id ? selectedWorkerIds.includes(id) : false;
                                    return (
                                        <button
                                            key={id || `${w.name}-${w.idNumber}`}
                                            type="button"
                                            onClick={() => id && toggleWorkerSelection(id)}
                                            disabled={!id}
                                            className={`w-full text-left px-3 py-2 border-b border-slate-200 hover:bg-slate-50 disabled:opacity-60 ${checked ? 'bg-indigo-50' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm text-slate-800 font-medium">{w.name}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{w.idNumber}</div>
                                                </div>
                                                <div className={`text-xs ${checked ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {checked ? '선택됨' : '미선택'}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterV5Page;
