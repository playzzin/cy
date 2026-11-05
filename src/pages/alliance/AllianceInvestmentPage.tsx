import React from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Boxes, Building2, Check, Code2, HardHat, Layers3, MessageSquare, Phone } from 'lucide-react';
import { ALLIANCE_SITE_NAME, INVESTMENT_LABEL } from '../../constants/siteModes';
import AllianceCooperationGraphic from './AllianceCooperationGraphic';
import AllianceBusinessModel from './AllianceBusinessModel';
import AlliancePartnerCards from './AlliancePartnerCards';
import { FieldExampleSection, PublicBiddingSection } from './AlliancePlatformGuide';
import { companies, crewCompanies, rentalCompanies } from './allianceNetwork';
import { developmentBase, representatives } from './allianceRepresentatives';
import './AllianceInvestmentPage.css';

const contactNumber = '010-2365-7692';
const dialNumber = contactNumber.replace(/-/g, '');
const partners = {
    contractor: {
        role: '시공사', title: '청연ENG · 시공사 모집 및 지원망 구축', icon: HardHat,
        intro: '청연ENG의 자체 인력 100여 명과 협력 지원팀 100여 팀을 기반으로, 같은 동바리·비계 공정에 참여하는 시공사와 지원팀을 모집합니다. 현장 인력을 상호 지원하는 시공 네트워크를 플랫폼의 실행 인프라로 구축합니다.',
        strengths: ['동일 공정의 협력 시공사·지원팀 모집 및 플랫폼 참여 확대', '필요 기능·지원 날짜와 가용 작업조를 연계해 인력 상호 지원', '시공 ERP에 요청·배정·출역·정산 이력을 기록하고 현장 실증'],
        benefit: '현장별 인력 수급 불균형을 완화하고, 지원 요청부터 확정·출역·정산까지 일관된 운영 이력을 확보합니다.',
    },
    rental: {
        role: '임대사', title: '임대사 모집 및 공동 공급망 구축', icon: Boxes,
        intro: '자재·물류 인프라를 보유한 대표 임대사 1개사를 선정합니다. 대표 임대사는 같은 동바리·비계 공정에 자재를 공급하는 협력 임대사를 모집하고, 재고·물류 거점을 연결해 플랫폼의 공동 공급 인프라를 구축합니다.',
        strengths: ['동일 공정의 협력 임대사 모집 및 권역별 공급망 확대', '규격별 가용 재고 공유와 업체 간 자재 대차·공동 출고', '임대 ERP에 소유 업체·운반·반납·회수 책임을 연계'],
        benefit: '협력사 간 자재 대차로 공급 대응력을 높이고, 소유 업체별 출고·반납·회수 이력을 통해 재고 운영의 정확도를 개선합니다.',
    },
    builder: {
        role: '건설사', title: '건설사 모집 및 발주 기반 구축', icon: Building2,
        intro: '업계 영향력과 발주·실증 인프라를 갖춘 대표 건설사 1개사를 선정합니다. 대표 건설사는 같은 동바리·비계 공정을 발주하는 건설사를 모집하고, 참여 현장과 협력망을 확대해 플랫폼의 발주 기반을 구축합니다.',
        strengths: ['동일 공정의 건설사 모집 및 발주 현장·이용 기업 확대', '시공사·임대사 대상 공개입찰 운영과 선정 기준 실증', '건설 ERP의 발주·공정·기성 정보를 시공·자재 공급과 연계'],
        benefit: '동일 조건에 따른 견적 비교와 선정 이력을 확보하고, 공정별 인력·자재 공급 차질을 사전에 파악합니다.',
    },
    developer: {
        role: '개발사', title: developmentBase.name + ' · 플랫폼·ERP 개발', icon: Code2,
        intro: '그뚠엔터는 건설사·임대사·시공사에 필요한 ERP를 각각 구축하고 이를 통합 플랫폼으로 연결합니다. 업무 자동화와 효율 향상을 구현하며, 공개입찰·협력망·데이터 연동 등 플랫폼 개발과 고도화에 집중합니다.',
        strengths: ['건설사 ERP: 발주·입찰·공정·기성 관리 구축', '임대사 ERP: 재고·대차·출고·반납·정산 관리 구축', '시공사 ERP: 인력·지원 요청·출역·정산 관리 구축', '반복 입력·승인·알림 자동화 및 통합 플랫폼 개발·운영'],
        benefit: '업종 간 중복 입력과 정보 불일치를 줄이고, 현장 실증 결과를 반영해 플랫폼의 확장성과 업무 자동화 수준을 높입니다.',
    },
};
type PartnerType = keyof typeof partners;
const partnerTypes: PartnerType[] = ['builder', 'rental', 'contractor', 'developer'];

