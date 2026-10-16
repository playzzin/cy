import React from 'react';

export const ErpPanel = ({ x, y, width, height, title, children }: { x: number; y: number; width: number; height: number; title?: string; children?: React.ReactNode }) => <g transform={`translate(${x} ${y})`}>
    <rect width={width} height={height} rx="16" fill="#0c263ce8" stroke="#3c6987" />
    {title && <><text x="21" y="34" fill="#d9eefb" fontSize="20" fontWeight="700">{title}</text><path d={`M20 52H${width - 20}`} stroke="#30526c" /></>}{children}
</g>;

export const ErpCheck = ({ x, y, className }: { x: number; y: number; className?: string }) => <g transform={`translate(${x} ${y})`}><g className={className}><circle r="13" fill="#174440" stroke="#95dfc9" /><path d="m-6 0 4 5 9-10" stroke="#bcf8e0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g></g>;

export const ErpResult = ({ text, x = 480, y = 465 }: { text: string; x?: number; y?: number }) => <g className="cy-erp-phase-3" transform={`translate(${x} ${y})`}><rect x="-175" y="-21" width="350" height="37" rx="18" fill="#143e46" stroke="#78b6bc" /><text y="3" textAnchor="middle" fill="#b5efdd" fontSize="16" fontWeight="600">{text}</text></g>;

export const ErpRoute = ({ d }: { d: string }) => <><path d={d} stroke="#345d76" strokeWidth="2" /><path className="cy-erp-route" d={d} pathLength="1" stroke="#88d6f0" strokeWidth="3" strokeDasharray="1" /></>;

export const ErpSheet = ({ title, fields, compact = false }: { title: string; fields: readonly string[]; compact?: boolean }) => <g>
    <path d={compact ? 'M0 0h160l26 27v200H0Z' : 'M0 0h280l30 32v342H0Z'} fill="#dcebf0" stroke="#a9d0df" strokeWidth="2" />
    <path d={compact ? 'M160 0v27h26' : 'M280 0v32h30'} fill="#b6d3df" stroke="#90b5c5" />
    <text x="20" y={compact ? 42 : 48} fill="#153e58" fontSize={compact ? 16 : 22} fontWeight="750">{title}</text><text x="20" y={compact ? 65 : 75} fill="#5d8296" fontSize="12">CHEONG YEON · 미리보기</text>
    {fields.map((field, i) => <g key={field} className={`cy-erp-sheet-row cy-erp-phase-${i + 1}`}>
        <rect x="18" y={(compact ? 84 : 105) + i * (compact ? 39 : 61)} width={compact ? 149 : 272} height={compact ? 31 : 49} rx="3" fill={i % 2 ? '#d4e3e9' : '#c8dce5'} />
        <text x="27" y={(compact ? 105 : 129) + i * (compact ? 39 : 61)} fill="#315c74" fontSize={compact ? 11 : 14}>{field}</text>
        {!compact && <path d={`M27 ${142 + i * 61}h${210 - i * 28}`} stroke="#88abbc" strokeWidth="3" strokeLinecap="round" />}
    </g>)}
    {!compact && <text x="22" y="320" fill="#5e8397" fontSize="12">연결된 기록으로 구성한 검토 전 초안</text>}
</g>;

export const ErpPhone = ({ children }: { children: React.ReactNode }) => <g><rect width="213" height="354" rx="24" fill="#172f46" stroke="#85bdd3" strokeWidth="3" /><rect x="10" y="12" width="193" height="329" rx="17" fill="#081e33" /><rect x="76" y="19" width="61" height="8" rx="4" fill="#31536c" />{children}<path d="M81 329h51" stroke="#6b94b0" strokeWidth="4" strokeLinecap="round" /></g>;
