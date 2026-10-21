import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

export interface TeamVehicleOilMetric {
    id: string;
    currentKm: number;
    lastOilKm: number;
    cycleKm: number;
}

export const saveTeamVehicleOil = async (records: TeamVehicleOilMetric[]): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('로그인이 필요합니다.');
    await httpsCallable(functions, 'saveTeamVehicleOil')({ records });
    if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
};
