import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faCheck, faPause, faPlay, faRotateRight, faBuilding } from '@fortawesome/free-solid-svg-icons';
import BusinessActionScene from './BusinessActionScene';
import { WorkforceMotionDetails } from './WorkforceMotionScene';
import { PartnerNetworkDetails } from './PartnerNetworkScene';
import { PARTNER_CHAT_DURATION } from './partnerNetworkContent';
import { ErpMotionDetails } from './ErpManagementScene';
import { ERP_ACTION_DURATION } from './erpMotionContent';
import { BusinessModule, MODULES, MODULE_LINKS, TOPICS } from './businessContent';
import { ACTION_BEATS } from './businessMotionChoreography';
import './BusinessMotionStory.css';

export const ACTION_DURATION = 6500;
export const WORKFORCE_ACTION_DURATION = 9000;
export const PARTNER_ACTION_DURATION = 9000;
const CHAPTER_COLORS = ['#8dddf5', '#c2acff', '#8de5c6', '#8dbdff', '#f0c28b'];
const INFO_TABS = ['핵심 업무', '기대 효과', '사업 이미지'];

export const StoryImage = ({ src, alt }: { src: string; alt: string }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    return failed ? <div className="cy-story-image-fallback" role="img" aria-label={alt}><FontAwesomeIcon icon={faBuilding} /><span>{alt}</span></div>
        : <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
};

type Props = {
    module: BusinessModule;
    paused: boolean;
    reducedMotion: boolean;
    onSelect: (id: string) => void;
};

