export const recruitmentPhone = '010-5950-0750';
export const lodging = '경기도 안산 · 수원';
export const money = (amount: number) => amount.toLocaleString('ko-KR') + '원';

export const standardDailyRate = 180_000;
export const nextDayDailyRate = 170_000;
// Each multiplier is the total for the day, including the regular shift.
export const workShifts = [
    { hours: '기본 8시간', units: 1 },
    { hours: '2시간 잔업', units: 1.5 },
    { hours: '4시간 잔업', units: 2 },
];
export const workUnitLabel = (units: number) => (units === 1 ? '1' : units.toFixed(1)) + '공수';
export const calculatePay = (dailyRate: number, units: number, days = 1) => dailyRate * units * days;
export const tasks = ['기능공 보조역할', '자재 정리·운반', '현장 청소 작업', '동바리 해체작업'];
export const supplies = ['신분증', '작업복', '개인 생필품', '안전화'];
export const safetyCertificate = '건설기초안전교육증 (4시간 필수)';
export const schedule = [
    { time: '오전 08:00', title: '현장 도착 및 아침식사', detail: '아침식사 및 안전 체조 실시' },
    { time: '09:00 ~ 12:00', title: '오전 근무', detail: '기능공 보조 및 현장 작업' },
    { time: '12:00 ~ 13:00', title: '점심 식사 및 휴식', detail: '든든한 점심식사 제공' },
    { time: '13:00 ~ 17:00', title: '오후 근무 및 퇴근', detail: '자재 정리 후 숙소로 이동해 저녁식사 및 자유시간' },
];

export const recruitmentText = [
    '[전국시스템인력] 시스템동바리 고단가 인력 모집',
    safetyCertificate + ' · 사무실 면접 후 당일취업 가능',
    '왕초보자 / 신용불량자 / 외국인·교포 / 숙소가 필요한 분 환영 · 친구동반 가능',
    '차비와 생활비 지원 · 외국인·교포는 취업 가능 여부 상담',
    '',
    '■ 모집 분야: 시스템동바리',
    tasks.join(' / '),
    '',
    '■ 실외현장 초보단가 (경력자 단가 별도 협의)',
    '하루 급여 = 기본 일당 × 하루 공수 (잔업을 포함한 총공수)',
    ...workShifts.map(({ hours, units }) => '- ' + hours + ' (' + workUnitLabel(units) + '): 일반 ' +
        money(calculatePay(standardDailyRate, units)) + ' / 익일지급 ' + money(calculatePay(nextDayDailyRate, units))),
    '- 익일지급도 숙식 제공. 월급은 기본 일당 × 실제 근무한 총공수로 정산하며 주급 및 우회입금 상담 가능',
    '- 담뱃값·생활비 최대 50%까지 가불 가능',
    '',
    '■ 하루 근무 시간표',
    ...schedule.map(slot => '- ' + slot.time + ' ' + slot.title + ' (' + slot.detail + ')'),
    '',
    '■ 준비물: ' + [...supplies, safetyCertificate].join(', '),
    '■ 숙소: ' + lodging + ' / 한 달 이상 근무 가능자 숙식 무료 (아침·점심·저녁 제공)',
    '■ 24시간 당일취업 상담전화: ' + recruitmentPhone,
].join('\n');
