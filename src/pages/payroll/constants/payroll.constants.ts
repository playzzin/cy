export const BANK_CODES: Record<string, string> = {
  '001': '한국은행',
  '002': '산업은행',
  '003': '기업은행',
  '004': '국민은행',
  '005': '외환은행',
  '007': '수협중앙회',
  '008': '수출입은행',
  '011': '농협은행',
  '012': '단위농협',
  '020': '우리은행',
  '023': '제일은행',
  '027': '씨티은행',
  '031': '대구은행',
  '032': '부산은행',
  '034': '광주은행',
  '035': '제주은행',
  '037': '전북은행',
  '039': '경남은행',
  '045': '새마을금고',
  '048': '신협중앙회',
  '050': '상호저축은행',
  '054': 'HSBC은행',
  '055': '도이치은행',
  '057': 'JP모간체이스은행',
  '060': 'BOA은행',
  '061': '비엔피파리바은행',
  '062': '중국건설은행',
  '064': '중국공상은행',
  '071': '우체국',
  '081': '하나은행',
  '088': '신한은행',
  '089': '케이뱅크',
  '090': '카카오뱅크',
  '092': '토스뱅크',
  '106': '신한저축은행',
  '209': '유안타증권',
  '218': 'KB증권',
  '221': '상상인증권',
  '222': '한양증권',
  '223': '리딩투자증권',
  '224': 'BNK투자증권',
  '225': 'IBK투자증권',
  '227': '다올투자증권',
  '238': '미래에셋증권',
  '240': '삼성증권',
  '243': '한국투자증권',
  '247': 'NH투자증권',
  '261': '교보증권',
  '262': '하이투자증권',
  '263': '현대차증권',
  '264': '키움증권',
  '265': '이베스트투자증권',
  '266': 'SK증권',
  '267': '대신증권',
  '269': '한화투자증권',
  '270': '하나증권',
  '271': '토스증권',
  '272': 'NH선물',
  '273': '코리아에셋투자증권',
  '274': 'DS투자증권',
  '275': '흥국증권',
  '276': '유화증권',
  '277': '에스아이증권',
  '278': '신한투자증권',
  '279': 'DB금융투자',
  '280': '유진투자증권',
  '287': '메리츠증권',
  '288': '카카오페이증권',
  '290': '부국증권',
  '291': '신영증권',
};

export const TEMP_INSURANCE_PREFIX = '[4대보험]';
export const TEMP_BUSINESS_PREFIX = '[3.3%]';
export const TEMP_TAX_PREFIX = '[원천세]';
export const LEGACY_TAX_PREFIX = '[세금]';
export const WITHHOLDING_MAX_MAN_DAY = 7;

export type AdvancePaymentStandardField =
    | 'prevMonthCarryover'
    | 'accommodation'
    | 'privateRoom'
    | 'gloves'
    | 'deposit'
    | 'fines'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water';

export const STANDARD_DEDUCTION_FIELDS: Array<{ key: AdvancePaymentStandardField; label: string }> = [
    { key: 'prevMonthCarryover', label: '전월 이월' },
    { key: 'accommodation', label: '숙소비' },
    { key: 'privateRoom', label: '개인방' },
    { key: 'gloves', label: '장갑' },
    { key: 'deposit', label: '보증금' },
    { key: 'fines', label: '과태료' },
    { key: 'electricity', label: '전기세' },
    { key: 'gas', label: '도시가스' },
    { key: 'internet', label: '인터넷' },
    { key: 'water', label: '수도세' },
];

export const APPLIED_UTILITY_FIELDS = [
    'accommodation',
    'privateRoom',
    'electricity',
    'gas',
    'internet',
    'water'
];

export const DEFAULT_PAYROLL_CONFIG: any = {
  pensionRate: 0.045,
  healthRate: 0.03545,
  longtermRate: 0.004527, 
  employmentRate: 0.009,
  thresholdDays: 7,
  withholdingBaseDeduction: 150000,
  withholdingIncomeBaseMultiplier: 0.85,
  withholdingIncomeTaxRate: 0.027,
  withholdingResidentTaxRate: 0.0027,
  withholdingApplyAllLabor: false,
  employmentApplyBelowThreshold: false,
  incomeTaxRate: 0.03,
  residentTaxRate: 0.003,
};
