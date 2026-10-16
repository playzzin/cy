import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MenuItem, SiteDataType } from '../../types/menu';
import { positionSiteKey } from '../../utils/linkedPositionMenus';
import { MENU_PATHS } from '../../constants/menuPaths';

export function previewMenuContainsPath(items: (MenuItem | string)[], path: string): boolean {
    const target = new URL(path, 'https://preview.invalid');
    return items.some(entry => {
        const item = typeof entry === 'string' ? { text: entry } : entry;
        if (item.hide) return false;
        const link = item.path || MENU_PATHS[item.text];
        if (link?.startsWith('/') && !link.startsWith('//')) {
            const url = new URL(link, 'https://preview.invalid');
            if (url.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '')
                && [...url.searchParams.entries()].filter(([key]) => key !== 'newTab').every(([key, value]) => target.searchParams.get(key) === value)) return true;
        }
        return Boolean(item.sub && previewMenuContainsPath(item.sub, path));
    });
}
export default function DevPreviewRouteGuard({ siteData, positionId, children }: { siteData: SiteDataType; positionId: string; children: React.ReactNode }) {
    const location = useLocation(), navigate = useNavigate();
    const allowed = ['/dashboard', '/profile'].includes(location.pathname) || previewMenuContainsPath(siteData[positionSiteKey(positionId)]?.menu || [], location.pathname + location.search);
    if (!allowed) return <div className="p-6" role="status"><h1 className="text-xl font-bold">이 직책에 제공되지 않는 페이지입니다</h1><p className="my-3">현재 페이지를 유지했습니다. 다른 직책으로 비교하거나 사용자 홈으로 이동할 수 있습니다.</p><button className="rounded border px-4 py-2" onClick={() => navigate('/dashboard')}>사용자 홈으로</button></div>;
    return <>{children}</>;
}
