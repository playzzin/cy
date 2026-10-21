import { createSetting, listAllSettings, updateSetting } from './firestoreCrudCompat';
import { payrollConfigService } from './payrollConfigService';

jest.mock('./firestoreCrudCompat', () => ({ createSetting: jest.fn(), listAllSettings: jest.fn(), updateSetting: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('설정이 없어도 조회 중 설정을 생성하지 않는다', async () => {
    (listAllSettings as jest.Mock).mockResolvedValue({ data: { settings: [] } });
    const result = await payrollConfigService.getConfigReadOnly();
    expect(result.advanceItemLabels.corporateAdvance1).toBe('법인가불1');
    expect(createSetting).not.toHaveBeenCalled();
    expect(updateSetting).not.toHaveBeenCalled();
});

test('사용자 지정 항목명을 읽되 누락된 설정은 DB에 보충하지 않는다', async () => {
    (listAllSettings as jest.Mock).mockResolvedValue({ data: { settings: [
        { id: 'payroll_config_v1', data: JSON.stringify({ advanceItemLabels: { corporateAdvance1: '1차 지급' } }) },
    ] } });
    expect((await payrollConfigService.getConfigReadOnly()).advanceItemLabels.corporateAdvance1).toBe('1차 지급');
    expect(createSetting).not.toHaveBeenCalled();
    expect(updateSetting).not.toHaveBeenCalled();
});

test('조회 실패는 정상적인 기본값으로 숨기지 않고 보고 화면에 전달한다', async () => {
    (listAllSettings as jest.Mock).mockRejectedValue(new Error('test read denied'));
    await expect(payrollConfigService.getConfigReadOnly()).rejects.toThrow('test read denied');
});