export default function AllianceInvestmentPage() {
    return (
        <article className="ai-page" aria-labelledby="ai-title">
            <div className="ai-hero">
                <div className="ai-wrap">
                    <div className="ai-masthead">
                        <span className="ai-wordmark"><Layers3 aria-hidden="true" /> {ALLIANCE_SITE_NAME}</span>
                        <span className="ai-open"><i /> 대표 파트너 모집 중</span>
                    </div>
                    <div className="ai-hero-grid">
                        <div className="ai-hero-intro">
                            <span className="ai-eyebrow"><i /> 시스템동바리 · 비계 통합 플랫폼</span>
                            <h1 id="ai-title">{ALLIANCE_SITE_NAME}<br /><em>{INVESTMENT_LABEL}</em></h1>
                            <p className="ai-hero-deck">산업 표준을 함께 구축할<br /><strong>대표 건설사·임대사 모집</strong></p>
                            <p className="ai-hero-thesis">청연ENG의 시공 역량과 그뚠엔터의 개발 역량에 대표 건설사의 발주망, 대표 임대사의 공급망을 결합합니다. 공개입찰·인력 지원·자재 공유·ERP 연동을 기반으로 시스템동바리·비계의 공통 업무 표준을 구축합니다.</p>
                            <div className="ai-actions">
                                <a href="#alliance-business" className="ai-action ai-primary">사업화 전략 보기 <ArrowDown size={17} aria-hidden="true" /></a>
                                <a href="#alliance-inquiry" className="ai-action ai-outline">대표사 참여 문의 <ArrowRight size={17} aria-hidden="true" /></a>
                            </div>
                        </div>
                        <AlliancePartnerCards />
                    </div>
                </div>
            </div>

            <div className="ai-wrap ai-body">
                <AllianceBusinessModel />
                <section className="ai-section ai-operations" aria-labelledby="ai-operation-title">
                    <div className="ai-section-lead ai-spread"><div><span className="ai-kicker">02 / 플랫폼 운영 및 ERP 연동</span>
                        <h2 id="ai-operation-title">발주부터 공급까지,<br />통합 운영 체계 구축</h2></div>
                        <p>각 업종은 동일 공정의 협력기업을 모집해 발주·시공·공급 인프라를 확대합니다. 그뚠엔터는 건설사·임대사·시공사 ERP를 각각 구축하고, 이를 플랫폼으로 연결해 반복 업무를 자동화합니다.</p></div>
                    <AllianceCooperationGraphic />
                    <details id="alliance-bidding" className="ai-plan-detail"><summary>공개입찰 및 선정 이력 관리</summary><PublicBiddingSection /></details>
                    <details className="ai-plan-detail"><summary>공정 변경 및 ERP 연동 시나리오 <span>시스템동바리·비계</span></summary><FieldExampleSection /></details>
                </section>
                <section id="alliance-partners" className="ai-section" aria-labelledby="ai-partners-title">
                    <div className="ai-section-lead ai-spread">
                        <div><span className="ai-kicker">03 / 참여사 역할 및 선정 기준</span>
                            <h2 id="ai-partners-title">시공·개발 기반에<br />발주·공급 인프라를 결합</h2></div>
                        <p>대표 건설사·임대사는 각 1개사를 선정합니다. 세 업종의 대표사는 동일 공정의 건설사·임대사·시공사를 각 업종별로 모집해 플랫폼 인프라를 확대하고, 개발사는 업종별 ERP와 플랫폼 개발에 집중합니다.</p>
                    </div>
                    <div className="ai-partners">
                        {partnerTypes.map(type => {
                            const partner = partners[type], PartnerIcon = partner.icon;
                            const members = type === 'contractor' ? crewCompanies : type === 'rental' ? rentalCompanies : undefined;
                            return <div key={type} className={'ai-card ai-role-' + type}>
                                <div className="ai-card-top"><PartnerIcon aria-hidden="true" /><span>{type === 'builder' || type === 'rental' ? representatives[type].badge : '선정 완료'}</span></div>
                                <div className="ai-card-role">{partner.role}</div><h3>{partner.title}</h3>
                                {members && <div className="ai-branch-tags" aria-label="업체 구성 예시">{members.map(key => <span key={key}>{companies[key].name}</span>)}</div>}
                                <p>{partner.intro}</p>
                                <details className="ai-role-detail"><summary>{partner.role} 수행 역할</summary>
                                    <ul>{partner.strengths.map(text => <li key={text}><Check aria-hidden="true" /> {text}</li>)}</ul>
                                    <div className="ai-benefit"><b>기대 효과</b><p>{partner.benefit}</p></div></details>
                                {(type === 'builder' || type === 'rental') && <a href="#alliance-inquiry">대표 {partner.role}로 제안하기 <ArrowUpRight size={16} aria-hidden="true" /></a>}
                            </div>;
                        })}
                    </div>
                </section>

                <section id="alliance-inquiry" className="ai-inquiry ai-section" aria-labelledby="ai-inquiry-title">
                    <div className="ai-contact">
                        <span className="ai-kicker">04 / 투자 및 사업 제휴</span><h2 id="ai-inquiry-title">대표 건설사·임대사<br />전략적 참여 제안</h2>
                        <p>업계 영향력과 실증 인프라를 갖춘 기업을 대상으로 공동 사업 참여를 제안합니다. 건설사는 발주 현장·협력망, 임대사는 보유 자재·물류 거점·공급 권역을 바탕으로 참여 범위를 협의합니다.</p>
                    </div>
                    <div className="ai-contact-actions">
                        <a className="ai-contact-phone" href={'tel:' + dialNumber}>
                            <span className="ai-phone-icon"><Phone size={20} aria-hidden="true" /></span>
                            <span><small>투자·협력 전화 문의</small><b>{contactNumber}</b></span>
                        </a>
                        <a className="ai-action ai-send" href={'sms:' + dialNumber}><MessageSquare size={16} aria-hidden="true" /> 문자로 문의하기</a>
                    </div>
                </section>
            </div>
        </article>
    );
}
