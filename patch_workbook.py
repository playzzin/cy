import re

filepath = r'c:\Users\playz\cy\src\pages\taxinvoice\WorkbookLedgerPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    src = f.read()

orig_len = len(src)

# 1. Add imports after useAuth
old1 = "import { useAuth } from '../../contexts/AuthContext';"
new1 = (
    "import { useAuth } from '../../contexts/AuthContext';\n"
    "import * as XLSX from 'xlsx';\n"
    "import { accountDirectoryService, AccountDirectory } from '../../services/accountDirectoryService';"
)
if old1 in src:
    src = src.replace(old1, new1, 1)
    print("PATCH1 ok: imports added")
else:
    print("PATCH1 SKIP: old string not found")

# 2. Add state after selectedDbEntryIds
old2 = "    const [selectedDbEntryIds, setSelectedDbEntryIds] = useState<string[]>([]);"
new2 = (
    "    const [selectedDbEntryIds, setSelectedDbEntryIds] = useState<string[]>([]);\n"
    "    const [selectedSummaryRowIds, setSelectedSummaryRowIds] = useState<string[]>([]);\n"
    "    const [purchaseAccountsByName, setPurchaseAccountsByName] = useState<Map<string, AccountDirectory>>(new Map());"
)
if old2 in src:
    src = src.replace(old2, new2, 1)
    print("PATCH2 ok: state added")
else:
    print("PATCH2 SKIP: old string not found")

# 3. Add useEffect for purchase account loading after rebuildLookupOptions
# Find the end of '}, [entries]);' near the entries effect to place a new effect
# Insert after the existing useEffect that sets site/team names from entries
old3 = "    const rebuildLookupOptions = useCallback((savedEntries: WorkbookLedgerEntry[]) => {"
new3 = (
    "    useEffect(() => {\n"
    "        accountDirectoryService.getEntriesByCategory('purchase').then((accounts) => {\n"
    "            const nextMap = new Map<string, AccountDirectory>();\n"
    "            accounts.forEach((acc) => {\n"
    "                const key = (acc.name ?? '').trim();\n"
    "                if (key) nextMap.set(key, acc);\n"
    "            });\n"
    "            setPurchaseAccountsByName(nextMap);\n"
    "        }).catch(() => {});\n"
    "    }, []);\n"
    "\n"
    "    const rebuildLookupOptions = useCallback((savedEntries: WorkbookLedgerEntry[]) => {"
)
if old3 in src:
    src = src.replace(old3, new3, 1)
    print("PATCH3 ok: useEffect added")
else:
    print("PATCH3 SKIP: old string not found")

# 4. Add selection memos and handlers before renderInputTab
old4 = "    const inputColumns = useMemo<any[]>(() => ["
new4 = (
    "    const selectedSummaryRowIdSet = useMemo(\n"
    "        () => new Set(selectedSummaryRowIds),\n"
    "        [selectedSummaryRowIds]\n"
    "    );\n"
    "\n"
    "    const selectableSummaryRowIds = useMemo(\n"
    "        () => summaryFilter.mode === '\ubbf8\uc9c0\uae09\uae08'\n"
    "            ? summaryRows\n"
    "                .filter((row) => row.outstandingAmount > 0)\n"
    "                .map((row) => row.id)\n"
    "            : [],\n"
    "        [summaryFilter.mode, summaryRows]\n"
    "    );\n"
    "\n"
    "    const areAllSelectableSummaryRowsSelected = useMemo(\n"
    "        () => selectableSummaryRowIds.length > 0 && selectableSummaryRowIds.every((id) => selectedSummaryRowIdSet.has(id)),\n"
    "        [selectableSummaryRowIds, selectedSummaryRowIdSet]\n"
    "    );\n"
    "\n"
    "    useEffect(() => {\n"
    "        const validSummaryIds = new Set(selectableSummaryRowIds);\n"
    "        setSelectedSummaryRowIds((prev) => prev.filter((id) => validSummaryIds.has(id)));\n"
    "    }, [selectableSummaryRowIds]);\n"
    "\n"
    "    const handleToggleSummaryRowSelection = useCallback((rowId: string) => {\n"
    "        setSelectedSummaryRowIds((prev) => (\n"
    "            prev.includes(rowId)\n"
    "                ? prev.filter((id) => id !== rowId)\n"
    "                : [...prev, rowId]\n"
    "        ));\n"
    "    }, []);\n"
    "\n"
    "    const handleToggleAllSummaryRowSelection = useCallback(() => {\n"
    "        if (selectableSummaryRowIds.length === 0) return;\n"
    "        setSelectedSummaryRowIds((prev) => {\n"
    "            const nextSet = new Set(prev);\n"
    "            const shouldSelectAll = selectableSummaryRowIds.some((id) => !nextSet.has(id));\n"
    "            selectableSummaryRowIds.forEach((id) => {\n"
    "                if (shouldSelectAll) nextSet.add(id); else nextSet.delete(id);\n"
    "            });\n"
    "            return Array.from(nextSet);\n"
    "        });\n"
    "    }, [selectableSummaryRowIds]);\n"
    "\n"
    "    const [downloadingKb, setDownloadingKb] = useState(false);\n"
    "\n"
    "    const handleDownloadSummaryKb = useCallback(async () => {\n"
    "        if (selectedSummaryRowIds.length === 0) return;\n"
    "        setDownloadingKb(true);\n"
    "        try {\n"
    "            const selectedRows = summaryRows.filter((row) => selectedSummaryRowIds.includes(row.id));\n"
    "            const rawData: (string | number)[][] = [\n"
    "                ['\uc740\ud589\ucf54\ub4dc', '\uacc4\uc88c\ubc88\ud638', '\uc774\uccb4\uae08\uc561', '\uc785\uae08\ud1b5\uc7a5\ud45c\uc2dc', '\ucd9c\uae08\ud1b5\uc7a5\ud45c\uc2dc'],\n"
    "                ...selectedRows.map((row) => {\n"
    "                    const acc = purchaseAccountsByName.get(row.partnerName);\n"
    "                    const bankCode = acc?.bankName ?? '';\n"
    "                    const accountNumber = acc?.accountNumber ?? '';\n"
    "                    return [bankCode, accountNumber, row.outstandingAmount, row.partnerName.slice(0, 10), row.partnerName.slice(0, 14)];\n"
    "                })\n"
    "            ];\n"
    "            const ws = XLSX.utils.aoa_to_sheet(rawData);\n"
    "            const wb = XLSX.utils.book_new();\n"
    "            XLSX.utils.book_append_sheet(wb, ws, '\uad6d\ubbfc\uc740\ud589\uc6a9');\n"
    "            XLSX.writeFile(wb, `\ubbf8\uc9c0\uae09\uae08_\uad6d\ubbfc\uc740\ud589\uc6a9_${summaryFilter.startDate}_${summaryFilter.endDate}.xlsx`);\n"
    "        } finally {\n"
    "            setDownloadingKb(false);\n"
    "        }\n"
    "    }, [purchaseAccountsByName, selectedSummaryRowIds, summaryFilter.endDate, summaryFilter.startDate, summaryRows]);\n"
    "\n"
    "    const inputColumns = useMemo<any[]>(() => ["
)
if old4 in src:
    src = src.replace(old4, new4, 1)
    print("PATCH4 ok: memos and handlers added")
