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
            }
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
            {
                text: "현황관리",
                icon: "fa-chart-simple",
                sub: ["통합 현황판", "인원전체내역조회"]
            },
            { text: "통합DB", icon: "fa-circle-info" },
            { text: "출력 관리", icon: "fa-clipboard-list", sub: ["일보작성", "일보목록"] },
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
            }
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
