import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Banknote,
    BedDouble,
    Building2,
    CalendarDays,
    CarFront,
    ChevronDown,
    CreditCard,
    Download,
    FileText,
    Printer,
    ReceiptText,
    RefreshCw,
    Search,
    WalletCards,
} from 'lucide-react';

import { accommodationService } from '../../services/accommodationService';
import { cardService } from '../../services/cardService';
import { vehicleService } from '../../services/vehicleService';
import type { Accommodation } from '../../types/accommodation';
import type { AccommodationAssignment } from '../../types/accommodationAssignment';
import type { Card, CardAssignmentRecord } from '../../types/card';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type { Vehicle, VehicleAssignmentRecord } from '../../types/vehicle';
import type { Team } from '../../services/teamService';
import { toast } from '../../utils/swal';
import {
    type BillingScope,
    type LedgerSummary,
    getBillingStatusLabel,
    getCategoryLabel,
    getStatusLabel,
    getSummaryTotal,
    summarizeVehicleBillingCosts,
    useExpenseLedgerData,
} from './hooks/useExpenseLedgerData';
import '../manpower/TeamWorkerDetailPage.css';
import './TeamResourceDetailPage.css';

type DetailView = 'summary' | 'accommodation' | 'vehicle' | 'card' | 'expense';
type ResourceStatusFilter = 'all' | 'assigned' | 'billed';

interface TeamResourceRow {
    team: Team;
    teamId: string;
    teamName: string;
    color: string;
    summary: LedgerSummary;
    accommodationCount: number;
    vehicleCount: number;
    cardCount: number;
    expenseCount: number;
    totalAmount: number;
}

interface ResourceCostLine {
    id: string;
    source: '숙소' | '차량' | '카드' | '경비';
    date?: string;
    resourceName: string;
    detail: string;
    status: string;
    amount: number;
    memo?: string;
}

const EMPTY_TEXT = '-';
const DEFAULT_COLOR = '#2563eb';

const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (month: string) => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber) return getMonthRange(getCurrentMonth());

    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
        startDate: `${yearText}-${monthText}-01`,
        endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    };
};

const normalizeText = (value?: unknown) =>
    String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

const asText = (value?: string | number | null) => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : EMPTY_TEXT;
};

