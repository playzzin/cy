import React from 'react';
import { ArrowUpRight, Boxes, Building2, Check, CheckCheck, Code2, HardHat, Layers3, Pause, Play } from 'lucide-react';
import { constructionBase, developmentBase, representatives } from './allianceRepresentatives';
import useAllianceMotion from './useAllianceMotion';
import { CardBeam, MotionBeam, MotionPulse } from './AllianceMotionEffects';
import './AlliancePartnerCards.css';

const highlights = [
    { key: 'crew', title: '시공 인프라', text: '청연ENG가 동일 공정의 협력 시공사·지원팀을 모집해 플랫폼의 시공 기반을 확대합니다.' },
    { key: 'developer', title: '개발사 선정', text: '그뚠엔터는 업종별 ERP를 각각 구축하고 업무 자동화와 통합 플랫폼 개발에 집중합니다.' },
    { key: 'builder', title: '건설사 모집', text: '업계 영향력과 발주·협력망, 실증 현장을 갖춘 대표 건설사 1개사를 선정합니다.' },
    { key: 'rental', title: '임대사 모집', text: '업계 영향력과 자재·물류 인프라를 보유한 대표 임대사 1개사를 선정합니다.' },
] as const;
const cardPaths = {
    developer: 'M230 130 C230 260 365 320 500 320',
    crew: 'M770 130 C770 260 635 320 500 320',
    builder: 'M500 320 C365 320 230 380 230 510',
    rental: 'M500 320 C635 320 770 380 770 510',
};

function PartnerStamp({ active, recruiting = false }: { active: boolean; recruiting?: boolean }) {
    return <span className="ai-partner-stamp" data-active={active} data-status={recruiting ? 'recruiting' : 'selected'}>
        <span className="ai-stamp-impression">
            {recruiting ? <i className="ai-stamp-dot" aria-hidden="true" /> : <Check size={14} strokeWidth={3} aria-hidden="true" />}
            <span>{recruiting ? '모집 중' : '선정 완료'}</span>
        </span>
        <span className="ai-stamp-impact" aria-hidden="true" />
    </span>;
}

