import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckCircle, faSearch, faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { barobillAccountService, BankAccountLog, BankAccount } from '../../../services/barobillAccountService';
import { receivableService, ReceivableLedger } from '../../../services/receivableService';

// Styled Components for Modal
const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    animation: fadeIn 0.2s ease-out;

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

const ModalContent = styled.div`
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 900px;
    height: 700px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: zoomIn 0.2s ease-out;

    @keyframes zoomIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
`;

const ModalHeader = styled.div`
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8fafc;
`;

const HeaderTitle = styled.h2`
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const ModalBody = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: white;
`;

const FilterSection = styled.div`
    padding: 16px 24px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    gap: 12px;
    align-items: center;
    background-color: white;
`;

const StyledSelect = styled.select`
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    color: #334155;
    outline: none;
    min-width: 200px;
    
    &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
`;

const StyledInput = styled.input`
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    color: #334155;
    outline: none;
    
    &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
`;

const TableContainer = styled.div`
    flex: 1;
    overflow: auto;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
`;

const Th = styled.th`
    position: sticky;
    top: 0;
    background-color: #f8fafc;
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
    z-index: 10;
`;

const Tr = styled.tr<{ $selected?: boolean }>`
    cursor: pointer;
    background-color: ${props => props.$selected ? '#eff6ff' : 'white'};
    transition: background-color 0.15s;

    &:hover {
        background-color: ${props => props.$selected ? '#eff6ff' : '#f8fafc'};
    }
`;

const Td = styled.td`
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
    color: #334155;
`;

const Amount = styled.span`
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    color: #2563eb;
`;

