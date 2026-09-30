import { act, renderHook, waitFor } from '@testing-library/react';
import { useDocumentStamp } from './useDocumentStamp';
import { documentStampService } from '../services/documentStampService';
import { createDefaultStampSettings } from '../features/document-stamps/model';

jest.mock('../services/documentStampService', () => ({ documentStampService: { subscribe: jest.fn(), resolveUrl: jest.fn() } }));

it('회사 전환 뒤 늦게 완료된 이전 회사 도장을 표시하지 않는다', async () => {
    let first!: (url: string) => void;
    (documentStampService.subscribe as jest.Mock).mockImplementation(callback => { callback(createDefaultStampSettings()); return jest.fn(); });
    (documentStampService.resolveUrl as jest.Mock).mockImplementation((_, __, name) => name === '청연' ? new Promise(resolve => { first = resolve; }) : Promise.resolve('/dawon.png'));
    const { result, rerender } = renderHook(({ company }) => useDocumentStamp('employment', company), { initialProps: { company: '청연' } });
    rerender({ company: '다원' });
    await waitFor(() => expect(result.current).toBe('/dawon.png'));
    await act(async () => first('/cheongyeon.png'));
    expect(result.current).toBe('/dawon.png');
});
