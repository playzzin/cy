import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowDown,
    faArrowUp,
    faBoxesStacked,
    faCheck,
    faCoins,
    faDatabase,
    faDownload,
    faFileInvoiceDollar,
    faPenToSquare,
    faPlus,
    faRotateRight,
    faSave,
    faSearch,
    faTable,
    faTrash,
    faTriangleExclamation,
    faUpload,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import { useMasterData } from '../../contexts/MasterDataContext';
import fieldGoodsService, {
    FieldGoodsItem,
    FieldGoodsTransaction,
    FieldGoodsTransactionInput,
    FieldGoodsTransactionKind,
} from '../../services/fieldGoodsService';

type ProgramView = 'input' | 'billing' | 'ledger' | 'master';

interface ProgramTab {
    id: ProgramView;
    label: string;
    icon: IconDefinition;
}

interface FieldGoodsTeam {
    id: string;
    name: string;
    active: boolean;
    color?: string;
    companyId?: string;
    companyName?: string;
    status?: string;
}

interface InputLine {
    id: string;
    teamId: string;
    itemId: string;
    quantity: string;
    memo: string;
}

interface ItemDraft {
    name: string;
    unit: string;
    purchasePrice: string;
    salePrice: string;
}

interface TransactionDraft {
    date: string;
    teamId: string;
    kind: FieldGoodsTransactionKind;
    itemId: string;
    quantity: string;
    memo: string;
}

const tabs: ProgramTab[] = [
    { id: 'input', label: '입력', icon: faTable },
    { id: 'billing', label: '팀별 청구', icon: faFileInvoiceDollar },
    { id: 'ledger', label: 'DB 원장', icon: faDatabase },
    { id: 'master', label: '품목/단가', icon: faBoxesStacked },
];

const kindLabels: Record<FieldGoodsTransactionKind, string> = {
    purchase: '매입',
    issue: '반출',
};

const today = (): string => new Date().toISOString().slice(0, 10);

const money = (value: number): string => Math.round(value).toLocaleString('ko-KR');

const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeIdentity = (value: unknown): string =>
    normalizeText(value).replace(/\s+/g, '').toLowerCase();

const normalizeCompanyIdentity = (value: unknown): string =>
    normalizeIdentity(value)
        .replace(/[()㈜]/g, '')
        .replace(/주식회사/g, '')
        .replace(/^주/, '');

const isCheongyeonEngCompanyName = (value: unknown): boolean => {
    const normalized = normalizeCompanyIdentity(value);
    if (!normalized) return false;

    return ['청연이엔지', '청연eng', 'cheongyeoneng', 'cheongyeon', 'cyeng'].some((key) =>
        normalized.includes(normalizeCompanyIdentity(key))
    );
};

const makeLineId = (): string => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBlankLines = (teamId: string, itemId: string, count = 1): InputLine[] =>
    Array.from({ length: count }, () => ({
        id: makeLineId(),
        teamId,
        itemId,
        quantity: '',
        memo: '',
    }));

const sortItems = (rows: FieldGoodsItem[]): FieldGoodsItem[] =>
    [...rows].sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        const sortCompare = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
        if (sortCompare !== 0) return sortCompare;
        return left.name.localeCompare(right.name, 'ko-KR');
    });

const sortTransactions = (rows: FieldGoodsTransaction[]): FieldGoodsTransaction[] =>
    [...rows].sort((left, right) => {
        const dateCompare = right.date.localeCompare(left.date);
        if (dateCompare !== 0) return dateCompare;
        return right.createdAt.localeCompare(left.createdAt);
    });

const toISODate = (value: unknown): string => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
            const month = String(parsed.m).padStart(2, '0');
            const day = String(parsed.d).padStart(2, '0');
            return `${parsed.y}-${month}-${day}`;
        }
    }

    const text = normalizeText(value);
    const dashed = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (dashed) return `${dashed[1]}-${dashed[2].padStart(2, '0')}-${dashed[3].padStart(2, '0')}`;

    const compact = text.replace(/[^\d]/g, '');
    if (compact.length >= 8) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? today() : fallback.toISOString().slice(0, 10);
};

const parseKind = (value: unknown): FieldGoodsTransactionKind => {
    const text = normalizeText(value).toLowerCase();
    if (text.includes('반출') || text.includes('출고') || text.includes('issue')) return 'issue';
    return 'purchase';
};

const isHeaderLikeItemName = (value: unknown): boolean => {
    const key = normalizeIdentity(value);
    return !key || ['품목관리', '품목', '품목명', '종류', '단위', '팀', '매입단가', '판매단가'].includes(key);
};

const looksLikeUnit = (value: unknown): boolean => {
    const key = normalizeIdentity(value);
    if (!key) return false;
    if (['ea', '개', '대', '식', 'm', 'mm', 'kg', 'ton', '톤', 'roll', 'box'].includes(key)) return true;
    return false;
};

const readItemCandidate = (row: unknown[]): ItemDraft | null => {
    const first = normalizeText(row[0]);
    const second = normalizeText(row[1]);

    if (first && looksLikeUnit(second) && !isHeaderLikeItemName(first)) {
        return {
            name: first,
            unit: second || 'EA',
            purchasePrice: String(row[2] ?? 0),
            salePrice: String(row[3] ?? 0),
        };
    }

    if (second && !isHeaderLikeItemName(second)) {
        return {
            name: second,
            unit: normalizeText(row[4]) || 'EA',
            purchasePrice: String(row[2] ?? 0),
            salePrice: String(row[3] ?? 0),
        };
    }

    if (first && !isHeaderLikeItemName(first)) {
        return {
            name: first,
            unit: 'EA',
            purchasePrice: String(row[2] ?? 0),
            salePrice: String(row[3] ?? 0),
        };
    }

    return null;
};

const createSnapshotItem = (transaction: FieldGoodsTransaction): FieldGoodsItem => ({
    id: transaction.itemId,
    name: transaction.itemName,
    unit: transaction.unit,
    purchasePrice: transaction.purchasePrice,
    salePrice: transaction.salePrice,
    active: false,
    sortOrder: 9999,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
});

