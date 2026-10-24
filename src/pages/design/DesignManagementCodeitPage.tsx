import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BusinessMotionIntro from './BusinessMotionIntro';
import BusinessMotionStory from './BusinessMotionStory';
import { MODULES } from './businessContent';
import './DesignManagementPage.css';
import './BusinessCompactLayout.css';

const scrollTo = (element: HTMLElement | null) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
};

const DesignManagementCodeitPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeModule = MODULES.find(item => item.id === searchParams.get('module')) || MODULES[0];
    const detailRef = useRef<HTMLElement>(null);
    const pendingFocus = useRef(false);

    useEffect(() => {
        document.body.classList.add('dashboard2-codeit-theme');
        return () => document.body.classList.remove('dashboard2-codeit-theme');
    }, []);

    const explore = () => {
        detailRef.current?.focus({ preventScroll: true });
        scrollTo(detailRef.current);
    };

    useEffect(() => {
        if (!pendingFocus.current) return;
        explore();
        pendingFocus.current = false;
    }, [activeModule.id]);

    const selectModule = (id: string) => {
        if (id === activeModule.id) { explore(); return; }
        pendingFocus.current = true;
        const next = new URLSearchParams(searchParams);
        next.set('module', id);
        setSearchParams(next, { preventScrollReset: true });
    };

    return <div className="business-page business-motion-page">
        <div className="business-container">
            <div className="business-breadcrumb"><Link to="/dashboard2">청연ENG</Link><span>/</span><span>사업영역</span></div>
            <BusinessMotionIntro>
                {playback => <section ref={detailRef} tabIndex={-1} id="business-detail" aria-labelledby="business-detail-title">
                    <BusinessMotionStory key={activeModule.id} module={activeModule} {...playback} onSelect={selectModule} />
                </section>}
            </BusinessMotionIntro>
        </div>
    </div>;
};

export default DesignManagementCodeitPage;
