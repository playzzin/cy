import React, { forwardRef, useId } from 'react';
import catalog from './cy-icon-catalog.json';

export type CyIconName = keyof typeof catalog;
export type CyIconVariant = 'outline' | 'duotone';

interface IconPath {
    d: string;
    accent?: boolean;
    filled?: boolean;
}

export interface CyIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name' | 'children'> {
    name: CyIconName;
    size?: number | string;
    variant?: CyIconVariant;
    accent?: string;
    title?: string;
}

/** 24px 기준 CY 업무 아이콘. 기본 색상은 부모의 글자색을 따릅니다. */
export const CyIcon = forwardRef<SVGSVGElement, CyIconProps>(function CyIcon(
    { name, size = 24, variant = 'duotone', accent, title, ...props },
    ref
) {
    const titleId = useId();
    const accessible = Boolean(title || props['aria-label'] || props['aria-labelledby']);
    const paths: IconPath[] = catalog[name].paths;

    return (
        <svg
            ref={ref}
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={accessible ? 'img' : undefined}
            aria-hidden={accessible ? undefined : true}
            aria-labelledby={title ? titleId : undefined}
            focusable="false"
            {...props}
        >
            {title && <title id={titleId}>{title}</title>}
            {paths.map((path, index) => {
                const color = variant === 'duotone' && path.accent
                    ? accent ?? 'var(--cy-icon-accent, currentColor)'
                    : 'currentColor';
                return (
                    <path
                        key={index}
                        d={path.d}
                        stroke={color}
                        fill={variant === 'duotone' && path.filled ? color : 'none'}
                        fillOpacity={variant === 'duotone' && path.filled ? 0.12 : undefined}
                    />
                );
            })}
        </svg>
    );
});