export default function AlliancePartnerCards() {
    const { ref, step, selectionId, auto, running, reduced, toggle, select } = useAllianceMotion(highlights.length);
    const focus = highlights[step];
    return <section ref={ref} className="ai-partner-motion" data-running={running} data-focus={focus.key} aria-labelledby="ai-partner-cards-title">
        <header className="ai-partner-motion-head">
            <div><span className="ai-partner-eyebrow">업계 표준화 프로젝트</span>
                <h2 id="ai-partner-cards-title">공동 사업 추진 체계</h2></div>
            {!reduced && <button type="button" className="ai-partner-play" onClick={toggle}
                aria-label={auto ? '참여사 카드 모션 일시정지' : '참여사 카드 모션 자동재생'}>
                {auto ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}{auto ? '일시정지' : '자동재생'}
            </button>}
        </header>
        <div className="ai-partner-status" aria-label="대표사 선정 현황"><span><CheckCheck size={14} aria-hidden="true" /> 선정 완료 <b>2개사</b></span><span><i /> 모집 중 <b>2개사</b></span></div>
        <div className="ai-partner-stage">
            <svg className="ai-partner-connections" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
                {Object.entries(cardPaths).map(([key, d]) => <g key={key} className={'ai-partner-wire wire-' + key} data-active={focus.key === key}>
                    <path d={d} />{focus.key === key && <MotionBeam key={key} d={d} color="var(--wire)" duration={2.6} />}
                </g>)}
            </svg>
            <div className="ai-partner-hub" aria-hidden="true">
                <svg className="ai-partner-hub-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" />
                    <circle className="ai-partner-hub-signal" cx="50" cy="50" r="46" pathLength="100" />
                    <circle className="ai-partner-hub-inner" cx="50" cy="50" r="40" pathLength="100" />
                    <MotionPulse key={focus.key} x={50} y={50} r={45} color="var(--partner-focus)" />
                </svg>
                <Layers3 size={20} /><span>전국<br />시스템연합</span>
            </div>
            <div className="ai-partner-card-grid">
                <section className="ai-partner-card card-crew" data-active={focus.key === 'crew'} aria-label="청연ENG 시공 인프라">
                    <CardBeam active={focus.key === 'crew'} />
                    <div className="ai-partner-card-top"><span className="ai-partner-role"><HardHat size={20} aria-hidden="true" /> 대표 시공사</span><PartnerStamp key={`crew-${focus.key}-${selectionId}`} active={focus.key === 'crew'} /></div>
                    <h3><a className="ai-partner-company-link" href="https://cyee-9c1e4.web.app/dashboard2">{constructionBase.name}<ArrowUpRight size={20} aria-hidden="true" /></a></h3><p>시스템동바리·비계 분야 <br />업계 상위 그룹 시공사</p>
                    <dl className="ai-partner-metrics"><div><dt>자체 시공 인력</dt><dd>{constructionBase.people}</dd></div><div><dt>협력 지원팀</dt><dd>{constructionBase.supportTeams}</dd></div></dl>
                </section>
                <section className="ai-partner-card card-developer" data-active={focus.key === 'developer'} aria-label="선정된 개발사 그뚠엔터">
                    <CardBeam active={focus.key === 'developer'} />
                    <div className="ai-partner-card-top"><span className="ai-partner-role"><Code2 size={20} aria-hidden="true" /> 개발사</span><PartnerStamp key={`developer-${focus.key}-${selectionId}`} active={focus.key === 'developer'} /></div>
                    <h3><a className="ai-partner-company-link" href="https://propig-63524.web.app/corp/company/introduction">{developmentBase.name}<ArrowUpRight size={20} aria-hidden="true" /></a></h3><p>{developmentBase.work} <br />업종별 ERP 구축·업무 효율화</p>
                    <ul className="ai-developer-modules" aria-label="그뚠엔터 개발 역할"><li>ERP 구축</li><li>업무 자동화</li><li>플랫폼 개발</li></ul>
                </section>
                {(['builder', 'rental'] as const).map(type => {
                    const partner = representatives[type], Icon = type === 'builder' ? Building2 : Boxes;
                    return <section key={type} className={'ai-partner-card card-' + type} data-active={focus.key === type} aria-label={'모집 중인 대표 ' + partner.role}>
                        <CardBeam active={focus.key === type} />
                        <div className="ai-partner-card-top"><span className="ai-partner-role"><Icon size={20} aria-hidden="true" /> 대표 {partner.role}</span><PartnerStamp key={`${type}-${focus.key}-${selectionId}`} active={focus.key === type} recruiting /></div>
                        <h3 className="ai-partner-opening"><b>1</b><span>개사<br />선정 예정</span></h3>
                        <p>{type === 'builder' ? '실증 현장과 발주·협력망을 보유한 건설사' : '규격별 재고·물류 거점·공급망을 보유한 임대사'}</p>
                        <a className={'ai-seat-' + type} href="#alliance-inquiry" aria-label={partner.badge + ' 참여 제안'}>참여 제안하기 <ArrowUpRight size={16} aria-hidden="true" /></a>
                    </section>;
                })}
            </div>
        </div>
        <div className="ai-partner-tour">
            <div className="ai-partner-tour-controls" role="group" aria-label="참여사 카드 살펴보기">
                {highlights.map((item, i) => <button key={item.key} type="button" onClick={() => select(i)}
                    aria-pressed={i === step} aria-label={item.title + ' 카드 보기'}><span aria-hidden="true">0{i + 1}</span>{item.title}</button>)}
            </div>
            <p>{focus.text}</p>
        </div>
        <p className="ai-partner-criteria">선정 대상: 각 업계의 영향력과 실증 현장 또는 공급망을 갖추고, 공동 사업 및 표준화에 참여할 수 있는 기업</p>
    </section>;
}
