import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoice, faImages } from '@fortawesome/free-solid-svg-icons';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import { getMaterialPhotoDisplayCount, hasMaterialPhotoReference } from './MaterialPhotoViewerModal';
import { getTransactionCertificateGroupKey } from './materialTransactionCertificate';
import './MaterialTransactionEvidence.css';

interface Props {
    label: string;
    rows: MaterialTransactionRow[];
    sourceRows: MaterialTransactionRow[];
    rentalCompanies: MaterialRentalCompanyOption[];
    onCertificate: (row: MaterialTransactionRow) => void;
}

export const MaterialTransactionPhotoButton: React.FC<{
    row: MaterialTransactionRow; onPhotos: (row: MaterialTransactionRow) => void;
}> = ({ row, onPhotos }) => {
    if (!hasMaterialPhotoReference(row)) return null;
    const count = getMaterialPhotoDisplayCount(row);
    return <div className="material-transaction-evidence"><button type="button" onClick={() => onPhotos(row)} title="첨부사진 보기">
        <FontAwesomeIcon icon={faImages} /> 사진 보기{count !== null && <small aria-hidden="true">{count}장</small>}
    </button></div>;
};

const MaterialTransactionEvidence: React.FC<Props> = ({ label, rows, sourceRows, rentalCompanies, onCertificate }) => {
    const groups = useMemo(() => {
        const keys = new Set(rows.map(row => getTransactionCertificateGroupKey(row, rentalCompanies)));
        const result = new Map<string, MaterialTransactionRow[]>();
        // Keep the complete document's notes even when a material filter hides
        // some of its rows. Unrelated sites, dates, rentals and vehicles stay out.
        sourceRows.forEach(row => {
            const key = getTransactionCertificateGroupKey(row, rentalCompanies);
            if (!keys.has(key)) return;
            const group = result.get(key) || [];
            group.push(row);
            result.set(key, group);
        });
        return Array.from(result, ([key, transactions]) => ({ key, transactions }));
    }, [rows, sourceRows, rentalCompanies]);

    return <section className="material-transaction-documents" aria-label={`${label} 증빙 및 비고`}>
        <p className="material-transaction-documents__title">증빙 및 비고 <small>임대사·차량별</small></p>
        {groups.map(({ key, transactions }) => {
            const row = transactions[0];
            const notes = Array.from(new Set(transactions.map(transaction => (transaction.notes || '').replace(/\r\n/g, '\n').trim()).filter(Boolean)));
            const rentalName = rentalCompanies.find(company => company.id === row.rentalCompanyId)?.name || row.rentalCompanyName?.trim() || '임대사 미지정';
            return <div className="material-transaction-documents__group" key={key} role="group"
                aria-label={`${row.type === 'inbound' ? '입고' : '출고'} ${rentalName} ${row.vehicleNumber?.trim() || '차량 미지정'} 증빙 및 비고`}>
                <div className="material-transaction-documents__heading">
                    <span className="material-transaction-documents__kind" data-type={row.type}>{row.type === 'inbound' ? '입고' : '출고'}</span>
                    <span className="material-transaction-documents__party">{rentalName} · {row.vehicleNumber?.trim() || '차량 미지정'}</span>
                    <div className="material-transaction-evidence"><button type="button" onClick={() => onCertificate(row)}
                        title="같은 날짜·현장·임대사·차량의 전체 품목으로 보기">
                        <FontAwesomeIcon icon={faFileInvoice} /> {row.type === 'inbound' ? '입고증 보기' : '반출증 보기'}
                    </button></div>
                </div>
                <div className="material-transaction-documents__notes"><strong>비고</strong>
                    {notes.length ? <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul> : <span className="material-transaction-documents__empty">등록된 비고가 없습니다.</span>}
                </div>
            </div>;
        })}
    </section>;
};

export default MaterialTransactionEvidence;
