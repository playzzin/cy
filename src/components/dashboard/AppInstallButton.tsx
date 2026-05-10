import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faDownload, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import {
  getInstallPrompt,
  isAppInstalled,
  promptPwaInstall,
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

const getInstallHelpMessage = () => {
  const isAppleMobile = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (isAppleMobile) {
    return 'iPhone/iPad에서는 Safari 하단 공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다.';
  }

  return '브라우저 주소창 또는 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다.';
};

export const AppInstallButton: React.FC = () => {
  const [canInstall, setCanInstall] = useState(Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(() => isAppInstalled());

  useEffect(() => {
    const update = () => {
      setCanInstall(Boolean(getInstallPrompt()));
      setInstalled(isAppInstalled());
    };

    const unsubscribe = subscribeToInstallPrompt(update);
    update();

    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    if (installed) return;

    if (!canInstall) {
      window.alert(getInstallHelpMessage());
      return;
    }

    const result = await promptPwaInstall();
    setCanInstall(Boolean(getInstallPrompt()));
    setInstalled(result === 'accepted' || isAppInstalled());
  };

  if (installed) {
    return (
      <InstallButton type="button" $ready={false} disabled>
        <FontAwesomeIcon icon={faCheckCircle} />
        앱 설치됨
      </InstallButton>
    );
  }

  return (
    <InstallButton type="button" $ready={canInstall} onClick={handleInstall}>
      <FontAwesomeIcon icon={canInstall ? faDownload : faMobileScreenButton} />
      앱 다운로드
    </InstallButton>
  );
};
