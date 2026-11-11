export interface MaterialCatalogEntry {
    category: string;
    itemName: string;
    specs: string[];
    unit?: string;
}

// 자재 품목 리스트.xlsx / Sheet1 B4:E43, G4:J44, L4:O13.
// Keep consecutive groups separate: 동바리상부 appears on both sides of 동바리하부.
export const EXCEL_MATERIAL_CATALOG: MaterialCatalogEntry[] = [
    {
        "category": "동바리",
        "itemName": "수직재",
        "specs": [
            "P-17",
            "P-12",
            "P-08",
            "P-04",
            "P-02"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "수평재",
        "specs": [
            "H-18",
            "H-15",
            "H-12",
            "H-09",
            "H-06",
            "H-03"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "동바리상부",
        "specs": [
            "상부자키"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "동바리하부",
        "specs": [
            "하부자키"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "동바리상부",
        "specs": [
            "W상부쟈키"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "대각재",
        "specs": [
            "B-1715",
            "B-1712",
            "B-1709",
            "B-1706",
            "대각재 핀"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "멍에재",
        "specs": [
            "4.0M",
            "3.0M",
            "2.5M",
            "2.0M",
            "1.5M",
            "1.0M"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "기타부속",
        "specs": [
            "카플링(소켓)",
            "이형클램프(자동)",
            "이형클램프(고정)",
            "일반클램프(자동)",
            "일반클램프(고정)"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "발판",
        "specs": [
            "5018",
            "5015",
            "5012",
            "5009",
            "5006",
            "4018",
            "4015",
            "4012",
            "4009"
        ],
        "unit": "EA"
    },
    {
        "category": "동바리",
        "itemName": "트러스",
        "specs": [
            "T-1500"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "수직재",
        "specs": [
            "P-38",
            "P-19",
            "P-09",
            "P-04",
            "P-02"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "수평재",
        "specs": [
            "H-18",
            "H-15",
            "H-12",
            "H-09",
            "H-06",
            "H-03"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "비계상부",
        "specs": [
            "상부자키"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "비계하부",
        "specs": [
            "하부자키",
            "경사하부"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "대각재",
        "specs": [
            "B-1918"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "발판",
        "specs": [
            "5018",
            "5015",
            "5012",
            "5009",
            "5006",
            "4018",
            "4015",
            "4012",
            "4009",
            "2518",
            "해치발판",
            "사다리",
            "계단발판"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "기타부속",
        "specs": [
            "비계버팀대",
            "일반클램프(자동)",
            "일반클램프(고정)"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "트러스",
        "specs": [
            "T-5400",
            "T-3600"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "브라켓",
        "specs": [
            "측벽-1500",
            "측벽-1200",
            "A형조정-900",
            "A형조정-600"
        ],
        "unit": "EA"
    },
    {
        "category": "비계",
        "itemName": "멍에재",
        "specs": [
            "3.0M",
            "2.5M",
            "2.0M",
            "1.5M"
        ],
        "unit": "EA"
    },
    {
        "category": "기타",
        "itemName": "파이프",
        "specs": [
            "6M",
            "4M",
            "3M",
            "2M",
            "1M"
        ],
        "unit": "EA"
    },
    {
        "category": "기타",
        "itemName": "안전망",
        "specs": [
            "1500D PVC",
            "톤백망"
        ],
        "unit": "EA"
    },
    {
        "category": "기타",
        "itemName": "방염틀",
        "specs": [
            "사각 방호선반",
            "코너 방호선반"
        ],
        "unit": "EA"
    },
    {
        "category": "기타",
        "itemName": "파손재",
        "specs": [
            "파손자재"
        ],
        "unit": "EA"
    }
];
