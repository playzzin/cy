import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SecureSignature from './SecureSignature';
import { resolveSecureSignature } from '../services/secureSignatureService';
import { useAuth } from '../contexts/AuthContext';
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/secureSignatureService', () => ({ resolveSecureSignature: jest.fn() }));
test('서명 권한 조회가 끝난 뒤 표시하고 계정 변경 즉시 이전 이미지를 제거한다', async () => {
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'owner' } });
    (resolveSecureSignature as jest.Mock).mockResolvedValueOnce('data:image/png;base64,fixture');
    const { rerender } = render(<SecureSignature src="gs://fixture/signatures/worker/file.png" alt="작업자 서명" />);
    expect(await screen.findByRole('img', { name: '작업자 서명' })).toHaveAttribute('src', 'data:image/png;base64,fixture');
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'other' } });
    (resolveSecureSignature as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    rerender(<SecureSignature src="gs://fixture/signatures/worker/file.png" alt="작업자 서명" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('서명 열람 권한을 확인');
});
