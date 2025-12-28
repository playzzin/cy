import { db } from '../config/firebase';
import { collection, doc, getDocs, setDoc, query, where, Timestamp } from 'firebase/firestore';

// 팀별 지원비 단가
export interface SupportRate {
    id?: string;                    // teamId
    teamId: string;
    teamName: string;
    defaultRate: number;            // 기본 지원비 단가
    customRates?: {                 // 특정 팀에 대한 차등 단가
        targetTeamId: string;
        targetTeamName: string;
        rate: number;
    }[];
    updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'support_rates';

export const supportRateService = {
    // 모든 지원비 단가 조회
    async getAllRates(): Promise<SupportRate[]> {
        try {
            const snapshot = await getDocs(collection(db, COLLECTION_NAME));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SupportRate[];
        } catch (error) {
            console.error('Error fetching support rates:', error);
            throw error;
        }
    },

    // 팀별 지원비 단가 조회
    async getRateByTeam(teamId: string): Promise<SupportRate | null> {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('teamId', '==', teamId));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SupportRate;
        } catch (error) {
            console.error('Error fetching support rate:', error);
            throw error;
        }
    },

    // 지원비 단가 저장/수정
    async saveRate(rate: SupportRate): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, rate.teamId);
            await setDoc(docRef, {
                ...rate,
                id: rate.teamId,
                updatedAt: Timestamp.now()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving support rate:', error);
            throw error;
        }
    },

    // A팀이 B팀에 지원 갔을 때 적용할 단가 계산
    // 우선순위: B팀의 customRates[A팀] > A팀의 defaultRate > 작업자 unitPrice
    async getApplicableRate(
        workerTeamId: string,      // 작업자 소속팀 (지원 간 팀)
        responsibleTeamId: string,  // 담당팀 (지원 받은 팀)
        workerUnitPrice: number     // 작업자 개인 단가 (fallback)
    ): Promise<number> {
        try {
            // 1. 담당팀(B)의 지원비 설정에서 A팀에 대한 특별 단가 확인
            const responsibleTeamRate = await this.getRateByTeam(responsibleTeamId);
            if (responsibleTeamRate?.customRates) {
                const customRate = responsibleTeamRate.customRates.find(
                    r => r.targetTeamId === workerTeamId
                );
                if (customRate) return customRate.rate;
            }

            // 2. 작업자 팀(A)의 기본 지원비 단가
            const workerTeamRate = await this.getRateByTeam(workerTeamId);
            if (workerTeamRate?.defaultRate) return workerTeamRate.defaultRate;

            // 3. Fallback: 작업자 개인 단가
            return workerUnitPrice;
        } catch (error) {
            console.error('Error getting applicable rate:', error);
            return workerUnitPrice;
        }
    },

    // 일괄 단가 적용
    async applyBulkRate(teamIds: string[], rate: number): Promise<void> {
        try {
            await Promise.all(
                teamIds.map(async (teamId) => {
                    const existing = await this.getRateByTeam(teamId);
                    return this.saveRate({
                        ...existing,
                        teamId,
                        teamName: existing?.teamName || '',
                        defaultRate: rate
                    });
                })
            );
        } catch (error) {
            console.error('Error applying bulk rate:', error);
            throw error;
        }
    }
};
