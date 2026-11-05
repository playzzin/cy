import React from 'react';
import { ChartPie, Pause, Play } from 'lucide-react';
import useAllianceMotion, { ALLIANCE_SCENE_MS } from './useAllianceMotion';
import MotionFocusButton from './MotionFocusButton';
import BusinessFlowGraphic from './BusinessFlowGraphic';
import { businessStages, investmentShares, totalShare } from './allianceBusinessPlan';
import './AllianceBusinessModel.css';

export default function AllianceBusinessModel() {
    const { ref, step, selectionId, auto, reduced, running, select, toggle } = useAllianceMotion(businessStages.length);
    const stage = businessStages[step], sceneNumber = String(step + 1).padStart(2, '0');
    return <section id="alliance-business" className="ai-section ai-business" aria-labelledby="ai-business-title">
        <div className="ai-section-lead ai-spread">
            <div><span className="ai-kicker">01 / 사업화 전략 및 수익 모델</span><h2 id="ai-business-title">현장 실증에서<br />산업 표준 플랫폼으로.</h2></div>
            <p>대표 파트너 선정, ERP 연동 실증, 기본 서비스 무료 보급, 단계적 수익화를 추진합니다. 구독·거래·광고·부가 서비스 수입을 기반으로 공동 투자사의 이익 배분 구조를 설계합니다.</p>
        </div>
        <figure ref={ref} className="ai-business-motion" data-running={running} data-stage={stage.id}
            style={{ '--scene': stage.tone, '--scene-ms': ALLIANCE_SCENE_MS + 'ms' } as React.CSSProperties} aria-labelledby="ai-business-diagram-title">
            <div className="ai-network-bar"><div><ChartPie size={20} aria-hidden="true" /><b id="ai-business-diagram-title">사업화 흐름과 투자 지분안</b></div>
                <div className="ai-player-actions"><MotionFocusButton target={ref} name="사업화 모션" />
                    {reduced ? <span className="ai-network-manual">단계별 보기</span> :
                        <button type="button" className="ai-network-play" onClick={toggle} aria-label={auto ? '사업화 흐름 일시정지' : '사업화 흐름 자동재생'}>
                            {auto ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{auto ? '일시정지' : '자동재생'}
                        </button>}</div>
            </div>
            <div className="ai-business-controls" role="group" aria-label="사업화 단계 선택">
                {businessStages.map((item, i) => <button key={item.id} type="button" aria-pressed={i === step}
                    onClick={() => select(i)} aria-label={`사업화 ${i + 1}단계 ${item.label}`}><small>0{i + 1}</small><span>{item.label}</span>
                    {i === step && <i key={`${running}-${selectionId}`} className="ai-biz-timer" aria-hidden="true" />}</button>)}
            </div>
            <div className="ai-business-layout">
                <div className="ai-biz-canvas">
                    <div className="ai-biz-canvas-label" aria-hidden="true"><span>사업 흐름도</span><span>{sceneNumber} / 05</span></div>
                    <BusinessFlowGraphic step={step} />
                </div>
                <div className="ai-business-story">
                    <span className="ai-biz-tag">단계 {sceneNumber} · {stage.label}</span>
                    <h3>{stage.title}</h3><p>{stage.text}</p>
                    <div className="ai-biz-outcome"><b>{stage.checkpoint}</b><p>{stage.outcome}</p></div>
                </div>
            </div>
            <figcaption><div className="ai-biz-finance-title"><b>공동 투자 지분 구조(안)</b><span>합계 {totalShare}%</span></div>
                <ul className="ai-biz-shares">{investmentShares.map(investor => <li key={investor.role}
                    style={{ '--share-color': investor.color } as React.CSSProperties}><span>{investor.role}</span><b>{investor.share}%</b></li>)}</ul>
                <p>4개 참여 주체가 각 25% 지분을 보유하는 공동 투자안입니다. 운영 비용을 반영한 배분 가능 이익을 지분율에 따라 배분하며, 세부 투자 조건과 배분 주기는 공동 협의로 확정합니다.</p>
            </figcaption>
        </figure>
    </section>;
}
