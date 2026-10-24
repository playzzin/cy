import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import WhiteboardSourceReportDialog from './WhiteboardSourceReportDialog';
import { getWhiteboardSourceReport } from '../../services/whiteboardSourceService';
jest.mock('../../services/whiteboardSourceService', () => ({ getWhiteboardSourceReport: jest.fn() }));
const selection = { reportIds: ['r1', 'r2', 'r2'], date: '2026-10-01', workerKey: 'id:w', workerName: '검증 작업자', manDay: 0.5 };
const report = (id: string) => ({ id, date: '2026-10-01', siteName: '검증 현장', teamName: '검증 팀', totalManDay: 0.25, recordedTotalManDay: 0.25, workers: [{ workerId: 'w', name: '검증 작업자', manDay: 0.25 }] });
beforeEach(() => (getWhiteboardSourceReport as jest.Mock).mockReset().mockImplementation(async id => report(id)));
test('동일 날짜 원본 일보를 중복 없이 모두 조회하고 0.25 공수를 그대로 표시한다', async () => {
    render(<WhiteboardSourceReportDialog selection={selection} onClose={jest.fn()} />);
    expect(await screen.findByText('일보 번호: r1')).toBeInTheDocument();
    expect(screen.getByText('일보 번호: r2')).toBeInTheDocument();
    expect(getWhiteboardSourceReport).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('0.25 공수')).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('삭제 또는 권한 회수로 일부 조회가 실패하면 불완전한 합계를 표시하지 않고 재시도한다', async () => {
    (getWhiteboardSourceReport as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    render(<WhiteboardSourceReportDialog selection={selection} onClose={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('원본 일보를 불러오지 못했습니다');
    expect(screen.queryByText('일보 번호: r2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    expect(await screen.findByText('일보 번호: r1')).toBeInTheDocument();
});
test('원본 날짜 또는 공수가 바뀌면 현황판의 과거 합계와 차이를 알린다', async () => {
    (getWhiteboardSourceReport as jest.Mock).mockImplementation(async id => ({ ...report(id), date: '2026-10-02' }));
    render(<WhiteboardSourceReportDialog selection={selection} onClose={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('현황판 조회 이후 원본이 변경');
});
