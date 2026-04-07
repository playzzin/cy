filepath = r'c:\Users\playz\cy\src\pages\taxinvoice\WorkbookLedgerPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    src = f.read()

# 1. Remove extra col in colgroup (the 80px selection col)
old1 = '''                        <colgroup>
                            <col style={{ width: '80px' }} />
                            <col className="workbook-summary-col-no" />'''
new1 = '''                        <colgroup>
                            <col className="workbook-summary-col-no" />'''
assert old1 in src, "PATCH1 not found"
src = src.replace(old1, new1, 1)
print("PATCH1 ok: removed extra col")

# 2. Merge selection th into No th (remove separate selection th, add checkbox to No th)
old2 = '''                                <th>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                                            checked={areAllSelectableSummaryRowsSelected}
                                            onChange={handleToggleAllSummaryRowSelection}
                                            disabled={summaryFilter.mode !== '\ubbf8\uc9c0\uae09\uae08' || selectableSummaryRowIds.length === 0}
                                        />
                                        {areAllSelectableSummaryRowsSelected ? '\uc804\uccb4\ud574\uc81c' : '\uc804\uccb4\uc120\ud0dd'}
                                    </label>
                                </th>
                                <th>No</th>'''
new2 = '''                                <th>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            style={{ width: '14px', height: '14px', accentColor: '#2563eb' }}
                                            checked={areAllSelectableSummaryRowsSelected}
                                            onChange={handleToggleAllSummaryRowSelection}
                                            disabled={summaryFilter.mode !== '\ubbf8\uc9c0\uae09\uae08' || selectableSummaryRowIds.length === 0}
                                        />
                                        No
                                    </label>
                                </th>'''
assert old2 in src, "PATCH2 not found"
src = src.replace(old2, new2, 1)
print("PATCH2 ok: merged checkbox into No th")

# 3. Fix colSpan in empty row (14->13, 13->12)
old3 = 'colSpan={canRegisterReceipt ? 14 : 13} className="sheet-empty-state"'
new3 = 'colSpan={canRegisterReceipt ? 13 : 12} className="sheet-empty-state"'
assert old3 in src, "PATCH3 not found"
src = src.replace(old3, new3, 1)
print("PATCH3 ok: colSpan fixed")

# 4. Merge selection td into index+1 td
old4 = '''                                    <td>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                                                checked={selectedSummaryRowIdSet.has(row.id)}
                                                onChange={() => handleToggleSummaryRowSelection(row.id)}
                                                disabled={summaryFilter.mode !== '\ubbf8\uc9c0\uae09\uae08' || row.outstandingAmount <= 0}
                                            />
                                            {selectedSummaryRowIdSet.has(row.id) ? '\ud574\uc81c' : '\uc120\ud0dd'}
                                        </label>
                                    </td>
                                    <td className="align-right">{index + 1}</td>'''
new4 = '''                                    <td className="align-right">
                                        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', cursor: summaryFilter.mode === '\ubbf8\uc9c0\uae09\uae08' && row.outstandingAmount > 0 ? 'pointer' : 'default' }}>
                                            <input
                                                type="checkbox"
                                                style={{ width: '14px', height: '14px', accentColor: '#2563eb', flexShrink: 0 }}
                                                checked={selectedSummaryRowIdSet.has(row.id)}
                                                onChange={() => handleToggleSummaryRowSelection(row.id)}
                                                disabled={summaryFilter.mode !== '\ubbf8\uc9c0\uae09\uae08' || row.outstandingAmount <= 0}
                                            />
                                            {index + 1}
                                        </label>
                                    </td>'''
assert old4 in src, "PATCH4 not found"
src = src.replace(old4, new4, 1)
print("PATCH4 ok: merged checkbox into No td")

with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)

print("\nFILE WRITTEN OK")
print("selectedSummaryRowIds present:", 'selectedSummaryRowIds' in src)