else:
    print("PATCH4 SKIP: old string not found")

# 5. Add colgroup col for selection (before col-no)
old5 = '                        <colgroup>\n                            <col className="workbook-summary-col-no" />'
new5 = (
    '                        <colgroup>\n'
    '                            <col style={{ width: \'80px\' }} />\n'
    '                            <col className="workbook-summary-col-no" />'
)
if old5 in src:
    src = src.replace(old5, new5, 1)
    print("PATCH5 ok: colgroup col added")
else:
    print("PATCH5 SKIP: old string not found")

# 6. Add selection header th (before No)
old6 = '                        <thead className="summary-header">\n                            <tr>\n                                <th>No</th>'
new6 = (
    '                        <thead className="summary-header">\n'
    '                            <tr>\n'
    '                                <th>\n'
    '                                    <label style={{ display: \'inline-flex\', alignItems: \'center\', gap: \'6px\', fontSize: \'11px\', fontWeight: 700, cursor: \'pointer\' }}>\n'
    '                                        <input\n'
    '                                            type="checkbox"\n'
    '                                            style={{ width: \'16px\', height: \'16px\', accentColor: \'#2563eb\' }}\n'
    '                                            checked={areAllSelectableSummaryRowsSelected}\n'
    '                                            onChange={handleToggleAllSummaryRowSelection}\n'
    '                                            disabled={summaryFilter.mode !== \'\ubbf8\uc9c0\uae09\uae08\' || selectableSummaryRowIds.length === 0}\n'
    '                                        />\n'
    '                                        {areAllSelectableSummaryRowsSelected ? \'\uc804\uccb4\ud574\uc81c\' : \'\uc804\uccb4\uc120\ud0dd\'}\n'
    '                                    </label>\n'
    '                                </th>\n'
    '                                <th>No</th>'
)
if old6 in src:
    src = src.replace(old6, new6, 1)
    print("PATCH6 ok: header th added")
else:
    print("PATCH6 SKIP: old string not found")

# 7. Fix colSpan in empty state (12 -> 13, 13 -> 14)
old7 = 'colSpan={canRegisterReceipt ? 13 : 12} className="sheet-empty-state"'
new7 = 'colSpan={canRegisterReceipt ? 14 : 13} className="sheet-empty-state"'
if old7 in src:
    src = src.replace(old7, new7, 1)
    print("PATCH7 ok: colSpan fixed")
else:
    print("PATCH7 SKIP: old string not found")

