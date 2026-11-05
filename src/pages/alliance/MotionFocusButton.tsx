import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function MotionFocusButton({ target, name }: { target: React.RefObject<HTMLElement>; name: string }) {
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState(false);
    useEffect(() => {
        const changed = () => { setExpanded(document.fullscreenElement === target.current); setError(false); };
        document.addEventListener('fullscreenchange', changed);
        return () => document.removeEventListener('fullscreenchange', changed);
    }, [target]);
    if (!document.fullscreenEnabled) return null;
    const toggle = async () => {
        try {
            if (document.fullscreenElement === target.current) await document.exitFullscreen();
            else await target.current?.requestFullscreen();
        } catch { setError(true); }
    };
    return <>
        <button type="button" className="ai-network-play" onClick={toggle} aria-label={name + (expanded ? ' 전체화면 닫기' : ' 전체화면 보기')}>
            {expanded ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}{expanded ? '축소' : '확대'}
        </button>
        {error && <small role="status">현재 화면에서 확대할 수 없습니다.</small>}
    </>;
}
