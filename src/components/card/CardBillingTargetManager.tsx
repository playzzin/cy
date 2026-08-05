import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteField } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faFileInvoiceDollar, faPen, faRotateLeft, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Card, CardBillingTargetRecord, CardBillingTargetType } from '../../types/card';
import { manpowerService, Worker } from '../../services/manpowerService';
import { cardService } from '../../services/cardService';
import { Team } from '../../services/teamService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { formatTypedDateInput, normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { BillingMode, BillingModeSelector, BillingStatusSummary } from '../support/BillingModeSelector';
import BillingPeriodTimeline, { BillingPeriodTimelineItem } from '../support/BillingPeriodTimeline';

interface BillingTargetSelection {
    type: CardBillingTargetType;
    id: string;
    name: string;
    group: string;
    detail?: string;
    color?: string;
}

interface CardBillingTargetManagerProps {
    cards: Card[];
    loading: boolean;
    initialCardId?: string | null;
    initialSplitMode?: boolean;
    selectableTeams?: Team[];
    onRefresh: () => void;
}

const DEFAULT_BILLING_START_DATE = '2026-01-01';
const getDefaultBillingStartDate = () => toShortYearDateInputValue(DEFAULT_BILLING_START_DATE) || '26-01-01';
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';
const TARGET_GROUPS = ['청연이엔지 소속팀', '작업자', '사무실', '사무실직원'];

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const includesCheongyeonKeyword = (...values: unknown[]): boolean => {
    const text = values.map((value) => String(value ?? '').toLowerCase()).join(' ');
    return ['청연이엔지', '청연엔지', '청연', 'cheongyeon'].some((keyword) => text.includes(keyword));
};

const getBillingTargetTypeLabel = (type?: CardBillingTargetType | null) => {
    if (type === 'TEAM') return '팀';
    if (type === 'WORKER') return '작업자';
    if (type === 'OFFICE') return '사무실';
    if (type === 'OFFICE_STAFF') return '사무실직원';
    return '청구대상';
};

const getTargetOptionKey = (type?: CardBillingTargetType | null, id?: string | null) => {
    const normalizedType = normalizeKey(type);
    const normalizedId = normalizeKey(id);
    return normalizedType && normalizedId ? `${normalizedType}:${normalizedId}` : '';
};

const getWorkerTargetId = (worker: Worker): string => (
    normalizeKey(worker.id) || normalizeKey(worker.legacyId) || normalizeKey(worker.name)
);

const getOfficeStaffTargetId = (staff: OfficeStaff): string => (
    normalizeKey(staff.id) || normalizeKey(staff.legacyId) || normalizeKey(staff.uid) || normalizeKey(staff.name)
);

const getLatestTargetRecord = (records: CardBillingTargetRecord[]): CardBillingTargetRecord | undefined => (
    records
        .slice()
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })[0]
);

const displayDate = (value?: string | null): string => toShortYearDateInputValue(value) || '';
const toDateText = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getTodayDateText = (): string => toDateText(new Date());

const getCurrentTargetRecord = (records: CardBillingTargetRecord[]): CardBillingTargetRecord | undefined => {
    const today = getTodayDateText();
    return records
        .slice()
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })
        .find((record) => {
            const startDate = normalizeKey(record.startDate);
            const endDate = normalizeKey(record.endDate);
            return (!startDate || startDate <= today) && (!endDate || endDate >= today);
        });
};

const buildEndDateAsDayBefore = (startDate: string): string => {
    const parsed = normalizeTypedDateInput(startDate);
    if (!parsed) return '';
    const [year, month, day] = parsed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return toDateText(date);
};

const makeBillingTargetId = (cardId: string, targetId: string, startDate: string): string => (
    `${cardId}_${targetId}_${startDate}_${Date.now()}`
);

const targetLabel = (card: Card, records: CardBillingTargetRecord[] = []): string => {
    const record = getCurrentTargetRecord(records);
    if (record) {
        const period = records.length > 1
            ? ` · ${displayDate(record.startDate) || '?'}~${displayDate(record.endDate) || '계속'}`
            : '';
        return `${getBillingTargetTypeLabel(record.targetType)} · ${record.targetName}${period}`;
    }
    if (card.billingTargetType && card.billingTargetId && card.billingTargetName) {
        return `${getBillingTargetTypeLabel(card.billingTargetType)} · ${card.billingTargetName}`;
    }
    if (card.currentAssigneeName) {
        return card.currentAssigneeType
            ? `${getBillingTargetTypeLabel(card.currentAssigneeType as CardBillingTargetType)} · ${card.currentAssigneeName}`
            : card.currentAssigneeName;
    }
    return '청구대상 미지정';
};