# 8. Add selection td in tbody (before index+1 td)
old8 = '                                <tr key={row.id}>\n                                    <td className="align-right">{index + 1}</td>'
new8 = (
    '                                <tr key={row.id}>\n'
    '                                    <td>\n'
    '                                        <label style={{ display: \'inline-flex\', alignItems: \'center\', gap: \'6px\', fontSize: \'11px\', fontWeight: 700, cursor: \'pointer\' }}>\n'
    '                                            <input\n'
    '                                                type="checkbox"\n'
    '                                                style={{ width: \'16px\', height: \'16px\', accentColor: \'#2563eb\' }}\n'
    '                                                checked={selectedSummaryRowIdSet.has(row.id)}\n'
    '                                                onChange={() => handleToggleSummaryRowSelection(row.id)}\n'
    '                                                disabled={summaryFilter.mode !== \'\ubbf8\uc9c0\uae09\uae08\' || row.outstandingAmount <= 0}\n'
    '                                            />\n'
    '                                            {selectedSummaryRowIdSet.has(row.id) ? \'\ud574\uc81c\' : \'\uc120\ud0dd\'}\n'
    '                                        </label>\n'
    '                                    </td>\n'
    '                                    <td className="align-right">{index + 1}</td>'
)
if old8 in src:
    src = src.replace(old8, new8, 1)
    print("PATCH8 ok: selection td added")
else:
    print("PATCH8 SKIP: old string not found")

# 9. Add emerald bar before the table wrapper
old9 = '                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">'
new9 = (
    '                {summaryFilter.mode === \'\ubbf8\uc9c0\uae09\uae08\' && (\n'
    '                    <div style={{ display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\', background: \'#ecfdf5\', border: \'1px solid #6ee7b7\', borderRadius: \'8px\', padding: \'8px 12px\', marginBottom: \'8px\' }}>\n'
    '                        <span style={{ fontSize: \'13px\', color: \'#065f46\', fontWeight: 700 }}>\n'
    '                            {selectedSummaryRowIds.length > 0 ? `\uc120\ud0dd ${selectedSummaryRowIds.length}\uac74` : \'\ubbf8\uc9c0\uae09\uae08 \ud589\uc744 \uccb4\ud06c\ud558\uc138\uc694\'}\n'
    '                        </span>\n'
    '                        <button\n'
    '                            type="button"\n'
    '                            className="excel-button excel-button-green"\n'
    '                            onClick={handleDownloadSummaryKb}\n'
    '                            disabled={downloadingKb || selectedSummaryRowIds.length === 0}\n'
    '                            style={{ minHeight: \'36px\' }}\n'
    '                        >\n'
    '                            <FontAwesomeIcon icon={downloadingKb ? faSpinner : faDownload} spin={downloadingKb} />\n'
    '                            {\`\uad6d\ubbfc\uc740\ud589\uc6a9 \ub2e4\uc6b4\ub85c\ub4dc${\ubc18selectedSummaryRowIds.length > 0 ? ` (${selectedSummaryRowIds.length})` : \'\'}\`}\n'
    '                        </button>\n'
    '                    </div>\n'
    '                )}\n'
    '                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">'
)
# Note: Use a simpler version without template literal issues
old9 = '                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">'
# Find the last occurrence (the one in summary tab)
idx = src.rfind(old9)
if idx >= 0:
    insert = (
        '                {summaryFilter.mode === \'\ubbf8\uc9c0\uae09\uae08\' && (\n'
        '                    <div style={{ display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\', background: \'#ecfdf5\', border: \'1px solid #6ee7b7\', borderRadius: \'8px\', padding: \'8px 12px\', marginBottom: \'8px\' }}>\n'
        '                        <span style={{ fontSize: \'13px\', color: \'#065f46\', fontWeight: 700 }}>\n'
        '                            {selectedSummaryRowIds.length > 0\n'
        '                                ? `\uc120\ud0dd ${selectedSummaryRowIds.length}\uac74`\n'
        '                                : \'\ubbf8\uc9c0\uae09\uae08 \ud589\uc744 \uccb4\ud06c\ud558\uc138\uc694\'}\n'
        '                        </span>\n'
        '                        <button\n'
        '                            type="button"\n'
        '                            className="excel-button excel-button-green"\n'
        '                            onClick={handleDownloadSummaryKb}\n'
        '                            disabled={downloadingKb || selectedSummaryRowIds.length === 0}\n'
        '                            style={{ minHeight: \'36px\' }}\n'
        '                        >\n'
        '                            <FontAwesomeIcon icon={downloadingKb ? faSpinner : faDownload} spin={downloadingKb} />\n'
        '                            {`\uad6d\ubbfc\uc740\ud589\uc6a9 \ub2e4\uc6b4\ub85c\ub4dc${selectedSummaryRowIds.length > 0 ? ` (\${selectedSummaryRowIds.length})` : \'\'}`}\n'
        '                        </button>\n'
        '                    </div>\n'
        '                )}\n'
        '                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">'
    )
    src = src[:idx] + insert + src[idx + len(old9):]
    print("PATCH9 ok: emerald bar added")
else:
    print("PATCH9 SKIP: not found")

print(f"\nOriginal length: {orig_len}, New length: {len(src)}")
print("selectedSummaryRowIds present:", 'selectedSummaryRowIds' in src)
print("areAllSelectableSummaryRowsSelected present:", 'areAllSelectableSummaryRowsSelected' in src)

with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)

print("\nFILE WRITTEN TO DISK OK")