const ModalFooter = styled.div`
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background-color: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const MatchButton = styled.button`
    padding: 10px 24px;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);

    &:hover {
        background-color: #2563eb;
        transform: translateY(-1px);
    }
    
    &:disabled {
        background-color: #94a3b8;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
`;

interface BankMatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    receivable: ReceivableLedger;
    onSuccess: () => void;
}

export const BankMatchModal: React.FC<BankMatchModalProps> = ({ isOpen, onClose, receivable, onSuccess }) => {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [searchMonth, setSearchMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [deposits, setDeposits] = useState<BankAccountLog[]>([]);
    const [selectedDeposit, setSelectedDeposit] = useState<BankAccountLog | null>(null);
    const [matchAmount, setMatchAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            barobillAccountService.getBankAccountList().then(list => {
                setAccounts(list);
                if (list.length > 0 && !selectedAccount) setSelectedAccount(list[0].accountNum);
            });
        }
    }, [isOpen]);

    const fetchHistory = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        // Clear previous selection reset
        setSelectedDeposit(null);

        try {
            const start = `${searchMonth}-01`.replace(/-/g, '');
            const [y, m] = searchMonth.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const end = `${searchMonth}-${lastDay}`.replace(/-/g, '');

            // Fetch all pages logic
            let allLogs: BankAccountLog[] = [];
            let page = 1;
            let maxPage = 1;

            do {
                const res = await barobillAccountService.getBankAccountHistory(selectedAccount, start, end, page);
                allLogs = [...allLogs, ...res.logs];
                maxPage = res?.maxPageNum || page; // Safety check
                page++;
            } while (page <= maxPage && page <= 50); // Safety limit 50 pages

            // Filter only deposits (Deposit > 0)
            const dep = allLogs.filter(l => Number(l.Deposit) > 0);
            setDeposits(dep);
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '계좌 내역 조회 실패', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedAccount && isOpen) fetchHistory();
    }, [selectedAccount, searchMonth, isOpen]);

    useEffect(() => {
        if (selectedDeposit) {
            const depositAmt = Number(selectedDeposit.Deposit);
            // Default match amount is MIN(Deposit, Outstanding)
            setMatchAmount(Math.min(depositAmt, receivable.outstandingAmount));
        } else {
            setMatchAmount(0);
        }
    }, [selectedDeposit, receivable]);

    const handleConfirm = async () => {
        if (!selectedDeposit) return;
        try {
            await receivableService.addPayment(receivable.id, {
                receivableId: receivable.id,
                type: 'BANK_MATCH',
                amount: matchAmount,
                paymentDate: selectedDeposit.TransDT.substring(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                bankTxId: `${selectedDeposit.TransDT}-${selectedDeposit.Balance}-${selectedDeposit.Identity}`, // More unique ID
                bankSender: selectedDeposit.TransRemark1 || selectedDeposit.TransRemark2,
                method: 'BankMatch',
            });
            Swal.fire({
                title: '매칭 완료',
                text: '성공적으로 매칭되었습니다.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '매칭 실패', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContent onClick={e => e.stopPropagation()}>
                <ModalHeader>
                    <HeaderTitle>
                        <FontAwesomeIcon icon={faBuildingColumns} className="text-blue-600" />
                        입금 내역 매칭
                    </HeaderTitle>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </ModalHeader>

                <ModalBody>
                    {/* Filters */}
                    <FilterSection>
                        <StyledSelect
                            value={selectedAccount}
                            onChange={e => setSelectedAccount(e.target.value)}
                        >
                            {accounts.map(acc => (
                                <option key={acc.accountNum} value={acc.accountNum}>
                                    {acc.bank} {acc.accountNum} ({acc.alias || '별칭없음'})
                                </option>
                            ))}
                        </StyledSelect>
                        <StyledInput
                            type="month"
                            value={searchMonth}
                            onChange={e => setSearchMonth(e.target.value)}
                        />
                        <button
                            onClick={fetchHistory}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </FilterSection>

                    {/* Table */}
                    <TableContainer>
                        <Table>
                            <thead>
                                <tr>
                                    <Th>거래일시</Th>
                                    <Th>적요 (보낸분)</Th>
                                    <Th style={{ textAlign: 'right' }}>입금액</Th>
                                    <Th style={{ textAlign: 'center', width: '60px' }}>선택</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <Td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                            데이터를 불러오는 중입니다...
                                        </Td>
                                    </tr>
                                ) : deposits.length === 0 ? (
                                    <tr>
                                        <Td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                            조회된 입금 내역이 없습니다.
                                        </Td>
                                    </tr>
                                ) : (
                                    deposits.map((log, idx) => (
                                        <Tr
                                            key={idx}
                                            $selected={selectedDeposit === log}
                                            onClick={() => setSelectedDeposit(log)}
                                        >
                                            <Td>{log.TransDT.substring(0, 10)} <span className="text-xs text-slate-400">{log.TransDT.substring(11, 19)}</span></Td>
                                            <Td>
                                                <div className="font-medium text-slate-700">{log.TransRemark1}</div>
                                                {log.TransRemark2 && <div className="text-xs text-slate-500">{log.TransRemark2}</div>}
                                            </Td>
                                            <Td style={{ textAlign: 'right' }}>
                                                <Amount>{Number(log.Deposit).toLocaleString()}</Amount>
                                            </Td>
                                            <Td style={{ textAlign: 'center' }}>
                                                {selectedDeposit === log && (
                                                    <FontAwesomeIcon icon={faCheckCircle} className="text-blue-600 text-lg" />
                                                )}
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </TableContainer>
                </ModalBody>

                <ModalFooter>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-500 font-medium">매칭 대상: {receivable.invoiceData.partnerName}</span>
                        <div className="text-sm font-bold text-slate-700">
                            미수잔액: <span className="text-red-500">{receivable.outstandingAmount.toLocaleString()}원</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {selectedDeposit && (
                            <div className="text-right mr-4 animate-in slide-in-from-right-4 fade-in">
                                <span className="text-xs text-slate-500 block">설정할 입금액</span>
                                <input
                                    type="number"
                                    className="font-bold text-blue-600 border-b border-blue-200 focus:border-blue-500 outline-none w-32 text-right bg-transparent"
                                    value={matchAmount}
                                    onChange={e => setMatchAmount(Number(e.target.value))}
                                />
                                <span className="text-sm font-bold text-blue-600 ml-1">원</span>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
                            >
                                취소
                            </button>
                            <MatchButton
                                onClick={handleConfirm}
                                disabled={!selectedDeposit || matchAmount <= 0}
                            >
                                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                                매칭 확정
                            </MatchButton>
                        </div>
                    </div>
                </ModalFooter>
            </ModalContent>
        </ModalOverlay>
    );
};
