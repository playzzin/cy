import React, { useLayoutEffect, useState } from 'react';
import { Pause, Play, Waypoints } from 'lucide-react';
import AllianceNetworkMap from './AllianceNetworkMap';
import { scenes } from './allianceNetwork';
import useAllianceMotion from './useAllianceMotion';
import MotionFocusButton from './MotionFocusButton';
import './AllianceCooperationGraphic.css';

export default function AllianceCooperationGraphic() {
    const { ref, step, auto, running, reduced, toggle, select } = useAllianceMotion(scenes.length);
    const [compact, setCompact] = useState(() => window.innerWidth < 700);
    const scene = scenes[step];

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const resize = () => setCompact(el.clientWidth < 700);
        resize();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(resize);
            observer.observe(el);
            return () => observer.disconnect();
        }
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [ref]);

    return <figure ref={ref} className="ai-network" data-running={running} data-tone={scene.tone} data-scene={step + 1} data-compact={compact} aria-labelledby="ai-network-title">
        <div className="ai-network-bar">
            <div><Waypoints size={20} aria-hidden="true" /><b id="ai-network-title">현장 협력 네트워크</b></div>
            <div className="ai-player-actions"><MotionFocusButton target={ref} name="현장 협력망" />
            {reduced ? <span className="ai-network-manual">단계별 보기</span> :
                <button type="button" className="ai-network-play" onClick={toggle} aria-label={auto ? '협력 흐름 일시정지' : '협력 흐름 자동재생'}>
                    {auto ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{auto ? '일시정지' : '자동재생'}
                </button>}</div>
        </div>
            <div className="ai-network-controls" role="group" aria-label="협력 흐름 단계 선택">
                {scenes.map((item, i) => <button key={item.label} type="button" aria-pressed={i === step} aria-label={(i + 1) + '단계 ' + item.label}
                    onClick={() => select(i)}>
                    <small aria-hidden="true">{'0' + (i + 1)}</small><span>{item.label}</span>
                </button>)}
            </div>
        <div className="ai-network-drawing"><AllianceNetworkMap scene={scene} /></div>
        <figcaption className="ai-network-caption">
            <div className="ai-scene"><div className="ai-scene-index" aria-hidden="true"><b>{'0' + (step + 1)}</b> / 06</div>
                <div><strong>{scene.headline}</strong><p>{scene.detail}</p></div></div>
            <div className="ai-network-key"><span>대표사 간 업무 연계와 협력 시공사·임대사 운영망의 예시입니다.</span>
                <a href="#alliance-bidding" onClick={() => { const panel = document.querySelector<HTMLDetailsElement>('#alliance-bidding'); if (panel) panel.open = true; }}>공개입찰 흐름 보기</a></div>
        </figcaption>
    </figure>;
}
