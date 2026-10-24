import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VehicleStatusBoard } from '../vehicle/VehicleStatusBoard';
import { CardStatusBoard } from '../card/CardStatusBoard';
import { SupportExcelDownloadButton } from './SupportExcelDownloadButton';
import { vehicleService } from '../../services/vehicleService';
import { cardService } from '../../services/cardService';
import { buildVehicleStatusWorkbook, buildCardStatusWorkbook, downloadSupportResourceWorkbook } from '../../utils/supportResourceExcelExport';
import type { Vehicle } from '../../types/vehicle';
import type { Card } from '../../types/card';

jest.mock('../../utils/supportResourceExcelExport', () => ({ buildVehicleStatusWorkbook: jest.fn(() => ({})), buildCardStatusWorkbook: jest.fn(() => ({})), downloadSupportResourceWorkbook: jest.fn() }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { listAllVehicleBillingTargets: jest.fn() } }));
jest.mock('../../services/cardService', () => ({ cardService: { listAllCardBillingTargets: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: async () => [] } }));
jest.mock('../../constants/iconMap', () => ({ iconMap: {} }));
const callbacks = { onEdit: jest.fn(), onAssign: jest.fn(), onCancelUse: jest.fn(), onRestoreUse: jest.fn() };
const vehicle = (id: string, status: Vehicle['status']): Vehicle => ({ id, licensePlate: `TEST-${id}`, model: '시험차량', type: 'OWNED', status, contract: { monthlyFee: 0 } as Vehicle['contract'] });
const card = (id: string, status: Card['status']): Card => ({ id, name: `시험카드-${id}`, issuer: '시험', cardType: 'CREDIT', status, last4: '0000', maskedNumber: '****' });
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({ matches: false })) });
    jest.mocked(vehicleService.listAllVehicleBillingTargets).mockResolvedValue([]);
    jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([]);
    jest.mocked(downloadSupportResourceWorkbook).mockResolvedValue(undefined);
});

it('차량 현황 상태 필터를 목록과 카드 보기 모두 다운로드에 반영한다', async () => {
    const vehicles = [vehicle('active', 'AVAILABLE'), vehicle('archived', 'DISPOSED')];
    render(<VehicleStatusBoard vehicles={vehicles} loading={false} {...callbacks} exportContext={{ teamName: '시험팀', searchText: 'TEST' }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    await waitFor(() => expect(buildVehicleStatusWorkbook).toHaveBeenCalledTimes(1));
    expect(buildVehicleStatusWorkbook).toHaveBeenLastCalledWith(expect.objectContaining({ teamName: '시험팀', searchText: 'TEST', statusLabel: '현재 관리' }), [expect.objectContaining({ vehicle: vehicles[0] })]);
    fireEvent.click(screen.getByRole('button', { name: '전체 2' }));
    fireEvent.click(screen.getByRole('button', { name: '카드' }));
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    await waitFor(() => expect(buildVehicleStatusWorkbook).toHaveBeenCalledTimes(2));
    expect(jest.mocked(buildVehicleStatusWorkbook).mock.calls[1][1]).toHaveLength(2);
});

it('카드 현황은 현재 관리와 정지·해지 필터에 해당하는 카드만 내보낸다', async () => {
    const cards = [card('active', 'AVAILABLE'), card('closed', 'CLOSED')];
    render(<CardStatusBoard cards={cards} loading={false} {...callbacks} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '정지·해지 1' }));
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    await waitFor(() => expect(buildCardStatusWorkbook).toHaveBeenCalledTimes(1));
    expect(buildCardStatusWorkbook).toHaveBeenCalledWith(expect.objectContaining({ statusLabel: '정지·해지' }), [expect.objectContaining({ card: cards[1] })]);
});

it('보조 자료 로드 실패 시 불완전한 현황 다운로드를 막는다', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(cardService.listAllCardBillingTargets).mockRejectedValueOnce(Error('fixture load failure'));
    render(<CardStatusBoard cards={[card('active', 'AVAILABLE')]} loading={false} {...callbacks} />);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
    error.mockRestore();
});

it('다운로드 중 중복 클릭을 막고 실패 후 재시도할 수 있다', async () => {
    let reject!: (error: Error) => void;
    const download = jest.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<SupportExcelDownloadButton onDownload={download} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    fireEvent.click(screen.getByRole('button', { name: '엑셀 생성 중...' }));
    expect(download).toHaveBeenCalledTimes(1);
    reject(Error('fixture download failure'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('엑셀 다운로드에 실패했습니다. 다시 시도해 주세요.'));
    expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled();
    alert.mockRestore(); error.mockRestore();
});
