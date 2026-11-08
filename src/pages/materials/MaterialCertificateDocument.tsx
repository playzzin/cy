import React, { useEffect, useMemo, useState } from 'react';
import type { SelectedMaterial } from './MaterialSelectionActionBar';
import MaterialCertificateHeading from './MaterialCertificateHeading';
import {
    CERTIFICATE_COLUMN_LABELS, CERTIFICATE_META_LABEL_WIDTH,
    createCertificateTextMeasure, getMaterialCertificateLayout, MaterialCertificateField,
} from './materialCertificateLayout';

export const certificateSize = (value: number) => `calc(${value} * 100cqw / 1240)`;

const MaterialCertificateDocument: React.FC<{
    kind: 'inbound' | 'outbound';
    items: SelectedMaterial[];
    details: MaterialCertificateField[];
}> = ({ kind, items, details }) => {
    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
        let active = true;
        void document.fonts?.ready.then(() => { if (active) setFontsReady(true); });
        return () => { active = false; };
    }, []);
    const layout = useMemo(() => getMaterialCertificateLayout(items, details, createCertificateTextMeasure()), [items, details, fontsReady]);
    return <div id={`${kind}-certificate-print`} className="material-certificate-pages">
        {layout.pages.map((page, pageIndex) => <section className="material-certificate-paper" key={pageIndex} aria-label={`${pageIndex + 1}페이지 증명서`}>
            <div className="material-certificate-frame">
                <MaterialCertificateHeading kind={kind} />
                <dl className="material-certificate-details">
                    {layout.metadata.map((row, index) => <div className="material-certificate-details__row" key={index} style={{ height: certificateSize(row.height) }}>
                        {row.cells.map(field => <div key={field.label} className={field.wide ? 'material-certificate-details__wide' : ''}>
                            <dt style={{ width: certificateSize(CERTIFICATE_META_LABEL_WIDTH) }}>{field.label}</dt>
                            <dd>{field.lines.map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}</dd>
                        </div>)}
                    </div>)}
                </dl>
                {page.tables.map((table, tableIndex) => <div className="material-certificate-table" key={tableIndex}
                    style={{ top: certificateSize(layout.tableTop), left: certificateSize(60 + table.offset), width: certificateSize(table.width), fontSize: certificateSize(page.fontSize), lineHeight: certificateSize(page.lineHeight) }}>
                    <table aria-label={`${tableIndex + 1}번째 품목표`}>
                        <colgroup>{table.columns.map((width, index) => <col key={index} style={{ width: `${width / table.width * 100}%` }} />)}</colgroup>
                        <thead><tr>{CERTIFICATE_COLUMN_LABELS.map(label => <th key={label} style={{ fontSize: certificateSize(page.tables.length > 1 ? 18 : 20) }}>{label}</th>)}</tr></thead>
                        <tbody>{table.rows.map((row, index) => <tr key={index} style={{ height: certificateSize(row.height) }}>
                            {row.cells.map((lines, column) => <td key={column}>{lines.map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}</td>)}
                        </tr>)}</tbody>
                    </table>
                </div>)}
                <div className="material-certificate-confirmation">위 자재를 {kind === 'inbound' ? '입고' : '반출'}함.</div>
                <div className="material-certificate-signatures"><div>{kind === 'inbound' ? '입고' : '인수자'} 확인</div><div>담당자 확인</div></div>
                {layout.pages.length > 1 && <div className="material-certificate-page-number">{pageIndex + 1} / {layout.pages.length}</div>}
            </div>
        </section>)}
    </div>;
};

export default MaterialCertificateDocument;
