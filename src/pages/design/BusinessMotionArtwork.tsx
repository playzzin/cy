import React, { useId } from 'react';
import construction from '../../assets/business-motion/construction-atlas-v1.png';
import rental from '../../assets/business-motion/rental-atlas-v1.png';
import workforce from '../../assets/business-motion/workforce-atlas-v1.png';
import erp from '../../assets/business-motion/erp-atlas-v1.png';
import partners from '../../assets/business-motion/partners-atlas-v1.png';
import type { BusinessModule } from './businessContent';

type ModuleId = BusinessModule['id'];
type Atlas = { src: string; regions: [number, number, number, number][] };
// Original alpha/pixels remain intact. Viewports isolate each generated object.
export const MOTION_ARTWORK: Record<ModuleId, Atlas> = {
    'system-dongbari-scaffolding': { src: construction, regions: [[38, 218, 598, 329], [661, 8, 568, 605], [101, 585, 522, 637], [829, 632, 239, 586]] },
    'material-rental': { src: rental, regions: [[52, 20, 539, 645], [603, 207, 651, 402], [42, 710, 561, 468], [574, 640, 664, 548]] },
    'manpower-supply': { src: workforce, regions: [[86, 8, 622, 610], [844, 22, 265, 599], [192, 618, 316, 615], [835, 636, 268, 600]] },
    'erp-site-management': { src: erp, regions: [[158, 66, 269, 537], [634, 36, 565, 578], [82, 632, 459, 584], [635, 727, 595, 458]] },
    'partner-network': { src: partners, regions: [[27, 60, 577, 527], [636, 98, 608, 508], [30, 654, 569, 554], [635, 736, 601, 407]] },
};
type SpriteProps = { moduleId: ModuleId; tile: number; x: number; y: number; width: number; height: number; className?: string; object?: string };
export const MotionSprite = ({ moduleId, tile, x, y, width, height, className, object }: SpriteProps) => {
    const atlas = MOTION_ARTWORK[moduleId];
    const cropId = useId().replace(/:/g, '');
    const [left, top, regionWidth, regionHeight] = atlas.regions[tile];
    return <svg x={x} y={y} width={width} height={height} viewBox={atlas.regions[tile].join(' ')} overflow="hidden" className={className} data-motion-object={object} preserveAspectRatio="xMidYMid meet">
        <defs><clipPath id={`cy-sprite-${cropId}`}><rect x={left} y={top} width={regionWidth} height={regionHeight} /></clipPath></defs>
        <image href={atlas.src} width="1254" height="1254" clipPath={`url(#cy-sprite-${cropId})`} />
    </svg>;
};
export const BusinessVisualThumbnail = ({ moduleId }: { moduleId: string }) => {
    if (!(moduleId in MOTION_ARTWORK)) return null;
    const id = moduleId as ModuleId;
    const main = id === 'system-dongbari-scaffolding' || id === 'erp-site-management' ? 1 : 0;
    const secondary = id === 'material-rental' ? 1 : id === 'partner-network' ? 3 : id === 'manpower-supply' ? 1 : 2;
    return <svg viewBox="0 0 320 170" className="cy-art-thumbnail" aria-hidden="true"><ellipse cx="164" cy="151" rx="137" ry="12" fill="#56c9e9" opacity=".09" /><MotionSprite moduleId={id} tile={main} x={25} y={6} width={190} height={152} /><MotionSprite moduleId={id} tile={secondary} x={184} y={63} width={113} height={98} /></svg>;
};
