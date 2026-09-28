import { aiSettingsService } from './aiSettingsService';
test('workspace switch is independent of statistics and server policy', () => {
  localStorage.clear();
  expect(aiSettingsService.getPageByPath('/reports/ai-workspace')?.modelScope).toBe('server');
  aiSettingsService.setPageEnabled('reports-ai-workspace', false);
  expect(() => aiSettingsService.assertPathEnabled('/reports/ai-workspace')).toThrow('비활성화');
  expect(aiSettingsService.isPathEnabled('/reports/statistics')).toBe(true);
});
