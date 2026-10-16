import React, { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPause, faPlay, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import metallicLogo from '../../assets/cheongyeon-metallic-logo.png';
import './BusinessMotionIntro.css';

type Props = {
    children?: (playback: { paused: boolean; reducedMotion: boolean }) => React.ReactNode;
};

// Each clip reveals a portion of the supplied artwork in its original coordinates.
// The final image restores the full artwork without changing the logo itself.
const LOGO_LAYERS = [
    { name: 'building-left', points: '8,920 8,485 173,470 188,640 285,746 421,771 625,769 624,918' },
    { name: 'building-right', points: '833,922 841,710 906,616 1128,603 1236,757 1240,922' },
    { name: 'crane', points: '746,175 1198,185 1204,407 1093,415 1092,718 1045,718 1045,362 744,266' },
    { name: 'silver-c', points: '734,275 644,401 463,400 383,419 325,479 296,563 297,660 338,728 422,767 633,768 585,895 386,894 279,849 201,749 175,621 189,474 254,370 362,298 455,275' },
    { name: 'silver-y', points: '510,435 663,435 837,694 721,953 601,953 699,707' },
    { name: 'blue-wing', points: '881,358 1045,358 827,670 746,553' },
    { name: 'wordmark', points: '100,976 1151,976 1151,1088 100,1088' },
];

const BusinessMotionIntro: React.FC<Props> = ({ children }) => {
    const instanceId = useId().replace(/:/g, '');
    const sectionRef = useRef<HTMLElement>(null);
    const [replay, setReplay] = useState(0);
    const [paused, setPaused] = useState(false);
    const [visible, setVisible] = useState(true);
    const [pageVisible, setPageVisible] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const updateMotion = () => setReducedMotion(media?.matches ?? false);
        const updateVisibility = () => setPageVisible(!document.hidden);
        media?.addEventListener('change', updateMotion);
        document.addEventListener('visibilitychange', updateVisibility);
        updateVisibility();
        const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
            ([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 }
        );
        if (sectionRef.current) observer?.observe(sectionRef.current);
        return () => {
            media?.removeEventListener('change', updateMotion);
            document.removeEventListener('visibilitychange', updateVisibility);
            observer?.disconnect();
        };
    }, []);

    const isPaused = paused || !visible || !pageVisible;
    const restart = () => { setPaused(false); setReplay((value) => value + 1); };

    return (
        <section id="business-intro" ref={sectionRef} className="cy-motion-intro" aria-labelledby="business-title" data-paused={isPaused} data-reduced-motion={reducedMotion}>
            <div className="cy-motion-grid" aria-hidden="true" />
            <div className="cy-motion-topline">
                <span><span className="cy-motion-status-dot" /> CHEONG YEON SYSTEM</span>
                <div className="cy-motion-controls" role="group" aria-label="인트로 재생 제어">
                    <button type="button" onClick={restart} disabled={reducedMotion}><FontAwesomeIcon icon={faRotateRight} />다시보기</button>
                    <button type="button" onClick={() => setPaused((value) => !value)} disabled={reducedMotion} aria-label={paused ? '전체 모션 재생' : '전체 모션 일시정지'} aria-pressed={paused}><FontAwesomeIcon icon={paused ? faPlay : faPause} /><span>{paused ? '재생' : '일시정지'}</span></button>
                </div>
            </div>
            <div key={replay} className="cy-motion-sequence">
                <div className="cy-motion-stage">
                    <div className="cy-motion-copy">
                        <h1 id="business-title" tabIndex={-1}>현장의 시작부터,<br /><em>완성까지 함께.</em></h1>
                        <p className="cy-motion-description">시공부터 인력과 데이터까지, 하나로 연결되는 청연의 전문성.</p>
                    </div>
                    <div className="cy-motion-artwork">
                        <div className="cy-motion-orbit" aria-hidden="true" />
                        <svg className="cy-motion-logo" viewBox="0 0 1254 1254" role="img" aria-label="청연 시스템 메탈릭 건설 로고">
                            <defs>
                                {LOGO_LAYERS.map((layer) => <clipPath key={layer.name} id={`${instanceId}-${layer.name}`}><polygon points={layer.points} /></clipPath>)}
                                <clipPath id={`${instanceId}-metal`}>
                                    {LOGO_LAYERS.filter((layer) => ['silver-c', 'silver-y', 'blue-wing'].includes(layer.name)).map((layer) => <polygon key={layer.name} points={layer.points} />)}
                                </clipPath>
                                <linearGradient id={`${instanceId}-shine`}><stop stopColor="white" stopOpacity="0" /><stop offset=".5" stopColor="white" stopOpacity=".65" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
                            </defs>
                            <image className="cy-motion-logo-complete" href={metallicLogo} width="1254" height="1254" />
                            {LOGO_LAYERS.map((layer) => <g key={layer.name} className={`cy-motion-layer cy-motion-${layer.name}`}>
                                <image href={metallicLogo} width="1254" height="1254" clipPath={`url(#${instanceId}-${layer.name})`} />
                            </g>)}
                            <g className="cy-motion-wireframe" fill="none" stroke="#75e4ff" strokeWidth="2" aria-hidden="true">
                                {LOGO_LAYERS.slice(3, 6).map((layer) => <polygon key={layer.name} points={layer.points} pathLength="1" />)}
                            </g>
                            <g clipPath={`url(#${instanceId}-metal)`} aria-hidden="true"><rect className="cy-motion-shine" x="-400" y="0" width="240" height="1254" fill={`url(#${instanceId}-shine)`} /></g>
                        </svg>
                    </div>
                </div>

            </div>
            {children?.({ paused: isPaused, reducedMotion })}
            <p className="cy-motion-footnote">{reducedMotion ? '모션 감소 설정에 따라 정지 화면으로 표시합니다.' : '로고에서 이어지는 다섯 가지 전문성'}<span>사업 이미지는 이해를 돕기 위한 참고 이미지입니다.</span></p>
        </section>
    );
};

export default BusinessMotionIntro;
