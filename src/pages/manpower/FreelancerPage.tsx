import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import Handsontable from 'handsontable';
import { freelancerService } from '../../services/freelancerService';

import { addYears, subYears } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faFileExcel, faSave, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import './FreelancerPage.css';

import { registerLanguageDictionary, koKR } from 'handsontable/i18n';

// Register all Handsontable modules
registerAllModules();

// Register Korean language dictionary for better IME support
registerLanguageDictionary(koKR);

const FreelancerPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [allFreelancers, setAllFreelancers] = useState<any[]>([]);
    const [displayData, setDisplayData] = useState<any[]>([]);
    const EXTRA_EDIT_ROWS = 10;
    const { teams: masterTeams, companies: masterCompanies, loading: masterLoading } = useMasterData();
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [reportTeams, setReportTeams] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [tableHeight, setTableHeight] = useState<number>(480);
    const hotRef = useRef<any>(null);
    const tableWrapRef = useRef<HTMLDivElement>(null);
    const allFreelancersRef = useRef<any[]>([]);
    const modifiedRowsRef = useRef<Set<number>>(new Set());
    const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set()); // UI 갱신용 (저장 활성화 등)
    const year = currentDate.getFullYear();
    const toFiniteAmount = useCallback((value: unknown): number => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
            const cleaned = value.replace(/,/g, '').trim();
            if (!cleaned) return 0;
            const numericCandidate = cleaned.replace(/[^0-9.-]/g, '');
            if (!numericCandidate || numericCandidate === '-' || numericCandidate === '.' || numericCandidate === '-.') {
                return 0;
            }
            const parsed = Number(numericCandidate);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }, []);
    const normalizeTeamNameKey = useCallback((value: unknown) => String(value ?? '').trim().replace(/\s+/g, ''), []);

    // --- Renderers ---

    const centerRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.className = 'htCenter htMiddle';
        return td;
    }, []);

    const currencyRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
        Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.className = 'htRight htMiddle px-3';
        if (value) {
            td.innerText = Number(value).toLocaleString();
        }
        return td;
    }, []);

    const currencyRedRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
        Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.className = 'htRight htMiddle px-3 ht-total-red';
        if (value) {
            td.innerText = Number(value).toLocaleString();
        }
        return td;
    }, []);

    const statusRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
        Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.className = 'htCenter htMiddle';
        if (value === '신고안함') {
            td.className += ' ht-text-dimmed';
        } else if (typeof value === 'string' && (value.includes('신고') || value.includes('선행') || value.includes('완료'))) {
            td.className += ' ht-status-label';
        }
        return td;
    }, []);

    const glowRenderer = useCallback((instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
        Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
        td.className = 'htRight htMiddle px-3 col-orange-bg';
        if (value) {
            td.innerText = Number(value).toLocaleString();
        }
        return td;
    }, []);

    const normalizeSalaryModel = useCallback((value: unknown) => {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return '';
        if (raw.includes('월급')) return '월급제';
        if (raw.includes('일급')) return '일급제';
        if (raw.includes('용역')) return '용역팀';
        return raw;
    }, []);

    const getSalaryModelPriority = useCallback((value: unknown) => {
        const salaryModel = normalizeSalaryModel(value);
        if (salaryModel === '월급제') return 0;
        if (salaryModel === '일급제') return 1;
        if (salaryModel === '용역팀') return 2;
        return 3;
    }, [normalizeSalaryModel]);

    const sortFreelancers = useCallback((left: any, right: any) => {
        const salaryPriorityCompare = getSalaryModelPriority(left?.salaryModel) - getSalaryModelPriority(right?.salaryModel);
        if (salaryPriorityCompare !== 0) return salaryPriorityCompare;

        const leftGridNo = Number(left?.gridNo) || 0;
        const rightGridNo = Number(right?.gridNo) || 0;

        if (leftGridNo > 0 && rightGridNo > 0 && leftGridNo !== rightGridNo) {
            return leftGridNo - rightGridNo;
        }

        if (leftGridNo > 0 && rightGridNo <= 0) return -1;
        if (leftGridNo <= 0 && rightGridNo > 0) return 1;

        return String(left?.name || '').localeCompare(String(right?.name || ''), 'ko');
    }, [getSalaryModelPriority]);

    // --- Data Fetching ---

    // 청연 시공사 소속 팀 목록 추출 (마스터 데이터 기준)
    const cheongyeonTeams = useMemo(() => {
        const cheongyeonCompanies = masterCompanies.filter(c => c.name?.includes('청연'));
        const companyIds = cheongyeonCompanies
            .map(c => c.id)
            .filter((id): id is string => !!id);

        return masterTeams
            .filter(t => t.companyId && companyIds.includes(t.companyId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [masterTeams, masterCompanies]);

    const cheongyeonTeamIdMap = useMemo(() => {
        const map = new Map<string, string>();
        cheongyeonTeams.forEach(team => {
            if (team.id) map.set(String(team.id), String(team.id));
            if (team.legacyId) map.set(String(team.legacyId), String(team.id || team.legacyId));
        });
        return map;
    }, [cheongyeonTeams]);

    const cheongyeonTeamNameMap = useMemo(() => {
        const map = new Map<string, string>();
        cheongyeonTeams.forEach(team => {
            if (team.id) map.set(String(team.id), team.name);
            if (team.legacyId) map.set(String(team.legacyId), team.name);
        });
        return map;
    }, [cheongyeonTeams]);

    const cheongyeonTeamIdByNameMap = useMemo(() => {
        const map = new Map<string, string>();
        cheongyeonTeams.forEach(team => {
            const name = normalizeTeamNameKey(team.name);
            const id = String(team.id ?? '').trim();
            if (!name || !id || map.has(name)) return;
            map.set(name, id);
        });
        return map;
    }, [cheongyeonTeams, normalizeTeamNameKey]);

    const normalizeTeamId = useCallback((id?: string | null) => {
        if (!id) return '';
        const raw = String(id);
        return cheongyeonTeamIdMap.get(raw) || raw;
    }, [cheongyeonTeamIdMap]);

    const visibleTeams = useMemo(() => {
        const shouldRestrictByCheongyeonTeam = cheongyeonTeamIdMap.size > 0;

        if (reportTeams.length === 0) {
            return cheongyeonTeams
                .filter(t => t.id)
                .map(t => ({
                    id: String(t.id),
                    name: t.name,
                    color: t.color // 팀 데이터의 고유 색상 추가
                }))
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        }

        return reportTeams
            .map(team => {
                const normalizedId = normalizeTeamId(team.id);
                const masterTeam = cheongyeonTeams.find(t => String(t.id) === normalizedId);
                return {
                    id: normalizedId,
                    name: team.name || cheongyeonTeamNameMap.get(normalizedId) || team.name,
                    color: masterTeam?.color // 마스터 데이터에서 색상 가져오기
                };
            })
            .filter(team => team.id && (!shouldRestrictByCheongyeonTeam || cheongyeonTeamIdMap.has(team.id)))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [reportTeams, cheongyeonTeams, cheongyeonTeamIdMap, cheongyeonTeamNameMap, normalizeTeamId]);

    const recalcTableHeight = useCallback(() => {
        if (!tableWrapRef.current) return;
        const rect = tableWrapRef.current.getBoundingClientRect();
        const reserveBottom = 130; // 저장 버튼 + 여백
        const nextHeight = Math.max(320, Math.floor(window.innerHeight - rect.top - reserveBottom));
        setTableHeight(nextHeight);
    }, []);

    const fetchData = useCallback(async () => {
        if (masterLoading) return;
        setLoading(true);
        setAllFreelancers([]);

        try {
            // 서비스에서 모든 소스(FreelancerPayment + 일보)를 병합한 결과를 가져옴
            const freelancerResult = await freelancerService.getFreelancerYearlyData(year);

            const cheongyeonTeamIds = cheongyeonTeams
                .map(t => t.id)
                .filter((id): id is string => !!id);
            const shouldRestrictByCheongyeonTeam = cheongyeonTeamIds.length > 0;

            const teamsFound = new Map<string, string>();

            const normalized = freelancerResult.freelancers
                .map((f: any) => {
                    const normalizedTeamId = normalizeTeamId(f.teamId)
                        || cheongyeonTeamIdByNameMap.get(normalizeTeamNameKey(f.teamName))
                        || f.teamId || '';
                    const teamName = cheongyeonTeamNameMap.get(normalizedTeamId) || f.teamName || '';
                    if (normalizedTeamId) teamsFound.set(normalizedTeamId, teamName);
                    return { ...f, teamId: normalizedTeamId || f.teamId, teamName };
                })
                .filter((f: any) => {
                    if (!shouldRestrictByCheongyeonTeam) return true;
                    return f.teamId && cheongyeonTeamIdMap.has(f.teamId);
                });

            // 실제 데이터에서 팀 목록 구성
            const reportTeamsNormalized = Array.from(teamsFound.entries())
                .filter(([id]) => !shouldRestrictByCheongyeonTeam || cheongyeonTeamIdMap.has(id))
                .map(([id, name]) => ({ id, name: cheongyeonTeamNameMap.get(id) || name }));
            setReportTeams(reportTeamsNormalized);

            setAllFreelancers(normalized);
            allFreelancersRef.current = normalized;
        } catch (error) {
            console.error('Failed to fetch yearly data (suppressed alert):', error);
        } finally {
            setLoading(false);
        }
    }, [year, cheongyeonTeams, masterLoading, cheongyeonTeamIdMap, cheongyeonTeamNameMap, cheongyeonTeamIdByNameMap, normalizeTeamId, normalizeTeamNameKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const timer = window.setTimeout(() => recalcTableHeight(), 0);
        const onResize = () => recalcTableHeight();
        window.addEventListener('resize', onResize);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, [recalcTableHeight, selectedTeamId, displayData.length, loading]);

    // 초기 로드 시 첫 번째 팀 자동 선택
    useEffect(() => {
        if (!selectedTeamId && visibleTeams.length > 0) {
            setSelectedTeamId(visibleTeams[0].id || null);
        }
    }, [visibleTeams, selectedTeamId]);

    // 표시 데이터 필터링 (전체 보기) 및 합계 행 추가
    useEffect(() => {
        let filtered = allFreelancers;
        if (selectedTeamId) {
            filtered = allFreelancers.filter(f => normalizeTeamId(f.teamId) === selectedTeamId);
        }
        filtered = [...filtered].sort(sortFreelancers);

        const maxGridNo = filtered.reduce((max, item) => {
            const gridNo = Number(item?.gridNo) || 0;
            return gridNo > max ? gridNo : max;
        }, 0);
        const totalSlots = Math.max(filtered.length, maxGridNo) + EXTRA_EDIT_ROWS;

        // 전체 데이터를 한 번에 보여주되, 하단 입력용 빈 행은 소량만 남긴다.
        const slots = Array.from({ length: totalSlots }, (_, i) => ({
            no: i + 1,
            name: '',
            isEmpty: true,
            readOnly: false,
            total: null, m01: null, m02: null, m03: null, m04: null, m05: null, m06: null,
            m07: null, m08: null, m09: null, m10: null, m11: null, m12: null,
            performanceBonus: null, reportingBalance: null, reportableAmount: null
        }));

        // gridNo가 있는 데이터는 전체 리스트에서 지정된 위치에 고정 배치한다.
        const anchored = filtered.filter(f => (Number(f?.gridNo) || 0) > 0);
        anchored.forEach(item => {
            const slotIdx = (Number(item.gridNo) || 0) - 1;
            if (slotIdx >= 0 && slotIdx < totalSlots) {
                slots[slotIdx] = { ...item, isEmpty: false };
            }
        });

        // gridNo가 없는 데이터는 남은 빈 자리에 순차 배치한다.
        const standard = filtered.filter(f => !(Number(f?.gridNo) || 0));
        const anchoredIds = new Set(anchored.map(a => a.id));
        const standardToPlace = standard.filter(f => !anchoredIds.has(f.id));

        let standardIdx = 0;
        for (let i = 0; i < totalSlots; i++) {
            if (slots[i].isEmpty && standardIdx < standardToPlace.length) {
                slots[i] = { ...standardToPlace[standardIdx], isEmpty: false };
                standardIdx++;
            }
        }

        const formatted = slots.map((item: any, index) => {
            const monthlyKeys = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12'];
            const monthlySum = monthlyKeys.reduce((sum, key) => sum + toFiniteAmount(item[key]), 0);
            const bonus = toFiniteAmount(item.performanceBonus);
            const reportable = toFiniteAmount(item.reportableAmount);

            // 화면 가독성을 위해 0은 null(표시 안함)로 처리
            const displayItem = { ...item };
            if (!item.isEmpty) {
                monthlyKeys.forEach(key => {
                    if (toFiniteAmount(displayItem[key]) === 0) displayItem[key] = null;
                });
                if (toFiniteAmount(displayItem.performanceBonus) === 0) displayItem.performanceBonus = null;
            }

            return {
                ...displayItem,
                no: index + 1,
                total: (monthlySum + bonus) || null,
                reportingBalance: (reportable - monthlySum) || null,
                reportableAmount: reportable || null,
            };
        });

        // 3. 하단 합계 데이터 산출 (실제 데이터만 합산)
        const footer: any = {
            no: '',
            name: '합 계',
            isFooter: true,
            readOnly: true
        };
        const colsToSum = ['total', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'performanceBonus', 'reportingBalance', 'reportableAmount'];

        colsToSum.forEach(col => {
            const sumValue = formatted
                .filter((r: any) => !r.isEmpty && !r.isFooter)
                .reduce((sum, row: any) => sum + toFiniteAmount(row[col]), 0);
            footer[col] = sumValue || null;
        });
        formatted.push(footer);

        setDisplayData(formatted);
    }, [EXTRA_EDIT_ROWS, allFreelancers, selectedTeamId, normalizeTeamId, sortFreelancers, toFiniteAmount]);

    const colors = [
        'linear-gradient(135deg, #FF5252 0%, #D32F2F 100%)', // Red
        'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)', // Blue
        'linear-gradient(135deg, #7C4DFF 0%, #512DA8 100%)', // Deep Purple
        'linear-gradient(135deg, #E040FB 0%, #C2185B 100%)', // Pink
        'linear-gradient(135deg, #FFAB40 0%, #F57C00 100%)', // Orange
        'linear-gradient(135deg, #FFD740 0%, #FFA000 100%)', // Amber
        'linear-gradient(135deg, #69F0AE 0%, #388E3C 100%)', // Green
        'linear-gradient(135deg, #40C4FF 0%, #0288D1 100%)', // Light Blue
        'linear-gradient(135deg, #18FFFF 0%, #0097A7 100%)', // Cyan
        'linear-gradient(135deg, #EEFF41 0%, #AFB42B 100%)'  // Lime
    ];

    const selectedTeamTheme = useMemo(() => {
        const selectedIndex = visibleTeams.findIndex((team: any) => team.id === selectedTeamId);
        if (selectedIndex < 0) {
            return {
                background: '#1a1a1a',
                borderColor: '#111111'
            };
        }
        return {
            background: visibleTeams[selectedIndex]?.color || colors[selectedIndex % colors.length],
            borderColor: '#0f172a'
        };
    }, [colors, selectedTeamId, visibleTeams]);

    const columns = useMemo((): any[] => [
        { data: 'no', title: 'No', readOnly: true, width: 45, renderer: centerRenderer },
        {
            data: 'name', title: '이     름', type: 'text', width: 90, renderer: (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) => {
                if (cellProperties.isFooter) {
                    td.style.fontWeight = '900';
                    td.style.color = '#ff0000';
                    td.style.textAlign = 'center';
                    td.innerText = value;
                    return td;
                }
                return centerRenderer(instance, td, row, col, prop, value, cellProperties);
            }
        },
        { data: 'total', title: '합     계', readOnly: true, width: 110, renderer: currencyRedRenderer },

        { data: 'm01', title: '01월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm02', title: '02월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm03', title: '03월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm04', title: '04월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm05', title: '05월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm06', title: '06월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm07', title: '07월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm08', title: '08월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm09', title: '09월', type: 'numeric', width: 85, renderer: statusRenderer },
        { data: 'm10', title: '10월', type: 'numeric', width: 85, renderer: statusRenderer },
        { data: 'm11', title: '11월', type: 'numeric', width: 85, renderer: currencyRenderer },
        { data: 'm12', title: '12월', type: 'numeric', width: 85, renderer: currencyRenderer },

        { data: 'performanceBonus', title: '성 과 급', type: 'numeric', width: 100, renderer: currencyRenderer },
        { data: 'reportingBalance', title: '신고 잔액', type: 'numeric', readOnly: true, width: 110, className: 'col-green-bg', renderer: currencyRenderer },
        { data: 'reportableAmount', title: '신고 가능 금액', type: 'numeric', width: 120, className: 'col-orange-bg', renderer: glowRenderer },
        { data: 'depositDate', title: '입금 날짜', type: 'date', dateFormat: 'YYYY-MM-DD', width: 110, className: 'htCenter htMiddle' },
        { data: 'paymentMemo', title: '비     고', type: 'text', width: 180, className: 'htMiddle px-3' }
    ], [centerRenderer, currencyRedRenderer, currencyRenderer, statusRenderer, glowRenderer]);

    const nestedHeaders = useMemo(() => [
        [
            'No',
            '이     름',
            '합     계',
            '01월', '02월', '03월', '04월', '05월', '06월', '07월', '08월', '09월', '10월', '11월', '12월',
            '성 과 급',
            '신고 잔액',
            '신고 가능 금액',
            '입금 날짜',
            '비     고'
        ]
    ], []);

    useEffect(() => {
        const hotInstance = hotRef.current?.hotInstance;
        if (hotInstance) {
            hotInstance.updateSettings({
                imeEnabled: true,
                imeFastEdit: true,
            } as any);
        }
    }, []);

    const syncRefToState = useCallback(() => {
        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance) return;

        // 그리드의 소스 데이터(현재 표시 중인 데이터)를 기반으로 Ref 업데이트
        const currentGridData = hotInstance.getSourceData();
        // 실제 데이터 항목(isEmpty: false)들만 추출하여 전체 목록(allFreelancers)에 반영
        const modifiedInGrid = currentGridData.filter((row: any) => row && !row.isEmpty && !row.isFooter);

        setAllFreelancers(prev => {
            const next = [...prev];
            modifiedInGrid.forEach((item: any) => {
                const idx = next.findIndex(f => f.id === item.id);
                if (idx !== -1) {
                    next[idx] = { ...item };
                } else {
                    next.push({ ...item });
                }
            });
            allFreelancersRef.current = next;
            return next;
        });

        // 수정한 행 목록을 상태로 동기화 (UI 저장 버튼 활성화 등을 위함)
        setModifiedRows(new Set(modifiedRowsRef.current));
    }, []);

    const afterChange = (changes: any, source: string) => {
        if (!changes || source === 'internal' || source === 'loadData') return;
        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance) return;

        let hasStructuralChange = false;

        changes.forEach(([row, prop, oldValue, newValue]: any) => {
            if (oldValue === newValue) return;

            let rowData = hotInstance.getSourceDataAtRow(row);
            if (!rowData || rowData.isFooter) return;

            // 1. 숫자/텍스트 타입 변환
            const numericCols = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'performanceBonus', 'reportableAmount'];
            const isNumeric = numericCols.includes(String(prop));
            const processedValue = isNumeric
                ? (newValue === '' || newValue === null ? 0 : toFiniteAmount(newValue))
                : newValue;

            // 2. 새로운 행 생성 (Promotion)
            if (rowData.isEmpty) {
                const tempId = `temp_${Date.now()}_${row}`;
                const currentTeam = cheongyeonTeams.find(t => t.id === selectedTeamId);

                const newRecord: any = {
                    ...rowData,
                    id: tempId,
                    gridNo: rowData.no,
                    isEmpty: false,
                    teamId: selectedTeamId,
                    teamName: currentTeam?.name || '',
                    companyId: currentTeam?.companyId || '',
                    companyName: currentTeam?.companyName || '',
                    total: 0, m01: 0, m02: 0, m03: 0, m04: 0, m05: 0, m06: 0,
                    m07: 0, m08: 0, m09: 0, m10: 0, m11: 0, m12: 0,
                    performanceBonus: 0, reportingBalance: 0, reportableAmount: 0,
                    [prop]: processedValue
                };

                // 초기 계산 및 그리드 반영 (비동기)
                requestAnimationFrame(() => {
                    hotInstance.setDataAtRowProp([
                        [row, 'id', tempId, 'internal'],
                        [row, 'isEmpty', false, 'internal'],
                        [row, 'gridNo', rowData.no, 'internal'],
                        [row, prop, processedValue, 'internal']
                    ]);
                    recalculateRow(row, hotInstance);
                });
                hasStructuralChange = true;
            } else {
                // 3. 기존 행 수정
                rowData[prop] = processedValue;
                if (isNumeric || prop.startsWith('m')) {
                    recalculateRow(row, hotInstance);
                }
            }
            // 리렌더링을 유발하는 setModifiedRows 대신 Ref 사용
            modifiedRowsRef.current.add(row);
        });

        // 4. Ref 업데이트 (상태 변경 없이 메모리 상에서만 유지)
        allFreelancersRef.current = hotInstance.getSourceData().filter((r: any) => r && !r.isEmpty && !r.isFooter);
    };

    const recalculateRow = (row: number, hotInstance: any) => {
        const rowData = hotInstance.getSourceDataAtRow(row);
        if (!rowData) return;

        const monthlyKeys = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12'];
        const monthlySum = monthlyKeys.reduce((sum, key) => sum + toFiniteAmount(rowData[key]), 0);
        const total = monthlySum + toFiniteAmount(rowData.performanceBonus);
        const balance = toFiniteAmount(rowData.reportableAmount) - monthlySum;

        hotInstance.setDataAtRowProp([
            [row, 'total', total || null, 'internal'],
            [row, 'reportingBalance', balance || null, 'internal']
        ]);

        // 푸터 업데이트 (합계 행)
        updateFooter(hotInstance);
    };

    const updateFooter = (hotInstance: any) => {
        const rowCount = hotInstance.countRows();
        const footerRow = rowCount - 1;
        const allData = hotInstance.getSourceData();
        const realData = allData.filter((r: any) => r && !r.isEmpty && !r.isFooter);

        const keys = ['total', 'm01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'performanceBonus', 'reportingBalance', 'reportableAmount'];

        const footerUpdates: any[] = [];
        keys.forEach(key => {
            const sum = realData.reduce((acc: number, curr: any) => acc + toFiniteAmount(curr[key]), 0);
            footerUpdates.push([footerRow, key, sum || null, 'internal']);
        });

        requestAnimationFrame(() => {
            hotInstance.setDataAtRowProp(footerUpdates);
        });
    };

    const handleSave = async () => {
        syncRefToState(); // 저장 전 최신 데이터 동기화
        const hotInstance = hotRef.current?.hotInstance;

        // modifiedRows 상태는 비동기이므로, 즉각적인 로직에서는 Ref를 직접 확인해야 함
        if (!hotInstance || modifiedRowsRef.current.size === 0) {
            Swal.fire({ icon: 'info', title: '저장할 내용이 없습니다.', timer: 1500, showConfirmButton: false });
            return;
        }

        setLoading(true);
        try {
            const dataToSave = Array.from(modifiedRows)
                .map(rowIdx => hotInstance.getSourceDataAtRow(rowIdx))
                .filter(row => row && row.name && row.name.trim() !== '');

            if (dataToSave.length > 0) {
                await freelancerService.saveYearlyPayments(year, dataToSave);
                setModifiedRows(new Set());
                await Swal.fire('Success', '변경사항이 안전하게 저장되었습니다.', 'success');
                fetchData();
            }
        } catch (error) {
            console.error('Save failed:', error);
            Swal.fire('Error', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleYearChange = async (offset: number) => {
        syncRefToState(); // 년도 변경 전 동기화

        if (modifiedRowsRef.current.size > 0) {
            const result = await Swal.fire({
                title: '미저장 데이터 경고',
                text: '년도를 변경하면 현재 입력 중인 내역이 소실될 수 있습니다. 계속하시겠습니까?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '네, 변경합니다',
                cancelButtonText: '취소'
            });

            if (!result.isConfirmed) return;
        }

        // 상태 초기화
        modifiedRowsRef.current.clear();
        setModifiedRows(new Set());
        setCurrentDate(prev => offset > 0 ? addYears(prev, offset) : subYears(prev, Math.abs(offset)));
    };

    const handleTeamChange = async (teamId: string | null) => {
        syncRefToState();

        if (modifiedRowsRef.current.size > 0 && selectedTeamId !== teamId) {
            const result = await Swal.fire({
                title: '미저장 데이터 경고',
                text: '팀을 변경하면 현재 입력 중인 내역이 소실될 수 있습니다. 계속하시겠습니까?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '네, 변경합니다',
                cancelButtonText: '취소'
            });

            if (!result.isConfirmed) return;
        }

        // 상태 초기화
        modifiedRowsRef.current.clear();
        setModifiedRows(new Set());
        setSelectedTeamId(teamId);
    };

    const handleDownloadExcel = useCallback(async () => {
        const monthlyKeys = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12'] as const;
        const filtered = allFreelancers
            .filter((freelancer) => !selectedTeamId || normalizeTeamId(freelancer.teamId) === selectedTeamId)
            .sort(sortFreelancers);

        if (filtered.length === 0) {
            Swal.fire('안내', '다운로드할 프리랜서 데이터가 없습니다.', 'info');
            return;
        }

        setDownloadingExcel(true);

        try {
            const XLSX = await import('xlsx');
            const teamName = selectedTeamId
                ? visibleTeams.find((team: any) => team.id === selectedTeamId)?.name || '전체'
                : '전체';

            const rows = filtered.map((item, index) => {
                const monthlyAmounts = monthlyKeys.reduce((sum, key) => sum + toFiniteAmount(item[key]), 0);
                const performanceBonus = toFiniteAmount(item.performanceBonus);
                const reportableAmount = toFiniteAmount(item.reportableAmount);
                const reportingBalance = reportableAmount - monthlyAmounts;
                const total = monthlyAmounts + performanceBonus;

                return {
                    No: index + 1,
                    팀명: item.teamName || teamName,
                    이름: item.name || '',
                    총액: total || 0,
                    '01월': toFiniteAmount(item.m01),
                    '02월': toFiniteAmount(item.m02),
                    '03월': toFiniteAmount(item.m03),
                    '04월': toFiniteAmount(item.m04),
                    '05월': toFiniteAmount(item.m05),
                    '06월': toFiniteAmount(item.m06),
                    '07월': toFiniteAmount(item.m07),
                    '08월': toFiniteAmount(item.m08),
                    '09월': toFiniteAmount(item.m09),
                    '10월': toFiniteAmount(item.m10),
                    '11월': toFiniteAmount(item.m11),
                    '12월': toFiniteAmount(item.m12),
                    성과금: performanceBonus,
                    신고잔액: reportingBalance || 0,
                    신고가능금액: reportableAmount || 0,
                    입금일: item.depositDate || '',
                    비고: item.paymentMemo || ''
                };
            });

            const summaryRow = rows.reduce<Record<string, string | number>>((accumulator, row) => ({
                ...accumulator,
                총액: Number(accumulator['총액'] || 0) + Number(row['총액'] || 0),
                '01월': Number(accumulator['01월'] || 0) + Number(row['01월'] || 0),
                '02월': Number(accumulator['02월'] || 0) + Number(row['02월'] || 0),
                '03월': Number(accumulator['03월'] || 0) + Number(row['03월'] || 0),
                '04월': Number(accumulator['04월'] || 0) + Number(row['04월'] || 0),
                '05월': Number(accumulator['05월'] || 0) + Number(row['05월'] || 0),
                '06월': Number(accumulator['06월'] || 0) + Number(row['06월'] || 0),
                '07월': Number(accumulator['07월'] || 0) + Number(row['07월'] || 0),
                '08월': Number(accumulator['08월'] || 0) + Number(row['08월'] || 0),
                '09월': Number(accumulator['09월'] || 0) + Number(row['09월'] || 0),
                '10월': Number(accumulator['10월'] || 0) + Number(row['10월'] || 0),
                '11월': Number(accumulator['11월'] || 0) + Number(row['11월'] || 0),
                '12월': Number(accumulator['12월'] || 0) + Number(row['12월'] || 0),
                성과금: Number(accumulator['성과금'] || 0) + Number(row['성과금'] || 0),
                신고잔액: Number(accumulator['신고잔액'] || 0) + Number(row['신고잔액'] || 0),
                신고가능금액: Number(accumulator['신고가능금액'] || 0) + Number(row['신고가능금액'] || 0)
            }), {
                No: '',
                팀명: '',
                이름: '합계',
                총액: 0,
                '01월': 0,
                '02월': 0,
                '03월': 0,
                '04월': 0,
                '05월': 0,
                '06월': 0,
                '07월': 0,
                '08월': 0,
                '09월': 0,
                '10월': 0,
                '11월': 0,
                '12월': 0,
                성과금: 0,
                신고잔액: 0,
                신고가능금액: 0,
                입금일: '',
                비고: ''
            });

            const worksheet = XLSX.utils.json_to_sheet([...rows, summaryRow]);
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 14 },
                { wch: 14 },
                { wch: 14 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 10 },
                { wch: 12 },
                { wch: 12 },
                { wch: 14 },
                { wch: 12 },
                { wch: 28 }
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '프리랜서관리');
            XLSX.writeFile(workbook, `프리랜서관리_${teamName}_${year}.xlsx`);
        } catch (error) {
            console.error('Excel download failed:', error);
            Swal.fire('오류', '엑셀 다운로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setDownloadingExcel(false);
        }
    }, [allFreelancers, normalizeTeamId, selectedTeamId, sortFreelancers, toFiniteAmount, visibleTeams, year]);

    return (
        <div className="freelancer-page-container">
            {/* 상단 팀 내비게이션 */}
            <div className="team-tab-navigation">
                {/* 년도 조절기 (전체보기 버튼 대신 위치) */}
                <div className="year-picker-container bg-white border border-gray-300 rounded px-3 py-1 flex items-center shadow-inner mr-4">
                    <button className="hover:bg-gray-100 p-1 rounded" onClick={() => handleYearChange(-1)}>
                        <FontAwesomeIcon icon={faChevronLeft} className="text-gray-400" />
                    </button>
                    <span className="font-bold text-lg min-w-[80px] text-center text-blue-900 mx-2">
                        {year}년
                    </span>
                    <button className="hover:bg-gray-100 p-1 rounded" onClick={() => handleYearChange(1)}>
                        <FontAwesomeIcon icon={faChevronRight} className="text-gray-400" />
                    </button>
                </div>

                {visibleTeams.map((team: any, idx: number) => (
                    <button
                        key={team.id}
                        onClick={() => handleTeamChange(team.id)}
                        className={`team-tab-btn ${selectedTeamId === team.id ? 'active' : ''}`}
                        style={{ ['--tab-color' as any]: team.color || colors[idx % 10] }}
                    >
                        {team.name}
                    </button>
                ))}
            </div>

            {/* 검은색 타이틀 바 */}
            <div
                className="black-title-bar"
                style={{
                    background: selectedTeamTheme.background,
                    borderBottom: `2px solid ${selectedTeamTheme.borderColor}`
                }}
            >
                {selectedTeamId ? visibleTeams.find((t: any) => t.id === selectedTeamId)?.name : '청연팀 전체'} 사업소득세 신고
            </div>

            <div className="freelancer-salary-legend">
                <span className="freelancer-salary-legend-label">급여형태 표시</span>
                <span className="freelancer-salary-legend-chip is-daily">일급제</span>
                <span className="freelancer-salary-legend-chip is-monthly">월급제</span>
                <span className="freelancer-salary-legend-chip is-agency">용역팀</span>
            </div>

            <main className="excel-main">
                <div className="relative freelancer-table-shell" ref={tableWrapRef}>
                    {loading && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-[100] flex items-center justify-center">
                            <div className="text-blue-900 font-black text-xl">데이터 로딩 중...</div>
                        </div>
                    )}
                    <HotTable
                        ref={hotRef}
                        data={displayData}
                        columns={columns}
                        rowHeaders={false}
                        nestedHeaders={nestedHeaders}
                        language="ko-KR"
                        layoutDirection="ltr"
                        beforeRenderer={(td, row, col, prop, value, cellProperties) => {
                            // 헤더 그라데이션 적용 로직 (prop 기준)
                            if (row < 0) { // Header row
                                const headerText = String(value);
                                if (headerText.includes('성 과 급')) td.classList.add('header-yellow');
                                if (headerText.includes('신고 잔액')) td.classList.add('header-green');
                                if (headerText.includes('신고 가능 금액')) td.classList.add('header-orange');
                            }
                        }}
                        afterGetColHeader={(col, TH) => {
                            // 중첩 헤더인 경우 TH 내부에 클래스 주입
                            const headerText = TH.innerText;
                            if (headerText.includes('성 과 급')) TH.classList.add('header-yellow');
                            if (headerText.includes('신고 잔액')) TH.classList.add('header-green');
                            if (headerText.includes('신고 가능 금액')) TH.classList.add('header-orange');
                        }}
                        afterRenderer={(TD, row, col, prop, value, cellProperties) => {

                            if (cellProperties?.isFooter) {
                                TD.classList.add('ht-footer-row');
                                return;
                            }

                            if (typeof prop !== 'string' || !/^m\d{2}$/.test(prop)) return;

                            const rowData = displayData[row];
                            const salaryModel = normalizeSalaryModel(rowData?.[`${prop}_salaryModel`]);

                            TD.classList.remove('freelancer-salary-daily-cell', 'freelancer-salary-monthly-cell', 'freelancer-salary-agency-cell');
                            TD.removeAttribute('data-salary-model');

                            if (salaryModel === '일급제' || salaryModel === '월급제' || salaryModel === '용역팀') {
                                TD.dataset.salaryModel = salaryModel;
                                TD.classList.add(
                                    salaryModel === '월급제'
                                        ? 'freelancer-salary-monthly-cell'
                                        : salaryModel === '용역팀'
                                            ? 'freelancer-salary-agency-cell'
                                            : 'freelancer-salary-daily-cell'
                                );
                            }
                        }}
                        height={tableHeight}
                        licenseKey="non-commercial-and-evaluation"
                        stretchH="all"
                        fixedColumnsLeft={2}
                        manualColumnResize={true}
                        contextMenu={true}
                        copyPaste={true}
                        enterBeginsEditing={true}
                        autoWrapCol={false}
                        autoWrapRow={false}
                        afterChange={afterChange}
                        cells={(row, col, prop) => {
                            const cellProperties: any = {};
                            const rowData = displayData[row];
                            if (rowData && rowData.isFooter) {
                                cellProperties.readOnly = true;
                                cellProperties.isFooter = true;
                                cellProperties.className = 'ht-footer-row';
                            }
                            return cellProperties;
                        }}
                        className="custom-ledger-grid"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={handleDownloadExcel}
                        disabled={loading || downloadingExcel}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded font-black shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon icon={downloadingExcel ? faSpinner : faFileExcel} spin={downloadingExcel} />
                        엑셀 다운로드
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-[#1e40af] text-white rounded font-black shadow-lg hover:bg-[#1e3a8a] transition-all"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {year}년 변경 내용 저장하기
                    </button>
                </div>
            </main>
        </div>
    );
};

export default FreelancerPage;
