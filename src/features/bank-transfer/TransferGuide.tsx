import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, FileSpreadsheet, Landmark, ListChecks, Search, ShieldCheck, X } from 'lucide-react';
import { TRANSFER_GUIDE_CHAPTERS, TRANSFER_GUIDE_FAQ } from './transferGuideContent';
import './TransferGuide.css';
import TransferGuideSimulator from './TransferGuideSimulator';

// @guide-sync 목차 순서는 transferGuideContent.ts와 transferGuideSimulation.ts가 공유한다.
// 단계 변경 시 FAQ.chapter 및 BankTransferPage.tsx의 initialChapter 진입값도 맞춘다.
function GuideBody({ initialChapter }: { initialChapter: number }) {
    const [chapterIndex, setChapterIndex] = useState(initialChapter);
    const [faq, setFaq] = useState(false);
    const [theater, setTheater] = useState(false);
    const [query, setQuery] = useState('');
    const readingPane = useRef<HTMLDivElement>(null);
    const navigation = useRef<HTMLElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const focusHeading = useRef(false);
    const chapter = TRANSFER_GUIDE_CHAPTERS[chapterIndex];
    const selectChapter = (index: number) => { setChapterIndex(index); setFaq(false); };
    const normalizedQuery = query.replace(/\s/g, '').toLocaleLowerCase();
    const matches = TRANSFER_GUIDE_FAQ.filter(item => `${item.question}${item.answer}`.replace(/\s/g, '').toLocaleLowerCase().includes(normalizedQuery));
    useEffect(() => {
        readingPane.current?.scrollTo?.({ top: 0 });
        navigation.current?.querySelector('[aria-current=step]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        if (focusHeading.current) { heading.current?.focus(); focusHeading.current = false; }
    }, [chapterIndex, faq]);
    const moveChapter = (index: number) => { focusHeading.current = true; selectChapter(index); };
    return <>
        <div className={`bt-guide-layout ${theater && !faq ? 'is-theater' : ''}`}>
            <aside className="bt-guide-sidebar">
                <p className="bt-guide-nav-label">처음이라면 순서대로</p>
                <nav ref={navigation} aria-label="사용설명서 목차">{TRANSFER_GUIDE_CHAPTERS.map((item, index) => <button type="button" key={item.title} aria-current={!faq && chapterIndex === index ? 'step' : undefined} onClick={() => selectChapter(index)}><span className="bt-guide-chapter-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ChevronRight size={14} /></button>)}</nav>
                <button type="button" className={`bt-guide-faq-link ${faq ? 'is-active' : ''}`} aria-pressed={faq} onClick={() => setFaq(true)}><CircleHelp size={18} /><span>막혔을 때 · 자주 묻는 질문</span></button>
                <div className="bt-guide-sidebar-note"><ShieldCheck size={18} /><p>설명서는 읽기·연습용입니다.<br />실제 송금 목록과 저장 상태는 바뀌지 않습니다.</p></div>
            </aside>
            <div className="bt-guide-reading" ref={readingPane}>
                {faq ? <section aria-labelledby="bt-guide-faq-title">
                    <span className="bt-guide-eyebrow">TROUBLESHOOTING</span><h3 id="bt-guide-faq-title">어디에서 막히셨나요?</h3><p className="bt-guide-intro">증상이나 궁금한 단어로 해결 방법을 찾아보세요.</p>
                    <label className="bt-guide-search"><Search size={18} /><input aria-label="설명서 질문 검색" placeholder="예: 퇴사자, 저장, 다운로드, 중복" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="설명서 검색 지우기" onClick={() => setQuery('')}><X size={15} /></button>}</label>
                    <p className="bt-guide-search-count" role="status">{matches.length}개의 도움말</p>
                    <div className="bt-guide-faq-list">{matches.map(item => <details key={`${query}:${item.question}`} open={normalizedQuery ? true : undefined}><summary>{item.question}<ChevronRight size={16} /></summary><div><p>{item.answer}</p><button type="button" onClick={() => moveChapter(item.chapter)}>{TRANSFER_GUIDE_CHAPTERS[item.chapter].title} 안내 보기 <ArrowRight size={14} /></button></div></details>)}</div>
                    {!matches.length && <div className="bt-guide-no-results"><CircleHelp size={30} /><strong>일치하는 도움말이 없습니다.</strong><p>짧은 단어로 검색하거나 목차에서 관련 단계를 선택하세요.</p><button type="button" onClick={() => setQuery('')}>전체 질문 보기</button></div>}
                </section> : <section aria-labelledby="bt-guide-chapter-title">
                    <div className="bt-guide-chapter-heading"><div><span className="bt-guide-eyebrow">STEP {String(chapterIndex + 1).padStart(2, '0')} / {String(TRANSFER_GUIDE_CHAPTERS.length).padStart(2, '0')}</span><h3 id="bt-guide-chapter-title" ref={heading} tabIndex={-1}>{chapter.title}</h3></div><span className="bt-guide-reading-badge">따라 하기</span></div>
                    <p className="bt-guide-intro">{chapter.intro}</p>
                    <button type="button" className="bt-guide-theater-toggle" aria-pressed={theater} onClick={() => setTheater(!theater)}>{theater ? '목차와 함께 보기' : '시연 화면 크게 보기'}</button>
                    <TransferGuideSimulator key={chapterIndex} chapter={chapterIndex} onNext={chapterIndex < TRANSFER_GUIDE_CHAPTERS.length - 1 ? () => moveChapter(chapterIndex + 1) : undefined} />
                    <details className="bt-guide-written-steps"><summary>이 단계의 자세한 사용법 읽기</summary><ol className="bt-guide-instructions">{chapter.steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><h4>{step.title}</h4><p>{step.text}</p></div></li>)}</ol></details>
                    <div className="bt-guide-caution"><ShieldCheck size={20} /><div><strong>실수 방지 · {chapter.caution.title}</strong><p>{chapter.caution.text}</p></div></div>
                    <div className="bt-guide-check"><Check size={18} /><p>{chapter.check}</p></div>
                </section>}
            </div>
        </div>
        <footer className="bt-guide-footer"><span>{faq ? <span className="bt-guide-footer-hint">궁금한 점을 해결하고 작업을 이어가세요.</span> : <><b>{chapterIndex + 1} / {TRANSFER_GUIDE_CHAPTERS.length} 단계</b><span className="bt-guide-footer-hint"> · 내 속도로 읽고 이동하세요.</span></>}</span><div>{faq ? <button type="button" onClick={() => selectChapter(chapterIndex)}><ArrowLeft size={15} /> 단계 안내로</button> : <>
            <button type="button" disabled={chapterIndex === 0} onClick={() => moveChapter(chapterIndex - 1)}><ArrowLeft size={15} /> 이전</button>
            {chapterIndex < TRANSFER_GUIDE_CHAPTERS.length - 1 ? <button type="button" className="bt-guide-primary" onClick={() => moveChapter(chapterIndex + 1)}>다음 단계 <ArrowRight size={15} /></button> : <Dialog.Close className="bt-guide-primary">설명서 닫고 작업하기 <Check size={15} /></Dialog.Close>}
        </>}</div></footer>
    </>;
}

export default function TransferGuide({ initialChapter = 0 }: { initialChapter?: number }) {
    const [open, setOpen] = useState(false);
    const title = useRef<HTMLHeadingElement>(null);
    return <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="bt-guide-trigger"><BookOpen size={16} /> 사용설명서 <span>시연·연습</span></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="bt-guide-overlay" /><Dialog.Content className="bt-guide-dialog" onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }}>
            <header className="bt-guide-header"><div className="bt-guide-header-copy"><span className="bt-guide-book"><BookOpen size={22} /></span><div><span className="bt-guide-eyebrow">국민은행 송금 · 운영 가이드</span><Dialog.Title ref={title} tabIndex={-1}>처음부터, 차근차근.</Dialog.Title><Dialog.Description>실제 화면을 따라 보고, 가상 자료로 직접 연습하세요</Dialog.Description></div></div><Dialog.Close aria-label="사용설명서 닫기" className="bt-guide-close"><X size={21} /></Dialog.Close></header>
            <div className="bt-guide-overview"><span><FileSpreadsheet size={16} /><span className="bt-guide-wide-label">이 화면에서 파일 준비</span><span className="bt-guide-short-label">파일 준비</span></span><ChevronRight size={14} /><span><Landmark size={16} /><span className="bt-guide-wide-label">은행에서 실제 이체</span><span className="bt-guide-short-label">은행 이체</span></span><ChevronRight size={14} /><span><ListChecks size={16} /><span className="bt-guide-wide-label">결과 확인·기록</span><span className="bt-guide-short-label">결과 기록</span></span></div>
            {open && <GuideBody initialChapter={Math.min(Math.max(initialChapter, 0), TRANSFER_GUIDE_CHAPTERS.length - 1)} />}
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>;
}
