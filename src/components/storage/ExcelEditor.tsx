import React, { useEffect, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faTimes, faFileExcel, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Register Handsontable modules
registerAllModules();

interface ExcelEditorProps {
    visible: boolean;
    fileUrl: string | null;
    fileName: string;
    onSave: (blob: Blob) => Promise<void>;
    onClose: () => void;
}

const ExcelEditor: React.FC<ExcelEditorProps> = ({ visible, fileUrl, fileName, onSave, onClose }) => {
    const hotRef = useRef<any>(null);
    const [data, setData] = useState<any[][]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [currentSheet, setCurrentSheet] = useState<string>('');
    const workbookRef = useRef<XLSX.WorkBook | null>(null);

    // Initial Load
    useEffect(() => {
        if (visible && fileUrl) {
            loadFile(fileUrl);
        } else {
            setData([]);
            setSheetNames([]);
            workbookRef.current = null;
        }
    }, [visible, fileUrl]);

    const loadFile = async (url: string) => {
        setLoading(true);
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            workbookRef.current = workbook;
            setSheetNames(workbook.SheetNames);

            if (workbook.SheetNames.length > 0) {
                loadSheet(workbook.SheetNames[0], workbook);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to load Excel file', 'error');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const loadSheet = (sheetName: string, wb: XLSX.WorkBook = workbookRef.current!) => {
        if (!wb) return;
        const worksheet = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        // Normalize data to ensure it's at least array
        const normalizedData = (jsonData.length > 0 ? jsonData : [[]]) as any[][];
        setData(normalizedData);
        setCurrentSheet(sheetName);
    };

    const handleSave = async () => {
        if (!hotRef.current || !workbookRef.current) return;
        setSaving(true);
        try {
            const hotInstance = hotRef.current.hotInstance;
            const newData = hotInstance?.getData(); // Get current data from grid

            if (newData) {
                // Update the current sheet in the workbook object
                const newWorksheet = XLSX.utils.aoa_to_sheet(newData);
                workbookRef.current.Sheets[currentSheet] = newWorksheet;

                // Update range of the sheet manually to ensure all data is captured
                const range = XLSX.utils.decode_range(newWorksheet['!ref'] || 'A1');
                newWorksheet['!ref'] = XLSX.utils.encode_range(range);
            }

            // Write workbook to buffer
            const wbout = XLSX.write(workbookRef.current, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            await onSave(blob);
            Swal.fire({
                icon: 'success',
                title: 'Saved!',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save file', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex justify-between items-center shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-green-600 p-2 rounded text-white">
                        <FontAwesomeIcon icon={faFileExcel} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800">{fileName}</h2>
                        <div className="flex gap-2 text-xs">
                            {sheetNames.map(sheet => (
                                <button
                                    key={sheet}
                                    onClick={() => loadSheet(sheet)}
                                    className={`px-2 py-1 rounded ${currentSheet === sheet ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    {sheet}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Save Changes
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                    >
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-slate-100 p-4 overflow-hidden relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-slate-400" />
                    </div>
                ) : (
                    <div className="h-full w-full bg-white rounded-lg shadow-inner overflow-hidden">
                        <HotTable
                            ref={hotRef}
                            data={data}
                            rowHeaders={true}
                            colHeaders={true}
                            height="100%"
                            width="100%"
                            licenseKey="non-commercial-and-evaluation" // for non-commercial use
                            contextMenu={true}
                            manualColumnResize={true}
                            manualRowResize={true}
                            comments={true}
                            autoWrapRow={true}
                            autoWrapCol={true}
                            filters={true}
                            dropdownMenu={true}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExcelEditor;
