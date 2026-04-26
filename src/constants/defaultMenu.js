Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MENU_CONFIG = void 0;
exports.DEFAULT_MENU_CONFIG = {
    admin: {
        name: "청연ENG ERP",
        icon: "fa-shield-halved",
        menu: [
            {
                text: "대시보드",
                icon: "fa-chart-line",
                path: "/dashboard"
            },
            {
                text: "현황관리",
                icon: "fa-chart-simple",
                sub: ["통합 현황판", "인원전체내역조회"]
            },
            {
                text: "통합DB", icon: "fa-circle-info", path: "/database/manpower-db"
            },
            {
                text: "출력 관리",
                icon: "fa-clipboard-list",
                sub: ["일보작성", "일보목록v2", "통합 일괄 등록", "일보 통계"]
            },
            {
                text: "지원 관리",
                icon: "fa-life-ring",
                sub: [
                    "지원비 설정",
                    "지원 현황판",
                    "지원비 단가 관리",
                    "숙소 관리",
                    "법인차량 관리"
                ]
            },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: [
                    "일급제",
                    "월급제",
                    "프리랜서 관리",
                    "지원팀",
                    "팀정산 관리",
                    { text: "가불관리", sub: ["가불등록", "세금/가불"] }
                ]
            },
            {
                text: "서명관리",
                icon: "fa-pen-nib",
                sub: ["서명등록", "서명위임장", "위임장v2", "위임장v5"]
            },
            {
                text: "자재관리",
                icon: "fa-boxes-stacked",
                sub: ["자재 마스터", "입고 등록", "출고 등록", "입출고 내역", "재고 현황", "현장별 재고"]
            },
            {
                text: "지원 관리",
                icon: "fa-hand-holding-dollar",
                sub: ["지원비 단가 관리", "인력 교류 정산"]
            },
            {
                text: "시스템 관리",
                icon: "fa-gears",
                sub: [
                    "메뉴관리",
                    "시스템 메시지 설정",
                    "데이터 연결 점검",
                    { text: "현장 관리", path: "/site/management" },
                    { text: "마감 현장 관리", path: "/site/management/closed" }
                ]
            },
            {
                text: "클라우드 저장소",
                icon: "fa-hdd",
                sub: ["로컬 저장소", "구글 드라이브"]
            },
            {
                text: "설계도",
                icon: "fa-sitemap",
                sub: ["정산 시스템 설계도", "DB 설계도", "급여 정산 설계도"]
            },
            {
                text: "세무 관리",
                icon: "fa-file-invoice-dollar",
                sub: ["세무 대시보드", "세금계산서 발행", "수금 관리(원청)", "지급 관리(업체)"]
            },
            {
                text: "노무비 지급명세서 생성기",
                icon: "fa-file-contract",
                path: "/payroll/labor-cost-statement-generator"
            },
            {
                text: "스마트 메모",
                icon: "fa-sticky-note",
                path: "/memos"
            },
            {
                text: "할일",
                icon: "fa-check-square",
                path: "/todo"
            }
        ],
        positionConfig: [
            { id: 'full', name: '전체 메뉴', icon: 'fa-shield-halved', color: 'from-red-600 to-red-400', order: 0 },
            { id: 'ceo', name: '대표', icon: 'fa-crown', color: 'from-amber-500 to-yellow-400', order: 1 },
            { id: 'manager1', name: '메니저1', icon: 'fa-user-tie', color: 'from-blue-600 to-blue-400', order: 2 },
            { id: 'manager2', name: '메니저2', icon: 'fa-user-tie', color: 'from-indigo-600 to-indigo-400', order: 3 },
            { id: 'manager3', name: '메니저3', icon: 'fa-user-tie', color: 'from-purple-600 to-purple-400', order: 4 },
            { id: 'teamLead', name: '팀장', icon: 'fa-user-gear', color: 'from-emerald-600 to-emerald-400', order: 5 },
            { id: 'foreman', name: '반장', icon: 'fa-users', color: 'from-teal-600 to-teal-400', order: 6 },
            { id: 'general', name: '일반', icon: 'fa-user', color: 'from-slate-500 to-slate-400', order: 7 },
            { id: 'newbie', name: '신규', icon: 'fa-user-plus', color: 'from-pink-500 to-rose-400', order: 8 }
        ]
    },
    company: {
        name: "개발중",
        icon: "fa-building",
        menu: [
            {
                text: "세금관리",
                icon: "fa-file-invoice",
                sub: ["세금계산서 발행", "세금계산서 거래장", "미수금 대시보드", "미수금 관리"]
            },
            {
                text: "숙소관리",
                icon: "fa-home",
                sub: ["숙소 관리", "가불 및 공제"]
            },
            {
                text: "자재관리",
                icon: "fa-boxes-stacked",
                sub: ["자재 마스터", "입고 등록", "출고 등록", "입출고 내역", "재고 현황", "현장별 재고"]
            },
            {
                text: "지원 관리",
                icon: "fa-hand-holding-dollar",
                sub: ["지원비 단가 관리", "인력 교류 정산"]
            },
            {
                text: "개발자 도구",
                icon: "fa-robot",
                sub: ["에이전트 플레이그라운드"]
            }
        ]
    },
    test: {
        name: "청연SITE",
        icon: "fa-flask",
        menu: [
            { text: "디자인 관리", icon: "fa-palette" },
            { text: "회사소개", icon: "fa-building" },
            { text: "대표 인사말", icon: "fa-user-tie" },
            { text: "프로젝트", icon: "fa-project-diagram", path: "/gallery/projects" },
            { text: "조직도", icon: "fa-sitemap", path: "/cheongyeon/organization" }
        ]
    },
    // === 직책별 메뉴 (Position Mode) ===
    pos_ceo: {
        name: "대표",
        icon: "fa-crown",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            },
            {
                text: "세금관리",
                icon: "fa-file-invoice",
                sub: ["세금계산서 발행", "세금계산서 거래장", "미수금 대시보드", "미수금 관리"]
            },
            {
                text: "숙소관리",
                icon: "fa-home",
                sub: ["숙소 관리", "가불 및 공제"]
            },
            {
                text: "자재관리",
                icon: "fa-boxes-stacked",
                sub: ["자재 마스터", "입고 등록", "출고 등록", "입출고 내역", "재고 현황", "현장별 재고"]
            },
            {
                text: "지원 관리",
                icon: "fa-hand-holding-dollar",
                sub: ["지원비 단가 관리", "인력 교류 정산"]
            }
        ]
    },
    pos_manager1: {
        name: "메니저1",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_manager2: {
        name: "메니저2",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_manager3: {
        name: "메니저3",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_teamLead: {
        name: "팀장",
        icon: "fa-user-gear",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_foreman: {
        name: "반장",
        icon: "fa-users",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_general: {
        name: "일반",
        icon: "fa-user",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_newbie: {
        name: "신규",
        icon: "fa-user-plus",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록v2"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", "팀정산 관리", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    }
};