const asNumber = (value?: number | string | null) => {
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrency = (value?: number | string | null) =>
    `${Math.round(asNumber(value)).toLocaleString('ko-KR')}원`;

const getTeamStableId = (team?: Team | null) =>
    String(team?.id ?? (team as any)?.legacyId ?? team?.name ?? '').trim();

const getTeamColor = (team?: Team | null) => {
    const color = String((team as any)?.color ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
};

const getTeamExactTokens = (team?: Team | null) =>
    [team?.id, (team as any)?.legacyId, team?.name]
        .map(value => String(value ?? '').trim())
        .filter(Boolean);

const valueMatchesTeam = (team: Team | null, ...values: unknown[]) => {
    if (!team) return false;
    const exactTokens = new Set(getTeamExactTokens(team));
    const normalizedTokens = new Set(getTeamExactTokens(team).map(normalizeText));

    return values.some(value => {
        const text = String(value ?? '').trim();
        if (!text) return false;
        return exactTokens.has(text) || normalizedTokens.has(normalizeText(text));
    });
};

const overlapsMonth = (startDate: string | undefined, endDate: string | undefined, monthStart: string, monthEnd: string) => {
    const start = String(startDate ?? '').trim();
    const end = String(endDate ?? '').trim();
    if (start && start > monthEnd) return false;
    if (end && end < monthStart) return false;
    return true;
};

const buildEmptySummary = (team: Team | null): LedgerSummary => ({
    teamId: getTeamStableId(team) || 'unknown',
    teamName: String(team?.name ?? '팀 미지정'),
    color: getTeamColor(team),
    accommodation: 0,
    privateRoom: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    accommodationOther: 0,
    vehicleRent: 0,
    vehicleFine: 0,
    vehicleRepair: 0,
    vehicleOther: 0,
    card: 0,
    otherClaim: 0,
    receivable: 0,
    payable: 0,
});

const getAccommodationTotal = (summary: LedgerSummary) =>
    summary.accommodation +
    summary.privateRoom +
    summary.electricity +
    summary.gas +
    summary.water +
    summary.internet +
    summary.accommodationOther;

const getVehicleTotal = (summary: LedgerSummary) =>
    summary.vehicleRent + summary.vehicleFine + summary.vehicleRepair + summary.vehicleOther;

const getExpenseDirection = (claim: TeamExpenseClaim, selectedTeam: Team | null) => {
    const isOther = claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim();
    if (isOther) return '기타경비';
    if (valueMatchesTeam(selectedTeam, claim.chargeToTeamId, claim.chargeToTeamName)) return '내야 할 후청구';
    return '받을 후청구';
};

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) {
        toast.warning('내보낼 월별 경비 데이터가 없습니다.');
        return;
    }

    const headers = Object.keys(rows[0]);
    const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
        headers.map(escape).join(','),
        ...rows.map(row => headers.map(header => escape(row[header])).join(',')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const DetailField: React.FC<{ label: string; value?: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
    <div className={wide ? 'tw-detail-field tw-detail-field--wide' : 'tw-detail-field'}>
        <span>{label}</span>
        <strong>{value ?? EMPTY_TEXT}</strong>
    </div>
);

const TeamResourceDetailPage: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [detailView, setDetailView] = useState<DetailView>('summary');
    const [billingScope, setBillingScope] = useState<BillingScope>('all');
    const [statusFilter, setStatusFilter] = useState<ResourceStatusFilter>('all');
    const [loadingResources, setLoadingResources] = useState(true);
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [accommodationAssignments, setAccommodationAssignments] = useState<AccommodationAssignment[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignmentRecord[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [cardAssignments, setCardAssignments] = useState<CardAssignmentRecord[]>([]);

    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);

    const {
        loading,
        teamOptions,
        summaries,
        rawDocs,
        resolveTeam,
        loadData,
    } = useExpenseLedgerData(selectedMonth, 'all', billingScope);

    const loadResourceData = useCallback(async () => {
        setLoadingResources(true);
        try {
            const [
                nextAccommodations,
                nextAccommodationAssignments,
                nextVehicles,
                nextVehicleAssignments,
                nextCards,
                nextCardAssignments,
            ] = await Promise.all([
                accommodationService.getAccommodations(),
                accommodationService.getAssignments(),
                vehicleService.getVehicles(),
                vehicleService.listAllVehicleAssignments(),
                cardService.getCards(),
                cardService.listAllCardAssignments(),
            ]);

            setAccommodations(nextAccommodations);
            setAccommodationAssignments(nextAccommodationAssignments);
            setVehicles(nextVehicles);
            setVehicleAssignments(nextVehicleAssignments);
            setCards(nextCards);
            setCardAssignments(nextCardAssignments);
        } catch (error) {
            console.error(error);
            toast.error('팀별 지원 배정 데이터를 불러오지 못했습니다.');
        } finally {
            setLoadingResources(false);
        }
    }, []);

    useEffect(() => {
        void loadResourceData();
    }, [loadResourceData]);

    useEffect(() => {
        if (teamOptions.length === 0) {
            setSelectedTeamId('');
            return;
        }

        setSelectedTeamId(current =>
            teamOptions.some(team => getTeamStableId(team) === current)
                ? current
                : getTeamStableId(teamOptions[0])
        );
    }, [teamOptions]);

    const selectedTeam = useMemo(
        () => teamOptions.find(team => getTeamStableId(team) === selectedTeamId) ?? null,
        [selectedTeamId, teamOptions]
    );

    const accommodationByKey = useMemo(() => {
        const map = new Map<string, Accommodation>();
        accommodations.forEach(accommodation => {
            [accommodation.id, accommodation.name].forEach(value => {
                const key = String(value ?? '').trim();
                if (key) map.set(key, accommodation);
            });
        });
        return map;
    }, [accommodations]);

    const vehicleByKey = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(vehicle => {
            [vehicle.id, vehicle.licensePlate].forEach(value => {
                const key = String(value ?? '').trim();
                if (key) map.set(key, vehicle);
            });
        });
        return map;
    }, [vehicles]);

    const cardByKey = useMemo(() => {
        const map = new Map<string, Card>();
        cards.forEach(card => {
            [card.id, card.name, card.maskedNumber, card.last4].forEach(value => {
                const key = String(value ?? '').trim();
                if (key) map.set(key, card);
            });
        });
        return map;
    }, [cards]);

    const getResolvedTeamStableId = useCallback(
        (id?: unknown, name?: unknown) => {
            const team = resolveTeam(id, name);
            return getTeamStableId(team) || String(id ?? name ?? '').trim();
        },
        [resolveTeam]
    );

    const matchesSelectedTeam = useCallback(
        (id?: unknown, name?: unknown) => {
            const resolved = resolveTeam(id, name);
            if (resolved && getTeamStableId(resolved) === selectedTeamId) return true;
            return valueMatchesTeam(selectedTeam, id, name);
        },
        [resolveTeam, selectedTeam, selectedTeamId]
    );

    const summaryByTeamId = useMemo(() => {
        const map = new Map<string, LedgerSummary>();
        summaries.forEach(summary => {
            const teamId = getResolvedTeamStableId(summary.teamId, summary.teamName);
            if (teamId) map.set(teamId, summary);
        });
        return map;
    }, [getResolvedTeamStableId, summaries]);

    const selectedSummary = useMemo(
        () => summaryByTeamId.get(selectedTeamId) ?? buildEmptySummary(selectedTeam),
        [selectedTeam, selectedTeamId, summaryByTeamId]
    );

    const selectedAccommodationDocs = useMemo(
        () => rawDocs.accommodationDocs.filter(doc => matchesSelectedTeam(doc.teamId, doc.teamName)),
        [matchesSelectedTeam, rawDocs.accommodationDocs]
    );

    const selectedVehicleDocs = useMemo(
        () => rawDocs.vehicleDocs.filter(doc => matchesSelectedTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName)),
        [matchesSelectedTeam, rawDocs.vehicleDocs]
    );

    const selectedCardDocs = useMemo(
        () => rawDocs.cardDocs.filter(doc => matchesSelectedTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName)),
        [matchesSelectedTeam, rawDocs.cardDocs]
    );

    const selectedClaims = useMemo(
        () => rawDocs.claims.filter(claim => (
            matchesSelectedTeam(claim.payerTeamId, claim.payerTeamName) ||
            matchesSelectedTeam(claim.chargeToTeamId, claim.chargeToTeamName)
        )),
        [matchesSelectedTeam, rawDocs.claims]
    );

    const selectedAccommodationAssignments = useMemo(() => {
        if (!selectedTeam) return [];
        return accommodationAssignments
            .filter(assignment => assignment.status !== 'ended')
            .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
            .filter(assignment => matchesSelectedTeam(assignment.teamId, assignment.teamName))
            .sort((left, right) => String(left.accommodationName ?? '').localeCompare(String(right.accommodationName ?? ''), 'ko-KR'));
    }, [accommodationAssignments, endDate, matchesSelectedTeam, selectedTeam, startDate]);

    const selectedAccommodationResources = useMemo(() => {
        const map = new Map<string, {
            accommodation: Accommodation | null;
            assignments: AccommodationAssignment[];
            monthlyRent: number;
        }>();

        selectedAccommodationAssignments.forEach(assignment => {
            const key = String(assignment.accommodationId || assignment.accommodationName || assignment.id || '').trim();
            if (!key) return;
            const accommodation = accommodationByKey.get(String(assignment.accommodationId ?? '').trim())
                ?? accommodationByKey.get(String(assignment.accommodationName ?? '').trim())
                ?? null;
            const current = map.get(key) ?? {
                accommodation,
                assignments: [],
                monthlyRent: asNumber(accommodation?.contract?.monthlyRent),
            };
            if (!current.accommodation && accommodation) {
                current.accommodation = accommodation;
                current.monthlyRent = asNumber(accommodation.contract?.monthlyRent);
            }
            current.assignments.push(assignment);
            map.set(key, current);
        });

        return Array.from(map.values());
    }, [accommodationByKey, selectedAccommodationAssignments]);

    const selectedVehicleResources = useMemo(() => {
        const map = new Map<string, {
            vehicle: Vehicle | null;
            assignments: VehicleAssignmentRecord[];
            monthlyBilling: number;
        }>();

        vehicles
            .filter(vehicle => vehicle.currentAssigneeType === 'TEAM' && matchesSelectedTeam(vehicle.currentAssigneeId, vehicle.currentAssigneeName))
            .forEach(vehicle => {
                map.set(vehicle.id, {
                    vehicle,
                    assignments: [],
                    monthlyBilling: 0,
                });
            });

        vehicleAssignments
            .filter(assignment => assignment.assigneeType === 'TEAM')
            .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
            .filter(assignment => matchesSelectedTeam(assignment.assigneeId, assignment.assigneeName))
            .forEach(assignment => {
                const key = String(assignment.vehicleId || assignment.vehiclePlate || assignment.id).trim();
                const vehicle = vehicleByKey.get(String(assignment.vehicleId ?? '').trim())
                    ?? vehicleByKey.get(String(assignment.vehiclePlate ?? '').trim())
                    ?? null;
                const current = map.get(key) ?? { vehicle, assignments: [], monthlyBilling: 0 };
                if (!current.vehicle && vehicle) current.vehicle = vehicle;
                current.assignments.push(assignment);
                map.set(key, current);
            });

        selectedVehicleDocs.forEach(doc => {
            const key = String(doc.vehicleId || doc.vehiclePlate || doc.id).trim();
            const vehicle = vehicleByKey.get(String(doc.vehicleId ?? '').trim())
                ?? vehicleByKey.get(String(doc.vehiclePlate ?? '').trim())
                ?? null;
            const current = map.get(key) ?? { vehicle, assignments: [], monthlyBilling: 0 };
            if (!current.vehicle && vehicle) current.vehicle = vehicle;
            current.monthlyBilling += asNumber(doc.totalAmount);
            map.set(key, current);
        });

        return Array.from(map.values())
            .sort((left, right) => String(left.vehicle?.licensePlate ?? '').localeCompare(String(right.vehicle?.licensePlate ?? ''), 'ko-KR'));
    }, [endDate, matchesSelectedTeam, selectedVehicleDocs, startDate, vehicleAssignments, vehicleByKey, vehicles]);

    const selectedCardResources = useMemo(() => {
        const map = new Map<string, {
            card: Card | null;
            assignments: CardAssignmentRecord[];
            monthlyBilling: number;
        }>();

        cards
            .filter(card => card.currentAssigneeType === 'TEAM' && matchesSelectedTeam(card.currentAssigneeId, card.currentAssigneeName))
            .forEach(card => {
                map.set(card.id, {
                    card,
                    assignments: [],
                    monthlyBilling: 0,
                });
            });

        cardAssignments
            .filter(assignment => assignment.assigneeType === 'TEAM')
            .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
            .filter(assignment => matchesSelectedTeam(assignment.assigneeId, assignment.assigneeName))
            .forEach(assignment => {
                const key = String(assignment.cardId || assignment.cardLabel || assignment.id).trim();
                const card = cardByKey.get(String(assignment.cardId ?? '').trim())
                    ?? cardByKey.get(String(assignment.cardLabel ?? '').trim())
                    ?? null;
                const current = map.get(key) ?? { card, assignments: [], monthlyBilling: 0 };
                if (!current.card && card) current.card = card;
                current.assignments.push(assignment);
                map.set(key, current);
            });

        selectedCardDocs.forEach(doc => {
            const key = String(doc.cardId || doc.cardLabel || doc.id).trim();
            const card = cardByKey.get(String(doc.cardId ?? '').trim())
                ?? cardByKey.get(String(doc.cardLabel ?? '').trim())
                ?? null;
            const current = map.get(key) ?? { card, assignments: [], monthlyBilling: 0 };
            if (!current.card && card) current.card = card;
            current.monthlyBilling += asNumber(doc.totalAmount);
            map.set(key, current);
        });

        return Array.from(map.values())
            .sort((left, right) => String(left.card?.name ?? '').localeCompare(String(right.card?.name ?? ''), 'ko-KR'));
    }, [cardAssignments, cardByKey, cards, endDate, matchesSelectedTeam, selectedCardDocs, startDate]);

    const selectedCostLines = useMemo<ResourceCostLine[]>(() => {
        const accommodationLines: ResourceCostLine[] = selectedAccommodationDocs.flatMap(doc =>
            (doc.lineItems ?? []).map(item => ({
                id: `${doc.id}-${item.id}`,
                source: '숙소' as const,
                resourceName: doc.issuedToWorkerName || doc.teamName || '숙소 청구',
                detail: item.label || item.targetField,
                status: getBillingStatusLabel(doc.status),
                amount: asNumber(item.amount),
                memo: doc.memo,
            }))
        );

        const vehicleLines: ResourceCostLine[] = selectedVehicleDocs.flatMap(doc =>
            (doc.lineItems ?? []).map((item, index) => ({
                id: `${doc.id}-${item.id || index}`,
                source: '차량' as const,
                resourceName: doc.vehiclePlate || '차량 청구',
                detail: item.label || item.category || '차량 비용',
                status: getBillingStatusLabel(doc.status),
                amount: asNumber(item.amount),
                memo: doc.memo,
            }))
        );

        const cardLines: ResourceCostLine[] = selectedCardDocs.flatMap(doc =>
            (doc.lineItems ?? []).map((item, index) => ({
                id: `${doc.id}-${item.id || index}`,
                source: '카드' as const,
                resourceName: doc.cardLabel || '카드 청구',
                detail: item.label || item.category || '카드 사용',
                status: getBillingStatusLabel(doc.status),
                amount: asNumber(item.amount),
                memo: doc.memo,
            }))
        );

        const claimLines: ResourceCostLine[] = selectedClaims.map(claim => ({
            id: claim.id,
            source: '경비' as const,
            date: claim.date,
            resourceName: claim.cardLabel || '현찰',
            detail: claim.description || getCategoryLabel(claim.category),
            status: getStatusLabel(claim.status),
            amount: asNumber(claim.amount),
            memo: getExpenseDirection(claim, selectedTeam),
        }));

        return [...accommodationLines, ...vehicleLines, ...cardLines, ...claimLines]
            .sort((left, right) => String(left.source).localeCompare(String(right.source), 'ko-KR') || String(left.date ?? '').localeCompare(String(right.date ?? ''), 'ko-KR'));
    }, [selectedAccommodationDocs, selectedCardDocs, selectedClaims, selectedTeam, selectedVehicleDocs]);

    const teamRows = useMemo<TeamResourceRow[]>(() => {
        return teamOptions.map(team => {
            const teamId = getTeamStableId(team);
            const summary = summaryByTeamId.get(teamId) ?? buildEmptySummary(team);

            const accommodationCount = accommodationAssignments
                .filter(assignment => assignment.status !== 'ended')
                .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
                .filter(assignment => valueMatchesTeam(team, assignment.teamId, assignment.teamName))
                .reduce((set, assignment) => set.add(String(assignment.accommodationId || assignment.accommodationName || assignment.id)), new Set<string>())
                .size;

            const vehicleKeys = new Set<string>();
            vehicles
                .filter(vehicle => vehicle.currentAssigneeType === 'TEAM' && valueMatchesTeam(team, vehicle.currentAssigneeId, vehicle.currentAssigneeName))
                .forEach(vehicle => vehicleKeys.add(vehicle.id));
            vehicleAssignments
                .filter(assignment => assignment.assigneeType === 'TEAM')
                .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
                .filter(assignment => valueMatchesTeam(team, assignment.assigneeId, assignment.assigneeName))
                .forEach(assignment => vehicleKeys.add(String(assignment.vehicleId || assignment.vehiclePlate || assignment.id)));

            const cardKeys = new Set<string>();
            cards
                .filter(card => card.currentAssigneeType === 'TEAM' && valueMatchesTeam(team, card.currentAssigneeId, card.currentAssigneeName))
                .forEach(card => cardKeys.add(card.id));
            cardAssignments
                .filter(assignment => assignment.assigneeType === 'TEAM')
                .filter(assignment => overlapsMonth(assignment.startDate, assignment.endDate, startDate, endDate))
                .filter(assignment => valueMatchesTeam(team, assignment.assigneeId, assignment.assigneeName))
                .forEach(assignment => cardKeys.add(String(assignment.cardId || assignment.cardLabel || assignment.id)));

            const expenseCount = rawDocs.claims.filter(claim => (
                valueMatchesTeam(team, claim.payerTeamId, claim.payerTeamName) ||
                valueMatchesTeam(team, claim.chargeToTeamId, claim.chargeToTeamName)
            )).length;

            return {
                team,
                teamId,
                teamName: String(team.name ?? '팀 미지정'),
                color: getTeamColor(team),
                summary,
                accommodationCount,
                vehicleCount: vehicleKeys.size,
                cardCount: cardKeys.size,
                expenseCount,
                totalAmount: getSummaryTotal(summary),
            };
        });
    }, [
        accommodationAssignments,
        cardAssignments,
        cards,
        endDate,
        rawDocs.claims,
        startDate,
        summaryByTeamId,
        teamOptions,
        vehicleAssignments,
        vehicles,
    ]);

    const filteredTeamRows = useMemo(() => {
        const query = normalizeText(searchQuery);
        return teamRows
            .filter(row => {
                if (statusFilter === 'assigned' && row.accommodationCount + row.vehicleCount + row.cardCount === 0) return false;
                if (statusFilter === 'billed' && row.totalAmount === 0) return false;
                if (!query) return true;
                return normalizeText([
                    row.teamName,
                    row.accommodationCount,
                    row.vehicleCount,
                    row.cardCount,
                    row.totalAmount,
                ].join(' ')).includes(query);
            })
            .sort((left, right) => left.teamName.localeCompare(right.teamName, 'ko-KR'));
    }, [searchQuery, statusFilter, teamRows]);

    const selectedTeamRow = useMemo(
        () => teamRows.find(row => row.teamId === selectedTeamId) ?? null,
        [selectedTeamId, teamRows]
    );

    const selectedStats = useMemo(() => {
        const accommodationTotal = getAccommodationTotal(selectedSummary);
        const vehicleTotal = getVehicleTotal(selectedSummary);
        const cardTotal = selectedSummary.card;
        const total = getSummaryTotal(selectedSummary);
        return {
            accommodationTotal,
            vehicleTotal,
            cardTotal,
            expenseTotal: selectedSummary.otherClaim + selectedSummary.payable - selectedSummary.receivable,
            total,
            accommodationCount: selectedAccommodationResources.length,
            vehicleCount: selectedVehicleResources.length,
            cardCount: selectedCardResources.length,
            expenseCount: selectedClaims.length,
        };
    }, [selectedAccommodationResources.length, selectedCardResources.length, selectedClaims.length, selectedSummary, selectedVehicleResources.length]);

    const handleTeamSelect = (teamId: string) => {
        setSelectedTeamId(teamId);
        setIsTeamPickerOpen(false);
    };

    const handleRefresh = async () => {
        await Promise.all([loadData(), loadResourceData()]);
        toast.success('팀별 지원/경비 데이터를 새로고침했습니다.');
    };

    const handleCsvDownload = () => {
        const teamName = selectedTeam?.name || '팀';
        downloadCsv(`팀별_지원경비_${teamName}_${selectedMonth}.csv`, selectedCostLines.map(line => ({
            구분: line.source,
            일자: line.date || '',
            팀: teamName,
            자원: line.resourceName,
            항목: line.detail,
            상태: line.status,
            금액: line.amount,
            메모: line.memo || '',
        })));
    };

    const renderTeamItem = (row: TeamResourceRow) => (
        <button
            key={row.teamId}
            type="button"
            className={row.teamId === selectedTeamId ? 'tw-team-item tw-team-item--active' : 'tw-team-item'}
            onClick={() => handleTeamSelect(row.teamId)}
        >
            <span className="tw-team-item__color" style={{ background: row.color }} />
            <span className="tw-team-item__body">
                <strong>{row.teamName}</strong>
                <small>숙소 {row.accommodationCount} · 차량 {row.vehicleCount} · 카드 {row.cardCount}</small>
            </span>
            <span className="tw-team-item__meta">
                <strong>{formatCurrency(row.totalAmount)}</strong>
                <small>경비 {row.expenseCount}건</small>
            </span>
        </button>
    );

    const renderCostLineTable = (lines: ResourceCostLine[], emptyText: string) => (
        <div className="tw-output-table-wrap tw-output-table-wrap--v2">
            <table className="tw-output-table trd-ledger-table">
                <thead>
                    <tr>
                        <th>구분</th>
                        <th>일자</th>
                        <th>자원/결제</th>
                        <th>항목</th>
                        <th>상태</th>
                        <th className="tw-number">금액</th>
                        <th>메모</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="tw-table-empty">{emptyText}</td>
                        </tr>
                    ) : (
                        lines.map(line => (
                            <tr key={line.id}>
                                <td><span className={`trd-source-badge trd-source-badge--${line.source}`}>{line.source}</span></td>
                                <td>{line.date || EMPTY_TEXT}</td>
                                <td><strong>{line.resourceName}</strong></td>
                                <td>{line.detail}</td>
                                <td>{line.status}</td>
                                <td className="tw-number">{formatCurrency(line.amount)}</td>
                                <td className="tw-truncate" title={line.memo || ''}>{line.memo || EMPTY_TEXT}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const teamColor = selectedTeamRow?.color || getTeamColor(selectedTeam);
    const isBusy = loading || loadingResources;
    const detailMenuItems: Array<{
        id: DetailView;
        label: string;
        icon: React.ReactNode;
        primary: string;
        secondary: string;
    }> = [
        {
            id: 'summary',
            label: '종합',
            icon: <WalletCards size={18} />,
            primary: formatCurrency(selectedStats.total),
            secondary: '전체 지원/경비',
        },
        {
            id: 'accommodation',
            label: '숙소',
            icon: <BedDouble size={18} />,
            primary: `${selectedStats.accommodationCount.toLocaleString('ko-KR')}건`,
            secondary: formatCurrency(selectedStats.accommodationTotal),
        },
        {
            id: 'vehicle',
            label: '차량',
            icon: <CarFront size={18} />,
            primary: `${selectedStats.vehicleCount.toLocaleString('ko-KR')}대`,
            secondary: formatCurrency(selectedStats.vehicleTotal),
        },
        {
            id: 'card',
            label: '카드',
            icon: <CreditCard size={18} />,
            primary: `${selectedStats.cardCount.toLocaleString('ko-KR')}장`,
            secondary: formatCurrency(selectedStats.cardTotal),
        },
        {
            id: 'expense',
            label: '경비',
            icon: <ReceiptText size={18} />,
            primary: `${selectedStats.expenseCount.toLocaleString('ko-KR')}건`,
            secondary: formatCurrency(selectedStats.expenseTotal),
        },
    ];

    return (
        <div className="tw-page trd-page">
            <header className="tw-page__header">
                <div>
                    <div className="tw-page__eyebrow">
                        <WalletCards size={16} />
                        팀별 지원 배정 월별 조회
                    </div>
                    <h1>팀별 숙소 · 차량 · 카드 · 경비 상세</h1>
                </div>

                <div className="tw-header-actions">
                    <button type="button" className="tw-icon-button" onClick={handleCsvDownload} title="CSV 내보내기">
                        <Download size={18} />
                        <span>CSV</span>
                    </button>
                    <button type="button" className="tw-icon-button" onClick={() => window.print()} title="인쇄">
                        <Printer size={18} />
                        <span>인쇄</span>
                    </button>
                    <button type="button" className="tw-primary-button" onClick={handleRefresh} disabled={isBusy}>
                        <RefreshCw size={18} className={isBusy ? 'tw-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </header>

            <section className="tw-toolbar">
                <label className="tw-control">
                    <span>조회월</span>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(event) => setSelectedMonth(event.target.value)}
                    />
                </label>

                <label className="tw-control tw-control--search">
                    <span>팀 검색</span>
                    <div className="tw-search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="팀명, 배정/청구 금액"
                        />
                    </div>
                </label>

                <label className="tw-control">
                    <span>표시 조건</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ResourceStatusFilter)}>
                        <option value="all">전체</option>
                        <option value="assigned">배정 있음</option>
                        <option value="billed">금액 있음</option>
                    </select>
                </label>

                <label className="tw-control">
                    <span>정산 범위</span>
                    <select value={billingScope} onChange={(event) => setBillingScope(event.target.value as BillingScope)}>
                        <option value="all">작성중 포함</option>
                        <option value="posted">확정/정산만</option>
                    </select>
                </label>
            </section>

            <section className="tw-kpi-grid" aria-label="선택 팀 지원 요약">
                <div className="tw-kpi">
                    <BedDouble size={20} />
                    <span>숙소 월금액</span>
                    <strong>{formatCurrency(selectedStats.accommodationTotal)}</strong>
                </div>
                <div className="tw-kpi">
                    <CarFront size={20} />
                    <span>차량 월금액</span>
                    <strong>{formatCurrency(selectedStats.vehicleTotal)}</strong>
                </div>
                <div className="tw-kpi">
                    <CreditCard size={20} />
                    <span>카드 월금액</span>
                    <strong>{formatCurrency(selectedStats.cardTotal)}</strong>
                </div>
                <div className="tw-kpi">
                    <Banknote size={20} />
                    <span>정산 반영 합계</span>
                    <strong>{formatCurrency(selectedStats.total)}</strong>
                </div>
            </section>

            <main className="tw-workspace">
                <section className="tw-worker-panel">
                    <div className="tw-panel-heading">
                        <div>
                            <span>팀 / 상세 목록</span>
                            <strong>{detailMenuItems.length.toLocaleString('ko-KR')}개</strong>
                        </div>
                        <small>{selectedTeam?.name || '팀 선택'}</small>
                    </div>

                    <div className="tw-worker-list">
                        <div className={isTeamPickerOpen ? 'tw-merged-team-list tw-merged-team-list--open' : 'tw-merged-team-list'} aria-label="팀 선택">
                            <button
                                type="button"
                                className="tw-team-picker-button"
                                onClick={() => setIsTeamPickerOpen(prev => !prev)}
                                aria-expanded={isTeamPickerOpen}
                                disabled={isBusy || filteredTeamRows.length === 0}
                            >
                                <span className="tw-team-item__color" style={{ background: teamColor }} />
                                <span className="tw-team-picker-button__body">
                                    <small>팀 선택</small>
                                    <strong>{selectedTeam?.name || '팀 선택'}</strong>
                                </span>
                                <span className="tw-team-picker-button__meta">
                                    {formatCurrency(selectedStats.total)}
                                </span>
                                <ChevronDown size={18} className={isTeamPickerOpen ? 'tw-team-picker-button__chevron tw-team-picker-button__chevron--open' : 'tw-team-picker-button__chevron'} />
                            </button>
                            {isBusy ? (
                                <div className="tw-empty-state">팀별 지원 데이터를 불러오는 중입니다.</div>
                            ) : filteredTeamRows.length === 0 ? (
                                <div className="tw-empty-state">조건에 맞는 팀이 없습니다.</div>
                            ) : isTeamPickerOpen && (
                                <div className="tw-team-picker-menu">
                                    {filteredTeamRows.map(renderTeamItem)}
                                </div>
                            )}
                        </div>

                        <div className="tw-list-block-title tw-list-block-title--workers">상세 목록</div>
                        <div className="trd-detail-menu" role="tablist" aria-label="지원 상세 선택">
                            {detailMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={detailView === item.id}
                                    className={detailView === item.id ? 'trd-detail-menu__item trd-detail-menu__item--active' : 'trd-detail-menu__item'}
                                    style={{ '--team-color': teamColor } as React.CSSProperties}
                                    onClick={() => setDetailView(item.id)}
                                    disabled={!selectedTeam}
                                >
                                    <span className="trd-detail-menu__icon">{item.icon}</span>
                                    <span className="trd-detail-menu__body">
                                        <strong>{item.label}</strong>
                                        <small>{item.secondary}</small>
                                    </span>
                                    <span className="trd-detail-menu__meta">{item.primary}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="tw-detail-panel">
                    {!selectedTeam ? (
                        <div className="tw-empty-detail">
                            <Building2 size={44} />
                            <strong>팀을 선택하세요.</strong>
                        </div>
                    ) : (
                        <>
                            <div className="tw-worker-hero">
                                <div className="tw-worker-hero__avatar" style={{ background: teamColor }}>{String(selectedTeam.name ?? '?').slice(0, 1)}</div>
                                <div className="tw-worker-hero__content">
                                    <div className="tw-worker-hero__title">
                                        <h2>{selectedTeam.name}</h2>
                                        <span className="tw-status">{billingScope === 'posted' ? '확정 기준' : '작성중 포함'}</span>
                                    </div>
                                    <div className="tw-worker-hero__meta">
                                        <span><CalendarDays size={15} />{startDate} ~ {endDate}</span>
                                        <span><BedDouble size={15} />숙소 {selectedStats.accommodationCount}</span>
                                        <span><CarFront size={15} />차량 {selectedStats.vehicleCount}</span>
                                        <span><CreditCard size={15} />카드 {selectedStats.cardCount}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tw-worker-stat-grid trd-stat-grid">
                                <div>
                                    <span>배정 숙소</span>
                                    <strong>{selectedStats.accommodationCount.toLocaleString('ko-KR')}</strong>
                                </div>
                                <div>
                                    <span>배정 차량</span>
                                    <strong>{selectedStats.vehicleCount.toLocaleString('ko-KR')}</strong>
                                </div>
                                <div>
                                    <span>배정 카드</span>
                                    <strong>{selectedStats.cardCount.toLocaleString('ko-KR')}</strong>
                                </div>
                                <div>
                                    <span>경비 건수</span>
                                    <strong>{selectedStats.expenseCount.toLocaleString('ko-KR')}</strong>
                                </div>
                            </div>

                            {detailView === 'summary' && (
                                <div className="tw-section-grid">
                                    <section className="tw-detail-section">
                                        <h3><ReceiptText size={18} />월별 금액 요약</h3>
                                        <div className="trd-summary-list">
                                            <div><span>숙소비</span><strong>{formatCurrency(selectedSummary.accommodation)}</strong></div>
                                            <div><span>개인숙소</span><strong>{formatCurrency(selectedSummary.privateRoom)}</strong></div>
                                            <div><span>전기/가스/수도/유선</span><strong>{formatCurrency(selectedSummary.electricity + selectedSummary.gas + selectedSummary.water + selectedSummary.internet)}</strong></div>
                                            <div><span>차량 렌트/수리/기타</span><strong>{formatCurrency(getVehicleTotal(selectedSummary))}</strong></div>
                                            <div><span>카드 사용액</span><strong>{formatCurrency(selectedSummary.card)}</strong></div>
                                            <div><span>기타경비/후청구</span><strong>{formatCurrency(selectedStats.expenseTotal)}</strong></div>
                                            <div className="trd-summary-list__total"><span>정산 반영 합계</span><strong>{formatCurrency(selectedStats.total)}</strong></div>
                                        </div>
                                    </section>

                                    <section className="tw-detail-section">
                                        <h3><WalletCards size={18} />배정 현황</h3>
                                        <div className="tw-detail-grid">
                                            <DetailField label="팀명" value={asText(selectedTeam.name)} />
                                            <DetailField label="소속회사" value={asText((selectedTeam as any).companyName)} />
                                            <DetailField label="배정 숙소" value={`${selectedStats.accommodationCount.toLocaleString('ko-KR')}건`} />
                                            <DetailField label="배정 차량" value={`${selectedStats.vehicleCount.toLocaleString('ko-KR')}건`} />
                                            <DetailField label="배정 카드" value={`${selectedStats.cardCount.toLocaleString('ko-KR')}건`} />
                                            <DetailField label="경비내역" value={`${selectedStats.expenseCount.toLocaleString('ko-KR')}건`} />
                                        </div>
                                    </section>

                                    <section className="tw-output-section trd-wide-section">
                                        <div className="tw-output-section__header">
                                            <h3><FileText size={18} />월별 상세 금액</h3>
                                            <span>{selectedMonth}</span>
                                        </div>
                                        {renderCostLineTable(selectedCostLines, '선택한 팀의 월별 지원/경비 금액이 없습니다.')}
                                    </section>
                                </div>
                            )}

                            {detailView === 'accommodation' && (
                                <div className="trd-tab-stack">
                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><BedDouble size={18} />배정 숙소</h3>
                                            <span>{selectedAccommodationResources.length.toLocaleString('ko-KR')}건</span>
                                        </div>
                                        <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                            <table className="tw-output-table trd-ledger-table">
                                                <thead>
                                                    <tr>
                                                        <th>숙소명</th>
                                                        <th>주소</th>
                                                        <th>작업자</th>
                                                        <th>배정기간</th>
                                                        <th>상태</th>
                                                        <th className="tw-number">월 임대료</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedAccommodationResources.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="tw-table-empty">배정된 숙소가 없습니다.</td>
                                                        </tr>
                                                    ) : (
                                                        selectedAccommodationResources.map(resource => {
                                                            const firstAssignment = resource.assignments[0];
                                                            const accommodation = resource.accommodation;
                                                            return (
                                                                <tr key={firstAssignment?.accommodationId || accommodation?.id || firstAssignment?.id}>
                                                                    <td><strong>{accommodation?.name || firstAssignment?.accommodationName || EMPTY_TEXT}</strong></td>
                                                                    <td className="tw-truncate" title={accommodation?.address || ''}>{accommodation?.address || EMPTY_TEXT}</td>
                                                                    <td>{resource.assignments.map(item => item.workerName || item.workerId || EMPTY_TEXT).join(', ')}</td>
                                                                    <td>{firstAssignment?.startDate || EMPTY_TEXT} ~ {firstAssignment?.endDate || '현재'}</td>
                                                                    <td>{firstAssignment?.status === 'ended' ? '종료' : '배정중'}</td>
                                                                    <td className="tw-number">{formatCurrency(resource.monthlyRent)}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><ReceiptText size={18} />숙소 월 청구내역</h3>
                                            <span>{formatCurrency(selectedStats.accommodationTotal)}</span>
                                        </div>
                                        {renderCostLineTable(selectedCostLines.filter(line => line.source === '숙소'), '선택한 월의 숙소 청구내역이 없습니다.')}
                                    </section>
                                </div>
                            )}

                            {detailView === 'vehicle' && (
                                <div className="trd-tab-stack">
                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><CarFront size={18} />배정 차량</h3>
                                            <span>{selectedVehicleResources.length.toLocaleString('ko-KR')}대</span>
                                        </div>
                                        <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                            <table className="tw-output-table trd-ledger-table">
                                                <thead>
                                                    <tr>
                                                        <th>차량번호</th>
                                                        <th>모델</th>
                                                        <th>계약구분</th>
                                                        <th>배정기간</th>
                                                        <th className="tw-number">월 고정비</th>
                                                        <th className="tw-number">월 청구액</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedVehicleResources.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="tw-table-empty">배정된 차량이 없습니다.</td>
                                                        </tr>
                                                    ) : (
                                                        selectedVehicleResources.map(resource => {
                                                            const vehicle = resource.vehicle;
                                                            const firstAssignment = resource.assignments[0];
                                                            return (
                                                                <tr key={vehicle?.id || firstAssignment?.vehicleId || firstAssignment?.id}>
                                                                    <td><strong>{vehicle?.licensePlate || firstAssignment?.vehiclePlate || EMPTY_TEXT}</strong></td>
                                                                    <td>{vehicle?.model || EMPTY_TEXT}</td>
                                                                    <td>{vehicle?.type || EMPTY_TEXT}</td>
                                                                    <td>{firstAssignment?.startDate || EMPTY_TEXT} ~ {firstAssignment?.endDate || '현재'}</td>
                                                                    <td className="tw-number">{formatCurrency(vehicle?.contract?.monthlyFee)}</td>
                                                                    <td className="tw-number">{formatCurrency(resource.monthlyBilling)}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><ReceiptText size={18} />차량 월 청구내역</h3>
                                            <span>{formatCurrency(selectedStats.vehicleTotal)}</span>
                                        </div>
                                        <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                            <table className="tw-output-table trd-ledger-table">
                                                <thead>
                                                    <tr>
                                                        <th>차량</th>
                                                        <th>상태</th>
                                                        <th className="tw-number">렌트료</th>
                                                        <th className="tw-number">과태료</th>
                                                        <th className="tw-number">수리</th>
                                                        <th className="tw-number">기타</th>
                                                        <th className="tw-number">합계</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedVehicleDocs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="tw-table-empty">선택한 월의 차량 청구내역이 없습니다.</td>
                                                        </tr>
                                                    ) : (
                                                        selectedVehicleDocs.map(doc => {
                                                            const breakdown = summarizeVehicleBillingCosts(doc);
                                                            return (
                                                                <tr key={doc.id}>
                                                                    <td><strong>{doc.vehiclePlate || EMPTY_TEXT}</strong></td>
                                                                    <td>{getBillingStatusLabel(doc.status)}</td>
                                                                    <td className="tw-number">{formatCurrency(breakdown.rent)}</td>
                                                                    <td className="tw-number">{formatCurrency(breakdown.fine)}</td>
                                                                    <td className="tw-number">{formatCurrency(breakdown.repair)}</td>
                                                                    <td className="tw-number">{formatCurrency(breakdown.other)}</td>
                                                                    <td className="tw-number"><strong>{formatCurrency(breakdown.total)}</strong></td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {detailView === 'card' && (
                                <div className="trd-tab-stack">
                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><CreditCard size={18} />배정 카드</h3>
                                            <span>{selectedCardResources.length.toLocaleString('ko-KR')}장</span>
                                        </div>
                                        <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                            <table className="tw-output-table trd-ledger-table">
                                                <thead>
                                                    <tr>
                                                        <th>카드명</th>
                                                        <th>카드번호</th>
                                                        <th>발급사</th>
                                                        <th>배정기간</th>
                                                        <th>상태</th>
                                                        <th className="tw-number">월 사용액</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedCardResources.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="tw-table-empty">배정된 카드가 없습니다.</td>
                                                        </tr>
                                                    ) : (
                                                        selectedCardResources.map(resource => {
                                                            const card = resource.card;
                                                            const firstAssignment = resource.assignments[0];
                                                            return (
                                                                <tr key={card?.id || firstAssignment?.cardId || firstAssignment?.id}>
                                                                    <td><strong>{card?.name || firstAssignment?.cardLabel || EMPTY_TEXT}</strong></td>
                                                                    <td>{card?.maskedNumber || (card?.last4 ? `**** ${card.last4}` : EMPTY_TEXT)}</td>
                                                                    <td>{card?.issuer || EMPTY_TEXT}</td>
                                                                    <td>{firstAssignment?.startDate || EMPTY_TEXT} ~ {firstAssignment?.endDate || '현재'}</td>
                                                                    <td>{card?.status || EMPTY_TEXT}</td>
                                                                    <td className="tw-number">{formatCurrency(resource.monthlyBilling)}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <section className="tw-output-section">
                                        <div className="tw-output-section__header">
                                            <h3><ReceiptText size={18} />카드 월 청구내역</h3>
                                            <span>{formatCurrency(selectedStats.cardTotal)}</span>
                                        </div>
                                        {renderCostLineTable(selectedCostLines.filter(line => line.source === '카드'), '선택한 월의 카드 사용내역이 없습니다.')}
                                    </section>
                                </div>
                            )}

                            {detailView === 'expense' && (
                                <section className="tw-output-section">
                                    <div className="tw-output-section__header">
                                        <h3><ReceiptText size={18} />경비 / 후청구 내역</h3>
                                        <span>{selectedClaims.length.toLocaleString('ko-KR')}건</span>
                                    </div>
                                    <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                        <table className="tw-output-table trd-ledger-table">
                                            <thead>
                                                <tr>
                                                    <th>날짜</th>
                                                    <th>구분</th>
                                                    <th>상대팀</th>
                                                    <th>현장</th>
                                                    <th>결제</th>
                                                    <th>항목</th>
                                                    <th>내용</th>
                                                    <th>상태</th>
                                                    <th className="tw-number">금액</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedClaims.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="tw-table-empty">선택한 월의 경비/후청구 내역이 없습니다.</td>
                                                    </tr>
                                                ) : (
                                                    selectedClaims.map(claim => {
                                                        const direction = getExpenseDirection(claim, selectedTeam);
                                                        const counterparty = direction === '내야 할 후청구'
                                                            ? claim.payerTeamName
                                                            : direction === '받을 후청구'
                                                                ? claim.chargeToTeamName
                                                                : '청구대상 없음';
                                                        return (
                                                            <tr key={claim.id}>
                                                                <td>{claim.date}</td>
                                                                <td><span className="trd-expense-direction">{direction}</span></td>
                                                                <td>{counterparty || EMPTY_TEXT}</td>
                                                                <td className="tw-truncate" title={claim.siteName || ''}>{claim.siteName || EMPTY_TEXT}</td>
                                                                <td>{claim.cardLabel || '현찰'}</td>
                                                                <td>{getCategoryLabel(claim.category)}</td>
                                                                <td className="tw-truncate" title={claim.description}>{claim.description}</td>
                                                                <td>{getStatusLabel(claim.status)}</td>
                                                                <td className="tw-number">{formatCurrency(claim.amount)}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};

export default TeamResourceDetailPage;
