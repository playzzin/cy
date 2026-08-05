import type { VehicleFineNoticeAnalysis } from '../types/vehicleFineImport';

export const normalizeVehicleFineAnalysis = (
    analysis: VehicleFineNoticeAnalysis,
): VehicleFineNoticeAnalysis => {
    let payableAmount = Math.max(0, Math.round(Number(analysis.payableAmount || 0)));
    const warnings = [...analysis.warnings];
    const ownerFineAmount = Math.max(0, Math.round(Number(analysis.ownerFineAmount || 0)));
    const driverPenaltyAmount = Math.max(0, Math.round(Number(analysis.driverPenaltyAmount || 0)));

    if (analysis.noticeType === 'TRAFFIC_FINE' && ownerFineAmount > 0 && payableAmount !== ownerFineAmount) {
        payableAmount = ownerFineAmount;
        warnings.push(`운전자 범칙금이 아닌 차량 소유자 과태료 ${ownerFineAmount.toLocaleString('ko-KR')}원을 적용했습니다.`);
    }

    if (
        analysis.noticeType === 'PARKING_FINE'
        && analysis.originalAmount > 0
        && analysis.reductionAmount > 0
    ) {
        const expectedDiscountedAmount = Math.max(0, analysis.originalAmount - analysis.reductionAmount);
        if (payableAmount !== expectedDiscountedAmount) {
            warnings.push(`최초과태료-감경금액은 ${expectedDiscountedAmount.toLocaleString('ko-KR')}원이지만 추출 납부금액은 ${payableAmount.toLocaleString('ko-KR')}원입니다.`);
        }
    }

    if (ownerFineAmount > 0 && driverPenaltyAmount > 0 && ownerFineAmount !== driverPenaltyAmount) {
        warnings.push(`차량 소유자 과태료와 운전자 범칙금이 다릅니다. 과태료 ${ownerFineAmount.toLocaleString('ko-KR')}원을 기준으로 검수하세요.`);
    }

    return {
        ...analysis,
        payableAmount,
        warnings: Array.from(new Set(warnings)),
    };
};
