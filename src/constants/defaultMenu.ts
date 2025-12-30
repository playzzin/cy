import { SiteDataType } from '../types/menu';

export const DEFAULT_MENU_CONFIG: SiteDataType = {
    admin: {
        name: "청연ENG ERP",
        icon: "fa-shield-halved",
        menu: [
            {
                text: "현황관리",
                icon: "fa-chart-simple",
                sub: ["통합 현황판", "인원전체내역조회"]
            },
            {
                text: "통합DB", icon: "fa-circle-info"
            },
            {
                text: "출력 관리",
                icon: "fa-clipboard-list",
                sub: ["일보작성", "일보목록"]
            },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: [
                    "일급제",
                    "월급제",
                    "지원팀",
                    { text: "가불관리", sub: ["가불등록", "세금/가불"] }
                ]
            },
            {
                text: "서명관리",
                icon: "fa-pen-nib",
                sub: ["서명생성기", "서명위임장", "위임장v2"]
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
                sub: ["메뉴관리", "시스템 메시지 설정", "데이터 연결 점검"]
            },
            {
                text: "클라우드 저장소",
                icon: "fa-hdd"
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
            { text: "대표 인사말", icon: "fa-user-tie" }
        ]
    },
    safety: {
        name: "사장",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    learning: {
        name: "실장",
        icon: "fa-user-gear",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    equipment: {
        name: "팀장",
        icon: "fa-users",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    foreman: {
        name: "반장",
        icon: "fa-user-tag",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    skilled: {
        name: "기능공",
        icon: "fa-wrench",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    general: {
        name: "일반공",
        icon: "fa-person-digging",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    newcomer: {
        name: "신규자",
        icon: "fa-user-plus",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    // === 직책별 메뉴 (Position Mode) ===
    pos_ceo: {
        name: "대표",
        icon: "fa-crown",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
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
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_manager2: {
        name: "메니저2",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_manager3: {
        name: "메니저3",
        icon: "fa-user-tie",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_teamLead: {
        name: "팀장",
        icon: "fa-user-gear",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_foreman: {
        name: "반장",
        icon: "fa-users",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_general: {
        name: "일반",
        icon: "fa-user",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    },
    pos_newbie: {
        name: "신규",
        icon: "fa-user-plus",
        menu: [
            { text: "현황관리", icon: "fa-chart-simple", sub: ["통합 현황판", "인원전체내역조회"] },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
            {
                text: "급여관리",
                icon: "fa-money-bill-wave",
                sub: ["일급제", "월급제", "지원팀", { text: "가불관리", sub: ["가불등록", "세금/가불"] }]
            }
        ]
    }
};
