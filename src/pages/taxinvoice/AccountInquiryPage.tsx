import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUniversity, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { format, startOfMonth, addDays } from 'date-fns';

import { barobillAccountService, BankAccountLog, BankAccount } from '../../services/barobillAccountService';

// New Components
import { AccountInquiryFilterBar } from './components/AccountInquiryFilterBar';
import { AccountTransactionTable } from './components/AccountTransactionTable';
import { AccountSummaryCards } from './components/AccountSummaryCards';

const PageContainer = styled.div`
    padding: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #f8f9fa;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
`;

const PageHeader = styled.div`
    margin-bottom: 24px;
`;

const HeaderContent = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 12px;
`;

const Subtitle = styled.p`
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
`;

const BackButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: white;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    color: #475569;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 16px;

    &:hover {
        background-color: #f1f5f9;
        text-decoration: none;
    }
`;

const PaginationBar = styled.div`
    padding: 16px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
`;

const PageButton = styled.button`
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid #e2e8f0;
    background-color: white;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        background-color: #f8fafc;
        border-color: #cbd5e1;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: #f1f5f9;
        color: #94a3b8;
    }
`;

const PageInfo = styled.span`
    font-size: 14px;
    font-weight: 500;
    color: #64748b;
`;

const AccountInquiryPage: React.FC = () => {
    const navigate = useNavigate();

    // State
    const [accountNum, setAccountNum] = useState('');
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Data State
    const [transactions, setTransactions] = useState<BankAccountLog[]>([]);
    const [registeredAccounts, setRegisteredAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Initial Load
    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const accounts = await barobillAccountService.getBankAccountList();
                setRegisteredAccounts(accounts || []);
                if (accounts && accounts.length > 0) {
                    const defaultAcc = '66620101767628'; // Legacy default
                    const found = accounts.find(a => a.accountNum === defaultAcc);
                    if (found) {
                        setAccountNum(found.accountNum);
                    } else {
                        setAccountNum(accounts[0].accountNum);
                    }
                }
            } catch (e) {
                console.error("Failed to load accounts", e);
            }
        };
        loadAccounts();
    }, []);

    // Summary Calculation (for the current page view - API limitation unless we fetch all to sum)
    // Actually Barobill might not give total stats for period. We summarize what we see.
    // Or we use the Balance from the latest record.
    const summary = useMemo(() => {
        const deposit = transactions.reduce((acc, curr) => acc + (Number(curr.Deposit) || 0), 0);
        const withdraw = transactions.reduce((acc, curr) => acc + (Number(curr.Withdraw) || 0), 0);
        // Latest balance: The first record if sorted desc by date? Barobill returns usually desc.
        // Let's assume index 0 is latest.
        const latestBalance = transactions.length > 0 ? Number(transactions[0].Balance) || 0 : 0;

        return { totalDeposit: deposit, totalWithdraw: withdraw, latestBalance };
    }, [transactions]);


    const fetchHistory = async (page: number) => {
        if (!accountNum) {
            Swal.fire('알림', '계좌를 선택해주세요.', 'warning');
            return;
        }

        setLoading(true);
        try {
            // Remove dashes from date if needed, but service expects generic string potentially.
            // Looking at previous code: formatDateForApi remove dashes.
            const startStr = startDate.replace(/-/g, '');
            const endStr = endDate.replace(/-/g, '');

            console.log(`[AccountInquiry] Fetching page ${page} for ${accountNum}, ${startStr}~${endStr}`);

            const result = await barobillAccountService.getBankAccountHistory(
                accountNum,
                startStr,
                endStr,
                page
            );

            setTransactions(result.logs || []);
            setTotalPages(result.maxPageNum || 1);
            setTotalCount(result.totalCount || 0);
            setCurrentPage(page);

        } catch (error: any) {
            console.error(error);
            Swal.fire('조회 실패', error.message || '내역을 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchHistory(1);
    };

    const handleRegister = async () => {
        const { value: formValues } = await Swal.fire({
            title: '계좌 등록 (바로빌)',
            html: `
                <div style="text-align: left; font-size: 14px; display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color: #374151;">은행</label>
                        <select id="swal-bank" class="swal2-input" style="margin:0; width:100%;">
                            <option value="">은행 선택</option>
                            <option value="004">국민은행</option>
                            <option value="088">신한은행</option>
                            <option value="020">우리은행</option>
                            <option value="081">하나은행</option>
                            <option value="011">농협</option>
                            <option value="003">기업은행</option>
                            <option value="023">SC제일은행</option>
                            <option value="002">산업은행</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color: #374151;">계좌번호 ('-' 없이)</label>
                        <input id="swal-account" class="swal2-input" placeholder="1234567890" style="margin:0; width:100%;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color: #374151;">계좌 비밀번호</label>
                        <input id="swal-pwd" type="password" class="swal2-input" placeholder="비밀번호" style="margin:0; width:100%;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color: #374151;">예금주 식별번호 (사업자/주민번호)</label>
                        <input id="swal-identity" class="swal2-input" placeholder="사업자번호 또는 주민번호" style="margin:0; width:100%;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color: #374151;">별칭 (선택)</label>
                        <input id="swal-alias" class="swal2-input" placeholder="예: 법인 주거래" style="margin:0; width:100%;">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '등록',
            cancelButtonText: '취소',
            confirmButtonColor: '#059669',
            preConfirm: () => {
                const bank = (document.getElementById('swal-bank') as HTMLSelectElement).value;
                const account = (document.getElementById('swal-account') as HTMLInputElement).value;
                const pwd = (document.getElementById('swal-pwd') as HTMLInputElement).value;
                const identity = (document.getElementById('swal-identity') as HTMLInputElement).value;
                const alias = (document.getElementById('swal-alias') as HTMLInputElement).value;

                if (!bank || !account || !pwd || !identity) {
                    Swal.showValidationMessage('모든 필수 정보를 입력해주세요.');
                    return false;
                }
                return { bank, account, pwd, identity, alias };
            }
        });

        if (formValues) {
            try {
                // Loading
                Swal.fire({
                    title: '등록 중...',
                    text: '바로빌에 계좌를 등록하고 있습니다.',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const result = await barobillAccountService.registBankAccount(
                    formValues.bank,
                    formValues.account,
                    formValues.pwd,
                    formValues.identity,
                    formValues.alias
                );

                if (result.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '등록 성공',
                        text: '계좌가 성공적으로 등록되었습니다.',
                        confirmButtonText: '확인',
                        confirmButtonColor: '#059669'
                    });
                    // Refresh account list
                    const accounts = await barobillAccountService.getBankAccountList();
                    setRegisteredAccounts(accounts || []);
                    if (accounts && accounts.length > 0 && !accountNum) {
                        setAccountNum(accounts[0].accountNum);
                    }
                }
            } catch (error: any) {
                Swal.fire({
                    icon: 'error',
                    title: '등록 실패',
                    text: error.message,
                    confirmButtonColor: '#d33'
                });
            }
        }
    };

    const handleBack = () => {
        navigate(-1);
    };

    return (
        <PageContainer>
            <BackButton onClick={handleBack}>
                <FontAwesomeIcon icon={faArrowLeft} />
                이전으로
            </BackButton>

            <PageHeader>
                <HeaderContent>
                    <div>
                        <Title>
                            <FontAwesomeIcon icon={faUniversity} className="text-emerald-600" />
                            계좌 입출금 내역 조회
                        </Title>
                        <Subtitle>
                            바로빌 서비스에 등록된 계좌의 입출금 내역을 조회합니다.
                        </Subtitle>
                    </div>
                </HeaderContent>
            </PageHeader>

            <AccountSummaryCards
                totalDeposit={summary.totalDeposit}
                totalWithdraw={summary.totalWithdraw}
                latestBalance={summary.latestBalance}
            />

            <AccountInquiryFilterBar
                accountNum={accountNum}
                onAccountChange={setAccountNum}
                accounts={registeredAccounts}
                startDate={startDate}
                endDate={endDate}
                onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                onRefresh={handleSearch}
                onRegister={handleRegister}
                loading={loading}
            />

            <AccountTransactionTable
                records={transactions}
                loading={loading}
            />

            {/* Pagination */}
            {totalCount > 0 && (
                <PaginationBar>
                    <PageButton
                        onClick={() => fetchHistory(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                    >
                        이전
                    </PageButton>
                    <PageInfo>
                        페이지 {currentPage} / {totalPages} (총 {totalCount.toLocaleString()}건)
                    </PageInfo>
                    <PageButton
                        onClick={() => fetchHistory(currentPage + 1)}
                        disabled={currentPage === totalPages || loading}
                    >
                        다음
                    </PageButton>
                </PaginationBar>
            )}
        </PageContainer>
    );
};

export default AccountInquiryPage;
