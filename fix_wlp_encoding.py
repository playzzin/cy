import sys

with open(r'c:\Users\playz\cy\src\pages\taxinvoice\WorkbookLedgerPage.tsx', 'rb') as f:
    data = f.read()
lines = data.split(b'\n')

print(f'Total lines: {len(lines)}')

# Print first 600 high-byte lines
count = 0
for i in range(min(600, len(lines))):
    line = lines[i]
    if any(b > 127 for b in line):
        decoded = line.decode('utf-8', errors='replace')
        print(f'Line {i+1}: {repr(decoded[:120])}')
        count += 1

print(f'Total high-byte lines in first 600: {count}')
