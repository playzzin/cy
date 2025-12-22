import React, { useRef, useEffect, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import Handsontable from 'handsontable';

registerAllModules();

interface SmartExcelGridProps {
    onChange: (data: any[]) => void;
}

const SmartExcelGrid: React.FC<SmartExcelGridProps> = ({ onChange }) => {
    const hotRef = useRef<any>(null);

    // Initial Data: 20 empty rows for easy pasting
    const [hotData, setHotData] = useState<any[]>(
        Array.from({ length: 50 }, () => ['', '', '', '', '', '', '', ''])
    );

    const columns = [
        { title: '날짜 (YYYY-MM-DD)', type: 'date', dateFormat: 'YYYY-MM-DD', width: 100 },
        { title: '현장명', type: 'text', width: 120 },
        { title: '담당팀', type: 'text', width: 100 },
        { title: '이름', type: 'text', width: 80 },
        { title: '팀명 (소속)', type: 'text', width: 100 },
        { title: '공수', type: 'numeric', numericFormat: { pattern: '0.0' }, width: 60 },
        { title: '작업내용', type: 'text', width: 200 },
        { title: '구분 (월급제/일급제)', type: 'text', width: 100 },
    ];

    const handleChange = (changes: any, source: string) => {
        if (!hotRef.current) return;

        // Timeout to ensure data is updated
        setTimeout(() => {
            const instance = hotRef.current?.hotInstance;
            if (instance) {
                const rawData = instance.getData();

                // Transform to Object Array for parent parsing
                const structuredData = rawData.map((row: any[]) => {
                    // Skip completely empty rows
                    if (row.every(cell => !cell)) return null;

                    return {
                        date: row[0],
                        siteName: row[1],
                        responsibleTeamName: row[2],
                        name: row[3],
                        teamName: row[4],
                        manDay: row[5],
                        workContent: row[6],
                        payType: row[7]
                    };
                }).filter(Boolean); // Remove nulls

                onChange(structuredData);
            }
        }, 100);
    };

    // Force render on mount to fix layout issues in Flex/Grid
    useEffect(() => {
        const timer = setTimeout(() => {
            if (hotRef.current?.hotInstance) {
                hotRef.current.hotInstance.render();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full h-full flex flex-col relative z-0">
            <div className="mb-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-700 font-bold whitespace-nowrap overflow-x-auto shrink-0">
                <span className="mr-2">📝 입력 순서:</span>
                날짜 ➔ 현장명 ➔ 담당팀 ➔ 이름 ➔ 팀명 ➔ 공수 ➔ 작업내용 ➔ 구분
            </div>
            {/* Wrapper with relative positioning and z-index to ensure clickability */}
            <div className="flex-1 overflow-hidden border border-gray-300 rounded-lg relative z-10 bg-white">
                <HotTable
                    ref={hotRef}
                    data={hotData}
                    colHeaders={columns.map(c => c.title)}
                    columns={columns}
                    rowHeaders={true}
                    width="100%"
                    height="100%" // Fill container
                    licenseKey="non-commercial-and-evaluation"
                    afterChange={handleChange}
                    contextMenu={true}
                    minSpareRows={5}
                    manualColumnResize={true}
                    enterMoves={{ row: 1, col: 0 }} // Enter moves down
                    tabMoves={{ row: 0, col: 1 }}   // Tab moves right
                    // Ensure events are captured
                    outsideClickDeselects={false}
                />

                {/* Force Styles for Handsontable */}
                <style>{`
                    .handsontable .wtHolder {
                        height: 100% !important;
                        pointer-events: auto !important;
                    }
                    .handsontable td {
                        cursor: text;
                    }
                    /* Ensure headers are visible */
                    .handsontable th {
                        z-index: 10;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default SmartExcelGrid;
