import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCalendarAlt,
    faCopy,
    faLandmark,
    faPrint,
    faShieldHalved,
    faSpinner,
    faTriangleExclamation,
    faUser,
} from '@fortawesome/free-solid-svg-icons';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';

type AccountType = 'self' | 'thirdParty';

const pad2 = (value: number): string => String(value).padStart(2, '0');
const toLocalDateText = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatKoreanDate = (dateText: string): string => {
    const [year, month, day] = String(dateText ?? '').split('-').map(Number);
    if (!year || !month || !day) return '';
    return `${year}년 ${month}월 ${day}일`;
};

const clean = (value: unknown): string => String(value ?? '').trim();

const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';
const labelClass = 'mb-1.5 block text-xs font-bold tracking-wide text-slate-300';

const AccountChangeRequestPage: React.FC = () => {
    const today = useMemo(() => new Date(), []);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [copying, setCopying] = useState(false);

    const [applicationDate, setApplicationDate] = useState(() => toLocalDateText(today));
    const [effectiveDate, setEffectiveDate] = useState(() => toLocalDateText(today));
    const [accountType, setAccountType] = useState<AccountType>('self');
    const [currentBankName, setCurrentBankName] = useState('');
    const [currentAccountNumber, setCurrentAccountNumber] = useState('');
    const [currentAccountHolder, setCurrentAccountHolder] = useState('');
    const [newBankName, setNewBankName] = useState('');
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [newAccountHolder, setNewAccountHolder] = useState('');
    const [holderRelationship, setHolderRelationship] = useState('');
    const [holderPhone, setHolderPhone] = useState('');
    const [changeReason, setChangeReason] = useState('');
    const [unavailableReason, setUnavailableReason] = useState('');
    const [paymentScope, setPaymentScope] = useState('변경 승인 이후 지급되는 임금');

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const [workerRows, companyRows] = await Promise.all([
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                ]);
                if (!alive) return;
                setWorkers(workerRows);
                setCompanies(companyRows);
                const defaultCompany = companyRows.find((company) => company.isMyCompany)
                    ?? companyRows.find((company) => clean(company.name).includes('청연'))
                    ?? companyRows[0];
                setSelectedCompanyId(clean(defaultCompany?.id));
            } catch (error) {
                console.error('계좌변경 신청서 기본 데이터 조회 실패:', error);
            } finally {
                if (alive) setLoading(false);
            }
        };

        void loadData();
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => manpowerService.subscribeWorkers(setWorkers), []);

    const selectedWorker = useMemo(
        () => workers.find((worker) => clean(worker.id) === selectedWorkerId) ?? null,
        [selectedWorkerId, workers]
    );

    const selectedCompany = useMemo(
        () => companies.find((company) => clean(company.id) === selectedCompanyId) ?? null,
        [companies, selectedCompanyId]
    );

    useEffect(() => {
        if (!selectedWorker) {
            setCurrentBankName('');
            setCurrentAccountNumber('');
            setCurrentAccountHolder('');
            setNewAccountHolder('');
            return;
        }
        setCurrentBankName(clean(selectedWorker.bankName));
        setCurrentAccountNumber(clean(selectedWorker.accountNumber));
        setCurrentAccountHolder(clean(selectedWorker.accountHolder));
        setNewBankName('');
        setNewAccountNumber('');
        setNewAccountHolder(accountType === 'self' ? clean(selectedWorker.name) : '');
    }, [selectedWorker]);

    useEffect(() => {
        if (accountType === 'self') {
            setNewAccountHolder(clean(selectedWorker?.name));
            setHolderRelationship('');
            setHolderPhone('');
            setUnavailableReason('');
        } else if (clean(newAccountHolder) === clean(selectedWorker?.name)) {
            setNewAccountHolder('');
        }
    }, [accountType, selectedWorker?.name]);

    const workerOptions = useMemo(
        () => workers
            .filter((worker) => worker.id && worker.name && worker.isActive !== false)
            .map((worker) => ({
                id: clean(worker.id),
                name: `${clean(worker.name)}${worker.teamName ? ` · ${clean(worker.teamName)}` : ''}${worker.contact ? ` · ${clean(worker.contact)}` : ''}`,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR', { numeric: true })),
        [workers]
    );

    const companyOptions = useMemo(
        () => companies
            .filter((company) => company.id && company.status !== 'archived')
            .map((company) => ({ id: clean(company.id), name: clean(company.name) }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')),
        [companies]
    );

    const thirdPartyReady = accountType === 'self'
        || Boolean(clean(holderRelationship) && clean(holderPhone) && clean(unavailableReason));
    const canPrint = Boolean(
        selectedWorker
        && selectedCompany
        && clean(newBankName)
        && clean(newAccountNumber)
        && clean(newAccountHolder)
        && clean(changeReason)
        && thirdPartyReady
    );

    const handleCopy = async () => {
        if (!printRef.current || !canPrint) return;
        setCopying(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            } as unknown as Parameters<typeof html2canvas>[1]);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
                alert('이 브라우저에서는 이미지 복사를 사용할 수 없습니다.');
                return;
            }
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            alert('급여계좌 변경 신청서가 이미지로 복사되었습니다.');
        } catch (error) {
            console.error('급여계좌 변경 신청서 이미지 복사 실패:', error);
            alert('이미지 복사 중 오류가 발생했습니다.');
        } finally {
            setCopying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="mb-3 text-3xl text-cyan-400" />
                    <p className="font-semibold">계좌변경 신청서 데이터를 불러오는 중입니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="account-change-page-root flex min-h-screen flex-col gap-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 lg:flex-row lg:p-6">
            <style>{`
                @page { size: A4 portrait; margin: 0; }
                .account-change-preview-container { container-type: inline-size; }
                .account-change-preview-container .account-change-print-root { zoom: 0.52; }
                @container (min-width: 650px) {
                    .account-change-preview-container .account-change-print-root { zoom: 0.78; }
                }
                @container (min-width: 860px) {
                    .account-change-preview-container .account-change-print-root { zoom: 1; }
                }
                @media print {
                    #main-header, #sidebar, #bottom-panel, #submenu-panel { display: none !important; }
                    body * { visibility: hidden !important; }
                    html, body, #root {
                        width: 210mm !important; min-height: auto !important; height: auto !important;
                        margin: 0 !important; padding: 0 !important; overflow: visible !important; background: white !important;
                    }
                    .app { display: block !important; min-height: auto !important; overflow: visible !important; }
                    .app > * { display: none !important; }
                    .app > #main-content { display: block !important; }
                    #main-content {
                        display: block !important; position: static !important; width: 210mm !important;
                        max-width: 210mm !important; min-height: auto !important; margin: 0 !important;
                        padding: 0 !important; overflow: visible !important;
                    }
                    #main-content > * { display: none !important; }
                    #main-content > .account-change-page-root { display: block !important; }
                    .account-change-page-root {
                        width: 210mm !important; min-height: auto !important; margin: 0 !important;
                        padding: 0 !important; background: white !important;
                    }
                    .account-change-page-root > * { display: none !important; }
                    .account-change-page-root > .account-change-preview-container {
                        display: block !important; width: 210mm !important; max-width: 210mm !important;
                        margin: 0 !important; padding: 0 !important; overflow: visible !important;
                        border: 0 !important; border-radius: 0 !important; background: white !important;
                    }
                    .account-change-print-root, .account-change-print-root * { visibility: visible !important; }
                    .account-change-print-root {
                        position: static !important; width: 210mm !important; margin: 0 !important;
                        box-shadow: none !important; zoom: 1 !important;
                    }
                    .account-change-document {
                        width: 210mm !important; height: 297mm !important; min-height: 297mm !important;
                        margin: 0 !important; box-shadow: none !important; background: white !important;
                        color: black !important; break-inside: avoid-page; page-break-inside: avoid;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <aside className="no-print flex w-full shrink-0 flex-col gap-4 lg:w-[430px]">
                <section className="rounded-2xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-2xl backdrop-blur">
                    <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                            <p className="mb-1 text-xs font-black tracking-[0.2em] text-cyan-400">PAYROLL DOCUMENT</p>
                            <h1 className="text-2xl font-black text-white">급여계좌 변경 신청서</h1>
                            <p className="mt-2 text-sm leading-6 text-slate-400">본인 계좌 변경과 제3자 계좌 예외지정을 한 양식에서 작성합니다.</p>
                        </div>
                        <FontAwesomeIcon icon={faLandmark} className="mt-1 text-2xl text-cyan-400" />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}><FontAwesomeIcon icon={faUser} className="mr-2 text-cyan-400" />신청 근로자 *</label>
                            <SingleSelectPopover options={workerOptions} selectedId={selectedWorkerId || null} onSelect={setSelectedWorkerId} placeholder="근로자 검색 및 선택" />
                        </div>
                        <div>
                            <label className={labelClass}><FontAwesomeIcon icon={faBuilding} className="mr-2 text-cyan-400" />제출 회사 *</label>
                            <SingleSelectPopover options={companyOptions} selectedId={selectedCompanyId || null} onSelect={setSelectedCompanyId} placeholder="회사 검색 및 선택" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label><span className={labelClass}><FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-cyan-400" />신청일</span><input type="date" value={applicationDate} onChange={(event) => setApplicationDate(event.target.value)} className={fieldClass} /></label>
                            <label><span className={labelClass}>변경 희망일</span><input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className={fieldClass} /></label>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-xl">
                    <h2 className="mb-3 text-sm font-black text-white">변경 계좌 유형</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setAccountType('self')} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${accountType === 'self' ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}>본인 명의 계좌</button>
                        <button type="button" onClick={() => setAccountType('thirdParty')} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${accountType === 'thirdParty' ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}>제3자 명의 계좌</button>
                    </div>
                    {accountType === 'thirdParty' && (
                        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 text-amber-300" />
                            지인 계좌 지정은 신청서만으로 승인되지 않습니다. 본인계좌 사용 불가 사유와 관계·전달 가능성을 회사가 엄격히 심사해야 합니다.
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-700/80 bg-slate-900/85 p-5 shadow-xl">
                    <h2 className="mb-4 text-sm font-black text-white">변경할 계좌 정보</h2>
                    <div className="space-y-3">
                        <label><span className={labelClass}>은행명 *</span><input value={newBankName} onChange={(event) => setNewBankName(event.target.value)} placeholder="예: 국민은행" className={fieldClass} /></label>
                        <label><span className={labelClass}>계좌번호 *</span><input value={newAccountNumber} onChange={(event) => setNewAccountNumber(event.target.value.replace(/[^0-9-]/g, ''))} inputMode="numeric" placeholder="숫자와 하이픈만 입력" className={fieldClass} /></label>
                        <label><span className={labelClass}>예금주 *</span><input value={newAccountHolder} onChange={(event) => setNewAccountHolder(event.target.value)} readOnly={accountType === 'self'} className={`${fieldClass} ${accountType === 'self' ? 'cursor-not-allowed opacity-70' : ''}`} /></label>
                        {accountType === 'thirdParty' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <label><span className={labelClass}>신청인과의 관계 *</span><input value={holderRelationship} onChange={(event) => setHolderRelationship(event.target.value)} placeholder="예: 배우자, 지인" className={fieldClass} /></label>
                                    <label><span className={labelClass}>예금주 연락처 *</span><input value={holderPhone} onChange={(event) => setHolderPhone(event.target.value)} placeholder="010-0000-0000" className={fieldClass} /></label>
                                </div>
                                <label><span className={labelClass}>본인계좌 사용이 불가능한 구체적 사유 *</span><textarea value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} rows={3} placeholder="단순 편의가 아닌 불가피한 사유를 구체적으로 입력" className={fieldClass} /></label>
                            </>
                        )}
                        <label><span className={labelClass}>변경 사유 *</span><textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={2} placeholder="변경 사유" className={fieldClass} /></label>
                        <label><span className={labelClass}>적용 범위</span><input value={paymentScope} onChange={(event) => setPaymentScope(event.target.value)} className={fieldClass} /></label>
                    </div>
                </section>

                <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4 text-xs leading-5 text-slate-300">
                    <p className="font-black text-cyan-300"><FontAwesomeIcon icon={faShieldHalved} className="mr-2" />양식에 반영한 안전장치</p>
                    <p className="mt-2">포괄 면책 대신 본인 요청, 정보 정확성, 명의자 동의, 증빙 확인, 오입금 회수 협조, 회사의 승인·반려 절차를 기록합니다.</p>
                </section>

                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleCopy} disabled={!canPrint || copying} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                        <FontAwesomeIcon icon={copying ? faSpinner : faCopy} spin={copying} className="mr-2" />이미지 복사
                    </button>
                    <button type="button" onClick={() => window.print()} disabled={!canPrint} className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
                        <FontAwesomeIcon icon={faPrint} className="mr-2" />인쇄 / PDF
                    </button>
                </div>
                {!canPrint && <p className="text-center text-xs text-amber-300">* 표시된 항목을 모두 입력하면 출력할 수 있습니다.</p>}
            </aside>

            <main className="account-change-preview-container min-w-0 flex-1 overflow-auto rounded-2xl border border-slate-700 bg-slate-800/60 p-3 shadow-2xl sm:p-6">
                <div className="account-change-print-root mx-auto w-[210mm] origin-top">
                    <article ref={printRef} className="account-change-document flex h-[297mm] w-[210mm] flex-col bg-white px-[16mm] py-[13mm] font-serif text-black shadow-2xl">
                        <header className="border-b-2 border-black pb-[5mm] text-center">
                            <p className="mb-1 font-sans text-[10px] font-bold tracking-[0.35em] text-slate-500">PAYROLL ACCOUNT CHANGE REQUEST</p>
                            <h2 className="text-[25px] font-extrabold tracking-[0.08em]">급여계좌 변경 신청서</h2>
                            <p className="mt-2 font-sans text-[11px] text-slate-600">본인 명의 변경 · 제3자 명의 계좌 예외지정</p>
                        </header>

                        <section className="mt-[6mm]">
                            <h3 className="mb-2 border-l-4 border-black pl-2 font-sans text-[12px] font-black">1. 신청인 및 적용 정보</h3>
                            <table className="w-full table-fixed border-collapse font-sans text-[11px]">
                                <tbody>
                                    <tr><th className="w-[24mm] border border-black bg-slate-100 px-2 py-2">성명</th><td className="border border-black px-2 py-2 font-bold">{selectedWorker?.name || ''}</td><th className="w-[24mm] border border-black bg-slate-100 px-2 py-2">연락처</th><td className="border border-black px-2 py-2">{selectedWorker?.contact || ''}</td></tr>
                                    <tr><th className="border border-black bg-slate-100 px-2 py-2">소속</th><td className="border border-black px-2 py-2">{selectedWorker?.teamName || selectedWorker?.companyName || ''}</td><th className="border border-black bg-slate-100 px-2 py-2">제출처</th><td className="border border-black px-2 py-2">{selectedCompany?.name || ''}</td></tr>
                                    <tr><th className="border border-black bg-slate-100 px-2 py-2">신청일</th><td className="border border-black px-2 py-2">{formatKoreanDate(applicationDate)}</td><th className="border border-black bg-slate-100 px-2 py-2">변경 희망일</th><td className="border border-black px-2 py-2">{formatKoreanDate(effectiveDate)}</td></tr>
                                    <tr><th className="border border-black bg-slate-100 px-2 py-2">적용 범위</th><td colSpan={3} className="border border-black px-2 py-2">{paymentScope}</td></tr>
                                </tbody>
                            </table>
                        </section>

                        <section className="mt-[5mm]">
                            <h3 className="mb-2 border-l-4 border-black pl-2 font-sans text-[12px] font-black">2. 계좌 변경 내용</h3>
                            <table className="w-full table-fixed border-collapse font-sans text-[11px]">
                                <thead><tr><th className="w-[23mm] border border-black bg-slate-200 px-2 py-2">구분</th><th className="w-[33mm] border border-black bg-slate-200 px-2 py-2">은행</th><th className="border border-black bg-slate-200 px-2 py-2">계좌번호</th><th className="w-[34mm] border border-black bg-slate-200 px-2 py-2">예금주</th></tr></thead>
                                <tbody>
                                    <tr><th className="border border-black bg-slate-50 px-2 py-2">변경 전</th><td className="border border-black px-2 py-2">{currentBankName || '-'}</td><td className="border border-black px-2 py-2 tracking-[0.04em]">{currentAccountNumber || '-'}</td><td className="border border-black px-2 py-2">{currentAccountHolder || '-'}</td></tr>
                                    <tr><th className="border border-black bg-slate-50 px-2 py-2">변경 후</th><td className="border border-black px-2 py-2 font-bold">{newBankName}</td><td className="border border-black px-2 py-2 font-bold tracking-[0.04em]">{newAccountNumber}</td><td className="border border-black px-2 py-2 font-bold">{newAccountHolder}</td></tr>
                                    <tr><th className="border border-black bg-slate-50 px-2 py-2">계좌 유형</th><td colSpan={3} className="border border-black px-2 py-2 font-bold">{accountType === 'self' ? '☑ 본인 명의 계좌  ☐ 제3자 명의 계좌' : '☐ 본인 명의 계좌  ☑ 제3자 명의 계좌'}</td></tr>
                                    <tr><th className="border border-black bg-slate-50 px-2 py-2">변경 사유</th><td colSpan={3} className="h-[12mm] border border-black px-2 py-2 align-top leading-5">{changeReason}</td></tr>
                                </tbody>
                            </table>
                        </section>

                        {accountType === 'thirdParty' && (
                            <section className="mt-[5mm]">
                                <h3 className="mb-2 border-l-4 border-amber-600 pl-2 font-sans text-[12px] font-black">3. 제3자 명의 계좌 예외지정 사항</h3>
                                <table className="w-full table-fixed border-collapse font-sans text-[11px]">
                                    <tbody>
                                        <tr><th className="w-[28mm] border border-black bg-amber-50 px-2 py-2">예금주</th><td className="border border-black px-2 py-2 font-bold">{newAccountHolder}</td><th className="w-[28mm] border border-black bg-amber-50 px-2 py-2">신청인과 관계</th><td className="border border-black px-2 py-2">{holderRelationship}</td></tr>
                                        <tr><th className="border border-black bg-amber-50 px-2 py-2">예금주 연락처</th><td className="border border-black px-2 py-2">{holderPhone}</td><th className="border border-black bg-amber-50 px-2 py-2">명의자 동의</th><td className="border border-black px-2 py-2">☐ 확인 완료</td></tr>
                                        <tr><th className="border border-black bg-amber-50 px-2 py-2">본인계좌 불가 사유</th><td colSpan={3} className="h-[12mm] border border-black px-2 py-2 align-top leading-5">{unavailableReason}</td></tr>
                                    </tbody>
                                </table>
                            </section>
                        )}

                        <section className="mt-[5mm] font-sans">
                            <h3 className="mb-2 border-l-4 border-black pl-2 text-[12px] font-black">{accountType === 'thirdParty' ? '4' : '3'}. 신청인 확인 및 서약</h3>
                            <div className="space-y-1.5 border border-black p-[3mm] text-[10.5px] leading-[1.45]">
                                <p>① 본 신청은 신청인의 자유로운 의사에 따른 것이며, 기재한 계좌와 사유가 사실과 다름없음을 확인합니다.</p>
                                <p>② 계좌번호·예금주 등 잘못된 정보 또는 허위 자료로 생긴 문제의 확인, 오입금 회수 및 정정 절차에 성실히 협조하겠습니다.</p>
                                {accountType === 'thirdParty' && <p>③ 예금주에게 임금 입금 목적과 개인정보 처리 내용을 설명하고 명시적 동의를 받았으며, 예금주는 입금액을 신청인에게 그대로 전달할 것임을 확인합니다.</p>}
                                <p>{accountType === 'thirdParty' ? '④' : '③'} 신청서 제출만으로 변경이 승인되거나 효력이 발생하지 않으며, 회사의 확인·승인 전에는 기존 지급방법이 유지될 수 있음을 이해합니다.</p>
                                <p>{accountType === 'thirdParty' ? '⑤' : '④'} 신청인의 고의·과실 또는 허위 기재에 따른 책임은 관계 법령상 인정되는 범위에서 부담할 수 있음을 확인합니다.</p>
                            </div>
                        </section>

                        <section className="mt-[4mm] border-2 border-black bg-slate-50 p-[3mm] font-sans">
                            <p className="mb-1 text-[10.5px] font-black">법적 유의사항</p>
                            <p className="text-[9.5px] leading-[1.45]">근로기준법 제43조에 따라 임금은 근로자에게 직접 지급하는 것이 원칙입니다. 제3자 명의 계좌는 본인계좌 사용이 불가능한 상당한 사유가 있고, 사회통념상 본인에게 지급하는 것과 동일시할 수 있거나 본인에게 그대로 전달될 것이 확실한 경우에 한해 예외적으로 검토됩니다. 본 신청서와 서약은 회사의 법정 임금지급의무 또는 고의·중과실 책임을 면제하지 않습니다.</p>
                        </section>

                        <section className="mt-[4mm] grid grid-cols-[1.2fr_1fr] gap-[4mm] font-sans text-[10px]">
                            <div className="border border-black p-[3mm]">
                                <p className="mb-2 font-black">제출·확인 서류</p>
                                <p>☐ 신청인 본인확인 &nbsp; ☐ 변경계좌 사본 또는 계좌확인서</p>
                                {accountType === 'thirdParty' && <p className="mt-1">☐ 예금주 본인확인·동의 &nbsp; ☐ 관계/불가피성 증빙</p>}
                                <p className="mt-1 text-[8.5px] text-slate-600">※ 사본 보관 시 회사 개인정보 처리방침과 보유기간을 적용합니다.</p>
                            </div>
                            <div className="border border-black p-[3mm]">
                                <p className="mb-2 font-black">회사 검토 결과</p>
                                <p>☐ 승인 &nbsp; ☐ 조건부 승인 &nbsp; ☐ 반려</p>
                                <p className="mt-3">담당자: __________________ (서명)</p>
                            </div>
                        </section>

                        <footer className="mt-auto pt-[5mm] text-center font-sans">
                            <p className="text-[11px]">위 내용을 충분히 읽고 이해한 후 급여계좌 변경을 신청합니다.</p>
                            <p className="mt-[4mm] text-[12px] font-bold tracking-[0.12em]">{formatKoreanDate(applicationDate)}</p>
                            <div className="mt-[5mm] flex items-center justify-center gap-2 text-[12px]">
                                <span>신청인</span><span className="min-w-[42mm] border-b border-black px-4 py-1 font-bold">{selectedWorker?.name || ''}</span>
                                <span className="relative inline-flex h-[12mm] w-[25mm] items-center justify-center">
                                    <span>(서명 또는 인)</span>
                                    {selectedWorker?.signatureUrl && <img src={selectedWorker.signatureUrl} alt="신청인 서명" className="absolute left-1/2 top-1/2 h-[13mm] w-[28mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90 mix-blend-multiply" />}
                                </span>
                            </div>
                            {accountType === 'thirdParty' && <p className="mt-2 text-[10.5px]">지정 예금주 동의 확인: {newAccountHolder} __________________ (서명 또는 인)</p>}
                            <p className="mt-[3mm] text-[14px] font-black tracking-[0.08em]">{selectedCompany?.name || ''} 귀중</p>
                        </footer>

                        {!canPrint && (
                            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center font-sans text-sm text-slate-400 no-print">
                                필수 항목을 입력하면 신청서가 완성됩니다.
                            </div>
                        )}
                    </article>
                </div>
            </main>
        </div>
    );
};

export default AccountChangeRequestPage;
