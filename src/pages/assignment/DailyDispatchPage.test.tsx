import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DailyDispatchPage from './DailyDispatchPage';
import { dispatchService } from '../../services/dispatchService';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { vehicleService } from '../../services/vehicleService';

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(async () => []) } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn(async () => []) } }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: jest.fn(async () => []) } }));
jest.mock('../../services/dispatchService', () => ({ dispatchService: { getDispatchByDate: jest.fn(async () => ({ assignments: [] })) } }));

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
  (siteService.getSites as jest.Mock).mockResolvedValue([]);
  (vehicleService.getVehicles as jest.Mock).mockResolvedValue([]);
  (dispatchService.getDispatchByDate as jest.Mock).mockResolvedValue({ assignments: [] });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(['2026-10-06T15:00:00Z', '2026-10-06T21:00:00Z', '2026-10-06T23:59:59Z', '2026-10-07T00:00:00Z'])(
  'opens the Korean business date at %s', async instant => {
    jest.setSystemTime(new Date(instant));
    render(<DailyDispatchPage />);
    expect(screen.getByDisplayValue('2026-10-07')).toBeInTheDocument();
    await waitFor(() => expect(dispatchService.getDispatchByDate).toHaveBeenCalledWith('2026-10-07'));
  }
);

it.each([['2026-01-01', '2025-12-31'], ['2026-03-01', '2026-02-28'], ['2024-03-01', '2024-02-29']])(
  'copies the previous calendar day for %s', async (selected, previous) => {
    jest.setSystemTime(new Date('2026-10-06T21:00:00Z'));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DailyDispatchPage />);
    await waitFor(() => expect(dispatchService.getDispatchByDate).toHaveBeenCalledWith('2026-10-07'));
    fireEvent.change(screen.getByDisplayValue('2026-10-07'), { target: { value: selected } });
    await waitFor(() => expect(dispatchService.getDispatchByDate).toHaveBeenCalledWith(selected));
    let finishCopy!: (value: { assignments: [] }) => void;
    (dispatchService.getDispatchByDate as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishCopy = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /전일 복사/ }));
    await waitFor(() => expect(dispatchService.getDispatchByDate).toHaveBeenCalledWith(previous));
    await act(async () => { finishCopy({ assignments: [] }); });
  }
);
