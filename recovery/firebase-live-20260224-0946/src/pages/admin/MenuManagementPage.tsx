import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { menuServiceV11, SiteDataType } from '../../services/menuServiceV11';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faUpload,
    faSave,
    faRotateLeft,
    faCheckCircle,
    faExclamationTriangle,
    faSync,
    faDatabase,
    faCloudArrowDown,
    faCloudArrowUp,
    faInfoCircle,
    faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { app } from '../../config/firebase';
import bundledMenuData from '../../data/bundled_menu.json';

const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  color: #1e293b;
`;

const Header = styled.div`
  margin-bottom: 2rem;
  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p {
    color: #64748b;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #334155;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  
  ${props => {
        switch (props.$variant) {
            case 'primary':
                return `
          background: #3b82f6;
          color: white;
          &:hover { background: #2563eb; }
          &:active { transform: scale(0.98); }
        `;
            case 'danger':
                return `
          background: #ef4444;
          color: white;
          &:hover { background: #dc2626; }
          &:active { transform: scale(0.98); }
        `;
            default:
                return `
          background: #f1f5f9;
          color: #475569;
          &:hover { background: #e2e8f0; }
          &:active { transform: scale(0.98); }
        `;
        }
    }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 300px;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5e1;
  font-family: monospace;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 1rem;
  &:focus {
    outline: 2px solid #3b82f6;
    border-color: transparent;
  }
`;

const StatusMessage = styled.div<{ $type: 'success' | 'error' | 'info' }>`
  padding: 1rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;

  ${props => {
        switch (props.$type) {
            case 'success':
                return `background: #dcfce7; color: #166534;`;
            case 'error':
                return `background: #fee2e2; color: #991b1b;`;
            default:
                return `background: #eff6ff; color: #1e40af;`;
        }
    }}
`;

const StatusBadge = styled.span<{ $status: 'ok' | 'warning' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;

  ${props => {
        switch (props.$status) {
            case 'ok':
                return `background: #dcfce7; color: #166534;`;
            case 'warning':
                return `background: #fef3c7; color: #92400e;`;
            case 'error':
                return `background: #fee2e2; color: #991b1b;`;
        }
    }}
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const InfoLabel = styled.span`
  color: #64748b;
  font-size: 0.875rem;
`;

const InfoValue = styled.span`
  color: #1e293b;
  font-weight: 500;
  font-family: monospace;
  font-size: 0.875rem;
`;

const SyncSection = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px dashed #cbd5e1;
`;

const SyncInput = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5e1;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  
  &:focus {
    outline: 2px solid #3b82f6;
    border-color: transparent;
  }
  
  &::placeholder {
    color: #94a3b8;
  }
`;

const CompareBox = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: center;
  margin: 1rem 0;
`;

const CompareItem = styled.div<{ $highlight?: boolean }>`
  padding: 1rem;
  background: ${props => props.$highlight ? '#fef3c7' : '#f1f5f9'};
  border-radius: 0.5rem;
  text-align: center;
  
  .label {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }
  
  .value {
    font-weight: 600;
    color: #1e293b;
  }
  
  .sub {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.25rem;
  }
