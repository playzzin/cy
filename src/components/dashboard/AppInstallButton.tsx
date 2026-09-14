import React, { useRef, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import * as Dialog from '@radix-ui/react-dialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faPlus } from '@fortawesome/free-solid-svg-icons';
import { getPwaInstallStatus, promptPwaInstall, subscribeToInstallPrompt } from '../../pwaInstallPrompt';

const DownloadButton = styled.a`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 0 0 88px;
    width: 88px;
    height: 88px;
    gap: 4px;
    padding: 8px;
    border: 1px solid rgba(103, 232, 249, 0.45);
    border-radius: 16px;
    background: rgba(6, 182, 212, 0.22);
    color: white;
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover { background: rgba(6, 182, 212, 0.32); }
    &:focus-visible { outline: 2px solid #67e8f9; outline-offset: 4px; }
    &:disabled { cursor: wait; opacity: 0.7; }
`;

const Logo = styled.img`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    object-fit: contain;
    background: white;
    padding: 4px;
`;

const DownloadBadge = styled.span`
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #0e7490;
    font-size: 10px;
`;

const Label = styled.span`
    display: flex;
    flex-direction: column;
    line-height: 14px;
    white-space: nowrap;
`;

const HelpOverlay = styled(Dialog.Overlay)`
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(15, 23, 42, 0.6);
`;

const HelpContent = styled(Dialog.Content)`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10001;
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    border-radius: 20px;
    padding: 24px;
    background: white;
    color: #0f172a;
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25);
`;

export const AppInstallButton: React.FC = () => {
  const [showHomeHelp, setShowHomeHelp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const installStatus = useSyncExternalStore(subscribeToInstallPrompt, getPwaInstallStatus, getPwaInstallStatus);
  const homeButtonRef = useRef<HTMLButtonElement>(null);
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  const isAndroid = /android/i.test(userAgent);
  const isIos = /iphone|ipad|ipod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);

  const artwork = (
    <>
      <Logo src="/icons/icon-192.png?v=20260524" alt="" />
      <DownloadBadge aria-hidden="true"><FontAwesomeIcon icon={faPlus} /></DownloadBadge>
      <Label><span>바탕화면에</span><span>추가</span></Label>
    </>
  );

  const addToHomeScreen = async () => {
    if (isIos || installStatus === 'installed') {
      setShowHomeHelp(true);
      return;
    }
    setIsAdding(true);
    try {
      const result = await promptPwaInstall();
      if (result === 'unavailable') setShowHomeHelp(true);
      else setShowHomeHelp(false);
    } catch {
      setShowHomeHelp(true);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
        <Dialog.Root open={showHomeHelp} onOpenChange={setShowHomeHelp}>
          <DownloadButton
            as="button"
            ref={homeButtonRef}
            type="button"
            disabled={isAdding}
            onClick={addToHomeScreen}
            aria-label="청연ENG ERP 바탕화면에 추가"
            data-install-state={installStatus}
            title="브라우저 설치 창에서 확인하면 ERP 아이콘으로 접속할 수 있습니다"
          >
            {artwork}
          </DownloadButton>
          <Dialog.Portal>
            <HelpOverlay />
            <HelpContent onCloseAutoFocus={(event) => {
              event.preventDefault();
              homeButtonRef.current?.focus();
            }}>
              <Dialog.Title className="text-lg font-bold">
                {isIos ? 'iPhone · iPad 홈 화면 추가' : isAndroid ? 'Android 홈 화면 추가' : '바탕화면에 추가'}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                {isIos
                  ? '홈 화면에 청연ENG ERP 아이콘을 추가하면 바로 접속할 수 있습니다.'
                  : installStatus === 'installed'
                    ? '청연ENG ERP PWA가 설치되었습니다. 바탕화면 또는 앱 목록의 아이콘으로 실행해 주세요.'
                    : installStatus === 'ready'
                      ? 'PWA 바로가기를 추가할 준비가 됐습니다. 아래 설치 버튼을 누르면 브라우저 설치 확인창이 열립니다.'
                      : '현재 브라우저에서 설치 확인창을 열 수 없습니다. 아래에서 설치 방법을 확인해 주세요. 바로 설치할 수 있게 되면 이 창에 설치 버튼이 나타납니다.'}
              </Dialog.Description>
              {!isIos && installStatus === 'ready' && (
                <button
                  type="button"
                  disabled={isAdding}
                  onClick={addToHomeScreen}
                  className="mt-4 min-h-[44px] w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  PWA 바로가기 설치
                </button>
              )}
              {installStatus !== 'installed' && <details className="mt-4" open={isIos}>
                <summary className="cursor-pointer text-sm font-semibold">{isIos ? '홈 화면에 추가하는 방법' : '설치 버튼이 나타나지 않을 때'}</summary>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">
                {isIos ? (
                  <>
                    <li>Safari에서 현재 페이지를 열고 공유 버튼을 누릅니다.</li>
                    <li>“홈 화면에 추가”를 선택합니다.</li>
                    <li>“웹 앱으로 열기”가 보이면 켠 뒤 “추가”를 누릅니다.</li>
                  </>
                ) : isAndroid ? (
                  <>
                    <li>Chrome 또는 삼성 인터넷에서 현재 페이지를 엽니다.</li>
                    <li>브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택합니다.</li>
                    <li>표시되는 추가 또는 설치 버튼을 누릅니다.</li>
                  </>
                ) : (
                  <>
                    <li>Chrome 또는 Edge에서 현재 페이지를 엽니다.</li>
                    <li>주소창의 설치 아이콘이나 브라우저 메뉴의 앱 설치를 선택합니다.</li>
                    <li>설치 창에서 “설치”를 누릅니다.</li>
                  </>
                )}
              </ol>
              </details>}
              <Dialog.Close className="mt-5 min-h-[44px] w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">
                확인
              </Dialog.Close>
            </HelpContent>
          </Dialog.Portal>
        </Dialog.Root>
      {!isIos && (
        <DownloadButton
          href="/downloads/cheongyeon-erp.apk"
          download="cheongyeon-erp.apk"
          aria-label="청연ENG ERP APK 설치"
          title="Android용 APK를 내려받아 열면 앱을 설치할 수 있습니다"
        >
          <Logo src="/icons/icon-192.png?v=20260524" alt="" />
          <DownloadBadge aria-hidden="true"><FontAwesomeIcon icon={faDownload} /></DownloadBadge>
          <Label><span>APK 설치</span><span>Android</span></Label>
        </DownloadButton>
      )}
    </>
  );
};
