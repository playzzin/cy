import React from 'react';
import { isChunkLoadError, recoverFromChunkLoadError } from './runtimeRecovery';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled render error:', error, info);

    if (isChunkLoadError(error)) {
      recoverFromChunkLoadError();
    }
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkLoadFailed = isChunkLoadError(error);

    return (
      <main
        role="alert"
        style={{
          alignItems: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
        }}
      >
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
            maxWidth: '520px',
            padding: '32px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>
            화면을 불러오지 못했습니다
          </h1>
          <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 24px' }}>
            {chunkLoadFailed
              ? '업데이트된 화면 파일을 다시 불러오는 중입니다. 잠시 후에도 그대로라면 아래 버튼을 눌러 주세요.'
              : '일시적인 실행 오류가 발생했습니다. 입력하던 내용은 확인한 뒤 화면을 새로 불러와 주세요.'}
          </p>
          <button
            type="button"
            onClick={this.reload}
            style={{
              background: '#2563eb',
              border: 0,
              borderRadius: '10px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 700,
              padding: '12px 20px',
            }}
          >
            화면 다시 불러오기
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary style={{ color: '#64748b', cursor: 'pointer' }}>개발 오류 정보</summary>
              <pre style={{ overflow: 'auto', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
            </details>
          )}
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;
