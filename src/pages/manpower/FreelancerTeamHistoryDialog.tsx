import React, { useEffect, useRef } from 'react';
import type { FreelancerTeamHistory } from '../../utils/freelancerTeamHistory';

interface Props {
    name: string;
    year: number;
    teamId: string;
    history: FreelancerTeamHistory;
    onClose: () => void;
}

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

export default function FreelancerTeamHistoryDialog({ name, year, teamId, history, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialogRef.current?.showModal(); }, []);

    return <dialog ref={dialogRef} className="freelancer-history-dialog" aria-labelledby="freelancer-history-title"
        onCancel={onClose} onClose={onClose}>
        <header>
            <div><p>{year}년 신고 내역</p><h2 id="freelancer-history-title">{name} · 어디서 얼마를 신고했나요?</h2></div>
            <button type="button" onClick={onClose} aria-label="신고 내역 닫기">닫기</button>
        </header>
        {history.previousTeamName && <p className="freelancer-history-summary">
            이전에 <strong>{history.previousTeamName}</strong>에서 신고한 내역이 있습니다.
        </p>}
        {!history.reports.some(report => report.teamId === teamId) && <p className="freelancer-history-summary">
            지금 보고 있는 팀에는 신고 금액이 없습니다. 아래는 다른 팀에서 신고한 내역입니다.
        </p>}
        {history.sharedMonths.length > 0 && <p className="freelancer-history-notice">
            <strong>{history.sharedMonths.map(month => `${month}월`).join(', ')}에는 여러 팀에서 신고했습니다.</strong>
            <span>아래에서 각 팀의 금액을 확인해 주세요. 같은 달의 내역만으로는 팀 이동 순서를 알 수 없습니다.</span>
        </p>}
        <div className="freelancer-history-teams">
            {history.reports.map(report => <section key={report.teamId} className="freelancer-history-team"
                aria-label={`${report.teamName} 신고 내역`}>
                <div className="freelancer-history-team-heading">
                    <h3 className="freelancer-history-team-chip" style={{ background: report.background, color: report.textColor }}>{report.teamName}</h3>
                    <span>{report.teamId === teamId ? '지금 보고 있는 팀' : report.teamId === history.previousTeamId ? '이전 신고팀' : '다른 신고팀'}</span>
                </div>
                <dl>{report.months.map(entry => <div key={entry.month}>
                    <dt>{entry.month}월</dt><dd>{won(entry.amount)}</dd>
                </div>)}
                    {report.bonus !== 0 && <div><dt>성과급</dt><dd>{won(report.bonus)}</dd></div>}
                    <div className="freelancer-history-team-total"><dt>팀 합계</dt><dd>{won(report.total)}</dd></div>
                </dl>
            </section>)}
        </div>
        <footer><span>모든 팀 합계</span><strong>{won(history.reports.reduce((sum, report) => sum + report.total, 0))}</strong></footer>
        <p className="freelancer-history-footnote">선택한 {year}년의 화면 금액 기준입니다. 저장 전 수정한 금액도 포함됩니다.</p>
    </dialog>;
}
