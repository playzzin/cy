import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Material } from '../../types/materials';
import { getMaterialGroupKey, MaterialGroupKey, sortMaterialDisplayRows } from '../../utils/materialOrdering';

export type SelectedMaterial = Material & { quantity: number };

type MaterialSelectionActionBarProps = {
    materials: SelectedMaterial[];
    tone: 'blue' | 'red';
    title: string;
    details?: Array<{ label: string; value?: string }>;
};

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');

const GROUP_LABELS: Record<MaterialGroupKey, string> = {
    scaffolding: '시스템 비계',
    dongbari: '시스템 동바리',
    other: '기타 및 소모품',
};

const GROUP_ORDER: MaterialGroupKey[] = ['scaffolding', 'dongbari', 'other'];

const TONE_STYLES = {
    blue: {
        primaryButton: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100',
        secondaryButton: 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50',
        message: 'border-blue-100 bg-blue-50 text-blue-700 shadow-blue-100',
    },
    red: {
        primaryButton: 'bg-red-600 text-white hover:bg-red-700 shadow-red-100',
        secondaryButton: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
        message: 'border-red-100 bg-red-50 text-red-700 shadow-red-100',
    },
};

const formatNumber = (value: number) => NUMBER_FORMATTER.format(value);

const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
        throw new Error('Clipboard copy failed');
    }
};

const MaterialSelectionActionBar: React.FC<MaterialSelectionActionBarProps> = ({
    materials,
    tone,
    title,
    details = [],
}) => {
    const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
    const [actionMessage, setActionMessage] = useState('');
    const styles = TONE_STYLES[tone];
    const sortedMaterials = useMemo(() => sortMaterialDisplayRows(materials), [materials]);
    const totalQuantity = sortedMaterials.reduce((sum, material) => sum + material.quantity, 0);
    const disabled = sortedMaterials.length === 0 || busyAction !== null;
    const groupedMaterials = useMemo(() => GROUP_ORDER.map((groupKey) => {
        const rows = sortedMaterials.filter((material) => getMaterialGroupKey(material) === groupKey);

        return {
            title: GROUP_LABELS[groupKey],
            rows,
        };
    }).filter((group) => group.rows.length > 0), [sortedMaterials]);
    const shareText = useMemo(() => {
        const lines = [title];
        const detailLines = details
            .map((detail) => ({ ...detail, value: detail.value?.trim() }))
            .filter((detail) => detail.value)
            .map((detail) => `${detail.label}: ${detail.value}`);

        if (detailLines.length > 0) {
            lines.push(...detailLines);
        }

        lines.push('');
        groupedMaterials.forEach((group) => {
            lines.push(`[${group.title}]`);
            group.rows.forEach((material, index) => {
                lines.push(`${index + 1}. ${material.itemName} / ${material.spec || '-'} / ${formatNumber(material.quantity)} ${material.unit}`);
            });
            lines.push('');
        });
        lines.push(`합계: ${formatNumber(sortedMaterials.length)}개 품목 / 총 ${formatNumber(totalQuantity)}`);

        return lines.join('\n').trim();
    }, [details, groupedMaterials, sortedMaterials.length, title, totalQuantity]);
    const showActionMessage = (message: string) => {
        setActionMessage(message);
        window.setTimeout(() => setActionMessage(''), 2400);
    };
    const handleCopy = async () => {
        setBusyAction('copy');
        try {
            await copyTextToClipboard(shareText);
            showActionMessage('복사되었습니다.');
        } catch (error) {
            console.error('Material selection copy failed:', error);
            showActionMessage('복사하지 못했습니다.');
        } finally {
            setBusyAction(null);
        }
    };
    const handleSend = async () => {
        setBusyAction('send');
        try {
            if (navigator.share) {
                await navigator.share({ title, text: shareText });
                showActionMessage('보내기를 열었습니다.');
            } else {
                await copyTextToClipboard(shareText);
                showActionMessage('보내기 미지원: 목록을 복사했습니다.');
            }
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                console.error('Material selection share failed:', error);
                try {
                    await copyTextToClipboard(shareText);
                    showActionMessage('보내기 실패: 목록을 복사했습니다.');
                } catch {
                    showActionMessage('보내지 못했습니다.');
                }
            }
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleCopy}
                disabled={disabled}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${styles.secondaryButton}`}
            >
                <FontAwesomeIcon icon={busyAction === 'copy' ? faSpinner : faCopy} spin={busyAction === 'copy'} />
                복사
            </button>
            <button
                type="button"
                onClick={handleSend}
                disabled={disabled}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold shadow-md transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${styles.primaryButton}`}
            >
                <FontAwesomeIcon icon={busyAction === 'send' ? faSpinner : faPaperPlane} spin={busyAction === 'send'} />
                보내기
            </button>
            {actionMessage && (
                <div className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-sm font-bold shadow-lg ${styles.message}`} role="status">
                    {actionMessage}
                </div>
            )}
        </>
    );
};

export default MaterialSelectionActionBar;