`;

export const MenuManagementPage: React.FC = () => {
    const [currentConfig, setCurrentConfig] = useState<SiteDataType | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [envInfo, setEnvInfo] = useState<{ projectId: string; useEmulators: boolean; dataConnectLocation?: string } | null>(null);

    // menus_v12 상태
    const [activeDocId, setActiveDocId] = useState<string>('');
    const [menusV12Exists, setMenusV12Exists] = useState<boolean | null>(null);
    const [currentConfigHash, setCurrentConfigHash] = useState<string>('');

    // 환경 간 동기화
    const [remoteJsonInput, setRemoteJsonInput] = useState('');
    const [remoteConfig, setRemoteConfig] = useState<SiteDataType | null>(null);
    const [remoteConfigHash, setRemoteConfigHash] = useState<string>('');

    const getConfigHash = useCallback((config: SiteDataType | null): string => {
        if (!config) return '';
        try {
            const json = JSON.stringify(config);
            return `${Object.keys(config).length}개 사이트, ${json.length.toLocaleString()}자`;
        } catch {
            return '';
        }
    }, []);

    const checkMenusV12Status = useCallback(async () => {
        const exists = await menuServiceV11.checkMenusV12Exists();
        setMenusV12Exists(exists);
        setActiveDocId(menuServiceV11.getActiveDocId());
    }, []);

    useEffect(() => {
        setEnvInfo({
            projectId: app.options.projectId ?? 'unknown',
            useEmulators: process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATORS === 'true',
            dataConnectLocation: process.env.REACT_APP_DATACONNECT_LOCATION
        });
        loadConfig();
        checkMenusV12Status();
    }, [checkMenusV12Status]);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const config = await menuServiceV11.getMenuConfig({ allowFallback: false });
            if (config) {
                setCurrentConfig(config);
                setJsonInput(JSON.stringify(config, null, 2));
                setCurrentConfigHash(getConfigHash(config));
            }
            await checkMenusV12Status();
            setStatus({
                type: 'success',
                message: '서버에서 메뉴 설정을 로드했습니다. (fallback 비활성)'
            });
        } catch (err) {
            console.error(err);
            setStatus({
                type: 'error',
                message: '서버 로드 실패: ' + (err instanceof Error ? err.message : String(err))
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInitializeMenusV12 = async () => {
        if (!window.confirm('menus_v12를 기본 메뉴 설정으로 초기화하시겠습니까?\n기존 설정이 있다면 덮어씌워집니다.')) return;
        setIsLoading(true);
        try {
            const success = await menuServiceV11.initializeMenusV12();
            if (success) {
                await loadConfig();
                setStatus({ type: 'success', message: 'menus_v12가 초기화되었습니다.' });
            } else {
                setStatus({ type: 'error', message: 'menus_v12 초기화에 실패했습니다.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: '초기화 실패: ' + (err instanceof Error ? err.message : String(err)) });
        } finally {
            setIsLoading(false);
        }
    };

    const handleParseRemoteJson = () => {
        if (!remoteJsonInput.trim()) {
            setStatus({ type: 'error', message: '원격 JSON을 입력해주세요.' });
            return;
        }
        try {
            const parsed = menuServiceV11.parseMenuConfigJson(remoteJsonInput);
            if (parsed) {
                setRemoteConfig(parsed);
                setRemoteConfigHash(getConfigHash(parsed));
                setStatus({ type: 'success', message: '원격 설정을 파싱했습니다. 아래에서 비교 결과를 확인하세요.' });
            } else {
                setStatus({ type: 'error', message: '유효하지 않은 JSON 형식입니다.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'JSON 파싱 실패: ' + (err instanceof Error ? err.message : String(err)) });
        }
    };

    const handleApplyRemoteConfig = async () => {
        if (!remoteConfig) {
            setStatus({ type: 'error', message: '먼저 원격 설정을 파싱해주세요.' });
            return;
        }
        if (!window.confirm('원격 환경의 메뉴 설정을 현재 환경에 적용하시겠습니까?\n현재 설정이 덮어씌워집니다.')) return;
        setIsLoading(true);
        try {
            await menuServiceV11.saveMenuConfig(remoteConfig);
            await loadConfig();
            setRemoteConfig(null);
            setRemoteJsonInput('');
            setRemoteConfigHash('');
            setStatus({ type: 'success', message: '원격 설정이 현재 환경에 적용되었습니다!' });
        } catch (err) {
            setStatus({ type: 'error', message: '적용 실패: ' + (err instanceof Error ? err.message : String(err)) });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCurrentForSync = async () => {
        try {
            const rawJson = await menuServiceV11.getMenuConfigRaw();
            if (rawJson) {
                await navigator.clipboard.writeText(rawJson);
                setStatus({ type: 'success', message: '현재 환경의 menus_v12 JSON이 클립보드에 복사되었습니다. 다른 환경에서 붙여넣기 하세요.' });
            } else {
                setStatus({ type: 'error', message: 'menus_v12 설정을 가져올 수 없습니다.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: '복사 실패: ' + (err instanceof Error ? err.message : String(err)) });
        }
    };

    const configsAreDifferent = currentConfigHash && remoteConfigHash && currentConfigHash !== remoteConfigHash;

    const handleExport = () => {
        if (!currentConfig) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "cyan_erp_menu_config.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setStatus({ type: 'success', message: '메뉴 설정이 JSON 파일로 다운로드되었습니다.' });
    };

    const handleImport = async () => {
        if (!jsonInput) return;
        setIsLoading(true);
        try {
            const parsed = JSON.parse(jsonInput);
            await menuServiceV11.saveMenuConfig(parsed);
            await loadConfig();
            setStatus({ type: 'success', message: '메뉴 설정이 서버에 성공적으로 저장되었습니다.' });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: '저장 실패: ' + (err instanceof Error ? err.message : String(err)) });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('정말 초기화하시겠습니까? 모든 커스텀 설정이 사라집니다.')) return;
        setIsLoading(true);
        try {
            await menuServiceV11.resetToDefault();
            await loadConfig();
            setStatus({ type: 'success', message: '초기화가 완료되었습니다.' });
        } catch (err) {
            setStatus({ type: 'error', message: '초기화 실패' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSyncFromBundled = async () => {
        if (!window.confirm('배포에 포함된 최신 메뉴 데이터로 서버 설정을 업데이트하시겠습니까?')) return;
        setIsLoading(true);
        try {
            // @ts-ignore
            await menuServiceV11.saveMenuConfig(bundledMenuData);
            await loadConfig();
            setStatus({ type: 'success', message: '배포된 데이터로 동기화가 완료되었습니다!' });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: '동기화 실패: ' + (err instanceof Error ? err.message : String(err)) });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container>
            <Header>
                <h1>Menu Management Console</h1>
                <p>개발 환경과 배포 환경 간의 메뉴 설정(menus_v12)을 동기화하거나 백업/복원합니다.</p>
            </Header>

            {/* Environment & menus_v12 Status */}
            <Card style={{ marginBottom: '1.5rem' }}>
                <CardTitle><FontAwesomeIcon icon={faInfoCircle} /> 환경 정보 및 menus_v12 상태</CardTitle>
                <InfoRow>
                    <InfoLabel>Project ID</InfoLabel>
                    <InfoValue>{envInfo?.projectId ?? 'unknown'}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>Emulators</InfoLabel>
                    <InfoValue>{envInfo?.useEmulators ? 'true' : 'false'}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>DataConnect Location Override</InfoLabel>
                    <InfoValue>{envInfo?.dataConnectLocation ?? '(none)'}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>활성 문서 ID</InfoLabel>
                    <InfoValue style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {activeDocId || '(없음)'}
                        {activeDocId === 'menus_v12' && (
                            <StatusBadge $status="ok">✓ v12</StatusBadge>
                        )}
                    </InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>menus_v12 존재 여부</InfoLabel>
                    <InfoValue>
                        {menusV12Exists === null ? (
                            <StatusBadge $status="warning">확인 중...</StatusBadge>
                        ) : menusV12Exists ? (
                            <StatusBadge $status="ok">존재함</StatusBadge>
                        ) : (
                            <StatusBadge $status="error">없음</StatusBadge>
                        )}
                    </InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>현재 설정 크기</InfoLabel>
                    <InfoValue>{currentConfigHash || '(로드되지 않음)'}</InfoValue>
                </InfoRow>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <ActionButton onClick={loadConfig} $variant="secondary" disabled={isLoading} style={{ flex: 1 }}>
                        <FontAwesomeIcon icon={faSync} />
                        서버에서 다시 로드
                    </ActionButton>
                    {!menusV12Exists && (
                        <ActionButton onClick={handleInitializeMenusV12} $variant="primary" disabled={isLoading} style={{ flex: 1 }}>
                            <FontAwesomeIcon icon={faDatabase} />
                            menus_v12 초기화
                        </ActionButton>
                    )}
                </div>
            </Card>

            {/* 환경 간 동기화 */}
            <Card style={{ marginBottom: '1.5rem' }}>
                <CardTitle><FontAwesomeIcon icon={faSync} /> 환경 간 동기화 (개발 ↔ 배포)</CardTitle>
                <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                    다른 환경의 menus_v12 설정을 가져와서 현재 환경에 적용합니다.<br />
                    <strong>방법:</strong> ① 소스 환경에서 "복사" → ② 대상 환경에서 "붙여넣기" → ③ "적용"
                </p>

                <SyncSection>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <ActionButton onClick={handleExportCurrentForSync} $variant="secondary" disabled={isLoading}>
                            <FontAwesomeIcon icon={faCloudArrowUp} />
                            현재 환경 설정 복사 (클립보드)
                        </ActionButton>
                    </div>

                    <TextArea
                        value={remoteJsonInput}
                        onChange={(e) => setRemoteJsonInput(e.target.value)}
                        placeholder="다른 환경에서 복사한 JSON을 여기에 붙여넣으세요..."
                        style={{ height: '150px' }}
                    />

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <ActionButton onClick={handleParseRemoteJson} $variant="secondary" disabled={isLoading || !remoteJsonInput.trim()} style={{ flex: 1 }}>
                            <FontAwesomeIcon icon={faCloudArrowDown} />
                            파싱 및 비교
                        </ActionButton>
                        <ActionButton onClick={handleApplyRemoteConfig} $variant="primary" disabled={isLoading || !remoteConfig} style={{ flex: 1 }}>
                            <FontAwesomeIcon icon={faArrowRight} />
                            현재 환경에 적용
                        </ActionButton>
                    </div>

                    {remoteConfig && (
                        <CompareBox>
                            <CompareItem>
                                <div className="label">현재 환경</div>
                                <div className="value">{envInfo?.projectId}</div>
                                <div className="sub">{currentConfigHash}</div>
                            </CompareItem>
                            <FontAwesomeIcon icon={faArrowRight} style={{ color: configsAreDifferent ? '#f59e0b' : '#22c55e' }} />
                            <CompareItem $highlight={!!configsAreDifferent}>
                                <div className="label">원격 환경</div>
                                <div className="value">가져온 설정</div>
                                <div className="sub">{remoteConfigHash}</div>
                            </CompareItem>
                        </CompareBox>
                    )}

                    {remoteConfig && (
                        <StatusMessage $type={configsAreDifferent ? 'info' : 'success'}>
                            <FontAwesomeIcon icon={configsAreDifferent ? faExclamationTriangle : faCheckCircle} />
                            {configsAreDifferent
                                ? '설정이 다릅니다. "현재 환경에 적용" 버튼을 눌러 동기화하세요.'
                                : '설정이 동일합니다. 동기화가 필요하지 않습니다.'}
                        </StatusMessage>
                    )}
                </SyncSection>
            </Card>

            <CardGrid>
                <Card>
                    <CardTitle><FontAwesomeIcon icon={faDownload} /> Export (백업)</CardTitle>
                    <p style={{ marginBottom: '1rem', color: '#64748b' }}>현재 적용된 메뉴 설정을 JSON 파일로 다운로드합니다.</p>
                    <ActionButton onClick={handleExport} $variant="primary" disabled={isLoading}>
                        설정 다운로드
                    </ActionButton>
                </Card>

                <Card>
                    <CardTitle><FontAwesomeIcon icon={faRotateLeft} /> Reset (초기화)</CardTitle>
                    <p style={{ marginBottom: '1rem', color: '#64748b' }}>설정이 꼬였을 때 기본값으로 되돌립니다.</p>
                    <ActionButton onClick={handleReset} $variant="danger" disabled={isLoading}>
                        기본값으로 초기화
                    </ActionButton>
                </Card>

                <Card>
                    <CardTitle><FontAwesomeIcon icon={faUpload} /> Build Sync (배포 동기화)</CardTitle>
                    <p style={{ marginBottom: '1rem', color: '#64748b' }}>배포된 최신 데이터로 DB를 업데이트합니다.</p>
                    <ActionButton onClick={handleSyncFromBundled} $variant="primary" disabled={isLoading}>
                        배포 데이터 적용
                    </ActionButton>
                </Card>
            </CardGrid>

            <Card>
                <CardTitle><FontAwesomeIcon icon={faUpload} /> Import / Edit (복원)</CardTitle>
                <TextArea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder="여기에 JSON 설정을 붙여넣거나 수정하세요."
                />

                <ActionButton onClick={handleImport} $variant="secondary" disabled={isLoading}>
                    <FontAwesomeIcon icon={faSave} />
                    {isLoading ? '저장 중...' : '서버에 저장 및 적용'}
                </ActionButton>

                {status && (
                    <StatusMessage $type={status.type}>
                        <FontAwesomeIcon icon={status.type === 'error' ? faExclamationTriangle : faCheckCircle} />
                        {status.message}
                    </StatusMessage>
                )}
            </Card>
        </Container>
    );
};
