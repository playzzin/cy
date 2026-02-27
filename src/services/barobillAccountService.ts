/**
 * 바로빌 계좌 조회 서비스 (Frontend)
 * 
 * Firebase Functions를 통해 바로빌 계좌 입출금 내역을 조회합니다.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface BankAccountLog {
    BankAccountNum: string;  // 계좌번호
    TransDT: string;         // 거래일시 (YYYYMMDDHHMMSS)
    Deposit: string;         // 입금액
    Withdraw: string;        // 출금액
    Balance: string;         // 잔액
    TransDirection: string;  // 입출금구분 (1:전체, 2:입금, 3:출금)
    TransRemark1: string;    // 입출금비고1 (보낸분/받는분)
    TransRemark2: string;    // 입출금비고2 (내통장표시내용)
    MgtRemark1: string;      // 비고1 (KB: 내통장표시내용, IBK: CMS코드)
    MgtRemark2: string;      // 비고2
    CmsCode: string;         // CMS 코드
    TransType: string;       // 입출금구분 (은행)
    TransOffice: string;     // 취급점
    Memo: string;            // 메모
    [key: string]: any;
}

export interface PagedBankAccountTransLog {
    currentPage: number;
    maxPageNum: number;
    countPerPage: number;
    totalCount: number;
    logs: BankAccountLog[];
}

export const barobillAccountService = {
    /**
     * 기간별 입출금 내역 조회
     * 
     * @param accountNum 계좌번호 (하이픈 제외 가능)
     * @param startDate 조회 시작일 (YYYYMMDD)
     * @param endDate 조회 종료일 (YYYYMMDD)
     * @param page 페이지 번호 (기본값 1)
     */
    getBankAccountHistory: async (
        accountNum: string,
        startDate: string,
        endDate: string,
        page: number = 1
    ): Promise<PagedBankAccountTransLog> => {
        try {
            const callable = httpsCallable(functions, 'getBankAccountHistory');
            const response = await callable({
                accountNum,
                startDate,
                endDate,
                page
            });

            const data = response.data as PagedBankAccountTransLog;
            return data;
        } catch (error: any) {
            console.error('계좌 내역 조회 실패:', error);
            throw new Error(error.message || '계좌 내역을 불러오는 중 오류가 발생했습니다.');
        }
    },

    /**
     * 계좌 등록 (바로빌)
     * 
     * @param bank 은행 코드
     * @param accountNum 계좌번호
     * @param accountPwd 계좌 비밀번호
     * @param identityNum 주민/사업자번호
     * @param alias 별칭
     */
    registBankAccount: async (
        bank: string,
        accountNum: string,
        accountPwd: string,
        identityNum: string,
        alias: string = ''
    ): Promise<{ success: boolean; code: number }> => {
        try {
            const callable = httpsCallable(functions, 'registBankAccount');
            const response = await callable({
                bank,
                accountNum,
                accountPwd,
                identityNum,
                alias
            });
            return response.data as { success: boolean; code: number };
        } catch (error: any) {
            console.error('계좌 등록 실패:', error);
            throw new Error(error.message || '계좌 등록 중 오류가 발생했습니다.');
        }
    },

    /**
     * 등록된 계좌 목록 조회
     */
    getBankAccountList: async (): Promise<BankAccount[]> => {
        try {
            const callable = httpsCallable(functions, 'getBankAccountList');
            const response = await callable({});
            return response.data as BankAccount[];
        } catch (error: any) {
            console.error('계좌 목록 조회 실패:', error);
            throw new Error(error.message || '계좌 목록을 불러오는 중 오류가 발생했습니다.');
        }
    }
};

export interface BankAccount {
    bank: string;
    accountNum: string;
    alias?: string;
    bankAccountType?: number;
    useYn?: string;
}
