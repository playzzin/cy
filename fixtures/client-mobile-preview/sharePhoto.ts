// A readable synthetic image for checking orientation, text and image-only delivery.
// No identity documents, signatures or customer records are used.
export function makeSharePhoto(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 760;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eff6ff'; ctx.fillRect(0, 0, 1200, 760);
    ctx.fillStyle = '#17365d'; ctx.fillRect(0, 0, 1200, 180);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px sans-serif';
    ctx.fillText('사진 공유 검수용 합성 이미지', 56, 112);
    ctx.fillStyle = '#17365d'; ctx.font = '40px sans-serif';
    ctx.fillText('실제 신분증 · 급여 · 개인정보가 아닙니다.', 56, 270);
    ctx.fillText('한글 확인: 가나다 / 숫자 확인: 1234567890', 56, 350);
    ['#2563eb', '#f59e0b', '#10b981', '#ec4899'].forEach((color, index) => {
        ctx.fillStyle = color; ctx.fillRect(56 + index * 275, 420, 245, 160);
        ctx.fillStyle = '#111827'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(String(index + 1), 150 + index * 275, 520);
    });
    ctx.fillStyle = '#17365d'; ctx.font = 'bold 42px sans-serif';
    ctx.fillText('위 ↑  /  아래 ↓  /  파일만 공유  /  QA ONLY', 56, 680);
    return canvas.toDataURL('image/png');
}
