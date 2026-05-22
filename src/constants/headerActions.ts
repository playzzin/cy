import { MenuItem } from '../types/menu';

export const DEFAULT_HEADER_ACTIONS: MenuItem[] = [
    {
        id: 'header-theme',
        text: '테마 전환',
        icon: 'fa-sun',
        action: 'theme'
    },
    {
        id: 'header-calculator',
        text: '계산기',
        icon: 'fa-calculator',
        action: 'calculator'
    },
    {
        id: 'header-camera',
        text: '카메라',
        icon: 'fa-camera',
        action: 'camera'
    },
    {
        id: 'header-position',
        text: '모드 선택',
        icon: 'fa-id-badge',
        action: 'position',
        roles: ['admin', '관리자', '사장', '실장', 'super_admin']
    },
    {
        id: 'header-admin',
        text: '관리자 메뉴',
        icon: 'fa-user-shield',
        action: 'admin',
        roles: ['admin', '관리자', '사장', '실장', 'super_admin']
    },
    {
        id: 'header-messages',
        text: '메시지함',
        icon: 'fa-envelope',
        action: 'messages'
    }
];
