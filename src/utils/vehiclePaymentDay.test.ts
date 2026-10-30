import type { Vehicle } from '../types/vehicle';
import { matchesVehiclePaymentDay } from './vehiclePaymentDay';

const vehicleWithDay = (paymentDay: unknown): Vehicle => ({
    contract: { paymentDay }
} as Vehicle);

test('결제일을 정확하게 비교하고 기존 숫자 문자열도 처리한다', () => {
    expect(matchesVehiclePaymentDay(vehicleWithDay(5), '5')).toBe(true);
    expect(matchesVehiclePaymentDay(vehicleWithDay('05'), '5')).toBe(true);
    expect(matchesVehiclePaymentDay(vehicleWithDay(15), '5')).toBe(false);
    expect(matchesVehiclePaymentDay(vehicleWithDay(25), '5')).toBe(false);
    expect(matchesVehiclePaymentDay(vehicleWithDay(1), '1')).toBe(true);
    expect(matchesVehiclePaymentDay(vehicleWithDay(31), '31')).toBe(true);
});

test.each([undefined, null, '', 0, -1, 32, 1.5, 'invalid'])('미설정 조회는 유효한 결제일이 없는 차량을 포함한다: %s', (day) => {
    expect(matchesVehiclePaymentDay(vehicleWithDay(day), 'unset')).toBe(true);
    expect(matchesVehiclePaymentDay(vehicleWithDay(day), '1')).toBe(false);
    expect(matchesVehiclePaymentDay(vehicleWithDay(day), '')).toBe(true);
});

test('전체 조회와 계약 정보가 없는 차량을 처리한다', () => {
    expect(matchesVehiclePaymentDay(vehicleWithDay(15), '')).toBe(true);
    expect(matchesVehiclePaymentDay(vehicleWithDay(15), 'unset')).toBe(false);
    expect(matchesVehiclePaymentDay({} as Vehicle, 'unset')).toBe(true);
    expect(matchesVehiclePaymentDay({} as Vehicle, '15')).toBe(false);
});
