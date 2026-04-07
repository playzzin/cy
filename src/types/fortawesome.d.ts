declare module '@fortawesome/react-fontawesome' {
    import { IconDefinition, Transform, IconLookup } from '@fortawesome/fontawesome-svg-core';
    import * as React from 'react';

    export interface FontAwesomeIconProps extends React.HTMLAttributes<SVGElement> {
        icon: IconDefinition | IconLookup | string | string[];
        mask?: IconDefinition | IconLookup | string | string[];
        className?: string;
        color?: string;
        spin?: boolean;
        spinPulse?: boolean;
        spinReverse?: boolean;
        pulse?: boolean;
        beat?: boolean;
        fade?: boolean;
        beatFade?: boolean;
        bounce?: boolean;
        shake?: boolean;
        border?: boolean;
        fixedWidth?: boolean;
        inverse?: boolean;
        listItem?: boolean;
        flip?: boolean | 'horizontal' | 'vertical' | 'both';
        size?: 'xs' | 'sm' | 'lg' | '1x' | '2x' | '3x' | '4x' | '5x' | '6x' | '7x' | '8x' | '9x' | '10x';
        pull?: 'left' | 'right';
        rotation?: 90 | 180 | 270;
        transform?: string | Transform;
        symbol?: boolean | string;
        title?: string;
        titleId?: string;
        swapOpacity?: boolean;
    }

    export class FontAwesomeIcon extends React.Component<FontAwesomeIconProps> {}
}
