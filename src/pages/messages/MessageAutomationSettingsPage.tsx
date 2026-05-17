import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faFloppyDisk,
  faShieldHalved,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { resolveIcon } from '../../constants/iconMap';
import { manpowerService, type Worker } from '../../services/manpowerService';
import {
  createDefaultRecipientRule,
  getLinkedWorkersForUser,
  getUserDisplayLabel,
  normalizeRecipientRule,
  resolveMessageRecipients,
  type MessageRecipientData,
  type MessageRecipientMode,
  type MessageRecipientRule
} from '../../services/messageRecipientResolver';
import {
  DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS,
  SYSTEM_MESSAGE_EVENT_GROUPS,
  SYSTEM_MESSAGE_EVENT_LABELS,
  systemMessageService
} from '../../services/systemMessageService';
import { teamService, type Team } from '../../services/teamService';
import { userService, type UserData } from '../../services/userService';
import type { SystemMessageEvent, SystemMessageEventConfig, SystemMessageSettings } from '../../types/systemMessage';
import MessagePageTabs from '../../components/messages/MessagePageTabs';
import '../../components/messages/MessageSystem.css';

const systemMessageEvents = Object.keys(SYSTEM_MESSAGE_EVENT_LABELS) as SystemMessageEvent[];

const ruleModeOptions: Array<{ mode: MessageRecipientMode; label: string }> = [
  { mode: 'global', label: '기본 대상' },
  { mode: 'users', label: '지정 사용자' },
  { mode: 'allUsers', label: '전체 사용자' },
  { mode: 'allWorkers', label: '전체 작업자' },
  { mode: 'teamMembers', label: '선택 팀 소속' },
  { mode: 'teamLeaders', label: '팀장' },
  { mode: 'relatedTeamLeaders', label: '로그 해당 팀장' }
];

const isAdminRole = (role?: string | null): boolean => {
  const normalized = String(role || '').trim().toLowerCase();
  return ['admin', 'administrator', 'superadmin', 'owner', '관리자', '사장', '실장'].includes(normalized);
};

const getTeamKey = (team: Team): string => String(team.id || team.legacyId || team.name || '').trim();

const getTeamLabel = (team: Team): string =>
  [team.name, team.leaderName ? `팀장 ${team.leaderName}` : '', team.companyName]
    .filter(Boolean)
    .join(' · ');

const getSelectedUsers = (users: UserData[], ids: string[]): UserData[] =>
  ids.map((uid) => users.find((user) => user.uid === uid)).filter((user): user is UserData => Boolean(user));

const getSelectedTeams = (teams: Team[], ids: string[]): Team[] =>
  ids.map((id) => teams.find((team) => getTeamKey(team) === id)).filter((team): team is Team => Boolean(team));

const MessageAutomationSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<SystemMessageSettings>(DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusTone, setStatusTone] = useState<'info' | 'error'>('info');

  const admin = isAdminRole(currentProfile?.role as string | undefined);

  useEffect(() => {
    if (!currentUser?.uid) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [allUsers, profile, allWorkers, allTeams, savedSettings] = await Promise.all([
          userService.getAllUsers(),
          userService.getUser(currentUser.uid),
          manpowerService.getWorkers(true),
          teamService.getTeams(),
          systemMessageService.getLogAutomationSettings()
        ]);
        if (cancelled) return;
        setUsers(allUsers);
        setCurrentProfile(profile);
        setWorkers(allWorkers);
        setTeams(allTeams);
        setSettings(savedSettings);
      } catch (error) {
        console.error('[MessageAutomationSettings] load failed:', error);
        setStatusTone('error');
        setStatusText('설정을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  const recipientData = useMemo<MessageRecipientData>(() => ({ users, workers, teams }), [teams, users, workers]);

  const recipientMetaByUid = useMemo(() => {
    const teamById = new Map<string, Team>();
    const teamByName = new Map<string, Team>();

    teams.forEach((team) => {
      [team.id, team.legacyId].forEach((id) => {
        const key = String(id || '').trim();
        if (key) teamById.set(key, team);
      });
      const name = String(team.name || '').trim();
      if (name) teamByName.set(name, team);
    });

    const metaMap = new Map<string, {
      teamColor: string;
      teamIconName?: string | null;
      workerLabel: string;
      teamLabel: string;
      searchText: string;
    }>();

    users.forEach((user) => {
      const linkedWorkers = getLinkedWorkersForUser(user, recipientData);
      const primaryWorker = linkedWorkers[0];
      const team = primaryWorker
        ? (
          (primaryWorker.teamId ? teamById.get(primaryWorker.teamId) : undefined) ||
          (primaryWorker.teamName ? teamByName.get(primaryWorker.teamName) : undefined)
        )
        : undefined;
      const workerLabel = linkedWorkers
        .map((worker) => [worker.name, worker.role].filter(Boolean).join(' · '))
        .filter(Boolean)
        .join(', ');
      const teamLabel = team?.name || primaryWorker?.teamName || '';

      metaMap.set(user.uid, {
        teamColor: team?.color || primaryWorker?.color || '#94a3b8',
        teamIconName: team?.iconKey || team?.icon || primaryWorker?.iconKey || 'fa-users',
        workerLabel,
        teamLabel,
        searchText: [
          getUserDisplayLabel(user),
          user.email,
          user.role,
          user.department,
          user.position,
          workerLabel,
          teamLabel
        ].map((value) => String(value || '').toLowerCase()).join(' ')
      });
    });

    return metaMap;
  }, [recipientData, teams, users]);

  const filteredUsers = useMemo(() => {
    const keyword = recipientSearch.trim().toLowerCase();
    return users
      .filter((user) => {
        if (!keyword) return true;
        return (recipientMetaByUid.get(user.uid)?.searchText || '').includes(keyword);
      })
      .sort((left, right) => getUserDisplayLabel(left).localeCompare(getUserDisplayLabel(right), 'ko-KR'));
  }, [recipientMetaByUid, recipientSearch, users]);

  const filteredTeams = useMemo(() => {
    const keyword = teamSearch.trim().toLowerCase();
    return teams
      .filter((team) => {
        if (!keyword) return true;
        return [team.name, team.type, team.leaderName, team.companyName]
          .map((value) => String(value || '').toLowerCase())
          .join(' ')
          .includes(keyword);
      })
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'ko-KR'));
  }, [teamSearch, teams]);

  const enabledEventCount = useMemo(
    () => systemMessageEvents.filter((event) => settings.events[event]?.enabled).length,
    [settings.events]
  );

  const getEventConfig = (event: SystemMessageEvent): SystemMessageEventConfig => ({
    enabled: Boolean(settings.events[event]?.enabled),
    recipientRule: normalizeRecipientRule(settings.events[event]?.recipientRule, 'global')
  });

  const getEventRule = (event: SystemMessageEvent): MessageRecipientRule =>
    normalizeRecipientRule(settings.events[event]?.recipientRule, 'global');

  const setEventConfig = (event: SystemMessageEvent, patch: Partial<SystemMessageEventConfig>) => {
    setSettings((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [event]: {
          enabled: Boolean(prev.events[event]?.enabled),
          recipientRule: normalizeRecipientRule(prev.events[event]?.recipientRule, 'global'),
          ...patch
        }
      }
    }));
  };

  const setEventRule = (event: SystemMessageEvent, patch: Partial<MessageRecipientRule>) => {
    setSettings((prev) => {
      const current = normalizeRecipientRule(prev.events[event]?.recipientRule, 'global');
      return {
        ...prev,
        events: {
          ...prev.events,
          [event]: {
            ...prev.events[event],
            enabled: Boolean(prev.events[event]?.enabled),
            recipientRule: normalizeRecipientRule({ ...current, ...patch }, 'global')
          }
        }
      };
    });
  };

  const setEventGroup = (events: SystemMessageEvent[], enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      events: events.reduce<SystemMessageSettings['events']>((nextEvents, event) => {
        nextEvents[event] = {
          ...prev.events[event],
          enabled,
          recipientRule: normalizeRecipientRule(prev.events[event]?.recipientRule, 'global')
        };
        return nextEvents;
      }, { ...prev.events })
    }));
  };

  const setRuleMode = (event: SystemMessageEvent, mode: MessageRecipientMode) => {
    const current = getEventRule(event);
    setEventRule(event, {
      ...createDefaultRecipientRule(mode),
      recipientIds: mode === 'users' ? current.recipientIds : [],
      recipientNames: mode === 'users' ? current.recipientNames : [],
      teamIds: mode === 'teamMembers' || mode === 'teamLeaders' ? current.teamIds : [],
      teamNames: mode === 'teamMembers' || mode === 'teamLeaders' ? current.teamNames : []
    });
  };

  const toggleDefaultRecipient = (uid: string) => {
    setSettings((prev) => ({
      ...prev,
      recipientScope: 'users',
      recipientIds: prev.recipientIds.includes(uid)
        ? prev.recipientIds.filter((id) => id !== uid)
        : [...prev.recipientIds, uid]
    }));
  };

  const toggleEventUser = (event: SystemMessageEvent, uid: string) => {
    const current = getEventRule(event);
    setEventRule(event, {
      mode: 'users',
      recipientIds: current.recipientIds.includes(uid)
        ? current.recipientIds.filter((id) => id !== uid)
        : [...current.recipientIds, uid]
    });
  };

  const toggleEventTeam = (event: SystemMessageEvent, team: Team) => {
    const key = getTeamKey(team);
    if (!key) return;
    const current = getEventRule(event);
    setEventRule(event, {
      teamIds: current.teamIds.includes(key)
        ? current.teamIds.filter((id) => id !== key)
        : [...current.teamIds, key]
    });
  };

  const getRulePreview = (rule: MessageRecipientRule): string => {
    const normalized = normalizeRecipientRule(rule, 'global');

    if (normalized.mode === 'global') {
      return settings.recipientScope === 'all'
        ? `기본 대상 · 전체 사용자 ${users.length}명`
        : `기본 대상 · ${settings.recipientIds.length}명`;
    }

    if (normalized.mode === 'relatedTeamLeaders') return '로그 팀 기준';

    const resolved = resolveMessageRecipients(normalized, recipientData);
    return resolved.recipientScope === 'all' ? `${resolved.description} ${resolved.count}명` : resolved.description;
  };

  const buildRuleForSave = (rule: MessageRecipientRule): MessageRecipientRule => {
    const normalized = normalizeRecipientRule(rule, 'global');
    const selectedUsers = getSelectedUsers(users, normalized.recipientIds);
    const selectedTeams = getSelectedTeams(teams, normalized.teamIds);

    return {
      ...normalized,
      recipientNames: normalized.mode === 'users' ? selectedUsers.map(getUserDisplayLabel) : [],
      teamNames: normalized.mode === 'teamMembers' || normalized.mode === 'teamLeaders'
        ? selectedTeams.map((team) => String(team.name || '').trim()).filter(Boolean)
        : []
    };
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatusText('');
    setStatusTone('info');

    try {
      const nextEvents = systemMessageEvents.reduce<SystemMessageSettings['events']>((events, event) => {
        const current = getEventConfig(event);
        events[event] = {
          enabled: current.enabled,
          recipientRule: buildRuleForSave(normalizeRecipientRule(current.recipientRule, 'global'))
        };
        return events;
      }, {} as SystemMessageSettings['events']);

      const nextSettings: SystemMessageSettings = {
        ...settings,
        recipientIds: settings.recipientScope === 'users' ? settings.recipientIds : [],
        recipientNames: settings.recipientScope === 'users'
          ? getSelectedUsers(users, settings.recipientIds).map(getUserDisplayLabel)
          : ['전체 사용자'],
        events: nextEvents
      };

      const enabledEvents = systemMessageEvents.filter((event) => nextSettings.events[event]?.enabled);
      if (nextSettings.enabled && enabledEvents.length === 0) throw new Error('event-required');

      enabledEvents.forEach((event) => {
        const rule = normalizeRecipientRule(nextSettings.events[event]?.recipientRule, 'global');
        if (rule.mode === 'global' && nextSettings.recipientScope === 'users' && nextSettings.recipientIds.length === 0) {
          throw new Error('default-recipient-required');
        }
        if (rule.mode === 'users' && rule.recipientIds.length === 0) throw new Error('recipient-required');
        if (rule.mode === 'teamMembers' && rule.teamIds.length === 0) throw new Error('team-required');
      });

      await systemMessageService.saveLogAutomationSettings(nextSettings);
      setSettings(nextSettings);
      setStatusText('자동 메시지 설정을 저장했습니다.');
    } catch (error) {
      console.error('[MessageAutomationSettings] save failed:', error);
      const message = error instanceof Error ? error.message : 'save-failed';
      setStatusTone('error');
      if (message === 'event-required') setStatusText('자동 발송 이벤트를 1개 이상 선택하세요.');
      else if (message === 'default-recipient-required') setStatusText('기본 대상을 지정하거나 전체 사용자로 바꾸세요.');
      else if (message === 'recipient-required') setStatusText('지정 사용자 방식에는 사용자가 1명 이상 필요합니다.');
      else if (message === 'team-required') setStatusText('선택 팀 소속 방식에는 팀이 1개 이상 필요합니다.');
      else setStatusText('자동 메시지 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const renderUserPicker = (
    selectedIds: string[],
    onToggle: (uid: string) => void
  ) => (
    <div className="erp-message-recipient-grid settings-user-list">
      {filteredUsers.map((user) => {
        const selected = selectedIds.includes(user.uid);
        const meta = recipientMetaByUid.get(user.uid);
        const teamIcon = resolveIcon(meta?.teamIconName || 'fa-users', faUsers);

        return (
          <label key={user.uid} className={`erp-message-recipient-option ${selected ? 'selected' : ''}`}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(user.uid)} />
            <span
              className="erp-message-recipient-team-icon"
              style={{ backgroundColor: meta?.teamColor || '#94a3b8' }}
              aria-hidden="true"
            >
              <FontAwesomeIcon icon={teamIcon} />
            </span>
            <span className="erp-message-recipient-copy">
              <span className="erp-message-recipient-name">{getUserDisplayLabel(user)}</span>
              <span className="erp-message-recipient-worker">{meta?.workerLabel || '연결 작업자 없음'}</span>
              {meta?.teamLabel && <span className="erp-message-recipient-team">{meta.teamLabel}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );

  const renderTeamPicker = (
    selectedIds: string[],
    onToggle: (team: Team) => void
  ) => (
    <div className="erp-message-team-grid compact">
      {filteredTeams.map((team) => {
        const key = getTeamKey(team);
        const selected = selectedIds.includes(key);
        const teamIcon = resolveIcon(team.iconKey || team.icon || 'fa-users', faUsers);

        return (
          <label key={key || team.name} className={`erp-message-team-option ${selected ? 'selected' : ''}`}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(team)} />
            <span
              className="erp-message-recipient-team-icon"
              style={{ backgroundColor: team.color || '#94a3b8' }}
              aria-hidden="true"
            >
              <FontAwesomeIcon icon={teamIcon} />
            </span>
            <span className="erp-message-recipient-copy">
              <span className="erp-message-recipient-name">{team.name}</span>
              <span className="erp-message-recipient-worker">{getTeamLabel(team) || '팀 정보 없음'}</span>
            </span>
          </label>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="erp-message-shell">
        <div className="erp-message-empty">설정을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="erp-message-shell">
        <section className="erp-message-compose-panel">
          <div className="erp-message-detail-header">
            <div>
              <h1 className="erp-message-page-title">자동 메시지 설정</h1>
              <p className="erp-message-page-description">관리자 권한이 필요합니다.</p>
            </div>
            <MessagePageTabs active="settings" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="erp-message-shell">
      <header className="erp-message-page-header">
        <div>
          <h1 className="erp-message-page-title">로그 자동 메시지 설정</h1>
          <p className="erp-message-page-description">로그 종류마다 다른 수신 대상을 지정합니다.</p>
        </div>
        <div className="erp-message-page-header-actions">
          <MessagePageTabs active="settings" />
          <button type="button" className="erp-message-primary-button" onClick={() => void saveSettings()} disabled={saving}>
            <FontAwesomeIcon icon={faFloppyDisk} />
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </header>

      <section className="erp-message-settings-layout">
        <aside className="erp-message-settings-side">
          <section className="erp-message-compose-panel">
            <label className="erp-system-toggle-row">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              <span>
                <strong>자동 발송 사용</strong>
                <small>{enabledEventCount}개 이벤트 선택</small>
              </span>
            </label>
          </section>

          <section className="erp-message-compose-panel">
            <div className="erp-message-section-title">
              <FontAwesomeIcon icon={faShieldHalved} />
              기본 대상
            </div>
            <div className="erp-system-scope-row">
              <button
                type="button"
                className={`erp-message-scope-button ${settings.recipientScope === 'users' ? 'active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, recipientScope: 'users' }))}
              >
                지정 사용자
              </button>
              <button
                type="button"
                className={`erp-message-scope-button ${settings.recipientScope === 'all' ? 'active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, recipientScope: 'all' }))}
              >
                전체 사용자
              </button>
            </div>

            {settings.recipientScope === 'users' && (
              <div className="erp-message-picker-stack">
                <input
                  className="erp-message-input"
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  placeholder="사용자 검색"
                />
                {renderUserPicker(settings.recipientIds, toggleDefaultRecipient)}
              </div>
            )}
          </section>

          <section className="erp-message-compose-panel">
            <div className="erp-message-section-title">
              <FontAwesomeIcon icon={faUsers} />
              팀 검색
            </div>
            <input
              className="erp-message-input"
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
              placeholder="팀명, 팀장, 회사명 검색"
            />
          </section>
        </aside>

        <main className="erp-message-settings-main">
          <div className="erp-system-event-groups">
            {SYSTEM_MESSAGE_EVENT_GROUPS.map((group) => {
              const enabledCount = group.events.filter((event) => settings.events[event]?.enabled).length;
              return (
                <section key={group.id} className="erp-system-event-group automation">
                  <div className="erp-system-event-group-header">
                    <div>
                      <strong>{group.label}</strong>
                      <small>{enabledCount}/{group.events.length}개 선택</small>
                    </div>
                    <div className="erp-system-event-group-actions">
                      <button type="button" onClick={() => setEventGroup(group.events, true)}>모두 선택</button>
                      <button type="button" onClick={() => setEventGroup(group.events, false)}>해제</button>
                    </div>
                  </div>

                  <div className="erp-message-automation-list">
                    {group.events.map((event) => {
                      const config = getEventConfig(event);
                      const rule = normalizeRecipientRule(config.recipientRule, 'global');

                      return (
                        <div key={event} className={`erp-message-automation-row ${config.enabled ? 'enabled' : ''}`}>
                          <label className="erp-message-automation-toggle">
                            <input
                              type="checkbox"
                              checked={config.enabled}
                              onChange={(changeEvent) => setEventConfig(event, { enabled: changeEvent.target.checked })}
                            />
                            <span>{SYSTEM_MESSAGE_EVENT_LABELS[event]}</span>
                          </label>

                          <div className="erp-message-automation-controls">
                            <select
                              className="erp-message-select"
                              value={rule.mode}
                              onChange={(changeEvent) => setRuleMode(event, changeEvent.target.value as MessageRecipientMode)}
                            >
                              {ruleModeOptions.map((option) => (
                                <option key={option.mode} value={option.mode}>{option.label}</option>
                              ))}
                            </select>
                            <span className="erp-message-rule-preview">{getRulePreview(rule)}</span>
                          </div>

                          {rule.mode === 'users' && (
                            <details className="erp-message-automation-details">
                              <summary>사용자 선택</summary>
                              {renderUserPicker(rule.recipientIds, (uid) => toggleEventUser(event, uid))}
                            </details>
                          )}

                          {(rule.mode === 'teamMembers' || rule.mode === 'teamLeaders') && (
                            <details className="erp-message-automation-details">
                              <summary>팀 선택</summary>
                              {renderTeamPicker(rule.teamIds, (team) => toggleEventTeam(event, team))}
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      </section>

      <div className="erp-message-form-actions">
        {statusText && (
          <span className={`erp-message-status-text ${statusTone === 'error' ? 'error' : ''}`}>{statusText}</span>
        )}
        <button type="button" className="erp-message-primary-button" onClick={() => void saveSettings()} disabled={saving}>
          <FontAwesomeIcon icon={faCheck} />
          {saving ? '저장 중' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

export default MessageAutomationSettingsPage;
