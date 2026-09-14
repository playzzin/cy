import React from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { isChunkLoadError, recoverFromChunkLoadError } from './runtimeRecovery';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const chunkLoadFailed = isChunkLoadError(error);

  return (
    <div role="alert" className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50 rounded-lg border border-slate-200 m-4">
      <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-3xl mb-3" />
      <h3 className="text-lg font-bold text-slate-700 mb-1">{chunkLoadFailed ? '화면 파일을 불러오지 못했습니다' : '일시적인 오류 발생'}</h3>
      <p className="text-slate-500 text-sm mb-4">{chunkLoadFailed
        ? '업데이트 또는 연결 문제로 화면을 열지 못했습니다. 인터넷 연결을 확인한 뒤 화면 복구를 눌러 주세요.'
        : '화면을 불러오는 중 문제가 발생했습니다.'}</p>
      <pre className="text-xs text-red-400 bg-red-50 p-2 rounded mb-4 max-w-xs overflow-auto">{message}</pre>
      <button
        type="button"
        onClick={() => chunkLoadFailed ? recoverFromChunkLoadError({ manual: true }) : resetErrorBoundary()}
        className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faRotateRight} />
        {chunkLoadFailed ? '화면 복구' : '다시 시도'}
      </button>
    </div>
  );
};

const RuntimeErrorBoundary = ({ children, resetKeys }: { children: React.ReactNode; resetKeys?: unknown[] }) => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error) => { if (isChunkLoadError(error)) recoverFromChunkLoadError(); }}
    onReset={(details) => { if (details.reason === 'imperative-api') window.location.reload(); }}
    resetKeys={resetKeys}
  >
    {children}
  </ErrorBoundary>
);

export default RuntimeErrorBoundary;
