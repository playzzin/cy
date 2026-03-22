import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import Handsontable from 'handsontable';
import { freelancerService } from '../../services/freelancerService';

import { addYears, subYears } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faSave } from '@fortawesome/free-solid-svg-icons';
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
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 30;
    const { teams: masterTeams, companies: masterCompanies, loading: masterLoading } = useMasterData();
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [reportTeams, setReportTeams] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
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
    }, [recalcTableHeight, selectedTeamId, currentPage, displayData.length, loading]);

    // 초기 로드 시 첫 번째 팀 자동 선택 및 페이지 리셋
    useEffect(() => {
        if (!selectedTeamId && visibleTeams.length > 0) {
            setSelectedTeamId(visibleTeams[0].id || null);
        }
        setCurrentPage(1);
    }, [visibleTeams, selectedTeamId]);

    // 표시 데이터 필터링 (페이징 적용) 및 합계 행 추가
    useEffect(() => {
        let filtered = allFreelancers;
        if (selectedTeamId) {
            filtered = allFreelancers.filter(f => normalizeTeamId(f.teamId) === selectedTeamId);
        }

        // 1. 현재 페이지용 30개 빈 슬롯 기반 데이터 배치 (Excel 방식)
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const slots = Array.from({ length: PAGE_SIZE }, (_, i) => ({
            no: startIndex + i + 1,
            name: '',
            isEmpty: true,
            readOnly: false,
            total: null, m01: null, m02: null, m03: null, m04: null, m05: null, m06: null,
            m07: null, m08: null, m09: null, m10: null, m11: null, m12: null,
            performanceBonus: null, reportingBalance: null, reportableAmount: null
        }));

        // 고정 위치(gridNo)가 있는 데이터 배치
        const anchored = filtered.filter(f => f.gridNo && Math.ceil(f.gridNo / PAGE_SIZE) === currentPage);
        anchored.forEach(item => {
            const slotIdx = (item.gridNo - 1) % PAGE_SIZE;
            if (slotIdx >= 0 && slotIdx < PAGE_SIZE) {
                slots[slotIdx] = { ...item, isEmpty: false };
            }
        });

        // 고정 위치가 없는 데이터(DB 로드 등) 빈 자리에 순차 배치
        const standard = filtered.filter(f => !f.gridNo || Math.ceil(f.gridNo / PAGE_SIZE) !== currentPage);
        // 이미 anchored로 배치된 항목은 제외 (ID 기준)
        const anchoredIds = new Set(anchored.map(a => a.id));
        const standardToPlace = standard.filter(f => !anchoredIds.has(f.id));

        let standardIdx = 0;
        for (let i = 0; i < PAGE_SIZE; i++) {
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
                no: startIndex + index + 1,
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
    }, [allFreelancers, selectedTeamId, currentPage, normalizeTeamId, toFiniteAmount]);

    const totalPages = Math.ceil((selectedTeamId ? allFreelancers.filter(f => normalizeTeamId(f.teamId) === selectedTeamId).length : allFreelancers.length) / PAGE_SIZE);

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
        setCurrentPage(1);
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
        setCurrentPage(1);
    };

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

            {/* 페이징 컨트롤 */}
            <div className="flex items-center justify-center gap-4 bg-white py-2 border-b">
                <button
                    disabled={currentPage === 1}
                    onClick={() => { syncRefToState(); setCurrentPage(prev => prev - 1); }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded border ${currentPage === 1 ? 'text-gray-300 bg-gray-50 border-gray-200 cursor-not-allowed' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                >
                    <FontAwesomeIcon icon={faChevronLeft} size="sm" />
                    이전
                </button>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                    <span className="text-sm font-black text-blue-800">
                        {currentPage} / {totalPages || 1} 페이지
                    </span>
                    <span className="text-xs text-blue-400">(30건씩 보기)</span>
                </div>
                <button
                    disabled={currentPage >= totalPages}
                    onClick={() => { syncRefToState(); setCurrentPage(prev => prev + 1); }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded border ${currentPage >= totalPages ? 'text-gray-300 bg-gray-50 border-gray-200 cursor-not-allowed' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                >
                    다음
                    <FontAwesomeIcon icon={faChevronRight} size="sm" />
                </button>
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

            <main className="excel-main">
                <div className="relative" ref={tableWrapRef}>
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

                <div className="flex justify-end mt-4">
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