export const CardBillingTargetManager: React.FC<CardBillingTargetManagerProps> = ({
    cards,
    loading,
    initialCardId,
    initialSplitMode = false,
    selectableTeams = [],
    onRefresh
}) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [selectedTargetKey, setSelectedTargetKey] = useState('');
    const [targetStartDate, setTargetStartDate] = useState(getDefaultBillingStartDate());
    const [targetEndDate, setTargetEndDate] = useState('');
    const [targetRecords, setTargetRecords] = useState<CardBillingTargetRecord[]>([]);
    const [targetRecordsLoading, setTargetRecordsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTargetRecordId, setEditingTargetRecordId] = useState<string | null>(null);
    const [billingMode, setBillingMode] = useState<BillingMode>(initialSplitMode ? 'split' : 'same');

    const handleTargetStartDateChange = (value: string) => {
        setTargetStartDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };

    const handleTargetEndDateChange = (value: string) => {
        setTargetEndDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };

    const normalizeTargetStartDate = () => {
        setTargetStartDate((prev) => toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev);
    };

    const normalizeTargetEndDate = () => {
        setTargetEndDate((prev) => prev ? (toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev) : '');
    };

    useEffect(() => {
        let mounted = true;
        Promise.all([
            manpowerService.getWorkers().catch(() => [] as Worker[]),
            officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
        ])
            .then(([workerRows, staffRows]) => {
                if (!mounted) return;
                setWorkers(workerRows);
                setOfficeStaffRows(staffRows);
            })
            .catch((error) => {
                console.error(error);
                toast.error('청구대상 목록을 불러오지 못했습니다.');
            });
        return () => {
            mounted = false;
        };
    }, []);

    const loadTargetRecords = async () => {
        setTargetRecordsLoading(true);
        try {
            setTargetRecords(await cardService.listAllCardBillingTargets());
        } catch (error) {
            console.error(error);
            toast.error('카드 청구대상 기간을 불러오지 못했습니다.');
        } finally {
            setTargetRecordsLoading(false);
        }
    };

    useEffect(() => {
        loadTargetRecords();
    }, []);

    const cardsById = useMemo(() => {
        const map = new Map<string, Card>();
        cards.forEach((card) => map.set(String(card.id), card));
        return map;
    }, [cards]);

    const selectedCard = useMemo(() => {
        if (!selectedCardId) return null;
        return cardsById.get(String(selectedCardId)) ?? null;
    }, [cardsById, selectedCardId]);

    const selectedTargetRecords = useMemo(
        () => targetRecords.filter((record) => String(record.cardId) === String(selectedCardId)),
        [targetRecords, selectedCardId]
    );
    const latestSelectedTargetRecord = useMemo(
        () => getLatestTargetRecord(selectedTargetRecords),
        [selectedTargetRecords]
    );
    const targetRecordsByCardId = useMemo(() => {
        const map = new Map<string, CardBillingTargetRecord[]>();
        targetRecords.forEach((record) => {
            const key = normalizeKey(record.cardId);
            if (!key) return;
            const list = map.get(key) ?? [];
            list.push(record);
            map.set(key, list);
        });
        map.forEach((list) => {
            list.sort((a, b) => {
                const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
                if (startDiff !== 0) return startDiff;
                return String(b.id ?? '').localeCompare(String(a.id ?? ''));
            });
        });
        return map;
    }, [targetRecords]);
    const getCardTargetLabel = useCallback(
        (card: Card) => targetLabel(card, targetRecordsByCardId.get(normalizeKey(card.id)) ?? []),
        [targetRecordsByCardId]
    );

    const selectedCardHasExplicitBillingTarget = Boolean(
        (selectedCard?.billingTargetType && selectedCard?.billingTargetId) ||
        selectedTargetRecords.some((record) => !record.endDate || record.endDate >= getTodayDateText())
    );

    const explicitCardIds = useMemo(() => new Set(
        targetRecords
            .filter((record) => !record.endDate || record.endDate >= getTodayDateText())
            .map((record) => normalizeKey(record.cardId))
            .filter(Boolean)
    ), [targetRecords]);

    const explicitCards = useMemo(
        () => cards.filter((card) => Boolean(card.billingTargetType && card.billingTargetId) || explicitCardIds.has(normalizeKey(card.id))),
        [cards, explicitCardIds]
    );

    const followingCards = useMemo(
        () => cards.filter((card) => !card.billingTargetType && !explicitCardIds.has(normalizeKey(card.id))),
        [cards, explicitCardIds]
    );

    const selectableTeamIds = useMemo(() => new Set(
        selectableTeams
            .flatMap((team) => [team.id, team.legacyId])
            .map((value) => normalizeKey(value))
            .filter(Boolean)
    ), [selectableTeams]);

    const selectableTeamNames = useMemo(() => new Set(
        selectableTeams
            .map((team) => normalizeKey(team.name))
            .filter(Boolean)
    ), [selectableTeams]);

    const targetOptions = useMemo<BillingTargetSelection[]>(() => {
        const teamOptions: BillingTargetSelection[] = selectableTeams
            .filter((team) => Boolean(team.id && team.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((team) => ({
                type: 'TEAM',
                id: String(team.id),
                name: String(team.name),
                group: '청연이엔지 소속팀',
                detail: normalizeKey(team.companyName),
                color: normalizeHexColor(team.color)
            }));

        const workerOptions: BillingTargetSelection[] = workers
            .filter((worker) => {
                const teamId = normalizeKey(worker.teamId);
                const teamName = normalizeKey(worker.teamName);
                return (
                    selectableTeamIds.has(teamId) ||
                    selectableTeamNames.has(teamName) ||
                    includesCheongyeonKeyword(worker.companyName, worker.teamType, worker.teamName)
                );
            })
            .filter((worker) => Boolean(getWorkerTargetId(worker) && worker.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((worker) => ({
                type: 'WORKER',
                id: getWorkerTargetId(worker),
                name: String(worker.name),
                group: '작업자',
                detail: normalizeKey(worker.teamName) || normalizeKey(worker.companyName)
            }));

        const officeStaffOptions: BillingTargetSelection[] = officeStaffRows
            .filter((staff) => staff.isActive !== false)
            .filter((staff) => Boolean(getOfficeStaffTargetId(staff) && staff.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((staff) => ({
                type: 'OFFICE_STAFF',
                id: getOfficeStaffTargetId(staff),
                name: String(staff.name),
                group: '사무실직원',
                detail: normalizeKey(staff.department) || normalizeKey(staff.role)
            }));

        return [
            ...teamOptions,
            ...workerOptions,
            {
                type: 'OFFICE',
                id: OFFICE_TARGET_ID,
                name: OFFICE_TARGET_NAME,
                group: '사무실',
                detail: '사무실 공통 청구'
            },
            ...officeStaffOptions
        ];
    }, [officeStaffRows, selectableTeamIds, selectableTeamNames, selectableTeams, workers]);

    const targetOptionsByKey = useMemo(() => {
        const map = new Map<string, BillingTargetSelection>();
        targetOptions.forEach((target) => map.set(getTargetOptionKey(target.type, target.id), target));
        return map;
    }, [targetOptions]);

    useEffect(() => {
        if (selectedTargetKey || targetOptions.length === 0) return;
        setSelectedTargetKey(getTargetOptionKey(targetOptions[0].type, targetOptions[0].id));
    }, [selectedTargetKey, targetOptions]);

    const selectedTarget = useMemo<BillingTargetSelection | null>(
        () => targetOptionsByKey.get(selectedTargetKey) ?? null,
        [selectedTargetKey, targetOptionsByKey]
    );
    const selectedTargetTimelineItems = useMemo<BillingPeriodTimelineItem[]>(() => (
        selectedTargetRecords
            .slice()
            .sort((a, b) => {
                const startDiff = String(a.startDate ?? '').localeCompare(String(b.startDate ?? ''));
                if (startDiff !== 0) return startDiff;
                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            })
            .map((record) => {
                const option = targetOptionsByKey.get(getTargetOptionKey(record.targetType, record.targetId));
                return {
                    id: normalizeKey(record.id) || `${normalizeKey(record.cardId)}:${normalizeKey(record.startDate)}`,
                    label: normalizeKey(record.targetName) || '청구대상',
                    typeLabel: getBillingTargetTypeLabel(record.targetType),
                    startDate: record.startDate,
                    endDate: record.endDate,
                    color: option?.color
                };
            })
    ), [selectedTargetRecords, targetOptionsByKey]);
    const selectedTargetColor = selectedTarget?.color ? normalizeHexColor(selectedTarget.color) : '#64748b';
    const showTargetSelector = billingMode !== 'same';
    const showTargetDateFields = Boolean(selectedCard && (billingMode === 'split' || editingTargetRecordId));
    const canUseSameMode = Boolean(selectedCard && (
        selectedCard.currentAssigneeName ||
        selectedCardHasExplicitBillingTarget
    ));
    const canSaveBilling = Boolean(selectedCard) && (
        billingMode === 'same' ? canUseSameMode : Boolean(selectedTarget)
    );
    const saveButtonLabel = saving
        ? '처리 중...'
        : billingMode === 'same'
            ? (selectedCard?.currentAssigneeName ? '배정자에게 청구 저장' : '별도청구 해제')
                : editingTargetRecordId
                    ? '청구기간 수정'
                : billingMode === 'split' && selectedTargetRecords.length > 0
                    ? '월중 변경 저장'
                    : '청구대상 저장';

    const clearCardBillingTargetSnapshot = async (cardId: string) => {
        await cardService.updateCard(cardId, {
            billingTargetId: deleteField(),
            billingTargetType: deleteField(),
            billingTargetName: deleteField(),
            billingTargetStartDate: deleteField(),
            billingTargetEndDate: deleteField()
        } as unknown as Partial<Card>);
    };

    const setCardBillingTargetSnapshot = async (cardId: string, record: Pick<CardBillingTargetRecord, 'targetId' | 'targetType' | 'targetName' | 'startDate' | 'endDate'>) => {
        await cardService.updateCard(cardId, {
            billingTargetId: record.targetId,
            billingTargetType: record.targetType,
            billingTargetName: record.targetName,
            billingTargetStartDate: record.startDate,
            billingTargetEndDate: record.endDate || null
        } as unknown as Partial<Card>);
    };

    const buildTargetRecord = (
        card: Card,
        target: BillingTargetSelection,
        startDate: string,
        endDate: string,
        id?: string
    ): Omit<CardBillingTargetRecord, 'createdAt' | 'updatedAt'> => ({
        id: id || makeBillingTargetId(card.id, target.id, startDate),
        cardId: card.id,
        cardLabel: `${card.name} (${card.last4})`,
        targetId: target.id,
        targetType: target.type,
        targetName: target.name,
        startDate,
        endDate: endDate || undefined
    });

    const buildCurrentAssigneeTargetRecord = (
        card: Card,
        startDate: string,
        endDate: string
    ): Omit<CardBillingTargetRecord, 'createdAt' | 'updatedAt'> | null => {
        const targetId = normalizeKey(card.currentAssigneeId) || normalizeKey(card.currentAssigneeName);
        if (!targetId || !card.currentAssigneeName || !card.currentAssigneeType) return null;

        return {
            id: makeBillingTargetId(card.id, targetId, startDate),
            cardId: card.id,
            cardLabel: `${card.name} (${card.last4})`,
            targetId,
            targetType: card.currentAssigneeType as CardBillingTargetType,
            targetName: card.currentAssigneeName,
            startDate,
            endDate,
            note: '분할 전 기본 사용자'
        };
    };

    const applySameBillingTarget = async (card: Card, effectiveDate: string = DEFAULT_BILLING_START_DATE) => {
        const records = await cardService.listAllCardBillingTargets(card.id);
        const previousEndDate = buildEndDateAsDayBefore(effectiveDate);
        const deleteIds = records
            .filter((record) => normalizeKey(record.startDate) >= effectiveDate)
            .map((record) => record.id)
            .filter(Boolean);
        const closeRecords = records
            .filter((record) => {
                const startDate = normalizeKey(record.startDate);
                if (!startDate || startDate >= effectiveDate) return false;
                const endDate = normalizeKey(record.endDate);
                return !endDate || endDate >= effectiveDate;
            })
            .map((record) => ({ id: record.id, endDate: previousEndDate }))
            .filter((record) => Boolean(record.id && record.endDate));

        await cardService.applyCardBillingTargetChanges({
            cardId: card.id,
            closeRecords,
            deleteIds,
            clearSnapshot: true
        });
    };

    const saveBillingTarget = async (
        card: Card,
        target: BillingTargetSelection | null,
        startDate: string = targetStartDate,
        endDate: string = targetEndDate
    ) => {
        setSaving(true);
        try {
            if (!target) {
                await applySameBillingTarget(card);
                setEditingTargetRecordId(null);
                toast.success(card.currentAssigneeName ? '기준일 이후 카드 청구를 기본 청구로 변경했습니다.' : '기준일 이후 별도청구를 해제했습니다.');
            } else {
                const latestRecord = latestSelectedTargetRecord;
                const shouldCreateSplitRecord = Boolean(billingMode === 'split' && !editingTargetRecordId && latestRecord);
                const targetRecordId = editingTargetRecordId ?? (billingMode !== 'split' ? latestRecord?.id : undefined);
                const upserts: Array<Omit<CardBillingTargetRecord, 'createdAt' | 'updatedAt'>> = [];
                const closeRecords: Array<{ id: string; endDate: string }> = [];

                if (shouldCreateSplitRecord && latestRecord) {
                    const previousEndDate = buildEndDateAsDayBefore(startDate);
                    if (previousEndDate && (!latestRecord.endDate || latestRecord.endDate >= startDate)) {
                        closeRecords.push({ id: latestRecord.id, endDate: previousEndDate });
                    }
                } else if (billingMode === 'split' && !editingTargetRecordId && !latestRecord) {
                    const previousEndDate = buildEndDateAsDayBefore(startDate);
                    const defaultRecord = buildCurrentAssigneeTargetRecord(card, DEFAULT_BILLING_START_DATE, previousEndDate);
                    if (!defaultRecord) {
                        throw new Error('분할 전 기본 사용자가 없어 분할청구를 만들 수 없습니다.');
                    }
                    upserts.push(defaultRecord);
                }

                const nextTargetRecord = buildTargetRecord(card, target, startDate, endDate, targetRecordId);
                upserts.push(nextTargetRecord);
                await cardService.applyCardBillingTargetChanges({
                    cardId: card.id,
                    closeRecords,
                    upserts,
                    clearSnapshot: true
                });
                await setCardBillingTargetSnapshot(card.id, nextTargetRecord);
                toast.success(editingTargetRecordId ? '카드 청구대상 기간이 수정되었습니다.' : '카드 청구대상 기간이 추가되었습니다.');
                setEditingTargetRecordId(null);
            }
            await loadTargetRecords();
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedCard) {
            toast.error('카드를 선택해주세요.');
            return;
        }
        if (billingMode === 'same') {
            if (!canUseSameMode) {
                toast.error('사용자 배정 또는 별도 청구대상이 있어야 기본 청구로 변경할 수 있습니다.');
                return;
            }
            const result = await showConfirmAlert(
                '카드 청구',
                selectedCard.currentAssigneeName
                    ? `${selectedCard.name} 카드의 26-01-01 이후 별도 청구를 종료하고 기본 청구로 변경할까요?`
                    : `${selectedCard.name} 카드의 26-01-01 이후 별도 청구대상 설정을 해제할까요?`
            );
            if (!result.isConfirmed) return;

            try {
                await saveBillingTarget(selectedCard, null);
            } catch (error) {
                console.error(error);
                toast.error('카드 청구 처리에 실패했습니다.');
            }
            return;
        }
        if (!selectedTarget) {
            toast.error('청구대상을 선택해주세요.');
            return;
        }
        if (showTargetDateFields && !targetStartDate) {
            toast.error('기간 시작일을 입력해주세요.');
            return;
        }
        const normalizedStartDate = normalizeTypedDateInput(targetStartDate) ?? DEFAULT_BILLING_START_DATE;
        if (!normalizedStartDate) {
            toast.error('기간 시작일을 올바른 날짜로 입력해주세요.');
            return;
        }
        let normalizedEndDate = '';
        if (targetEndDate) {
            const parsedEndDate = normalizeTypedDateInput(targetEndDate);
            if (!parsedEndDate) {
                toast.error('기간 종료일을 올바른 날짜로 입력해주세요.');
                return;
            }
            normalizedEndDate = parsedEndDate;
        }
        setTargetStartDate(toShortYearDateInputValue(normalizedStartDate));
        setTargetEndDate(toShortYearDateInputValue(normalizedEndDate));

        if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
            toast.error('청구 종료일은 시작일보다 빠를 수 없습니다.');
            return;
        }
        const latestRecord = latestSelectedTargetRecord;
        if (billingMode === 'split' && latestRecord && !editingTargetRecordId && normalizedStartDate <= latestRecord.startDate) {
            toast.error(`기간 시작일은 기존 최신 청구 시작일(${displayDate(latestRecord.startDate)})보다 뒤여야 합니다.`);
            return;
        }
        if (billingMode === 'split' && !latestRecord && !editingTargetRecordId && normalizedStartDate <= DEFAULT_BILLING_START_DATE) {
            toast.error('기간 시작일은 기본 청구 시작일(26-01-01)보다 뒤여야 합니다.');
            return;
        }

        const result = await showConfirmAlert(
            '카드 청구',
            showTargetDateFields
                ? `${selectedCard.name} 카드를 ${displayDate(normalizedStartDate)}~${displayDate(normalizedEndDate) || '계속'} 기간 동안 ${getBillingTargetTypeLabel(selectedTarget.type)} · ${selectedTarget.name}에 청구할까요?`
                : `${selectedCard.name} 카드의 기본 청구대상을 ${getBillingTargetTypeLabel(selectedTarget.type)} · ${selectedTarget.name}(으)로 저장할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(selectedCard, selectedTarget, normalizedStartDate, normalizedEndDate);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '카드 청구 처리에 실패했습니다.');
        }
    };

    const handleReset = async (card: Card) => {
        const result = await showConfirmAlert(
            '카드 기본 청구',
            card.currentAssigneeName
                ? `${card.name} 카드 청구를 기본 청구로 변경할까요?`
                : `${card.name} 카드의 별도 청구대상 설정을 삭제할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(card, null);
        } catch (error) {
            console.error(error);
            toast.error('카드 기본 청구 처리에 실패했습니다.');
        }
    };

    const handleDeleteTargetRecord = async (record: CardBillingTargetRecord) => {
        const result = await showConfirmAlert(
            '청구기간 삭제',
            `${record.cardLabel} ${displayDate(record.startDate)}~${displayDate(record.endDate) || '계속'} 청구기간을 삭제할까요?`
        );
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await cardService.deleteCardBillingTarget(record.id);
            const card = cardsById.get(String(record.cardId));
            if (card) {
                const remainingRecords = (targetRecordsByCardId.get(normalizeKey(card.id)) ?? [])
                    .filter((item) => normalizeKey(item.id) !== normalizeKey(record.id));
                const nextRecord = getLatestTargetRecord(remainingRecords);
                if (nextRecord) {
                    await setCardBillingTargetSnapshot(card.id, nextRecord);
                } else {
                    await clearCardBillingTargetSnapshot(card.id);
                }
            }
            await loadTargetRecords();
            onRefresh();
            if (editingTargetRecordId === record.id) {
                setEditingTargetRecordId(null);
            }
            toast.success('청구기간이 삭제되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('청구기간 삭제에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const pickCard = (card: Card) => {
        setSelectedCardId(card.id);
        const latestRecord = getLatestTargetRecord(targetRecordsByCardId.get(normalizeKey(card.id)) ?? []);
        const hasExplicitTarget = Boolean(latestRecord || (card.billingTargetType && card.billingTargetId));
        const nextBillingMode: BillingMode = initialSplitMode ? 'split' : (hasExplicitTarget ? 'custom' : 'same');
        setBillingMode(nextBillingMode);
        setTargetStartDate(nextBillingMode === 'custom' && latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
        setTargetEndDate('');
        setEditingTargetRecordId(null);
        const targetKey = latestRecord
            ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
            : getTargetOptionKey(card.billingTargetType, card.billingTargetId);
        if (targetKey) setSelectedTargetKey(targetKey);
    };

    const handleEditTargetRecord = (record: CardBillingTargetRecord) => {
        setSelectedCardId(record.cardId);
        setBillingMode('custom');
        setEditingTargetRecordId(record.id);
        setSelectedTargetKey(getTargetOptionKey(record.targetType, record.targetId));
        setTargetStartDate(displayDate(record.startDate) || getDefaultBillingStartDate());
        setTargetEndDate(displayDate(record.endDate));
    };

    const handleCancelEditTargetRecord = () => {
        setEditingTargetRecordId(null);
        if (selectedCard) {
            const latestRecord = getLatestTargetRecord(targetRecordsByCardId.get(normalizeKey(selectedCard.id)) ?? []);
            setTargetStartDate(!initialSplitMode && latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
            setTargetEndDate('');
            const targetKey = latestRecord
                ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
                : getTargetOptionKey(selectedCard.billingTargetType, selectedCard.billingTargetId);
            if (targetKey) setSelectedTargetKey(targetKey);
        }
    };

    const handleBillingModeChange = (mode: BillingMode) => {
        setBillingMode(mode);
        setEditingTargetRecordId(null);
        setTargetEndDate('');

        if (mode === 'split') {
            setTargetStartDate(getDefaultBillingStartDate());
            return;
        }

        if (mode === 'custom' && selectedCard) {
            const latestRecord = getLatestTargetRecord(targetRecordsByCardId.get(normalizeKey(selectedCard.id)) ?? []);
            setTargetStartDate(latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
            setTargetEndDate(displayDate(latestRecord?.endDate));
            const targetKey = latestRecord
                ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
                : getTargetOptionKey(selectedCard.billingTargetType, selectedCard.billingTargetId);
            if (targetKey) setSelectedTargetKey(targetKey);
            return;
        }

        setTargetStartDate(getDefaultBillingStartDate());
    };

    const pickCardById = (cardId: string) => {
        const card = cardsById.get(String(cardId));
        if (card) {
            pickCard(card);
            return;
        }
        setSelectedCardId(cardId);
    };

    useEffect(() => {
        if (!initialCardId) return;
        pickCardById(String(initialCardId));
    }, [initialCardId, cardsById, initialSplitMode, targetRecordsByCardId]);

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-emerald-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-sm" />
                            </span>
                            카드 청구 방식
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">
                            카드 사용자에게 청구할지, 다른 팀/사람에게 청구할지만 먼저 선택합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleAssign}
                            disabled={saving || !canSaveBilling}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 ${
                                saving || !canSaveBilling
                                    ? 'bg-emerald-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'
                            }`}
                        >
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            {saveButtonLabel}
                        </button>
                        {editingTargetRecordId && (
                            <button
                                type="button"
                                onClick={handleCancelEditTargetRecord}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 disabled:text-slate-400 transition-all flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                                수정 취소
                            </button>
                        )}
                        <button
                            onClick={() => selectedCard && handleReset(selectedCard)}
                            disabled={saving || !selectedCardHasExplicitBillingTarget || !selectedCard}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-100 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faBan} />
                            {selectedCard?.currentAssigneeName ? '배정자에게 청구' : '별도청구 해제'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 space-y-3">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                            {!initialCardId && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">카드 선택</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={selectedCardId}
                                        onChange={(event) => pickCardById(event.target.value)}
                                    >
                                        <option value="">카드를 선택하세요</option>
                                        {cards
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((card) => (
                                                <option key={card.id} value={card.id}>
                                                    {card.name} ({card.last4}) · {getCardTargetLabel(card)}
                                                </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {selectedCard && (
                                <BillingStatusSummary
                                    items={[
                                        {
                                            label: '현재 사용자',
                                            value: selectedCard.currentAssigneeName || '미배정',
                                            tone: 'slate'
                                        },
                                        {
                                            label: '현재 청구대상',
                                            value: getCardTargetLabel(selectedCard),
                                            tone: selectedCardHasExplicitBillingTarget ? 'indigo' : 'emerald'
                                        },
                                        {
                                            label: '청구 시작일',
                                            value: displayDate(latestSelectedTargetRecord?.startDate) || '26-01-01',
                                            tone: 'amber'
                                        }
                                    ]}
                                />
                            )}

                            <BillingModeSelector
                                value={billingMode}
                                onChange={handleBillingModeChange}
                                sameLabel={selectedCard?.currentAssigneeName ? '배정자에게 청구' : '별도청구 해제'}
                                sameDescription={selectedCard?.currentAssigneeName ? '카드 사용자와 같은 대상에게 비용 청구' : '26-01-01 이후 별도청구 해제'}
                                customLabel="다른 대상에게 청구"
                                customDescription="사용자와 다른 팀/사람에게 비용 청구"
                                disabled={!selectedCard}
                                sameDisabled={!canUseSameMode}
                            />

                            {showTargetSelector && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구대상 선택</label>
                                    {selectedTarget?.color && (
                                        <span
                                            className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: selectedTargetColor }}
                                        />
                                    )}
                                    <select
                                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 ${
                                            selectedTarget?.color ? 'pl-8 pr-3' : 'px-3'
                                        }`}
                                        value={selectedTargetKey}
                                        onChange={(event) => setSelectedTargetKey(event.target.value)}
                                        style={
                                            selectedTarget?.color
                                                ? {
                                                    borderColor: hexToRgba(selectedTargetColor, 0.35),
                                                    backgroundColor: hexToRgba(selectedTargetColor, 0.05),
                                                    color: selectedTargetColor
                                                }
                                                : undefined
                                        }
                                    >
                                        <option value="">청구대상을 선택하세요</option>
                                        {TARGET_GROUPS.map((group) => {
                                            const groupOptions = targetOptions.filter((target) => target.group === group);
                                            if (groupOptions.length === 0) return null;
                                            return (
                                                <optgroup key={group} label={group}>
                                                    {groupOptions.map((target) => (
                                                        <option
                                                            key={getTargetOptionKey(target.type, target.id)}
                                                            value={getTargetOptionKey(target.type, target.id)}
                                                            style={target.color ? { color: normalizeHexColor(target.color) } : undefined}
                                                        >
                                                            {target.name}{target.detail ? ` · ${target.detail}` : ''}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                    {selectedTarget && (
                                        <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                            {selectedTarget.group} · {getBillingTargetTypeLabel(selectedTarget.type)}
                                            {selectedTarget.detail ? ` · ${selectedTarget.detail}` : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {showTargetSelector && (
                                <details
                                    open={billingMode === 'split' || Boolean(editingTargetRecordId)}
                                    className="rounded-xl border border-slate-200 bg-white"
                                >
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                                        <span className="min-w-0">
                                            <span className="block text-sm font-extrabold text-slate-700">고급 설정</span>
                                            <span className="mt-0.5 block text-xs font-semibold text-slate-400">월중 변경이나 특정 기간 청구가 필요할 때만 사용합니다.</span>
                                        </span>
                                        <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                            billingMode === 'split' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {billingMode === 'split' ? '월중 변경' : '일반'}
                                        </span>
                                    </summary>
                                    <div className="space-y-3 border-t border-slate-100 p-3">
                                        {!editingTargetRecordId && (
                                            <button
                                                type="button"
                                                onClick={() => handleBillingModeChange(billingMode === 'split' ? 'custom' : 'split')}
                                                disabled={!selectedCard}
                                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                                    billingMode === 'split'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-200 hover:bg-amber-50/60'
                                                } ${!selectedCard ? 'cursor-not-allowed opacity-50' : ''}`}
                                            >
                                                <span>
                                                    <span className="block text-sm font-extrabold">월중 변경/분할 청구</span>
                                                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">한 달 안에 청구대상이 바뀌는 경우만 켭니다.</span>
                                                </span>
                                                <span className="text-xs font-extrabold">{billingMode === 'split' ? '사용 중' : '꺼짐'}</span>
                                            </button>
                                        )}

                                        {showTargetDateFields && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        {billingMode === 'split' ? '기간 시작일' : '청구 시작일'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={10}
                                                        placeholder="YY-MM-DD"
                                                        value={targetStartDate}
                                                        onChange={(event) => handleTargetStartDateChange(event.target.value)}
                                                        onBlur={normalizeTargetStartDate}
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        {billingMode === 'split' ? '기간 종료일' : '청구 종료일'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={10}
                                                        placeholder="선택"
                                                        value={targetEndDate}
                                                        onChange={(event) => handleTargetEndDateChange(event.target.value)}
                                                        onBlur={normalizeTargetEndDate}
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 text-[11px] font-semibold text-slate-400">
                                                    기본 청구 시작일은 26-01-01입니다. 월중 변경은 필요한 달만 거래일 기준으로 나눕니다.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>

                        {selectedCard && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-500 font-bold">선택 카드</div>
                                    <div className="text-lg font-extrabold text-slate-900 truncate">{selectedCard.name} ({selectedCard.last4})</div>
                                    <div className="text-sm text-slate-500 font-medium mt-1">{getCardTargetLabel(selectedCard)}</div>
                                </div>
                            </div>
                        )}

                        {selectedCard && (
                            <details open={Boolean(editingTargetRecordId)} className="group bg-white rounded-2xl border border-slate-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                    <span className="min-w-0">
                                        <span className="block font-extrabold text-slate-800">청구기간 타임라인</span>
                                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                                            변경일 기준으로 이전 대상이 닫히고 다음 대상이 이어집니다.
                                        </span>
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                                        {selectedTargetRecords.length}건
                                    </span>
                                </summary>
                                <div className="border-t border-slate-100 p-4">
                                {targetRecordsLoading ? (
                                    <div className="text-sm text-slate-400">불러오는 중...</div>
                                ) : selectedTargetRecords.length === 0 ? (
                                    <div className="text-sm text-slate-400">등록된 청구기간이 없습니다.</div>
                                ) : (
                                    <div className="space-y-3">
                                        <BillingPeriodTimeline items={selectedTargetTimelineItems} />
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                        {selectedTargetRecords
                                            .slice()
                                            .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
                                            .map((record) => (
                                                <div key={record.id} className="rounded-xl border border-slate-100 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-extrabold text-slate-800 truncate">{record.targetName}</div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {getBillingTargetTypeLabel(record.targetType)} · {displayDate(record.startDate)} ~ {displayDate(record.endDate) || '계속'}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditTargetRecord(record)}
                                                                disabled={saving}
                                                                className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:text-slate-300"
                                                                title="청구기간 수정"
                                                            >
                                                                <FontAwesomeIcon icon={faPen} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTargetRecord(record)}
                                                                disabled={saving}
                                                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:text-slate-300"
                                                                title="청구기간 삭제"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                </div>
                            </details>
                        )}
                    </div>

                    <div className="hidden">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">미청구 카드</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {followingCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">미청구 카드가 없습니다.</div>
                                ) : (
                                    followingCards.map((card) => (
                                        <button
                                            key={card.id}
                                            onClick={() => pickCard(card)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-extrabold text-slate-800 truncate">{card.name} ({card.last4})</div>
                                                <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">미청구</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{getCardTargetLabel(card)}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">청구 카드</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {explicitCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">청구 설정된 카드가 없습니다.</div>
                                ) : (
                                    explicitCards.map((card) => (
                                        <div
                                            key={card.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button onClick={() => pickCard(card)} className="min-w-0 text-left">
                                                    <div className="font-extrabold text-slate-800 truncate">{card.name} ({card.last4})</div>
                                                    <div className="text-xs text-slate-500 mt-1">{getCardTargetLabel(card)}</div>
                                                </button>
                                                <button
                                                    onClick={() => handleReset(card)}
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} />
                                                    {card.currentAssigneeName ? '기본 청구' : '별도청구 해제'}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                카드 사용자는 그대로 두고 사용금액 전체를 선택한 청구대상에 청구할 때 사용합니다. 한 달 안에 청구대상을 둘 이상 등록한 달만 거래일 기준으로 나뉘고, 다른 달은 최신 청구대상 1곳에 청구됩니다.
            </div>
        </div>
    );
};
