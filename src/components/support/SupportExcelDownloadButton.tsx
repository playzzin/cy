import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel } from '@fortawesome/free-solid-svg-icons';

export const SupportExcelDownloadButton: React.FC<{
    disabled?: boolean;
    hasUnsavedChanges?: boolean;
    container?: HTMLElement | null;
    compact?: boolean;
    onDownload: () => Promise<void>;
}> = ({ disabled, hasUnsavedChanges, container, compact = false, onDownload }) => {
    const [exporting, setExporting] = useState(false);
    const inFlight = useRef(false);
    const handleDownload = async () => {
        if (disabled || inFlight.current) return;
        inFlight.current = true;
        setExporting(true);
        try {
            await onDownload();
        } catch (error) {
            console.error('Failed to export support workbook', error);
            window.alert('엑셀 다운로드에 실패했습니다. 다시 시도해 주세요.');
        } finally {
            inFlight.current = false;
            setExporting(false);
        }
    };
    const button = <button type="button" onClick={handleDownload} disabled={disabled || exporting}
        title={hasUnsavedChanges ? '미저장 변경사항을 포함한 현재 조회 목록을 다운로드합니다.' : '현재 조회 목록을 다운로드합니다.'}
        className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-4 ${compact ? 'py-2' : 'py-2.5'} text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50`}>
        <FontAwesomeIcon icon={faFileExcel} />
        {exporting ? '엑셀 생성 중...' : '엑셀 다운로드'}
    </button>;
    return container === undefined ? button : container ? createPortal(button, container) : null;
};
