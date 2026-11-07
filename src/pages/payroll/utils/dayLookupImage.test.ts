import { renderDayLookupCanvas } from './dayLookupImage';

test('화면복사 이미지에 청구금액의 파랑·계좌의 붉은색·입력값 색상을 유지한다', () => {
    document.body.innerHTML = `<div id="sheet"><dl><dt>날짜</dt><dd>2026-11-08</dd></dl>
        <table><thead><tr style="color: white; background: green"><th>이름</th><th>청구금액</th><th>계좌</th><th>공수</th></tr></thead>
        <tbody><tr><td style="color: #1e1c11">검증 작업자</td><td style="color: #0369a1">200,000</td>
        <td style="color: #7a2c2c">검증 계좌</td><td><input style="color: #4a452a" value="1.5" /></td></tr></tbody></table></div>`;
    document.querySelectorAll('th').forEach(cell => {
        cell.getBoundingClientRect = () => ({ width: 150 } as DOMRect);
    });
    const painted: Array<{ text: string; color: string }> = [];
    const ctx = {
        fillStyle: '', font: '', textAlign: '',
        measureText: (text: string) => ({ width: text.length * 8 }),
        scale: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
        fillText(text: string) { painted.push({ text, color: this.fillStyle }); },
    };
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    try {
        renderDayLookupCanvas(document.getElementById('sheet')!, () => 1);
        expect(painted).toEqual(expect.arrayContaining([
            { text: '200,000', color: 'rgb(3, 105, 161)' },
            { text: '검증 계좌', color: 'rgb(122, 44, 44)' },
            { text: '1.5', color: 'rgb(74, 69, 42)' },
            { text: '검증 작업자', color: 'rgb(30, 28, 17)' },
        ]));
    } finally {
        getContext.mockRestore();
        document.body.innerHTML = '';
    }
});
