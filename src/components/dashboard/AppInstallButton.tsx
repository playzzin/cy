import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faDownload, faMobileScreenButton, faSpinner } from '@fortawesome/free-solid-svg-icons';
import {
  getInstallPrompt,
  isAppInstalled,
  promptPwaInstall,
  refreshPwaInstallAssets,
  subscribeToInstallPrompt
} from '../../pwaInstallPrompt';

const InstallButton = styled.button<{ $ready: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: ${props => props.$ready ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.1)'};
    border: 1px solid ${props => props.$ready ? 'rgba(103, 232, 249, 0.45)' : 'rgba(255, 255, 255, 0.2)'};
    border-radius: 9999px;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;

    &:hover {
        background: ${props => props.$ready ? 'rgba(6, 182, 212, 0.32)' : 'rgba(255, 255, 255, 0.18)'};
    }

    &:disabled {
        cursor: default;
        opacity: 0.75;
    }
`;

const InstallControls = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
`;

const ApkDownloadButton = styled.a`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(34, 197, 94, 0.18);
    border: 1px solid rgba(134, 239, 172, 0.45);
    border-radius: 9999px;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;

    &:hover {
        background: rgba(34, 197, 94, 0.3);
    }
`;

const getInstallHelpMessage = () => {
  const isAppleMobile = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isLocalDevelopmentServer = process.env.NODE_ENV !== 'production'
    && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  if (isLocalDevelopmentServer) {
    return '이 버튼은 APK 파일 다운로드가 아니라 브라우저 PWA 설치 기능입니다. localhost 개발 서버에서는 설치 프롬프트가 제한될 수 있으니 배포 주소(HTTPS) 또는 production build에서 브라우저의 "앱 설치" / "홈 화면에 추가"를 사용해 주세요.';
  }

  if (isAppleMobile) {
    return '이 버튼은 APK 파일 다운로드가 아니라 브라우저 PWA 설치 기능입니다. iPhone/iPad에서는 Safari 하단 공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다.';
  }

  return '이 버튼은 APK 파일 다운로드가 아니라 브라우저 PWA 설치 기능입니다. 브라우저 주소창 또는 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다.';
};

export const AppInstallButton: React.FC = () => {
  const [canInstall, setCanInstall] = useState(Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const [isPreparing, setIsPreparing] = useState(false);
  const refreshedInstallAssetsRef = useRef(false);

  useEffect(() => {
    const update = () => {
      setCanInstall(Boolean(getInstallPrompt()));
      setInstalled(isAppInstalled());
    };

    const unsubscribe = subscribeToInstallPrompt(update);
    update();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (installed || refreshedInstallAssetsRef.current) return;

    refreshedInstallAssetsRef.current = true;
    void refreshPwaInstallAssets();
  }, [installed]);

  const handleInstall = async () => {
    if (installed || isPreparing) return;

    void refreshPwaInstallAssets();

    const promptAvailable = Boolean(getInstallPrompt());
    setCanInstall(promptAvailable);

    if (!promptAvailable) {
      window.alert(getInstallHelpMessage());
      return;
    }

    setIsPreparing(true);

    try {
      const result = await promptPwaInstall();
      setCanInstall(Boolean(getInstallPrompt()));
      setInstalled(result === 'accepted' || isAppInstalled());
    } finally {
      setIsPreparing(false);
    }
  };

  if (installed) {
    return (
      <InstallControls>
      <InstallButton type="button" $ready={false} disabled>
        <FontAwesomeIcon icon={faCheckCircle} />
        앱 설치됨
      </InstallButton>
      <ApkDownloadButton
        href="/downloads/kb-sms-bridge.apk"
        download="kb-sms-bridge.apk"
        aria-label="국민은행 SMS 브리지 APK 다운로드"
        title="새 휴대폰에 설치할 국민은행 SMS 브리지 APK를 다운로드합니다"
      >
        <FontAwesomeIcon icon={faDownload} />
        SMS 브리지 APK
      </ApkDownloadButton>
      </InstallControls>
    );
  }

  return (
    <InstallControls>
    <InstallButton type="button" $ready={canInstall && !isPreparing} onClick={handleInstall} disabled={isPreparing}>
      <FontAwesomeIcon icon={isPreparing ? faSpinner : faMobileScreenButton} spin={isPreparing} />
      {isPreparing ? '준비 중...' : '앱 설치'}
    </InstallButton>
    <ApkDownloadButton
      href="/downloads/kb-sms-bridge.apk"
      download="kb-sms-bridge.apk"
      aria-label="국민은행 SMS 브리지 APK 다운로드"
      title="새 휴대폰에 설치할 국민은행 SMS 브리지 APK를 다운로드합니다"
    >
      <FontAwesomeIcon icon={faDownload} />
      SMS 브리지 APK
    </ApkDownloadButton>
    </InstallControls>
  );
};
