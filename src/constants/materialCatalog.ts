export interface MaterialCatalogEntry {
    category: string;
    itemName: string;
    specs: string[];
    unit?: string;
}

export const EXCEL_MATERIAL_CATALOG: MaterialCatalogEntry[] = [
    { category: '동바리', itemName: '수직재', specs: ['P17', 'P12', 'P08', 'P04', 'P02'] },
    { category: '동바리', itemName: '수평재', specs: ['H18', 'H15', 'H12', 'H09', 'H06', 'H03', 'H02'] },
    { category: '동바리', itemName: '받침 철물', specs: ['상부자키', '하부자키'] },
    { category: '동바리', itemName: '대각재', specs: ['B1718', 'B1715', 'B1712', 'B1709', 'B1706', 'B1212', 'B1209'] },
    { category: '동바리', itemName: '멍에재', specs: ['6M', '4M', '3.2M', '3M', '2.8M', '2.7M', '2.5M', '2.4M', '2.3M', '2.2M', '2.0M', '2.M', '2M', '1.87M', '1.8M', '1.7M', '1.5M', '1.3M', '1.2M', '1M', '0.8M', '0.5M'] },
    { category: '동바리', itemName: '부속 철물', specs: ['소 켓', '대각재 핀'] },
    { category: '동바리', itemName: '발판', specs: ['5006'] },
    { category: '동바리', itemName: '기타', specs: ['파이프 6M', '파이프 4M', '파이프 3M', '파이프 2M', '파이프 1.5M', '파이프 1M', '멍에재 6M', 'B1709', 'B1212', '벽연결용철물', '가세', '인코너', '콘판넬', '클램프'] },
    { category: '비계', itemName: '수직재', specs: ['P38', 'P19', 'P09', 'P06', 'P04', 'P03', 'P02'] },
    { category: '비계', itemName: '받침 철물', specs: ['상부자키', '하부자키'] },
    { category: '비계', itemName: '발판', specs: ['5018', '5015', '5012', '5009', '5006', '5003', '4018', '4015', '4012', '4009', '4006', '4003', '3018', '2518', '2515', '2512'] },
    { category: '비계', itemName: '해치', specs: ['해치5018', '해치5015', '해치5012', '사다리'] },
    { category: '비계', itemName: '부속 철물', specs: ['브라켓'] },
    { category: '비계', itemName: '부속철물', specs: ['벽 이음재', '벽연결용철물', '브라켓'] },
    { category: '비계', itemName: '대각재', specs: ['비계용'] },
    { category: '비계', itemName: '기타', specs: ['트러스', '파이프', '클램프', '브라켓', '계단', '계단 난간대', '계단 손잡이', '버팀대', '전도방지대', '베이스잭', '방호선반', '망', '방지망', '비계망', '수직망', '안전망', '수직가세', '쪽발판', '바퀴', '개뼈', '개뼈?', '유로폼', '콘판넬', '코너판넬', '축소판넬1800', '축소판넬600', '축소판넬300', '토류판', '합판', '케이블타이', '인코너'] },
];
