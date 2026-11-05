import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
    faBed, faBolt, faBowlRice, faCalculator, faCalendarCheck, faCertificate, faCheck,
    faCircleCheck, faClock, faCoins, faCopy, faDumbbell, faEarthAsia, faGift,
    faHandHoldingDollar, faHandsClapping, faHelmetSafety, faHouseChimney, faHouseMedicalFlag,
    faIdCard, faLayerGroup, faMoneyCheckDollar, faPassport, faPersonDigging, faPhone,
    faSeedling, faShirt, faShoePrints, faSoap, faSuitcase, faTriangleExclamation,
    faUserGroup, faUtensils, faWallet, faWonSign,
} from '@fortawesome/free-solid-svg-icons';
import {
    calculatePay, lodging, money, nextDayDailyRate, recruitmentPhone, recruitmentText, safetyCertificate,
    schedule, standardDailyRate, supplies, tasks, workShifts, workUnitLabel,
} from './recruitmentNotice';
import './NationwideRecruitmentPage.css';

const audiences = [
    { icon: faSeedling, title: '왕초보자', detail: '친절 교육 및 상담' },
    { icon: faMoneyCheckDollar, title: '신용불량자', detail: '우회입금 상담' },
    { icon: faEarthAsia, title: '외국인·교포', detail: '취업 가능 여부 상담' },
    { icon: faHouseMedicalFlag, title: '오갈 데 없는 분', detail: '숙소·생필품 지원' },
    { icon: faUserGroup, title: '친구동반 가능', detail: '지인과 함께 입소' },
    { icon: faWallet, title: '무전 입소 가능', detail: '차비·생활비 지원' },
];
const benefits = [
    { icon: faUtensils, tone: 'gold', title: '한 달 이상 근무 가능자 숙식 무료', detail: '아침·점심·저녁, 하루 세 끼와 안산·수원의 숙소를 무료로 제공합니다.' },
    { icon: faHandHoldingDollar, tone: 'green', title: '담뱃값·생활비 최대 50% 가불 가능', detail: '입소할 때 필요한 차비와 생활비를 지원합니다. 필요하면 최대 50%까지 가불을 상담해 드립니다.' },
    { icon: faCalendarCheck, tone: 'blue', title: '익일지급·주급·월급 및 우회입금 상담', detail: '월급은 기본 일당에 실제 근무한 총공수를 곱해 정산합니다. 주급과 익일지급도 선택할 수 있으며, 익일지급에도 숙식이 제공됩니다.' },
    { icon: faPassport, tone: 'violet', title: '외국인·교포 당일채용 상담', detail: '비자 종류에 관계없이 상담할 수 있습니다. 취업 가능 여부를 확인한 뒤 사무실 면접과 현장 배치를 안내합니다.' },
];
const supplyIcons = [faIdCard, faShirt, faSoap, faShoePrints];
const phoneHref = 'tel:' + recruitmentPhone.replace(/-/g, '');

function PayCalculator() {
    const [dailyRate, setDailyRate] = useState(standardDailyRate);
    const [units, setUnits] = useState(workShifts[0].units);
    const [days, setDays] = useState(25);
    return (
        <div className="nr-calculator">
            <div className="nr-row">
                <h3><Icon icon={faCalculator} /> 내 예상 수령액 계산해보기</h3>
                <small>일당 × 하루 공수 × 근무 일수</small>
            </div>
            <div className="nr-calc-inputs">
                <label>기본 일당
                    <select value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))}>
                        <option value={standardDailyRate}>일반 {money(standardDailyRate)}</option>
                        <option value={nextDayDailyRate}>익일지급 {money(nextDayDailyRate)}</option>
                    </select>
                </label>
                <label>하루 공수
                    <select value={units} onChange={e => setUnits(Number(e.target.value))}>
                        {workShifts.map(shift => <option key={shift.units} value={shift.units}>
                            {shift.hours} · {workUnitLabel(shift.units)}
                        </option>)}
                    </select>
                </label>
                <label className="nr-calc-days">근무 일수: <b>{days}일</b>
                    <input type="range" min={1} max={30} value={days} aria-valuetext={days + '일'}
                        onChange={e => setDays(Number(e.target.value))} />
                </label>
            </div>
            <div className="nr-row nr-total">
                <div><span>예상 총 급여액</span><small>{money(dailyRate)} × {workUnitLabel(units)} × {days}일</small></div>
                <output aria-live="polite" aria-label="예상 총 급여액">{money(calculatePay(dailyRate, units, days))}</output>
            </div>
        </div>
    );
}