const FieldGoodsProgramPage: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const {
        teams: masterTeams,
        companies: masterCompanies,
        loading: masterDataLoading,
        refreshTeams,
    } = useMasterData();

    const [activeView, setActiveView] = useState<ProgramView>('input');
    const [items, setItems] = useState<FieldGoodsItem[]>([]);
    const [transactions, setTransactions] = useState<FieldGoodsTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [transactionDate, setTransactionDate] = useState(today());
    const [transactionKind, setTransactionKind] = useState<FieldGoodsTransactionKind>('issue');
    const [inputLines, setInputLines] = useState<InputLine[]>(() => createBlankLines('', ''));

    const [billingTeamId, setBillingTeamId] = useState('');
    const [billingStartDate, setBillingStartDate] = useState('2023-01-01');
    const [billingEndDate, setBillingEndDate] = useState(today());

    const [ledgerKeyword, setLedgerKeyword] = useState('');
    const [ledgerKind, setLedgerKind] = useState<'all' | FieldGoodsTransactionKind>('all');
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>({
        date: today(),
        teamId: '',
        kind: 'issue',
        itemId: '',
        quantity: '',
        memo: '',
    });

    const [newItem, setNewItem] = useState<ItemDraft>({
        name: '',
        unit: 'EA',
        purchasePrice: '0',
        salePrice: '0',
    });

    const cheongyeonCompanyIds = useMemo(() => {
        const ids = new Set<string>();

        masterCompanies.forEach((company) => {
            const isTargetCompany =
                Boolean((company as any).isMyCompany) ||
                isCheongyeonEngCompanyName(company.name) ||
                isCheongyeonEngCompanyName(company.code);

            if (!isTargetCompany) return;

            [company.id, company.legacyId].forEach((id) => {
                const normalized = normalizeText(id);
                if (normalized) ids.add(normalized);
            });
        });

        return ids;
    }, [masterCompanies]);

    const teams = useMemo<FieldGoodsTeam[]>(() => {
        const seen = new Set<string>();
        const rows: FieldGoodsTeam[] = [];

        masterTeams.forEach((team, index) => {
            const name = normalizeText(team.name);
            if (!name) return;

            const companyId = normalizeText(team.companyId);
            const companyName = normalizeText(team.companyName);
            const isCheongyeonTeam =
                (!!companyId && cheongyeonCompanyIds.has(companyId)) ||
                isCheongyeonEngCompanyName(companyName);

            if (!isCheongyeonTeam) return;

            const id =
                normalizeText(team.id) ||
                normalizeText(team.legacyId) ||
                `team-${normalizeIdentity(name)}-${index}`;

            if (seen.has(id)) return;
            seen.add(id);

            rows.push({
                id,
                name,
                active: team.status !== 'closed',
                color: normalizeText(team.color) || '#64748b',
                companyId,
                companyName,
                status: team.status || 'active',
            });
        });

        return rows.sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'));
    }, [cheongyeonCompanyIds, masterTeams]);

    const activeTeams = useMemo(() => teams.filter((team) => team.active), [teams]);
    const activeItems = useMemo(() => items.filter((item) => item.active), [items]);

    const reportItems = useMemo(() => {
        const map = new Map<string, FieldGoodsItem>();
        items.forEach((item) => map.set(item.id, item));
        transactions.forEach((transaction) => {
            if (!map.has(transaction.itemId)) map.set(transaction.itemId, createSnapshotItem(transaction));
        });
        return sortItems(Array.from(map.values()));
    }, [items, transactions]);

    const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
    const activeTeamIdSet = useMemo(() => new Set(activeTeams.map((team) => team.id)), [activeTeams]);
    const itemMap = useMemo(() => new Map(reportItems.map((item) => [item.id, item])), [reportItems]);
    const activeItemIdSet = useMemo(() => new Set(activeItems.map((item) => item.id)), [activeItems]);

    const defaultTeamId = activeTeams[0]?.id || '';
    const defaultItemId = activeItems[0]?.id || '';

    const loadProgramData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [nextItems, nextTransactions] = await Promise.all([
                fieldGoodsService.getItems(),
                fieldGoodsService.getTransactions(),
            ]);
            setItems(sortItems(nextItems));
            setTransactions(sortTransactions(nextTransactions));
        } catch (error) {
            console.error('Failed to load field goods data:', error);
            setLoadError('현장물품 데이터를 불러오지 못했습니다. Firebase 연결과 권한을 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProgramData();
    }, [loadProgramData]);

    useEffect(() => {
        if (!defaultTeamId) {
            if (billingTeamId) setBillingTeamId('');
            return;
        }

        if (!billingTeamId || !activeTeamIdSet.has(billingTeamId)) {
            setBillingTeamId(defaultTeamId);
        }
    }, [activeTeamIdSet, billingTeamId, defaultTeamId]);

    useEffect(() => {
        setInputLines((prev) => {
            if (!prev.length) return createBlankLines(defaultTeamId, defaultItemId);

            let changed = false;
            const nextLines = prev.map((line) => {
                const nextTeamId = line.teamId && activeTeamIdSet.has(line.teamId) ? line.teamId : defaultTeamId;
                const nextItemId = line.itemId && activeItemIdSet.has(line.itemId) ? line.itemId : defaultItemId;

                if (nextTeamId === line.teamId && nextItemId === line.itemId) return line;
                changed = true;
                return { ...line, teamId: nextTeamId, itemId: nextItemId };
            });

            return changed ? nextLines : prev;
        });
    }, [activeItemIdSet, activeTeamIdSet, defaultItemId, defaultTeamId]);

    const transactionTotals = useMemo(() => {
        return transactions.reduce(
            (acc, transaction) => {
                if (transaction.kind === 'purchase') {
                    acc.purchaseCount += 1;
                    acc.purchaseAmount += transaction.quantity * transaction.purchasePrice;
                } else {
                    acc.issueCount += 1;
                    acc.revenue += transaction.quantity * transaction.salePrice;
                    acc.cost += transaction.quantity * transaction.purchasePrice;
                    acc.profit += transaction.quantity * (transaction.salePrice - transaction.purchasePrice);
                }
                return acc;
            },
            {
                purchaseCount: 0,
                issueCount: 0,
                purchaseAmount: 0,
                revenue: 0,
                cost: 0,
                profit: 0,
            }
        );
    }, [transactions]);

    const stockRows = useMemo(() => {
        return reportItems.map((item) => {
            const purchaseQty = transactions
                .filter((transaction) => transaction.kind === 'purchase' && transaction.itemId === item.id)
                .reduce((sum, transaction) => sum + transaction.quantity, 0);
            const issueQty = transactions
                .filter((transaction) => transaction.kind === 'issue' && transaction.itemId === item.id)
                .reduce((sum, transaction) => sum + transaction.quantity, 0);

            return {
                item,
                purchaseQty,
                issueQty,
                stockQty: purchaseQty - issueQty,
            };
        });
    }, [reportItems, transactions]);

    const stockByItemId = useMemo(() => new Map(stockRows.map((row) => [row.item.id, row.stockQty])), [stockRows]);

    const billingRows = useMemo(() => {
        const billingTeam = teamMap.get(billingTeamId);
        const billingTeamNameKey = normalizeIdentity(billingTeam?.name);
        const filtered = transactions.filter((transaction) => {
            if (transaction.kind !== 'issue') return false;
            if (
                billingTeamId &&
                transaction.teamId !== billingTeamId &&
                (!billingTeamNameKey || normalizeIdentity(transaction.teamName) !== billingTeamNameKey)
            ) {
                return false;
            }
            if (transaction.date < billingStartDate || transaction.date > billingEndDate) return false;
            return true;
        });

        return reportItems.map((item) => {
            const itemTransactions = filtered.filter((transaction) => transaction.itemId === item.id);
            const quantity = itemTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
            const revenue = itemTransactions.reduce((sum, transaction) => sum + transaction.quantity * transaction.salePrice, 0);
            const cost = itemTransactions.reduce((sum, transaction) => sum + transaction.quantity * transaction.purchasePrice, 0);

            return {
                item,
                quantity,
                salePrice: itemTransactions[0]?.salePrice ?? item.salePrice,
                purchasePrice: itemTransactions[0]?.purchasePrice ?? item.purchasePrice,
                revenue,
                cost,
                profit: revenue - cost,
            };
        });
    }, [billingEndDate, billingStartDate, billingTeamId, reportItems, teamMap, transactions]);

    const visibleBillingRows = useMemo(() => billingRows.filter((row) => row.quantity > 0), [billingRows]);

    const billingTotals = useMemo(() => {
        return billingRows.reduce(
            (acc, row) => ({
                quantity: acc.quantity + row.quantity,
                revenue: acc.revenue + row.revenue,
                cost: acc.cost + row.cost,
                profit: acc.profit + row.profit,
            }),
            { quantity: 0, revenue: 0, cost: 0, profit: 0 }
        );
    }, [billingRows]);

    const visibleLedgerRows = useMemo(() => {
        const keyword = normalizeIdentity(ledgerKeyword);
        return sortTransactions(transactions).filter((transaction) => {
            if (ledgerKind !== 'all' && transaction.kind !== ledgerKind) return false;
            if (!keyword) return true;

            const haystack = normalizeIdentity(
                `${transaction.date}${transaction.teamName}${transaction.itemName}${transaction.unit}${transaction.memo}${kindLabels[transaction.kind]}`
            );
            return haystack.includes(keyword);
        });
    }, [ledgerKeyword, ledgerKind, transactions]);

    const updateInputLine = (lineId: string, patch: Partial<InputLine>) => {
        setInputLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
    };

    const addInputLine = () => {
        setInputLines((prev) => [
            ...prev,
            {
                id: makeLineId(),
                teamId: prev[prev.length - 1]?.teamId || defaultTeamId,
                itemId: defaultItemId,
                quantity: '',
                memo: '',
            },
        ]);
    };

    const resetInputLines = () => {
        setInputLines(createBlankLines(defaultTeamId, defaultItemId));
    };

    const handleSaveInput = async () => {
        if (!activeTeams.length) {
            alert('팀 데이터가 없습니다. 팀 DB를 먼저 확인해 주세요.');
            return;
        }
        if (!activeItems.length) {
            alert('입력 가능한 품목이 없습니다. 품목/단가 탭에서 품목을 먼저 등록해 주세요.');
            setActiveView('master');
            return;
        }

        const validLines = inputLines
            .map((line) => ({
                ...line,
                quantityNumber: normalizeNumber(line.quantity),
            }))
            .filter(
                (line) =>
                    line.teamId &&
                    activeTeamIdSet.has(line.teamId) &&
                    line.itemId &&
                    activeItemIdSet.has(line.itemId) &&
                    line.quantityNumber > 0
            );

        if (!validLines.length) {
            alert('저장할 수량을 입력해 주세요.');
            return;
        }

        if (transactionKind === 'issue') {
            const shortages = validLines.filter((line) => {
                const currentStock = stockByItemId.get(line.itemId) ?? 0;
                return currentStock < line.quantityNumber;
            });

            if (shortages.length > 0) {
                const proceed = window.confirm(
                    `현재 재고보다 반출 수량이 큰 품목이 ${shortages.length}건 있습니다. 그래도 저장하시겠습니까?`
                );
                if (!proceed) return;
            }
        }

        const payload: FieldGoodsTransactionInput[] = validLines.map((line) => {
            const team = teamMap.get(line.teamId);
            const item = itemMap.get(line.itemId);

            return {
                date: transactionDate,
                teamId: line.teamId,
                teamName: team?.name || '',
                kind: transactionKind,
                itemId: line.itemId,
                itemName: item?.name || '',
                unit: item?.unit || 'EA',
                quantity: line.quantityNumber,
                purchasePrice: item?.purchasePrice || 0,
                salePrice: item?.salePrice || 0,
                memo: line.memo,
                source: 'manual',
            };
        });

        setSaving(true);
        try {
            const savedRows = await fieldGoodsService.addTransactionsBatch(payload);
            setTransactions((prev) => sortTransactions([...savedRows, ...prev]));
            resetInputLines();
            alert(`${savedRows.length}건을 DB 원장에 저장했습니다.`);
        } catch (error) {
            console.error('Failed to save field goods input:', error);
            alert('DB 저장에 실패했습니다. Firebase 권한과 네트워크 상태를 확인해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    const updateItem = (itemId: string, patch: Partial<FieldGoodsItem>) => {
        setItems((prev) => sortItems(prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))));
    };

    const handleAddItem = async () => {
        const name = newItem.name.trim();
        if (!name) {
            alert('품목명을 입력해 주세요.');
            return;
        }

        const duplicated = items.some((item) => normalizeIdentity(item.name) === normalizeIdentity(name));
        if (duplicated) {
            alert('이미 등록된 품목입니다.');
            return;
        }

        setSaving(true);
        try {
            const created = await fieldGoodsService.addItem({
                name,
                unit: newItem.unit.trim() || 'EA',
                purchasePrice: normalizeNumber(newItem.purchasePrice),
                salePrice: normalizeNumber(newItem.salePrice),
                active: true,
                sortOrder: items.length + 1,
            });
            setItems((prev) => sortItems([...prev, created]));
            setNewItem({ name: '', unit: 'EA', purchasePrice: '0', salePrice: '0' });
        } catch (error) {
            console.error('Failed to add field goods item:', error);
            alert('품목 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveItem = async (item: FieldGoodsItem) => {
        const name = item.name.trim();
        if (!name) {
            alert('품목명은 비워둘 수 없습니다.');
            return;
        }

        setSaving(true);
        try {
            await fieldGoodsService.updateItem(item.id, {
                name,
                unit: item.unit.trim() || 'EA',
                purchasePrice: normalizeNumber(item.purchasePrice),
                salePrice: normalizeNumber(item.salePrice),
                active: item.active,
                sortOrder: item.sortOrder ?? 0,
            });
            setItems((prev) =>
                sortItems(
                    prev.map((entry) =>
                        entry.id === item.id
                            ? {
                                  ...entry,
                                  name,
                                  unit: item.unit.trim() || 'EA',
                                  purchasePrice: normalizeNumber(item.purchasePrice),
                                  salePrice: normalizeNumber(item.salePrice),
                              }
                            : entry
                    )
                )
            );
        } catch (error) {
            console.error('Failed to update field goods item:', error);
            alert('품목 수정에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteItem = async (item: FieldGoodsItem) => {
        const relatedCount = transactions.filter((transaction) => transaction.itemId === item.id).length;
        const suffix = relatedCount > 0 ? `\n기존 원장 ${relatedCount}건은 유지되고, 신규 입력 목록에서만 제외됩니다.` : '';
        if (!window.confirm(`'${item.name}' 품목을 삭제하시겠습니까?${suffix}`)) return;

        setSaving(true);
        try {
            await fieldGoodsService.deleteItem(item.id);
            setItems((prev) =>
                sortItems(prev.map((entry) => (entry.id === item.id ? { ...entry, active: false } : entry)))
            );
        } catch (error) {
            console.error('Failed to delete field goods item:', error);
            alert('품목 삭제에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleRestoreItem = async (item: FieldGoodsItem) => {
        setSaving(true);
        try {
            await fieldGoodsService.restoreItem(item.id);
            setItems((prev) =>
                sortItems(prev.map((entry) => (entry.id === item.id ? { ...entry, active: true } : entry)))
            );
        } catch (error) {
            console.error('Failed to restore field goods item:', error);
            alert('품목 복구에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const startEditTransaction = (transaction: FieldGoodsTransaction) => {
        setEditingTransactionId(transaction.id);
        setTransactionDraft({
            date: transaction.date,
            teamId: transaction.teamId,
            kind: transaction.kind,
            itemId: transaction.itemId,
            quantity: String(transaction.quantity),
            memo: transaction.memo,
        });
    };

    const cancelEditTransaction = () => {
        setEditingTransactionId(null);
        setTransactionDraft({
            date: today(),
            teamId: defaultTeamId,
            kind: 'issue',
            itemId: defaultItemId,
            quantity: '',
            memo: '',
        });
    };

    const handleSaveTransaction = async (transaction: FieldGoodsTransaction) => {
        const quantity = normalizeNumber(transactionDraft.quantity);
        if (!transactionDraft.date) {
            alert('일자를 입력해 주세요.');
            return;
        }
        if (!transactionDraft.teamId) {
            alert('팀을 선택해 주세요.');
            return;
        }
        if (!transactionDraft.itemId) {
            alert('품목을 선택해 주세요.');
            return;
        }
        if (quantity <= 0) {
            alert('수량은 0보다 커야 합니다.');
            return;
        }

        const team = teamMap.get(transactionDraft.teamId);
        const item = itemMap.get(transactionDraft.itemId);
        const updates: FieldGoodsTransactionInput = {
            date: transactionDraft.date,
            teamId: transactionDraft.teamId,
            teamName: team?.name || transaction.teamName,
            kind: transactionDraft.kind,
            itemId: transactionDraft.itemId,
            itemName: item?.name || transaction.itemName,
            unit: item?.unit || transaction.unit,
            quantity,
            purchasePrice: item?.purchasePrice ?? transaction.purchasePrice,
            salePrice: item?.salePrice ?? transaction.salePrice,
            memo: transactionDraft.memo,
            source: transaction.source,
        };

        setSaving(true);
        try {
            await fieldGoodsService.updateTransaction(transaction.id, updates);
            const updatedAt = new Date().toISOString();
            setTransactions((prev) =>
                sortTransactions(
                    prev.map((entry) => (entry.id === transaction.id ? { ...entry, ...updates, updatedAt } : entry))
                )
            );
            cancelEditTransaction();
        } catch (error) {
            console.error('Failed to update field goods transaction:', error);
            alert('원장 수정에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTransaction = async (transaction: FieldGoodsTransaction) => {
        if (!window.confirm(`'${transaction.date} ${transaction.teamName} ${transaction.itemName}' 원장 행을 삭제하시겠습니까?`)) return;

        setSaving(true);
        try {
            await fieldGoodsService.deleteTransaction(transaction.id);
            setTransactions((prev) => prev.filter((entry) => entry.id !== transaction.id));
        } catch (error) {
            console.error('Failed to delete field goods transaction:', error);
            alert('원장 삭제에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const parseWorkbook = async (file: File) => {
        if (!teams.length) {
            alert('팀 데이터가 없습니다. 팀 DB를 먼저 확인해 주세요.');
            return;
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const itemSheet = workbook.Sheets['품목'] || workbook.Sheets[workbook.SheetNames[0]];
        const dbSheet = workbook.Sheets['DB'] || workbook.Sheets[workbook.SheetNames[2]] || workbook.Sheets[workbook.SheetNames[1]];

        if (!itemSheet || !dbSheet) {
            alert('품목 시트와 DB 시트를 찾을 수 없습니다.');
            return;
        }

        const itemRows = XLSX.utils.sheet_to_json(itemSheet, { header: 1, raw: true }) as unknown[][];
        const dbRows = XLSX.utils.sheet_to_json(dbSheet, { header: 1, raw: true }) as unknown[][];
        const workingItems = [...items];
        const itemByName = new Map(workingItems.map((item) => [normalizeIdentity(item.name), item]));

        setSaving(true);
        try {
            for (const row of itemRows) {
                const candidate = readItemCandidate(row);
                if (!candidate) continue;

                const existing = itemByName.get(normalizeIdentity(candidate.name));
                const payload = {
                    name: candidate.name,
                    unit: candidate.unit || 'EA',
                    purchasePrice: normalizeNumber(candidate.purchasePrice),
                    salePrice: normalizeNumber(candidate.salePrice),
                    active: true,
                    sortOrder: workingItems.length + 1,
                };

                if (existing) {
                    await fieldGoodsService.updateItem(existing.id, payload);
                    Object.assign(existing, payload);
                } else {
                    const created = await fieldGoodsService.addItem(payload);
                    workingItems.push(created);
                    itemByName.set(normalizeIdentity(created.name), created);
                }
            }

            const headerRow = dbRows[0] || [];
            const headerKeys = headerRow.map((header) => normalizeIdentity(header));
            const findHeaderIndex = (aliases: string[]) =>
                headerKeys.findIndex((key) => aliases.some((alias) => key.includes(normalizeIdentity(alias))));
            const dateColumn = findHeaderIndex(['일자', '날짜', 'date']);
            const teamColumn = findHeaderIndex(['팀', 'team']);
            const kindColumn = findHeaderIndex(['구분', 'kind', 'type']);
            const itemNameColumn = findHeaderIndex(['품목명', '품목', '종류', 'item']);
            const unitColumn = findHeaderIndex(['단위', 'unit']);
            const quantityColumn = findHeaderIndex(['수량', 'quantity', 'qty']);
            const memoColumn = findHeaderIndex(['비고', '메모', 'memo', 'remarks']);
            const isRowLedgerFormat = itemNameColumn >= 0 && quantityColumn >= 0;
            const teamByName = new Map(teams.map((team) => [normalizeIdentity(team.name), team]));
            const unmatchedTeamNames = new Set<string>();
            const payload: FieldGoodsTransactionInput[] = [];

            if (isRowLedgerFormat) {
                for (const row of dbRows.slice(1)) {
                    const itemName = normalizeText(row[itemNameColumn]);
                    const quantity = normalizeNumber(row[quantityColumn]);
                    if (!itemName || isHeaderLikeItemName(itemName) || quantity <= 0) continue;

                    const teamName = normalizeText(row[teamColumn >= 0 ? teamColumn : 1]);
                    const team = teamByName.get(normalizeIdentity(teamName));
                    if (!team) {
                        if (teamName) unmatchedTeamNames.add(teamName);
                        continue;
                    }

                    let item = itemByName.get(normalizeIdentity(itemName));
                    if (!item) {
                        item = await fieldGoodsService.addItem({
                            name: itemName,
                            unit: normalizeText(row[unitColumn]) || 'EA',
                            purchasePrice: 0,
                            salePrice: 0,
                            active: true,
                            sortOrder: workingItems.length + 1,
                        });
                        workingItems.push(item);
                        itemByName.set(normalizeIdentity(item.name), item);
                    }

                    payload.push({
                        date: toISODate(row[dateColumn >= 0 ? dateColumn : 0]),
                        teamId: team.id,
                        teamName: team.name,
                        kind: parseKind(row[kindColumn >= 0 ? kindColumn : 2]),
                        itemId: item.id,
                        itemName: item.name,
                        unit: item.unit,
                        quantity,
                        purchasePrice: item.purchasePrice,
                        salePrice: item.salePrice,
                        memo: normalizeText(row[memoColumn]),
                        source: 'excel',
                    });
                }
            } else {
                const itemColumnMap = headerRow
                    .map((header, index) => ({ header: normalizeText(header), index }))
                    .filter((entry) => entry.index >= 3 && entry.header);

                for (const entry of itemColumnMap) {
                    if (!itemByName.has(normalizeIdentity(entry.header))) {
                        const created = await fieldGoodsService.addItem({
                            name: entry.header,
                            unit: 'EA',
                            purchasePrice: 0,
                            salePrice: 0,
                            active: true,
                            sortOrder: workingItems.length + 1,
                        });
                        workingItems.push(created);
                        itemByName.set(normalizeIdentity(created.name), created);
                    }
                }

                dbRows.slice(1).forEach((row) => {
                    const date = toISODate(row[0]);
                    const teamName = normalizeText(row[1]);
                    const rawKind = normalizeText(row[2]);
                    const team = teamByName.get(normalizeIdentity(teamName));

                    if (!team) {
                        if (teamName) unmatchedTeamNames.add(teamName);
                        return;
                    }
                    if (!rawKind) return;

                    itemColumnMap.forEach((entry) => {
                        const quantity = normalizeNumber(row[entry.index]);
                        if (quantity <= 0) return;

                        const item = itemByName.get(normalizeIdentity(entry.header));
                        if (!item) return;

                        payload.push({
                            date,
                            teamId: team.id,
                            teamName: team.name,
                            kind: parseKind(rawKind),
                            itemId: item.id,
                            itemName: item.name,
                            unit: item.unit,
                            quantity,
                            purchasePrice: item.purchasePrice,
                            salePrice: item.salePrice,
                            memo: '',
                            source: 'excel',
                        });
                    });
                });
            }

            const savedRows = await fieldGoodsService.addTransactionsBatch(payload);
            setItems(sortItems(workingItems));
            setTransactions((prev) => sortTransactions([...savedRows, ...prev]));
            setActiveView('ledger');

            const unmatchedNotice = unmatchedTeamNames.size
                ? ` / 팀 DB 미매칭 ${unmatchedTeamNames.size}건 제외`
                : '';
            alert(`엑셀 데이터를 불러왔습니다. DB 원장 ${savedRows.length}건 저장${unmatchedNotice}`);
        } catch (error) {
            console.error('Excel import failed:', error);
            alert('엑셀 파일을 불러오지 못했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        void parseWorkbook(file);
    };

    const handleExportExcel = () => {
        const workbook = XLSX.utils.book_new();
        const itemSheetRows = [
            ['품목 관리'],
            ['품목', '단위', '매입단가', '판매단가', '사용여부'],
            ...items.map((item) => [
                item.name,
                item.unit,
                item.purchasePrice,
                item.salePrice,
                item.active ? '사용' : '삭제',
            ]),
        ];

        const ledgerRows = [
            ['일자', '팀', '구분', '품목', '단위', '수량', '매입단가', '판매단가', '금액', '비고', '입력방식'],
            ...sortTransactions(transactions).map((transaction) => [
                transaction.date,
                teamMap.get(transaction.teamId)?.name || transaction.teamName,
                kindLabels[transaction.kind],
                transaction.itemName,
                transaction.unit,
                transaction.quantity,
                transaction.purchasePrice,
                transaction.salePrice,
                transaction.quantity * (transaction.kind === 'issue' ? transaction.salePrice : transaction.purchasePrice),
                transaction.memo,
                transaction.source === 'excel' ? '엑셀' : '수기',
            ]),
        ];

        const billingSheetRows = [
            ['팀별 반출 청구'],
            ['팀 선택', teamMap.get(billingTeamId)?.name || ''],
            ['검색 시작', billingStartDate],
            ['검색 종료', billingEndDate],
            ['품목', '수량', '판매단가', '청구금액', '매입원가', '이익'],
            ...visibleBillingRows.map((row) => [
                row.item.name,
                row.quantity,
                row.salePrice,
                row.revenue,
                row.cost,
                row.profit,
            ]),
            ['합계', billingTotals.quantity, '', billingTotals.revenue, billingTotals.cost, billingTotals.profit],
        ];

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(itemSheetRows), '품목');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(ledgerRows), 'DB');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(billingSheetRows), '청구');
        XLSX.writeFile(workbook, `현장물품_프로그램_${today()}.xlsx`);
    };

    const renderMetric = (label: string, value: string, icon: IconDefinition, accent: string, sub?: string) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-bold text-slate-500">{label}</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
                    {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
                    <FontAwesomeIcon icon={icon} />
                </div>
            </div>
        </div>
    );

    const renderTransactionActions = (transaction: FieldGoodsTransaction) => {
        if (editingTransactionId === transaction.id) {
            return (
                <div className="flex items-center justify-center gap-1">
                    <button
                        type="button"
                        onClick={() => void handleSaveTransaction(transaction)}
                        disabled={saving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                        title="저장"
                    >
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button
                        type="button"
                        onClick={cancelEditTransaction}
                        disabled={saving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                        title="취소"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center gap-1">
                <button
                    type="button"
                    onClick={() => startEditTransaction(transaction)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                    title="수정"
                >
                    <FontAwesomeIcon icon={faPenToSquare} />
                </button>
                <button
                    type="button"
                    onClick={() => void handleDeleteTransaction(transaction)}
                    disabled={saving}
                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                    title="삭제"
                >
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </div>
        );
    };

    return (
        <div className="mx-auto flex w-full max-w-[2200px] flex-col gap-4 bg-slate-50 p-4 md:p-6">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={handleExcelImport}
            />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="text-xs font-black uppercase tracking-wide text-indigo-600">Field Goods</div>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
                        <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                        현장물품 매입·반출 청구
                    </h1>
                    <div className="mt-1 text-sm text-slate-500">
                        품목과 원장은 Firebase DB에 저장되며, 팀 정보는 팀 DB에서 불러옵니다.
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                        <FontAwesomeIcon icon={faUpload} />
                        엑셀 불러오기
                    </button>
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀 내보내기
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadProgramData()}
                        disabled={loading || saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-40"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        새로고침
                    </button>
                </div>
            </div>

            {loadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {loadError}
                </div>
            )}

            {(loading || masterDataLoading) && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">
                    데이터를 불러오는 중입니다.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {renderMetric(
                    '매입 건수',
                    `${transactionTotals.purchaseCount.toLocaleString('ko-KR')}건`,
                    faArrowDown,
                    'bg-blue-50 text-blue-600',
                    `매입액 ${money(transactionTotals.purchaseAmount)}원`
                )}
                {renderMetric(
                    '반출 건수',
                    `${transactionTotals.issueCount.toLocaleString('ko-KR')}건`,
                    faArrowUp,
                    'bg-rose-50 text-rose-600'
                )}
                {renderMetric(
                    '청구 합계',
                    `${money(transactionTotals.revenue)}원`,
                    faFileInvoiceDollar,
                    'bg-emerald-50 text-emerald-600'
                )}
                {renderMetric(
                    '추정 이익',
                    `${money(transactionTotals.profit)}원`,
                    faCoins,
                    'bg-amber-50 text-amber-600',
                    `원가 ${money(transactionTotals.cost)}원`
                )}
                {renderMetric(
                    '재고 경고',
                    `${stockRows.filter((row) => row.stockQty < 0).length}개`,
                    faTriangleExclamation,
                    'bg-orange-50 text-orange-600',
                    '반출이 매입보다 많은 품목'
                )}
            </div>

            {!masterDataLoading && !activeTeams.length && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    사용 가능한 팀 데이터가 없습니다. 팀 DB에서 팀을 등록하거나 상태를 확인해 주세요.
                </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <div className="flex gap-2 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveView(tab.id)}
                            className={[
                                'inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-black transition',
                                activeView === tab.id
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                            ].join(' ')}
                        >
                            <FontAwesomeIcon icon={tab.icon} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeView === 'input' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,180px)_1fr_auto] xl:items-end">
                        <div>
                            <label className="mb-1 block text-sm font-bold text-slate-600">일자</label>
                            <input
                                type="date"
                                value={transactionDate}
                                onChange={(event) => setTransactionDate(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-bold text-slate-600">구분</label>
                            <select
                                value={transactionKind}
                                onChange={(event) => setTransactionKind(event.target.value as FieldGoodsTransactionKind)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="purchase">매입</option>
                                <option value="issue">반출</option>
                            </select>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            팀과 품목은 DB에서 불러옵니다. 품목이 없으면 품목/단가 탭에서 먼저 등록해 주세요.
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleSaveInput()}
                            disabled={saving || !activeTeams.length || !activeItems.length}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            DB 저장
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-300">
                        <table className="w-full min-w-[1120px] border-collapse text-sm">
                            <thead className="bg-[#d9eaf7] text-[#17365d]">
                                <tr>
                                    <th className="border border-slate-300 px-3 py-2 text-center">No</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">팀</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">품목</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">수량</th>
                                    <th className="border border-slate-300 px-3 py-2 text-center">단위</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">매입단가</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">판매단가</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">금액</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">비고</th>
                                    <th className="border border-slate-300 px-3 py-2 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inputLines.map((line, index) => {
                                    const item = itemMap.get(line.itemId);
                                    const selectedTeam = teamMap.get(line.teamId);
                                    const quantity = normalizeNumber(line.quantity);
                                    const amount =
                                        quantity * (transactionKind === 'issue' ? item?.salePrice || 0 : item?.purchasePrice || 0);

                                    return (
                                        <tr key={line.id} className={quantity > 0 ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50'}>
                                            <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{index + 1}</td>
                                            <td className="border border-slate-200 px-2 py-1">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-4 w-4 flex-shrink-0 rounded-full border border-white shadow ring-1 ring-slate-200"
                                                        style={{ backgroundColor: selectedTeam?.color || '#64748b' }}
                                                        aria-hidden="true"
                                                    />
                                                    <select
                                                    value={line.teamId}
                                                    onChange={(event) => updateInputLine(line.id, { teamId: event.target.value })}
                                                    disabled={!activeTeams.length}
                                                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500"
                                                >
                                                    {activeTeams.length ? (
                                                        activeTeams.map((team) => (
                                                            <option
                                                                key={team.id}
                                                                value={team.id}
                                                                style={{ color: team.color || '#334155' }}
                                                            >
                                                                ● {team.name}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value="">팀 없음</option>
                                                    )}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1">
                                                <select
                                                    value={line.itemId}
                                                    onChange={(event) => updateInputLine(line.id, { itemId: event.target.value })}
                                                    disabled={!activeItems.length}
                                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500"
                                                >
                                                    {activeItems.length ? (
                                                        activeItems.map((entry) => (
                                                            <option key={entry.id} value={entry.id}>
                                                                {entry.name}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value="">품목 없음</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1">
                                                <input
                                                    type="number"
                                                    value={line.quantity}
                                                    onChange={(event) => updateInputLine(line.id, { quantity: event.target.value })}
                                                    onFocus={(event) => event.target.select()}
                                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-bold outline-none focus:border-blue-500"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{item?.unit || '-'}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right text-slate-600">{money(item?.purchasePrice || 0)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right text-slate-600">{money(item?.salePrice || 0)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right font-black text-slate-900">{money(amount)}</td>
                                            <td className="border border-slate-200 px-2 py-1">
                                                <input
                                                    type="text"
                                                    value={line.memo}
                                                    onChange={(event) => updateInputLine(line.id, { memo: event.target.value })}
                                                    className="w-full rounded border border-slate-200 px-2 py-1.5 outline-none focus:border-blue-500"
                                                    placeholder="메모"
                                                />
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setInputLines((prev) => prev.filter((entry) => entry.id !== line.id))}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100"
                                                    title="행 삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-between gap-2">
                        <button
                            type="button"
                            onClick={addInputLine}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            행 추가
                        </button>
                        <button
                            type="button"
                            onClick={resetInputLines}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-300"
                        >
                            <FontAwesomeIcon icon={faRotateRight} />
                            입력 초기화
                        </button>
                    </div>
                </div>
            )}

            {activeView === 'billing' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-[260px_180px_180px_auto_1fr] xl:items-end">
                        <div>
                            <label className="mb-1 block text-sm font-bold text-slate-600">팀 선택</label>
                            <select
                                value={billingTeamId}
                                onChange={(event) => setBillingTeamId(event.target.value)}
                                disabled={!activeTeams.length}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                                {activeTeams.length ? (
                                    activeTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">팀 없음</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-bold text-slate-600">검색 시작</label>
                            <input
                                type="date"
                                value={billingStartDate}
                                onChange={(event) => setBillingStartDate(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-bold text-slate-600">검색 종료</label>
                            <input
                                type="date"
                                value={billingEndDate}
                                onChange={(event) => setBillingEndDate(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00b050] px-5 py-2.5 text-sm font-black text-white"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                            청구 합계 {money(billingTotals.revenue)}원 / 이익 {money(billingTotals.profit)}원
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-300">
                        <table className="w-full min-w-[980px] border-collapse text-sm">
                            <thead className="bg-[#e2f0d9] text-[#375623]">
                                <tr>
                                    <th className="border border-slate-300 px-3 py-2 text-left">품목</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">수량</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">판매단가</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">청구금액</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">매입원가</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">이익</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">마진율</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleBillingRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                                            조건에 맞는 반출 청구 데이터가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    visibleBillingRows.map((row) => (
                                        <tr key={row.item.id} className="bg-white hover:bg-emerald-50/50">
                                            <td className="border border-slate-200 px-3 py-2 font-bold">{row.item.name}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{money(row.quantity)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{money(row.salePrice)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums">{money(row.revenue)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{money(row.cost)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-emerald-700">{money(row.profit)}</td>
                                            <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                                                {row.revenue > 0 ? `${((row.profit / row.revenue) * 100).toFixed(1)}%` : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white">
                                <tr>
                                    <td className="border border-slate-700 px-3 py-2 font-black">합계</td>
                                    <td className="border border-slate-700 px-3 py-2 text-right font-black">{money(billingTotals.quantity)}</td>
                                    <td className="border border-slate-700 px-3 py-2"></td>
                                    <td className="border border-slate-700 px-3 py-2 text-right font-black">{money(billingTotals.revenue)}</td>
                                    <td className="border border-slate-700 px-3 py-2 text-right font-black">{money(billingTotals.cost)}</td>
                                    <td className="border border-slate-700 px-3 py-2 text-right font-black">{money(billingTotals.profit)}</td>
                                    <td className="border border-slate-700 px-3 py-2 text-right font-black">
                                        {billingTotals.revenue > 0 ? `${((billingTotals.profit / billingTotals.revenue) * 100).toFixed(1)}%` : '-'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {activeView === 'ledger' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_320px]">
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-600">구분</label>
                                <select
                                    value={ledgerKind}
                                    onChange={(event) => setLedgerKind(event.target.value as 'all' | FieldGoodsTransactionKind)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                >
                                    <option value="all">전체</option>
                                    <option value="purchase">매입</option>
                                    <option value="issue">반출</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-600">검색</label>
                                <input
                                    type="text"
                                    value={ledgerKeyword}
                                    onChange={(event) => setLedgerKeyword(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="팀, 품목, 메모"
                                />
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-500">DB 원장 {visibleLedgerRows.length.toLocaleString('ko-KR')}건</div>
                    </div>

                    <div className="overflow-auto rounded-lg border border-slate-300">
                        <table className="w-full min-w-[1280px] border-collapse text-xs">
                            <thead className="sticky top-0 z-10 bg-[#d9e2f3] text-[#1f4e79]">
                                <tr>
                                    <th className="border border-slate-300 px-3 py-2 text-left">일자</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">팀</th>
                                    <th className="border border-slate-300 px-3 py-2 text-center">구분</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">품목</th>
                                    <th className="border border-slate-300 px-3 py-2 text-center">단위</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">수량</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">단가</th>
                                    <th className="border border-slate-300 px-3 py-2 text-right">금액</th>
                                    <th className="border border-slate-300 px-3 py-2 text-left">비고</th>
                                    <th className="border border-slate-300 px-3 py-2 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLedgerRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                                            DB 원장 데이터가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    visibleLedgerRows.map((transaction) => {
                                        const editing = editingTransactionId === transaction.id;
                                        const selectedItem = itemMap.get(editing ? transactionDraft.itemId : transaction.itemId);
                                        const quantity = editing ? normalizeNumber(transactionDraft.quantity) : transaction.quantity;
                                        const unitPrice =
                                            (editing ? transactionDraft.kind : transaction.kind) === 'issue'
                                                ? selectedItem?.salePrice ?? transaction.salePrice
                                                : selectedItem?.purchasePrice ?? transaction.purchasePrice;
                                        const amount = quantity * unitPrice;

                                        return (
                                            <tr key={transaction.id} className="bg-white hover:bg-slate-50">
                                                <td className="whitespace-nowrap border border-slate-200 px-2 py-1">
                                                    {editing ? (
                                                        <input
                                                            type="date"
                                                            value={transactionDraft.date}
                                                            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, date: event.target.value }))}
                                                            className="w-full rounded border border-slate-200 px-2 py-1 outline-none focus:border-indigo-500"
                                                        />
                                                    ) : (
                                                        transaction.date
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap border border-slate-200 px-2 py-1 font-bold text-slate-800">
                                                    {editing ? (
                                                        <select
                                                            value={transactionDraft.teamId}
                                                            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, teamId: event.target.value }))}
                                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none focus:border-indigo-500"
                                                        >
                                                            {teams.map((team) => (
                                                                <option key={team.id} value={team.id}>
                                                                    {team.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        teamMap.get(transaction.teamId)?.name || transaction.teamName
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 px-2 py-1 text-center">
                                                    {editing ? (
                                                        <select
                                                            value={transactionDraft.kind}
                                                            onChange={(event) =>
                                                                setTransactionDraft((prev) => ({
                                                                    ...prev,
                                                                    kind: event.target.value as FieldGoodsTransactionKind,
                                                                }))
                                                            }
                                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none focus:border-indigo-500"
                                                        >
                                                            <option value="purchase">매입</option>
                                                            <option value="issue">반출</option>
                                                        </select>
                                                    ) : (
                                                        <span
                                                            className={[
                                                                'inline-flex rounded-full border px-2 py-0.5 text-xs font-black',
                                                                transaction.kind === 'purchase'
                                                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                                    : 'border-rose-200 bg-rose-50 text-rose-700',
                                                            ].join(' ')}
                                                        >
                                                            {kindLabels[transaction.kind]}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 px-2 py-1">
                                                    {editing ? (
                                                        <select
                                                            value={transactionDraft.itemId}
                                                            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, itemId: event.target.value }))}
                                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none focus:border-indigo-500"
                                                        >
                                                            {reportItems.map((item) => (
                                                                <option key={item.id} value={item.id}>
                                                                    {item.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        transaction.itemName
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 px-2 py-1 text-center">{selectedItem?.unit || transaction.unit}</td>
                                                <td className="border border-slate-200 px-2 py-1 text-right tabular-nums">
                                                    {editing ? (
                                                        <input
                                                            type="number"
                                                            value={transactionDraft.quantity}
                                                            onChange={(event) =>
                                                                setTransactionDraft((prev) => ({ ...prev, quantity: event.target.value }))
                                                            }
                                                            className="w-full rounded border border-slate-200 px-2 py-1 text-right outline-none focus:border-indigo-500"
                                                        />
                                                    ) : (
                                                        money(transaction.quantity)
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{money(unitPrice)}</td>
                                                <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-slate-900">
                                                    {money(amount)}
                                                </td>
                                                <td className="border border-slate-200 px-2 py-1 text-slate-500">
                                                    {editing ? (
                                                        <input
                                                            type="text"
                                                            value={transactionDraft.memo}
                                                            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, memo: event.target.value }))}
                                                            className="w-full rounded border border-slate-200 px-2 py-1 outline-none focus:border-indigo-500"
                                                        />
                                                    ) : (
                                                        transaction.memo
                                                    )}
                                                </td>
                                                <td className="border border-slate-200 px-2 py-1 text-center">
                                                    {renderTransactionActions(transaction)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeView === 'master' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(340px,0.65fr)_minmax(0,1.35fr)]">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-black text-slate-900">팀 DB 연동</h2>
                                <p className="mt-1 text-xs font-semibold text-slate-500">팀 추가와 수정은 팀 DB에서 관리합니다.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{activeTeams.length}팀</span>
                        </div>

                        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                            <span>이 화면은 등록된 팀을 선택 데이터로 사용합니다.</span>
                            <button
                                type="button"
                                onClick={() => { void refreshTeams(); }}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
                            >
                                <FontAwesomeIcon icon={faRotateRight} />
                                새로고침
                            </button>
                        </div>

                        <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left">팀</th>
                                        <th className="px-3 py-2 text-left">소속</th>
                                        <th className="px-3 py-2 text-center">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {teams.length ? (
                                        teams.map((team) => (
                                            <tr key={team.id} className={team.active ? 'bg-white' : 'bg-slate-50 text-slate-400'}>
                                                <td className="px-3 py-2 font-bold text-slate-800">{team.name}</td>
                                                <td className="px-3 py-2 text-slate-500">{team.companyName || '-'}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span
                                                        className={[
                                                            'inline-flex rounded-full border px-2 py-0.5 text-xs font-black',
                                                            team.active
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                : 'border-slate-200 bg-slate-100 text-slate-500',
                                                        ].join(' ')}
                                                    >
                                                        {team.active ? '사용' : '종료'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-12 text-center text-slate-400">
                                                팀 데이터가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="font-black text-slate-900">품목/단가 관리</h2>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{items.length}품목</span>
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_90px_130px_130px_auto]">
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                placeholder="품목명"
                            />
                            <input
                                type="text"
                                value={newItem.unit}
                                onChange={(event) => setNewItem((prev) => ({ ...prev, unit: event.target.value }))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                placeholder="단위"
                            />
                            <input
                                type="number"
                                value={newItem.purchasePrice}
                                onChange={(event) => setNewItem((prev) => ({ ...prev, purchasePrice: event.target.value }))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                placeholder="매입단가"
                            />
                            <input
                                type="number"
                                value={newItem.salePrice}
                                onChange={(event) => setNewItem((prev) => ({ ...prev, salePrice: event.target.value }))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                placeholder="판매단가"
                            />
                            <button
                                type="button"
                                onClick={() => void handleAddItem()}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                추가
                            </button>
                        </div>

                        <div className="overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left">품목명</th>
                                        <th className="px-3 py-2 text-center">단위</th>
                                        <th className="px-3 py-2 text-right">매입단가</th>
                                        <th className="px-3 py-2 text-right">판매단가</th>
                                        <th className="px-3 py-2 text-right">개당 이익</th>
                                        <th className="px-3 py-2 text-right">재고</th>
                                        <th className="px-3 py-2 text-center">상태</th>
                                        <th className="px-3 py-2 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                                                등록된 품목이 없습니다. 위 입력칸에서 품목을 추가해 주세요.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => {
                                            const stock = stockByItemId.get(item.id) || 0;
                                            return (
                                                <tr key={item.id} className={item.active ? 'bg-white' : 'bg-slate-50 text-slate-400'}>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={(event) => updateItem(item.id, { name: event.target.value })}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 outline-none focus:border-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        <input
                                                            type="text"
                                                            value={item.unit}
                                                            onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                                                            className="w-20 rounded border border-slate-200 px-2 py-1.5 text-center outline-none focus:border-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="number"
                                                            value={item.purchasePrice}
                                                            onChange={(event) => updateItem(item.id, { purchasePrice: normalizeNumber(event.target.value) })}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="number"
                                                            value={item.salePrice}
                                                            onChange={(event) => updateItem(item.id, { salePrice: normalizeNumber(event.target.value) })}
                                                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-black text-emerald-700">
                                                        {money(item.salePrice - item.purchasePrice)}
                                                    </td>
                                                    <td className={`px-3 py-2 text-right font-black ${stock < 0 ? 'text-orange-700' : 'text-slate-800'}`}>
                                                        {money(stock)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span
                                                            className={[
                                                                'inline-flex rounded-full border px-2 py-0.5 text-xs font-black',
                                                                item.active
                                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                    : 'border-slate-200 bg-slate-100 text-slate-500',
                                                            ].join(' ')}
                                                        >
                                                            {item.active ? '사용' : '삭제'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleSaveItem(item)}
                                                                disabled={saving}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                                                                title="저장"
                                                            >
                                                                <FontAwesomeIcon icon={faSave} />
                                                            </button>
                                                            {item.active ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleDeleteItem(item)}
                                                                    disabled={saving}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                                                                    title="삭제"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleRestoreItem(item)}
                                                                    disabled={saving}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                                                    title="복구"
                                                                >
                                                                    <FontAwesomeIcon icon={faRotateRight} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {stockRows.map((row) => (
                    <div
                        key={row.item.id}
                        className={[
                            'rounded-lg border bg-white px-4 py-3 text-sm shadow-sm',
                            row.stockQty < 0 ? 'border-orange-300 bg-orange-50' : 'border-slate-200',
                        ].join(' ')}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="font-black text-slate-900">{row.item.name}</div>
                            <div className={row.stockQty < 0 ? 'font-black text-orange-700' : 'font-black text-slate-700'}>
                                재고 {money(row.stockQty)}
                            </div>
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-slate-500">
                            <span>매입 {money(row.purchaseQty)}</span>
                            <span>반출 {money(row.issueQty)}</span>
                            <span>판매단가 {money(row.item.salePrice)}원</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FieldGoodsProgramPage;
