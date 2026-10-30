import type { Vehicle } from '../types/vehicle';

export const getVehiclePaymentDay = (vehicle: Vehicle): number | null => {
    const paymentDay = Number(vehicle.contract?.paymentDay);
    return Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31 ? paymentDay : null;
};

export const matchesVehiclePaymentDay = (vehicle: Vehicle, selectedDay: string): boolean => {
    if (!selectedDay) return true;

    const paymentDay = getVehiclePaymentDay(vehicle);
    return selectedDay === 'unset'
        ? paymentDay === null
        : paymentDay !== null && paymentDay === Number(selectedDay);
};
