import type { VehicleExpenseType } from '../types/vehicle';

export const normalizeVehicleExpenseSearchText = (value: unknown): string =>
  String(value ?? '').replace(/\s+/g, '').toLowerCase();

const includesAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(normalizeVehicleExpenseSearchText(keyword)));

const exactAliases: Record<VehicleExpenseType, string[]> = {
  FUEL: ['fuel', 'gas', 'gasoline', 'diesel', 'oilfuel', '주유', '주유비', '유류', '유류비', '연료', '연료비', '휘발유', '경유'],
  REPAIR: ['repair', 'repairs', 'maintenance', 'maint', 'service', '수리', '수리비', '정비', '정비비'],
  TOLL: ['toll', 'tolls', 'highpass', 'hi-pass', 'highway', '통행', '통행료', '하이패스', '고속도로', '톨게이트'],
  FINE: ['fine', 'fines', 'penalty', 'ticket', 'violation', '과태료', '과태', '범칙금', '범칙', '벌금', '위반'],
  OTHER: ['other', 'etc', 'misc', '기타']
};

const keywordAliases: Record<Exclude<VehicleExpenseType, 'OTHER'>, string[]> = {
  FUEL: ['fuel', 'gasoline', 'diesel', '주유', '유류', '연료', '휘발유', '경유', '기름'],
  REPAIR: [
    'repair',
    'maintenance',
    'maint',
    'service',
    'parts',
    'part',
    'tire',
    'tyre',
    'oilchange',
    'engineoil',
    'battery',
    'brake',
    'inspection',
    '수리',
    '정비',
    '점검',
    '검사',
    '타이어',
    '엔진',
    '엔진오일',
    '오일교환',
    '오일',
    '배터리',
    '밧데리',
    '브레이크',
    '부품',
    '공임',
    '교체',
    '카센터',
    '공업사',
    '판금',
    '도색',
    '소모품',
    '필터',
    '미션',
    '냉각수',
    '워셔액',
    '라이트',
    '전구',
    '와이퍼'
  ],
  TOLL: ['toll', 'highpass', 'hi-pass', 'highway', 'expressway', '통행', '하이패스', '고속도로', '톨게이트'],
  FINE: ['fine', 'penalty', 'ticket', 'violation', '과태료', '과태', '범칙금', '범칙', '벌금', '위반', '주정차', '속도위반']
};

const getExactExpenseType = (value: unknown): VehicleExpenseType | null => {
  const key = normalizeVehicleExpenseSearchText(value);
  if (!key) return null;

  for (const [type, aliases] of Object.entries(exactAliases) as Array<[VehicleExpenseType, string[]]>) {
    if (aliases.some((alias) => normalizeVehicleExpenseSearchText(alias) === key)) {
      return type;
    }
  }

  return null;
};

export const normalizeVehicleExpenseType = (...values: unknown[]): VehicleExpenseType => {
  const exactType = getExactExpenseType(values[0]);
  if (exactType && exactType !== 'OTHER') return exactType;

  const text = normalizeVehicleExpenseSearchText(values.filter((value) => value != null).join(' '));
  if (includesAny(text, keywordAliases.REPAIR)) return 'REPAIR';
  if (includesAny(text, keywordAliases.FINE)) return 'FINE';
  if (includesAny(text, keywordAliases.TOLL)) return 'TOLL';
  if (includesAny(text, keywordAliases.FUEL)) return 'FUEL';

  return exactType ?? 'OTHER';
};
