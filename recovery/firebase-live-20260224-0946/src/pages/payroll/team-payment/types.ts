/**
 * 팀별 입금 리스트 관련 타입 정의
 */

import { Team } from '../../../services/teamService';
import { Worker } from '../../../services/manpowerService';

/**
 * 이체 데이터 행
 */
export interface TransferRow {
    rowKey: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel: string;
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    displayContent: string;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

/**
 * ID가 있는 팀 타입
 */
export type TeamWithId = Team & { id: string };

/**
 * ID가 있는 작업자 타입
 */
export type WorkerWithId = Worker & { id: string };

/**
 * 은행 코드 매핑 (은행명/별칭 → 코드)
 */
export const BANK_CODES: { [key: string]: string } = {
    '한국은행': '001',
    '산업은행': '002', '산업': '002', 'KDB': '002',
    '기업은행': '003', '기업': '003', 'IBK': '003',
    'KB국민은행': '004', '국민은행': '004', '국민': '004', 'KB': '004',
    '수협은행': '007', '수협': '007', 'Sh수협': '007',
    '수출입은행': '008',
    '농협은행': '011', '농협': '011', 'NH': '011', 'NH농협': '011',
    '농축협': '012', '지역농협': '012',
    '우리은행': '020', '우리': '020',
    'SC제일은행': '023', '제일은행': '023', 'SC': '023',
    '한국씨티은행': '027', '씨티': '027', '씨티은행': '027',
    '대구은행': '031', '대구': '031', 'iM뱅크': '031', 'DGB': '031',
    '부산은행': '032', '부산': '032', 'BNK부산': '032',
    '광주은행': '034', '광주': '034',
    '제주은행': '035', '제주': '035',
    '전북은행': '037', '전북': '037',
    '경남은행': '039', '경남': '039', 'BNK경남': '039',
    '새마을금고': '045', '새마을': '045', 'MG새마을': '045', 'MG': '045',
    '신협': '048', '신협중앙회': '048', '신용협동조합': '048',
    '상호저축은행': '050', '저축은행': '050',
    '우체국': '071', '우체국예금': '071',
    '하나은행': '081', '하나': '081', 'KEB하나': '081',
    '신한은행': '088', '신한': '088',
    '케이뱅크': '089', 'K뱅크': '089', '케이': '089',
    '카카오뱅크': '090', '카카오': '090', '카뱅': '090',
    '토스뱅크': '092', '토스': '092',
};
