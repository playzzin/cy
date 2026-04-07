









# Fix broken string literals in WorkbookLedgerPage.tsx - Round 3
filepath = r'c:\Users\playz\cy\src\pages\taxinvoice\WorkbookLedgerPage.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Single-replacement fixes for broken patterns
replacements = [
    # Line 690 - transactionType comparison
    ("transactionType === '???'",
     "transactionType === '\uB9E4\uC785'"),
    # Lines 693-699 - getSettlementLabels return object
    ("        action: isPurchase ? '???? : '???',",
     "        action: isPurchase ? '\uC9C0\uAE09' : '\uC785\uAE08',"),
    ("        history: isPurchase ? '??????? : '??????',",
     "        history: isPurchase ? '\uC9C0\uAE09\uB0B4\uC5ED' : '\uC785\uAE08\uB0B4\uC5ED',"),
    ("        date: isPurchase ? '??????? : '??????',",
     "        date: isPurchase ? '\uC9C0\uAE09\uC77C\uC790' : '\uC785\uAE08\uC77C\uC790',"),
    ("        amount: isPurchase ? '??????? : '??????',",
     "        amount: isPurchase ? '\uC9C0\uAE09\uAE08\uC561' : '\uC785\uAE08\uAE08\uC561',"),
    ("        cumulative: isPurchase ? '??????? : '??????',",
     "        cumulative: isPurchase ? '\uB204\uC801\uC9C0\uAE09' : '\uB204\uC801\uC785\uAE08',"),
    ("        outstanding: isPurchase ? '??????' : '?????,",
     "        outstanding: isPurchase ? '\uBBF8\uC9C0\uAE09\uAE08' : '\uBBF8\uC218\uAE08',"),
    ("        placeholder: isPurchase ? '???????' : '??? ???'",
     "        placeholder: isPurchase ? '\uC9C0\uAE09 \uAC70\uB798\uCC98' : '\uC785\uAE08 \uAC70\uB798\uCC98'"),
]

changed = 0
for old, new in replacements:
    count = text.count(old)
    if count > 0:
        text = text.replace(old, new)
        changed += count
        print(f"Fixed x{count}: {repr(old[:60])}")
    else:
        print(f"NOT FOUND: {repr(old[:60])}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print(f"\nTotal fixes applied: {changed}")
print("File saved.")
