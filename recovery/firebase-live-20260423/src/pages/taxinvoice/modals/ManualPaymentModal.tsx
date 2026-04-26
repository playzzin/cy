import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faPen, faMoneyBillWave, faUniversity, faUser } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { receivableService, ReceivableLedger } from '../../../services/receivableService';

// Reusing styled components or defining new ones consistent with BankMatchModal
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
    width: 450px;
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
    padding: 24px;
    background-color: white;
`;

const FormGroup = styled.div`
    margin-bottom: 20px;
    
    label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 8px;
    }
`;

const StyledInput = styled.input`
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 15px;
    color: #1e293b;
    outline: none;
    transition: all 0.2s;

    &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
`;

const MethodGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
`;

const MethodCard = styled.button<{ $selected: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border: 1px solid ${props => props.$selected ? '#3b82f6' : '#e2e8f0'};
    background-color: ${props => props.$selected ? '#eff6ff' : 'white'};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    color: ${props => props.$selected ? '#2563eb' : '#64748b'};

    &:hover {
        background-color: #f8fafc;
        border-color: ${props => props.$selected ? '#3b82f6' : '#cbd5e1'};
    }

    svg {
        font-size: 20px;
        margin-bottom: 6px;
    }

    span {
        font-size: 13px;
        font-weight: 600;
    }
`;

const ModalFooter = styled.div`
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background-color: #f8fafc;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
`;

const PrimaryButton = styled.button`
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
`;

interface ManualPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    receivable: ReceivableLedger;
    onSuccess: () => void;
}

export const ManualPaymentModal: React.FC<ManualPaymentModalProps> = ({ isOpen, onClose, receivable, onSuccess }) => {
    const [amount, setAmount] = useState<number>(receivable.outstandingAmount);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [method, setMethod] = useState<'Cash' | 'Corporate' | 'Personal' | 'Manual'>('Cash');
    const [memo, setMemo] = useState('');

    const handleSubmit = async () => {
        if (amount <= 0) {
            Swal.fire('알림', '입금액을 확인해주세요.', 'warning');
            return;
        }

        try {
            await receivableService.addPayment(receivable.id, {
                receivableId: receivable.id,
                type: 'MANUAL',
                amount,
                paymentDate: date,
                method: method,
                memo
            });
            Swal.fire({
                title: '완료',
                text: '수기 입금 등록이 완료되었습니다.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '저장 실패', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContent onClick={e => e.stopPropagation()}>
                <ModalHeader>
                    <HeaderTitle>
                        <FontAwesomeIcon icon={faPen} className="text-orange-500" />
                        직접 입금 등록
                    </HeaderTitle>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </ModalHeader>

                <ModalBody>
                    <FormGroup>
                        <label>거래처 / 품목</label>
                        <div className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-1">
                            {receivable.invoiceData.partnerName} / {receivable.invoiceData.itemName}
                        </div>
                        <div className="text-xs text-red-500 font-semibold text-right">
                            미수 잔액: {receivable.outstandingAmount.toLocaleString()}원
                        </div>
                    </FormGroup>

                    <FormGroup>
                        <label>입금일자</label>
                        <StyledInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormGroup>

                    <FormGroup>
                        <label>입금수단</label>
                        <MethodGrid>
                            <MethodCard $selected={method === 'Cash'} onClick={() => setMethod('Cash')}>
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                                <span>현금</span>
                            </MethodCard>
                            <MethodCard $selected={method === 'Corporate'} onClick={() => setMethod('Corporate')}>
                                <FontAwesomeIcon icon={faUniversity} />
                                <span>법인계좌</span>
                            </MethodCard>
                            <MethodCard $selected={method === 'Personal'} onClick={() => setMethod('Personal')}>
                                <FontAwesomeIcon icon={faUser} />
                                <span>개인계좌</span>
                            </MethodCard>
                            <MethodCard $selected={method === 'Manual'} onClick={() => setMethod('Manual')}>
                                <FontAwesomeIcon icon={faPen} />
                                <span>기타(수기)</span>
                            </MethodCard>
                        </MethodGrid>
                    </FormGroup>

                    <FormGroup>
                        <label>입금액</label>
                        <div className="relative">
                            <StyledInput
                                type="number"
                                value={amount}
                                onChange={e => setAmount(Number(e.target.value))}
                                style={{ textAlign: 'right', fontWeight: 'bold', color: '#059669' }}
                            />
                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">원</span>
                        </div>
                    </FormGroup>

                    <FormGroup>
                        <label>메모 (선택)</label>
                        <StyledInput
                            type="text"
                            placeholder="비고 사항 입력"
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                        />
                    </FormGroup>
                </ModalBody>

                <ModalFooter>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
                    >
                        취소
                    </button>
                    <PrimaryButton onClick={handleSubmit}>
                        <FontAwesomeIcon icon={faSave} className="mr-2" />
                        등록 완료
                    </PrimaryButton>
                </ModalFooter>
            </ModalContent>
        </ModalOverlay>
    );
};