export default function NationwideRecruitmentPage() {
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout>>();
    const manualDialog = useRef<HTMLDialogElement>(null);
    const manualText = useRef<HTMLTextAreaElement>(null);
    useEffect(() => () => clearTimeout(copyTimer.current), []);

    async function copyNotice() {
        clearTimeout(copyTimer.current);
        try {
            await navigator.clipboard.writeText(recruitmentText);
            setCopied(true);
            copyTimer.current = setTimeout(() => setCopied(false), 3000);
        } catch {
            setCopied(false);
            manualDialog.current?.showModal();
            manualText.current?.focus();
            manualText.current?.select();
        }
    }

    const actions = (compact = false) => (
        <div className={'nr-actions' + (compact ? ' nr-actions-compact' : '')}>
            <button type="button" className="nr-action nr-copy" onClick={copyNotice}>
                <Icon icon={faCopy} /> {compact ? '공고 복사' : '모집요강 텍스트 복사하기'}
            </button>
            <a className="nr-action nr-call" href={phoneHref}>
                <Icon icon={faPhone} /> {compact ? '당일취업 상담전화' : '24시간 친절 전화상담 연결'}
            </a>
        </div>
    );

    return (
        <article className="nr-page" aria-labelledby="nr-title">
            <div className="nr-alert">
                <b>필수</b><span>건설기초안전교육증 필수 · 초보자 친절 상담 · 당일취업 가능 · 한 달 이상 숙식 무료!</span>
            </div>
            <div className="nr-content">
                <header className="nr-hero">
                    <span className="nr-tag"><Icon icon={faHelmetSafety} /> 시스템동바리 전문 현장 정식 채용공고</span>
                    <h1 id="nr-title">초보자도 바로 시작하는<br /><strong>시스템동바리 고단가 인력 모집</strong></h1>
                    <p>초보자분들이 쉽게 접하실 수 있도록 친절하게 상담해 드립니다.<br />
                        <em>돈 한 푼 없이 몸만 오셔도</em> 모든 생활비 및 차비를 적극 지원해 드립니다!</p>
                    <div className="nr-highlights">
                        <div className="nr-highlight nr-tone-gold">
                            <span className="nr-icon-box"><Icon icon={faCoins} /></span>
                            <div><small>초보 1공수 / 익일지급 선택 가능</small><b>{money(standardDailyRate)}~</b></div>
                        </div>
                        <div className="nr-highlight nr-tone-green">
                            <span className="nr-icon-box"><Icon icon={faBowlRice} /></span>
                            <div><small>{lodging} 숙소</small><b>숙식 무료 제공</b></div>
                        </div>
                        <div className="nr-highlight nr-tone-blue">
                            <span className="nr-icon-box"><Icon icon={faBolt} /></span>
                            <div><small>사무실 면접 후 즉시</small><b>당일 취업 가능</b></div>
                        </div>
                    </div>
                </header>

                <section className="nr-card">
                    <div className="nr-section-heading nr-row">
                        <h2><Icon icon={faHandsClapping} /> 이런 분들 조건 없이 환영합니다!</h2>
                        <span className="nr-tag">학비 · 단기간 목돈 마련 · 취업 난항 모두 OK</span>
                    </div>
                    <ul className="nr-audiences">
                        {audiences.map(item => <li key={item.title} className="nr-tile">
                            <Icon icon={item.icon} /><b>{item.title}</b><small>{item.detail}</small>
                        </li>)}
                    </ul>
                </section>

                <div className="nr-work-grid">
                    <section className="nr-card nr-work">
                        <div>
                            <span className="nr-tag"><Icon icon={faPersonDigging} /> 모집 분야</span>
                            <h2>시스템동바리 집중 모집</h2>
                            <div className="nr-job">
                                <div className="nr-row"><h3><Icon icon={faLayerGroup} /> 시스템동바리</h3><span className="nr-badge">초보환영</span></div>
                                <p>현장 내 단일 공정으로 작업이 체계적이며, 초보자도 금방 배워 수월하게 일하실 수 있습니다.</p>
                                <ul className="nr-tasks">{tasks.map(task => <li key={task}><Icon icon={faCheck} /> {task}</li>)}</ul>
                            </div>
                        </div>
                        <div className="nr-stack">
                            <div className="nr-note nr-tone-green"><h3><Icon icon={faBolt} /> 익일지급 선택 가능!</h3>
                                <p>익일지급 1공수 <strong>{money(nextDayDailyRate)}</strong> (숙식제공 동일 적용)</p></div>
                            <div className="nr-note nr-tone-gold"><h3><Icon icon={faHouseChimney} /> 숙소 위치 안내</h3>
                                <p>{lodging} (아침·점심·저녁 무료 제공)</p></div>
                        </div>
                    </section>

                    <section className="nr-card nr-pay">
                        <div className="nr-row">
                            <span className="nr-tag nr-tone-green"><Icon icon={faWonSign} /> 실외현장 초보단가 확정</span>
                            <span className="nr-tag">★ 경력자 단가 별도 협의!</span>
                        </div>
                        <h2>공수별 일당 안내</h2>
                        <dl className="nr-rates">{workShifts.map(({ hours, units }) => <div key={units} className="nr-rate">
                            <dt><small>{hours}</small><b>{workUnitLabel(units)}</b></dt>
                            <dd>{calculatePay(standardDailyRate, units).toLocaleString('ko-KR')}<small>원</small>
                                <span className="nr-rate-next">익일지급 {money(calculatePay(nextDayDailyRate, units))}</span></dd>
                        </div>)}</dl>
                        <div className="nr-next-day"><span><b>익일지급</b> 숙식제공</span><strong>1공수 {money(nextDayDailyRate)}</strong></div>
                        <PayCalculator />
                    </section>
                </div>

                <section className="nr-card">
                    <h2 className="nr-section-heading"><Icon icon={faGift} /> 확실한 복리후생 및 정산 약속</h2>
                    <div className="nr-benefits">{benefits.map(item => <div key={item.title} className={'nr-tile nr-benefit nr-tone-' + item.tone}>
                        <span className="nr-icon-box"><Icon icon={item.icon} /></span>
                        <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                    </div>)}</div>
                </section>

                <section className="nr-card">
                    <h2 className="nr-section-heading"><Icon icon={faClock} /> 하루 근무 시간표</h2>
                    <ol className="nr-schedule">{schedule.map(slot => <li className="nr-tile" key={slot.time}>
                        <span>{slot.time}</span><h3>{slot.title}</h3><p>{slot.detail}</p>
                    </li>)}</ol>
                </section>

                <div className="nr-details">
                    <section className="nr-card">
                        <h2 className="nr-section-heading"><Icon icon={faSuitcase} /> 필수 준비물 안내</h2>
                        <ul className="nr-supplies">
                            {supplies.map((item, index) => <li key={item} className="nr-tile"><Icon icon={supplyIcons[index]} /> {item}</li>)}
                            <li className="nr-certificate"><Icon icon={faCertificate} /> {safetyCertificate}</li>
                        </ul>
                        <div className="nr-note nr-tone-gold"><h3><Icon icon={faBed} /> 숙소 및 급여 특별 안내</h3>
                            <p>숙소: {lodging}</p><small>★ 익일지급 1공수 {money(nextDayDailyRate)} / 숙식 제공</small></div>
                    </section>
                    <section className="nr-card nr-prepare">
                        <h2 className="nr-section-heading"><Icon icon={faDumbbell} /> 지원 전 꼭 읽어주세요</h2>
                        <div className="nr-tile"><h3>✓ 이런 분들은 훨씬 수월하십니다!</h3>
                            <p>평소 운동을 하셨거나 택배 상하차, 물류창고, 이삿짐센터, 일용직 현장 일을 해보신 분들은 수월하게 적응하실 수 있습니다.</p></div>
                        <p>몸으로 하는 일이라 처음에는 힘들 수 있지만 하루하루 일하는 방법을 익히면 금방 적응하십니다. 믿고 오세요!</p>
                        <div className="nr-warning"><Icon icon={faTriangleExclamation} />
                            <p>하루 이틀의 단기 근무보다는 꾸준히 일하며 목돈을 모으실 분을 모집합니다.</p></div>
                    </section>
                </div>

                <footer className="nr-card nr-footer">
                    <h2>지금 전화주시면 <strong>당일 면접 후 즉시 채용</strong>합니다!</h2>
                    <p>왕초보자도 걱정 마세요. 친절하게 하나부터 열까지 안내해 드립니다.</p>
                    <p className="nr-phone-number">{recruitmentPhone}</p>
                    {actions()}
                </footer>
            </div>

            <div className="nr-dock">
                <div className="nr-copy-status" role="status">{copied && <span><Icon icon={faCircleCheck} /> 모집요강이 복사되었습니다!</span>}</div>
                <div className="nr-dock-inner">
                    <div className="nr-dock-summary"><b>시스템동바리 1공수 {money(standardDailyRate)} (익일지급 {money(nextDayDailyRate)})</b>
                        <small>숙소: {lodging} / 숙식 무료 제공</small></div>
                    {actions(true)}
                </div>
            </div>
            <dialog className="nr-manual-copy" ref={manualDialog} aria-labelledby="nr-manual-title">
                <h2 id="nr-manual-title">모집요강 직접 복사</h2>
                <p>자동 복사를 사용할 수 없습니다. 아래에 선택된 모집요강을 복사해 주세요.</p>
                <textarea ref={manualText} aria-label="복사할 모집요강" readOnly value={recruitmentText} />
                <button type="button" className="nr-action nr-copy" onClick={() => manualDialog.current?.close()}>닫기</button>
            </dialog>
        </article>
    );
}
