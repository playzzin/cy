import { useEffect, useRef, useState } from 'react';

const motionQuery = '(prefers-reduced-motion: reduce)';
export const ALLIANCE_SCENE_MS = 6500;
export default function useAllianceMotion(count: number) {
    const ref = useRef<HTMLElement>(null);
    const [step, setStep] = useState(0);
    const [selectionId, setSelectionId] = useState(0);
    const [reduced, setReduced] = useState(() => window.matchMedia?.(motionQuery).matches ?? false);
    const [auto, setAuto] = useState(() => !reduced);
    const [inView, setInView] = useState(true);
    const [visible, setVisible] = useState(() => !document.hidden);
    const running = auto && inView && visible && !reduced;
    useEffect(() => {
        const media = window.matchMedia?.(motionQuery);
        const change = () => { setReduced(Boolean(media?.matches)); if (media?.matches) setAuto(false); };
        const visibility = () => setVisible(!document.hidden);
        media?.addEventListener?.('change', change);
        document.addEventListener('visibilitychange', visibility);
        const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting), { threshold: .1 },
        );
        if (ref.current) observer?.observe(ref.current);
        return () => {
            media?.removeEventListener?.('change', change);
            document.removeEventListener('visibilitychange', visibility);
            observer?.disconnect();
        };
    }, []);
    useEffect(() => {
        if (!running) return;
        const timer = window.setInterval(() => setStep(current => (current + 1) % count), ALLIANCE_SCENE_MS);
        return () => window.clearInterval(timer);
    }, [running, count, selectionId]);
    return { ref, step, selectionId, reduced, auto, running, toggle: () => setAuto(value => !value),
        select: (index: number) => { setStep(index); setSelectionId(value => value + 1); } };
}