const BusinessMotionStory: React.FC<Props> = ({ module, paused, reducedMotion, onSelect }) => {
    const index = MODULES.indexOf(module);
    const [step, setStep] = useState(0);
    const [replay, setReplay] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [actionPaused, setActionPaused] = useState(false);
    const [visible, setVisible] = useState(true);
    const [infoTab, setInfoTab] = useState(0);
    const [finished, setFinished] = useState(false);
    const [cinema, setCinema] = useState(false);
    const [documentIndex, setDocumentIndex] = useState(0);
    const elapsed = useRef(0);
    const generation = useRef(0);
    const sceneRef = useRef<HTMLDivElement>(null);
    const narrativeRef = useRef<HTMLDivElement>(null);
    const stepsRef = useRef<HTMLOListElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const stopped = paused || actionPaused || !visible || reducedMotion;
    const actionDuration = module.id === 'erp-site-management' ? ERP_ACTION_DURATION : module.id === 'partner-network' ? (step === 1 ? PARTNER_CHAT_DURATION : PARTNER_ACTION_DURATION) : module.id === 'manpower-supply' && step !== 2 ? WORKFORCE_ACTION_DURATION : ACTION_DURATION;
    const stepNumber = String(step + 1).padStart(2, '0');
    const totalSteps = String(module.workflow.length).padStart(2, '0');

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
        if (sceneRef.current) observer.observe(sceneRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (reducedMotion) setPlaying(false);
    }, [reducedMotion]);

    useEffect(() => {
        narrativeRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    }, [step]);

    useEffect(() => {
        const list = stepsRef.current;
        const selected = list?.querySelectorAll('button')[step];
        if (!list || !selected) return;
        const centerSelected = () => {
            if (list.scrollWidth <= list.clientWidth) return;
            const bounds = list.getBoundingClientRect();
            const button = selected.getBoundingClientRect();
            list.scrollTo({ left: list.scrollLeft + button.left - bounds.left - (list.clientWidth - button.width) / 2, behavior: reducedMotion ? 'auto' : 'smooth' });
        };
        centerSelected();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(centerSelected);
        observer?.observe(list);
        return () => observer?.disconnect();
    }, [step, reducedMotion]);

    // Preserve the remaining action time on pause, hidden tabs, and off-screen scenes.
    // A generation separates manual navigation/replay from the previous timer cleanup.
    useEffect(() => {
        if (!playing || stopped) return;
        const started = performance.now();
        const currentGeneration = generation.current;
        let completed = false;
        const timer = window.setTimeout(() => {
            completed = true;
            elapsed.current = 0;
            if (step < module.workflow.length - 1) setStep(value => value + 1);
            else { setPlaying(false); setFinished(true); }
        }, Math.max(0, actionDuration - elapsed.current));
        return () => {
            window.clearTimeout(timer);
            if (!completed && generation.current === currentGeneration) elapsed.current = Math.min(actionDuration, elapsed.current + performance.now() - started);
        };
    }, [playing, stopped, step, replay, module.workflow.length, actionDuration]);

    const selectStep = (next: number) => {
        generation.current += 1;
        elapsed.current = 0;
        setPlaying(false);
        setActionPaused(false);
        setFinished(false);
        setStep(next);
        setReplay(value => value + 1);
    };

    const togglePlayback = () => {
        if (!playing) sceneRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        setActionPaused(playing);
        const restart = finished || (step === module.workflow.length - 1 && !actionPaused);
        if (!playing && (restart || !actionPaused)) {
            generation.current += 1;
            elapsed.current = 0;
            if (restart) setStep(0);
            setReplay(value => value + 1);
            setFinished(false);
        }
        setPlaying(value => !value);
    };

    const replayAction = () => {
        sceneRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        generation.current += 1;
        elapsed.current = 0;
        setFinished(false);
        setActionPaused(false);
        setReplay(value => value + 1);
    };

    const stepKeys = (event: React.KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? module.workflow.length - 1 : (step + (event.key === 'ArrowRight' ? 1 : -1) + module.workflow.length) % module.workflow.length;
        selectStep(next);
        stepsRef.current?.querySelectorAll('button')[next]?.focus();
    };

    return <div className="cy-story" style={{ '--story-accent': CHAPTER_COLORS[index], '--film-duration': `${actionDuration}ms` } as React.CSSProperties} data-step-paused={stopped}>
        <nav className="cy-story-chapters" aria-label="사업 소개 장면 선택">
            {MODULES.map((item, i) => <button type="button" key={item.id} onClick={() => onSelect(item.id)} aria-pressed={module.id === item.id} aria-label={`${String(i + 1).padStart(2, '0')} ${TOPICS[i]} 상세 보기`} aria-controls="business-detail-content"><FontAwesomeIcon icon={item.icon} />{TOPICS[i]}</button>)}
        </nav>

        <div id="business-detail-content" className="cy-story-chapter-heading">
            <div><h2 id="business-detail-title">{module.title}<span className="cy-story-chapter-tag" aria-hidden="true">{module.level.toUpperCase()}</span></h2><p>{module.summary}</p></div>
        </div>

        <div className={`cy-story-theater${cinema ? ' is-cinema' : ''}`}>
            <div ref={sceneRef} className="cy-story-stage">
                <div className="cy-story-stage-label"><span><i /> {module.level.toUpperCase()} IN MOTION</span><div className="cy-cinema-toolbar"><span>{stepNumber} / {totalSteps}</span><button type="button" aria-pressed={cinema} aria-label="모션 크게 보기" onClick={() => setCinema(value => !value)}>{cinema ? '↙ 설명 함께 보기' : '↗ 모션 크게 보기'}</button></div></div>
                <ol ref={stepsRef} className={`cy-story-timeline${module.workflow.length > 5 ? ' is-extended' : ''}`} aria-label="운영 과정 액션" onKeyDown={stepKeys}>
                    {module.workflow.map((action, i) => <li key={action.title} className={i === step ? 'is-current' : i < step ? 'is-complete' : ''}>
                        <button type="button" onClick={() => selectStep(i)} aria-pressed={i === step} aria-label={`${i + 1}단계 ${action.title}`}>
                            <span className="cy-story-step-marker">{i < step ? <FontAwesomeIcon icon={faCheck} /> : String(i + 1).padStart(2, '0')}</span><span>{action.title}</span>
                        </button>
                        {i === step && <span className="cy-story-step-progress" aria-hidden="true"><span key={`${step}-${replay}`} className={playing || elapsed.current > 0 ? 'has-started' : ''} style={{ animationPlayState: playing && !stopped ? 'running' : 'paused', animationDuration: `${actionDuration}ms` }} /></span>}
                    </li>)}
                </ol>
                <BusinessActionScene module={module} step={step} replay={replay} documentIndex={documentIndex} paused={stopped} reducedMotion={reducedMotion} />
                <ol key={`beats-${step}-${replay}`} className="cy-story-action-beats" aria-label="선택한 액션의 동작 순서">{ACTION_BEATS[module.id][step].map(beat => <li key={beat}><i aria-hidden="true" />{beat}</li>)}</ol>
                <div className="cy-story-player">
                    <div className="cy-story-player-status" role="status">{reducedMotion ? '모션 감소 · 직접 단계 탐색' : paused ? '전체 모션 일시정지 중' : actionPaused ? '액션 모션 일시정지 중' : playing ? (visible ? '순서대로 재생 중' : '화면 밖에서 재생 대기 중') : finished ? '사업 흐름을 모두 살펴봤습니다' : '나의 속도로 살펴보세요'}<span>액션 {stepNumber} / {totalSteps}</span></div>
                    <div className="cy-story-player-controls" role="group" aria-label="사업 액션 재생 제어">
                        <button type="button" className="cy-story-autoplay" disabled={reducedMotion || paused} onClick={togglePlayback}><FontAwesomeIcon icon={playing ? faPause : faPlay} />{playing ? '자동 재생 일시정지' : finished ? '처음부터 재생' : '순서대로 재생'}</button>
                        <button type="button" onClick={replayAction} disabled={reducedMotion || paused} aria-label="선택한 액션 다시보기" title="선택한 액션 다시보기"><FontAwesomeIcon icon={faRotateRight} /></button>
                        <button type="button" onClick={() => setActionPaused(value => !value)} disabled={reducedMotion || paused} aria-pressed={actionPaused} aria-label={actionPaused ? '액션 모션 재생' : '액션 모션 일시정지'} title={actionPaused ? '액션 모션 재생' : '액션 모션 일시정지'}><FontAwesomeIcon icon={actionPaused ? faPlay : faPause} /></button>
                        <button type="button" onClick={() => selectStep(step - 1)} disabled={step === 0} aria-label="이전 액션"><FontAwesomeIcon icon={faArrowLeft} /></button>
                        <button type="button" onClick={() => selectStep(step + 1)} disabled={step === module.workflow.length - 1} aria-label="다음 액션"><FontAwesomeIcon icon={faArrowRight} /></button>
                    </div>
                </div>
            </div>
            <div ref={narrativeRef} className="cy-story-narrative" role="region" aria-label="선택한 사업 상세내용">
                <div className="cy-story-current-action" key={module.id === 'erp-site-management' ? step : `${step}-${replay}`} aria-live={playing && !stopped ? 'off' : 'polite'}>
                    <span className="cy-story-action-number">{stepNumber}</span>
                    <div><span className="cy-story-action-eyebrow">{playing ? '지금 재생 중인 액션' : '선택한 액션'}</span><h4>{module.workflow[step].title}</h4><p>{module.workflow[step].desc}</p>{module.id === 'manpower-supply' && <WorkforceMotionDetails step={step} />}{module.id === 'partner-network' && <PartnerNetworkDetails step={step} />}{module.id === 'erp-site-management' && <ErpMotionDetails step={step} documentIndex={documentIndex} onDocumentSelect={next => { setDocumentIndex(next); setPlaying(false); replayAction(); }} />}</div>
                </div>
                <div className="cy-story-information">
                    <div ref={tabsRef} className="cy-story-info-tabs" role="tablist" aria-label="사업 상세 정보" onKeyDown={event => {
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (infoTab + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
                        setInfoTab(next); tabsRef.current?.querySelectorAll('button')[next]?.focus();
                    }}>
                        {INFO_TABS.map((label, i) => <button type="button" role="tab" key={label} id={`cy-info-tab-${i}`} tabIndex={infoTab === i ? 0 : -1} aria-selected={infoTab === i} aria-controls="cy-story-info-panel" onClick={() => setInfoTab(i)}>{label}<span>0{[module.lessons.length, module.outcomes.length, module.gallery.length][i]}</span></button>)}
                    </div>
                    <div id="cy-story-info-panel" role="tabpanel" tabIndex={0} aria-labelledby={`cy-info-tab-${infoTab}`} className="cy-story-info-panel">
                        {infoTab === 0 && <details className="cy-story-description"><summary>사업 소개 자세히</summary><p>{module.description}</p></details>}
                        {infoTab < 2 ? <ul key={infoTab} className="cy-story-insights">{(infoTab === 0 ? module.lessons : module.outcomes).map((text, i) => <li key={text} style={{ '--piece-order': i } as React.CSSProperties}><span>{infoTab === 0 ? `0${i + 1}` : <FontAwesomeIcon icon={faCheck} />}</span><p>{text}</p></li>)}</ul>
                            : <div className="cy-story-gallery"><div className="cy-story-gallery-grid">{module.gallery.map(item => <figure key={item.src}><div><StoryImage src={item.src} alt={item.title} /><span>{item.label}</span></div><figcaption>{item.title}</figcaption></figure>)}</div><p>사업 이해를 돕는 참고 이미지이며 실제 수행 현장 사진과는 다를 수 있습니다.</p></div>}
                    </div>
                </div>
                <Link to={MODULE_LINKS[module.id].to} className="cy-story-workspace-link">{MODULE_LINKS[module.id].label}<FontAwesomeIcon icon={faArrowRight} /></Link>
            </div>
            <dl className="cy-story-metrics">{module.stats.map((stat, i) => <div key={stat.label} style={{ '--piece-order': i } as React.CSSProperties}><dt>{stat.label}</dt><dd>{stat.value}</dd><span>{stat.helper}</span></div>)}</dl>
        </div>
    </div>;
};

export default BusinessMotionStory;
