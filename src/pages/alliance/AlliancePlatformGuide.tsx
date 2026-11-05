import React, { useState } from 'react';
import { ArrowDown, ArrowUpRight, ClipboardList, FileCheck2 } from 'lucide-react';

const bidStages = [
    { title: '공고와 견적 의뢰', owner: '건설사', text: '현장·작업 구간·도면·수량·공기와 평가 기준을 등록합니다. 같은 공고에서 시공 견적과 자재 임대 견적을 나눠 요청합니다.' },
    { title: '분야별 입찰', owner: '시공사·임대사', text: '시공사는 설치·해체 공법, 투입 인원과 시공비를, 임대사는 규격별 수량, 임대 기간, 운반 조건과 임대료를 제안합니다.' },
    { title: '비교와 선정', owner: '건설사', text: '마감 후 시공과 임대 제안을 분야별로 비교합니다. 가격뿐 아니라 일정, 공급 여력과 작업팀 구성도 공고 기준으로 검토하고 선정 사유를 남깁니다.' },
    { title: '현장 실행과 정산', owner: '건설사·선정 협력사', text: '선정 후에는 시공사 간 인력 지원과 임대사 간 자재 대차를 구간별 발주에 연결합니다. 실제 출역·반입·반납을 기록해 지원·공급 업체별 정산 근거를 남깁니다.' },
];

export function PublicBiddingSection() {
    return <section className="ai-section ai-bidding" aria-labelledby="ai-bid-title">
        <div className="ai-section-lead ai-spread">
            <div><span className="ai-kicker">현장 운영 / 공개입찰</span><h2 id="ai-bid-title">분야별 공개입찰 및<br />선정 이력 관리</h2></div>
            <p>동일한 현장 조건과 사전 공지된 평가 기준을 적용해 시공·임대 제안을 분야별로 비교합니다. 공고 변경, 질의·답변, 평가와 선정 근거를 기록하는 입찰 체계를 구축합니다.</p>
        </div>
        <ol className="ai-bid-steps">{bidStages.map((stage, index) => <li key={stage.title}>
            <div className="ai-step-index"><span>{'0' + (index + 1)}</span><i aria-hidden="true" /></div>
            <span className="ai-step-owner">{stage.owner}</span><h3>{stage.title}</h3><p>{stage.text}</p>
        </li>)}</ol>
        <div className="ai-bid-note"><FileCheck2 size={21} aria-hidden="true" />
            <div><strong>입찰 정보 공개 및 접근 범위</strong>
                <p>공고 조건, 질의·답변, 변경 이력은 참여 업체가 함께 봅니다. 개별 견적은 마감 전 다른 입찰자에게 공개하지 않고, 선정 후에는 참여 업체가 결과와 선정 근거를 확인할 수 있도록 설계합니다.</p></div>
        </div>
    </section>;
}

