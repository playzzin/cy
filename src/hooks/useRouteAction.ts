import { useCallback } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';

export interface RouteActionOptions extends NavigateOptions {
    openInNewTab?: boolean;
}

const isExternalRoute = (path: string): boolean => {
    return /^(https?:)?\/\//i.test(path) || /^(mailto|tel):/i.test(path);
};

export const useRouteAction = () => {
    const navigate = useNavigate();

    return useCallback((path: string, options: RouteActionOptions = {}) => {
        const target = String(path || '').trim();
        if (!target) return;

        if (options.openInNewTab) {
            window.open(target, '_blank', 'noopener,noreferrer');
            return;
        }

        if (isExternalRoute(target)) {
            window.location.assign(target);
            return;
        }

        const { openInNewTab, ...navigateOptions } = options;
        navigate(target, navigateOptions);
    }, [navigate]);
};
