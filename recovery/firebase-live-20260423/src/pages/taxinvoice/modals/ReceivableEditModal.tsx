import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faPen } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { receivableService, ReceivableLedger } from '../../../services/receivableService';

// Styled Components (Reusing Modal Styles)
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
    z-index: 60; // Higher than DetailPanel
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
    width: 500px;
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

interface ReceivableEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    receivable: ReceivableLedger;
    onSuccess: () => void;
}

export const ReceivableEditModal: React.FC<ReceivableEditModalProps> = ({ isOpen, onClose, receivable, onSuccess }) => {
    const [date, setDate] = useState(receivable.invoiceData.date);
    const [partnerName, setPartnerName] = useState(receivable.invoiceData.partnerName);
    const [itemName, setItemName] = useState(receivable.invoiceData.itemName);
    const [totalAmount, setTotalAmount] = useState(receivable.invoiceData.totalAmount);

    useEffect(() => {
        if (isOpen) {
            setDate(receivable.invoiceData.date);
            setPartnerName(receivable.invoiceData.partnerName);
            setItemName(receivable.invoiceData.itemName);
            setTotalAmount(receivable.invoiceData.totalAmount);
        }
    }, [isOpen, receivable]);

    const handleSubmit = async () => {
        if (!partnerName || !itemName || totalAmount < 0) {
            Swal.fire('알림', '필수 정보를 입력해주세요.', 'warning');
            return;
        }

        try {
            await receivableService.updateReceivable(receivable.id, {
                date,
                partnerName,
                itemName,
                totalAmount
            });
            Swal.fire({
                title: '수정 완료',
                text: '미수금 정보가 수정되었습니다.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            Swal.fire('오류', '수정 실패', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContent onClick={e => e.stopPropagation()}>
                <ModalHeader>
                    <HeaderTitle>
                        <FontAwesomeIcon icon={faPen} className="text-slate-600" />
                        미수금 정보 수정
                    </HeaderTitle>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </ModalHeader>

                <ModalBody>
                    <FormGroup>
                        <label>작성일자</label>
                        <StyledInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </FormGroup>

                    <FormGroup>
                        <label>거래처명</label>
                        <StyledInput
                            type="text"
                            value={partnerName}
                            onChange={e => setPartnerName(e.target.value)}
                        />
                    </FormGroup>

                    <FormGroup>
                        <label>품목</label>
                        <StyledInput
                            type="text"
                            value={itemName}
                            onChange={e => setItemName(e.target.value)}
                        />
                    </FormGroup>

                    <FormGroup>
                        <label>청구금액 (Total Amount)</label>
                        <div className="relative">
                            <StyledInput
                                type="number"
                                value={totalAmount}
                                onChange={e => setTotalAmount(Number(e.target.value))}
                                style={{ textAlign: 'right', fontWeight: 'bold' }}
                            />
                            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">원</span>
                        </div>
                        <p className="text-xs text-orange-500 mt-2">
                            * 금액 수정 시 미수잔액이 자동으로 재계산됩니다.
                        </p>
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
                        저장하기
                    </PrimaryButton>
                </ModalFooter>
            </ModalContent>
        </ModalOverlay>
    );
};
