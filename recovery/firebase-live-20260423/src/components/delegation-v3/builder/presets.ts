import { BuilderElement } from './types';

export interface PresetBlock {
    id: string;
    label: string;
    icon: string; // FontAwesome icon name or similar identifier
    element: Partial<BuilderElement>;
}

export const PRESETS: PresetBlock[] = [
    {
        id: 'title',
        label: '큰 제목',
        icon: 'heading',
        element: {
            type: 'text',
            width: 150,
            height: 20,
            style: {
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
                color: '#1e293b'
            },
            content: {
                text: '위 임 장'
            }
        }
    },
    {
        id: 'subtitle',
        label: '소제목',
        icon: 'font',
        element: {
            type: 'text',
            width: 100,
            height: 12,
            style: {
                fontSize: 14,
                fontWeight: 'bold',
                textAlign: 'left',
                color: '#334155'
            },
            content: {
                text: '1. 위임 내용'
            }
        }
    },
    {
        id: 'body-text',
        label: '본문 텍스트',
        icon: 'align-left',
        element: {
            type: 'text',
            width: 180,
            height: 30,
            style: {
                fontSize: 11,
                fontWeight: 'normal',
                textAlign: 'left',
                color: '#475569'
            },
            content: {
                text: '상기 본인은 귀사에게 다음 권한을 위임합니다.\n내용을 자유롭게 수정하세요.'
            }
        }
    },
    {
        id: 'date-field',
        label: '날짜 서명',
        icon: 'calendar-alt',
        element: {
            type: 'text',
            width: 100,
            height: 15,
            style: {
                fontSize: 12,
                fontWeight: 'normal',
                textAlign: 'right',
                color: '#1e293b'
            },
            content: {
                text: '2024년    월    일'
            }
        }
    },
    {
        id: 'signature-box',
        label: '서명 영역',
        icon: 'signature',
        element: {
            type: 'text',
            width: 80,
            height: 20,
            style: {
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'right',
                color: '#000000'
            },
            content: {
                text: '위임자 :                (인)'
            }
        }
    },
    {
        id: 'delegator-table',
        label: '위임자 명단 (표)',
        icon: 'table',
        element: {
            type: 'table',
            width: 180,
            height: 60,
            style: {
                fontSize: 10,
                fontWeight: 'normal',
                textAlign: 'center',
                color: '#000000'
            },
            content: {
                tableType: 'dynamic', // Changed to dynamic for worker data binding
                autoFitHeight: true,
                staticData: [], // Not used in dynamic mode
                // Roughly: No(5), Name(15), ID(20), Addr(35), Amount(15), Sign(10)
                columnWidths: [5, 15, 20, 30, 10, 10, 10]
            }
        }
    },
    {
        id: 'basic-table',
        label: '일반 표 (3x3)',
        icon: 'table',
        element: {
            type: 'table',
            width: 150,
            height: 40,
            style: {
                fontSize: 12,
                fontWeight: 'normal',
                textAlign: 'center',
                color: '#000000'
            },
            content: {
                tableType: 'static',
                staticData: [
                    ['항목 1', '항목 2', '항목 3'],
                    ['내용', '내용', '내용'],
                    ['내용', '내용', '내용']
                ],
                columnWidths: [33, 33, 33]
            }
        }
    }
];

// End of PRESETS

