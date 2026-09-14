import React, { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RuntimeErrorBoundary from './RuntimeErrorBoundary';
import { recoverFromChunkLoadError } from './runtimeRecovery';

jest.mock('./runtimeRecovery', () => ({
  ...jest.requireActual('./runtimeRecovery'),
  recoverFromChunkLoadError: jest.fn().mockReturnValue(false),
}));

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

it('recovers a lazy route failure caught by the inner layout boundary', async () => {
  const Page = React.lazy(() => Promise.reject(new Error('Loading chunk 42 failed.')));
  render(<RuntimeErrorBoundary><Suspense fallback="loading"><Page /></Suspense></RuntimeErrorBoundary>);
  const button = await screen.findByRole('button', { name: '화면 복구' });
  expect(recoverFromChunkLoadError).toHaveBeenCalledTimes(1);
  expect(recoverFromChunkLoadError).toHaveBeenLastCalledWith();
  fireEvent.click(button);
  expect(recoverFromChunkLoadError).toHaveBeenLastCalledWith({ manual: true });
});

it('does not treat ordinary render failures as corrupted browser files', () => {
  const BrokenPage = (): JSX.Element => { throw new Error('Ordinary render failure'); };
  const { rerender } = render(<RuntimeErrorBoundary resetKeys={['/old']}><BrokenPage /></RuntimeErrorBoundary>);
  expect(screen.getByRole('alert').textContent).toContain('일시적인 오류 발생');
  expect(recoverFromChunkLoadError).not.toHaveBeenCalled();
  rerender(<RuntimeErrorBoundary resetKeys={['/new']}><div>정상 화면</div></RuntimeErrorBoundary>);
  expect(screen.getByText('정상 화면')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
