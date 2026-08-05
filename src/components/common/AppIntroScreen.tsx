import React from 'react';

type AppIntroScreenProps = {
  message?: string;
};

const AppIntroScreen: React.FC<AppIntroScreenProps> = ({
  message = '현장 데이터를 준비하는 중'
}) => (
  <div className="app-intro app-intro--runtime" role="status" aria-live="polite" aria-label="청연ENG ERP 로딩 중">
    <div className="app-intro__content">
      <div className="app-intro__mark-shell" aria-hidden="true">
        <img className="app-intro__mark" src="/icons/icon-192.png?v=20260524" alt="" width={140} height={140} />
      </div>
      <div className="app-intro__eyebrow">CHUNG YEON ENG</div>
      <h1 className="app-intro__title">청연ENG ERP</h1>
      <div className="app-intro__message">{message}</div>
      <div className="app-intro__progress" aria-hidden="true" />
    </div>
  </div>
);

export default AppIntroScreen;