const examples = {
    shoring: {
        label: '시스템동바리', title: '동바리 공정 변경 및 투입 일정 조정', context: '기준층 슬래브의 타설 순서 변경에 따라 구간별 자재 반입과 설치 일정을 재조정하는 시나리오입니다.',
        handoffs: [
            { who: '건설사', task: '공정 변경', copy: '해당 층·구간의 변경 일자와 사유를 현장 ERP에 한 번 입력합니다.' },
            { who: '동바리·권역 임대사', task: '자재 재배정', copy: '동바리 임대사가 자사 재고를 우선 배정하고, 부족 규격은 권역 임대사와 공동 공급합니다. 업체별 출고 수량과 회수 예정일을 기록합니다.' },
            { who: '청연ENG·협력 시공사', task: '작업팀 조율', copy: '청연ENG가 변경된 설치일 기준으로 작업조 지원을 요청하면 협력 시공사가 가용 인원을 회신합니다. 현장별 수요와 가용 인력에 따라 상호 지원을 확정합니다.' },
            { who: '시공사·임대사', task: '일정 공동 확인', copy: '확정된 인력 투입일과 업체별 반입일을 대조합니다. 분할 공급 시 우선 시공 구간과 차수별 물량을 공동 확정합니다.' },
        ],
        record: '같은 구간의 자재 반입일과 설치조 출역일을 한 일정표에서 대조합니다.',
    },
    scaffold: {
        label: '시스템비계', title: '비계 공정 분할 및 차수별 공급', context: '외벽 공정 변경에 따라 입면별 시공 범위를 구분하고, 비계 설치와 자재 공급을 차수별로 운영하는 시나리오입니다.',
        handoffs: [
            { who: '건설사', task: '작업면 분리', copy: '입면별 작업 범위와 설치·해체 차수를 나눕니다. 각 차수의 납기와 진입 가능한 시간을 공유합니다.' },
            { who: '임대사', task: '분할 출고', copy: '규격별 비계 자재를 차수별로 예약합니다. 협력 임대사와 상차 장소·수량을 나누고 출고·반납 내역을 대조합니다.' },
            { who: '청연ENG·비계 시공사', task: '차수별 배치', copy: '청연ENG와 협력 비계 시공사가 설치·해체 차수에 따라 작업조를 배정합니다. 지원팀의 가용 인력과 투입일을 확인하고 중복 배치를 검토합니다.' },
        ],
        record: '차수별 출고표와 작업조 명단을 연결해 중복 배치와 누락을 확인합니다.',
    },
    build: {
        label: '공동 구축', title: '인력·자재 통합 요청 기준 수립', context: '시공사와 임대사의 현장·구간 식별 기준을 통일하고, 인력 지원과 자재 공급의 승인 정보를 연결하는 시나리오입니다.',
        handoffs: [
            { who: '시공사·지원팀', task: '지원 요청 기준 정의', copy: '현장·층·작업 구간, 필요 기능과 인원, 작업일의 공통 입력 항목을 정의합니다. 요청사와 지원사의 확인 범위 및 승인 권한을 정합니다.' },
            { who: '협력 임대사', task: '공급 기준 공동 설계', copy: '작업 구간에 자재 규격, 소유 업체, 분담 수량과 회수 예정일을 연계합니다. 투입일과 납기 변경 시 통지·회신·승인 절차를 합의합니다.' },
            { who: '그뚠엔터 · 플랫폼·ERP 개발사', task: '연동과 시범 검증', copy: '건설·임대·시공 ERP를 각각 구축하고 공통 요청 흐름을 플랫폼에 구현합니다. 인원 변경·분할 출고·반납을 연계하고 반복 입력과 승인·알림을 자동화해 업무 효율을 검증합니다.' },
        ],
        record: '구간별 인력·자재 승인 상태와 변경 확인 담당자·시점을 통합 이력으로 관리합니다.',
    },
};
type Example = keyof typeof examples;

export function FieldExampleSection() {
    const [selected, setSelected] = useState<Example>('shoring');
    const example = examples[selected];
    return <section id="alliance-example" className="ai-section ai-example" aria-labelledby="ai-example-title">
        <div className="ai-section-lead ai-spread">
            <div><span className="ai-kicker">현장 운영 / 업무 자동화</span><h2 id="ai-example-title">공정 변경 및<br />ERP 연동 시나리오</h2></div>
            <p>현장·작업 구간·일정을 공통 식별 기준으로 적용합니다. 동바리·비계의 공정 변경과 인력·자재 통합 요청을 중심으로 업종별 데이터 연계와 승인 흐름을 실증합니다.</p>
        </div>
        <div className="ai-case">
            <div className="ai-case-summary">
                <div className="ai-case-label"><ClipboardList size={18} aria-hidden="true" /> 현장 적용 예시</div>
                <div className="ai-case-choices" role="group" aria-label="현장 예시 선택">
                    {(Object.keys(examples) as Example[]).map(key => <button key={key} type="button" aria-pressed={key === selected} aria-controls="ai-example-detail"
                        onClick={() => setSelected(key)}>{examples[key].label}</button>)}
                </div>
                <h3 id="ai-case-title">{example.title}</h3><p>{example.context}</p>
            </div>
            <div id="ai-example-detail" className="ai-case-detail" role="region" aria-labelledby="ai-case-title">
                <ol>{example.handoffs.map((handoff, index) => <li key={handoff.who}>
                    <span className="ai-case-arrow" aria-hidden="true">{index < example.handoffs.length - 1 ? <ArrowDown size={15} /> : <ArrowUpRight size={15} />}</span>
                    <div><span className="ai-case-who">{handoff.who}</span><h4>{handoff.task}</h4><p>{handoff.copy}</p></div>
                </li>)}</ol>
                <p className="ai-case-outcome"><b>현장 확인</b> {example.record}</p>
            </div>
        </div>
    </section>;
}
