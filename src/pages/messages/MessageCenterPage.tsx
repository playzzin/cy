import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCheck,
  faEnvelope,
  faInbox,
  faPaperPlane,
  faShieldHalved,
  faUserGroup,
  faUserTie,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { resolveIcon } from '../../constants/iconMap';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { messageService } from '../../services/messageService';
import {
  getLinkedWorkersForUser,
  getUserDisplayLabel,
  resolveMessageRecipients,
  type MessageRecipientData,
  type MessageRecipientMode
} from '../../services/messageRecipientResolver';
import { teamService, type Team } from '../../services/teamService';
import { userService, type UserData } from '../../services/userService';
import type { CreateErpMessageInput, ErpMessage, ErpMessagePriority, ErpMessageType } from '../../types/erpMessage';
import MessagePageTabs from '../../components/messages/MessagePageTabs';
import '../../components/messages/MessageSystem.css';

type MessageTab = 'inbox' | 'unread' | 'sent' | 'all' | 'system';
type ComposeRecipientMode = Extract<MessageRecipientMode, 'users' | 'teamMembers' | 'teamLeaders' | 'allWorkers' | 'allUsers'>;

interface ComposeState {
  recipientMode: ComposeRecipientMode;
  recipientIds: string[];
  teamIds: string[];
  body: string;
  priority: ErpMessagePriority;
}

interface RecipientMeta {
  workers: Worker[];
  primaryWorker?: Worker;
  team?: Team;
  workerLabel: string;
  teamLabel: string;
  teamColor: string;
  teamIconName?: string | null;
  searchText: string;
}

interface MessageCenterPageProps {
  mode?: 'view' | 'compose';
}

const initialCompose: ComposeState = {
  recipientMode: 'users',
  recipientIds: [],
  teamIds: [],
  body: '',
  priority: 'normal'
};

const priorityLabels: Record<ErpMessagePriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '중요',
  urgent: '긴급'
};

const typeLabels: Record<ErpMessageType, string> = {
  direct: '개별 메시지',
  broadcast: '전체 메시지',
  system: '시스템 메시지'
};

const recipientModeOptions: Array<{ mode: ComposeRecipientMode; label: string; icon: typeof faUsers }> = [
  { mode: 'users', label: '지정 사용자', icon: faUserGroup },
  { mode: 'teamMembers', label: '팀 소속', icon: faUsers },
  { mode: 'teamLeaders', label: '팀장', icon: faUserTie },
  { mode: 'allWorkers', label: '전체 작업자', icon: faUsers },
  { mode: 'allUsers', label: '전체 사용자', icon: faShieldHalved }
];

const isAdminRole = (role?: string | null): boolean => {
  const normalized = String(role || '').trim().toLowerCase();
  return ['admin', 'administrator', 'superadmin', 'owner', '관리자', '사장', '실장'].includes(normalized);
};

const formatDateTime = (message: ErpMessage): string =>
  message.createdAt.toDate().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

const mergeMessages = (...groups: ErpMessage[][]): ErpMessage[] => {
  const map = new Map<string, ErpMessage>();
  groups.flat().forEach((message) => map.set(message.id, message));
  return Array.from(map.values()).sort((left, right) => right.createdAt.toMillis() - left.createdAt.toMillis());
};

const getReceiptUsers = (message: ErpMessage, users: UserData[]): Array<{ uid: string; name: string }> => {
  if (message.recipientScope === 'all') {
    return users.map((user) => ({ uid: user.uid, name: getUserDisplayLabel(user) }));
  }

  if (users.length > 0) {
    const byUid = new Map(users.map((user) => [user.uid, user]));
    return message.recipientIds.map((uid, index) => ({
      uid,
      name: byUid.get(uid) ? getUserDisplayLabel(byUid.get(uid) as UserData) : message.recipientNames[index] || uid
    }));
  }

  return message.recipientIds.map((uid, index) => ({
    uid,
    name: message.recipientNames[index] || uid
  }));
};

const getTeamKey = (team: Team): string => String(team.id || team.legacyId || team.name || '').trim();

const MessageCenterPage: React.FC<MessageCenterPageProps> = ({ mode = 'view' }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserData | null>(null);
  const [inboxMessages, setInboxMessages] = useState<ErpMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<ErpMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ErpMessage[]>([]);
  const [tab, setTab] = useState<MessageTab>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(initialCompose);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusTone, setStatusTone] = useState<'info' | 'error'>('info');

  const isComposeMode = mode === 'compose';
  const admin = isAdminRole(currentProfile?.role as string | undefined);

  useEffect(() => {
    if (!currentUser?.uid) return;

    let cancelled = false;

    const loadUsers = async () => {
      try {
        const [allUsers, profile, allWorkers, allTeams] = await Promise.all([
          userService.getAllUsers(),
          userService.getUser(currentUser.uid),
          manpowerService.getWorkers(true),
          teamService.getTeams()
        ]);
        if (cancelled) return;
        setUsers(allUsers);
        setWorkers(allWorkers);
        setTeams(allTeams);
        setCurrentProfile(profile);
      } catch (error) {
        console.error('[MessageCenter] failed to load recipients:', error);
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribeInbox = messageService.subscribeInbox(currentUser.uid, setInboxMessages);
    const unsubscribeSent = messageService.subscribeSent(currentUser.uid, setSentMessages);

    return () => {
      unsubscribeInbox();
      unsubscribeSent();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!admin) {
      setAllMessages([]);
      return;
    }

    return messageService.subscribeAllMessages(setAllMessages);
  }, [admin]);

  const recipientData = useMemo<MessageRecipientData>(() => ({ users, workers, teams }), [teams, users, workers]);

  const teamMaps = useMemo(() => {
    const byId = new Map<string, Team>();
    const byName = new Map<string, Team>();
    teams.forEach((team) => {
      [team.id, team.legacyId].forEach((id) => {
        const key = String(id || '').trim();
        if (key) byId.set(key, team);
      });
      const name = String(team.name || '').trim();
      if (name) byName.set(name, team);
    });
    return { byId, byName };
  }, [teams]);

  const recipientMetaByUid = useMemo(() => {
    const metaMap = new Map<string, RecipientMeta>();

    users.forEach((user) => {
      const linkedWorkers = getLinkedWorkersForUser(user, recipientData);
      const primaryWorker = linkedWorkers[0];
      const team = primaryWorker
        ? (
          (primaryWorker.teamId ? teamMaps.byId.get(primaryWorker.teamId) : undefined) ||
          (primaryWorker.teamName ? teamMaps.byName.get(primaryWorker.teamName) : undefined)
        )
        : undefined;

      const workerNames = linkedWorkers.map((worker) => worker.name).filter(Boolean);
      const workerLabels = linkedWorkers
        .map((worker) => [worker.name, worker.role].filter(Boolean).join(' · '))
        .filter(Boolean);
      const workerLabel = workerLabels.length > 1
        ? `${workerLabels[0]} 외 ${workerLabels.length - 1}명`
        : workerLabels[0] || '';
      const teamLabel = team?.name || primaryWorker?.teamName || '';
      const teamColor = team?.color || primaryWorker?.color || '#94a3b8';
      const teamIconName = team?.iconKey || team?.icon || primaryWorker?.iconKey || 'fa-users';
      const workerRoles = linkedWorkers.map((worker) => worker.role).filter(Boolean).join(' ');

      metaMap.set(user.uid, {
        workers: linkedWorkers,
        primaryWorker,
        team,
        workerLabel,
        teamLabel,
        teamColor,
        teamIconName,
        searchText: [
          getUserDisplayLabel(user),
          user.email,
          user.role,
          user.department,
          user.position,
          workerNames.join(' '),
          workerRoles,
          teamLabel
        ].map((value) => String(value || '').toLowerCase()).join(' ')
      });
    });

    return metaMap;
  }, [recipientData, teamMaps.byId, teamMaps.byName, users]);

  const visibleMessages = useMemo(() => {
    const combined = admin ? mergeMessages(allMessages, inboxMessages, sentMessages) : mergeMessages(inboxMessages, sentMessages);

    if (tab === 'inbox') return inboxMessages;
    if (tab === 'unread') return inboxMessages.filter((message) => currentUser?.uid && !messageService.isReadBy(message, currentUser.uid));
    if (tab === 'sent') return sentMessages;
    if (tab === 'system') return combined.filter((message) => message.type === 'system');
    return combined;
  }, [admin, allMessages, currentUser?.uid, inboxMessages, sentMessages, tab]);

  const selectedMessage = useMemo(() => {
    const combined = mergeMessages(visibleMessages, inboxMessages, sentMessages, allMessages);
    return selectedId ? combined.find((message) => message.id === selectedId) || null : null;
  }, [allMessages, inboxMessages, selectedId, sentMessages, visibleMessages]);

  const unreadCount = useMemo(() => {
    if (!currentUser?.uid) return 0;
    return inboxMessages.filter((message) => !messageService.isReadBy(message, currentUser.uid)).length;
  }, [currentUser?.uid, inboxMessages]);

  useEffect(() => {
    if (isComposeMode) return;

    const params = new URLSearchParams(location.search);
    const messageId = params.get('messageId');
    if (messageId) {
      setSelectedId(messageId);
      return;
    }

    if (!selectedId && visibleMessages[0]) {
      setSelectedId(visibleMessages[0].id);
    }
  }, [isComposeMode, location.search, selectedId, visibleMessages]);

  useEffect(() => {
    if (isComposeMode) return;
    if (!currentUser?.uid || !selectedMessage) return;
    if (messageService.isReadBy(selectedMessage, currentUser.uid)) return;

    void messageService.markAsRead(selectedMessage.id, currentUser.uid);
  }, [currentUser?.uid, isComposeMode, selectedMessage]);

  const filteredUsers = useMemo(() => {
    const keyword = recipientSearch.trim().toLowerCase();
    return users
      .filter((user) => user.uid !== currentUser?.uid)
      .filter((user) => {
        if (!keyword) return true;
        return (recipientMetaByUid.get(user.uid)?.searchText || '').includes(keyword);
      })
      .sort((left, right) => getUserDisplayLabel(left).localeCompare(getUserDisplayLabel(right), 'ko-KR'));
  }, [currentUser?.uid, recipientMetaByUid, recipientSearch, users]);

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

  const selectedTeams = useMemo(
    () => teams.filter((team) => compose.teamIds.includes(getTeamKey(team))),
    [compose.teamIds, teams]
  );

  const resolvedComposeRecipients = useMemo(() => {
    const resolved = resolveMessageRecipients({
      mode: compose.recipientMode,
      recipientIds: compose.recipientIds,
      recipientNames: [],
      teamIds: compose.teamIds,
      teamNames: selectedTeams.map((team) => String(team.name || '').trim()).filter(Boolean)
    }, recipientData);

    if (resolved.recipientScope !== 'users' || !currentUser?.uid) return resolved;

    const pairs = resolved.recipientIds
      .map((uid, index) => ({ uid, name: resolved.recipientNames[index] || uid }))
      .filter((recipient) => recipient.uid !== currentUser.uid);

    return {
      ...resolved,
      recipientIds: pairs.map((recipient) => recipient.uid),
      recipientNames: pairs.map((recipient) => recipient.name),
      count: pairs.length
    };
  }, [compose.recipientIds, compose.recipientMode, compose.teamIds, currentUser?.uid, recipientData, selectedTeams]);

  const toggleRecipient = (uid: string) => {
    setCompose((prev) => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(uid)
        ? prev.recipientIds.filter((id) => id !== uid)
        : [...prev.recipientIds, uid]
    }));
  };

  const toggleComposeTeam = (team: Team) => {
    const key = getTeamKey(team);
    if (!key) return;

    setCompose((prev) => ({
      ...prev,
      teamIds: prev.teamIds.includes(key)
        ? prev.teamIds.filter((id) => id !== key)
        : [...prev.teamIds, key]
    }));
  };

  const sendMessage = async () => {
    if (!currentUser?.uid) return;

    setSending(true);
    setStatusText('');
    setStatusTone('info');

    try {
      if (compose.recipientMode === 'teamMembers' && compose.teamIds.length === 0) {
        throw new Error('team-required');
      }
      if (resolvedComposeRecipients.recipientScope === 'users' && resolvedComposeRecipients.recipientIds.length === 0) {
        throw new Error('recipient-required');
      }

      const payload: CreateErpMessageInput = {
        type: resolvedComposeRecipients.recipientScope === 'all' ? 'broadcast' : 'direct',
        body: compose.body,
        priority: compose.priority,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentProfile?.displayName || currentUser.email || '사용자',
        senderEmail: currentUser.email,
        recipientScope: resolvedComposeRecipients.recipientScope,
        recipientIds: resolvedComposeRecipients.recipientScope === 'users' ? resolvedComposeRecipients.recipientIds : [],
        recipientNames: resolvedComposeRecipients.recipientNames
      };

      const messageId = await messageService.createMessage(payload);
      setCompose(initialCompose);
      setRecipientSearch('');
      setTeamSearch('');
      setStatusText('메시지를 발송했습니다.');
      setTab('sent');
      setSelectedId(messageId);
      navigate(`/messages?messageId=${messageId}`, { replace: true });
    } catch (error) {
      console.error('[MessageCenter] send failed:', error);
      const message = error instanceof Error ? error.message : 'send-failed';
      setStatusTone('error');
      if (message === 'team-required') setStatusText('팀 소속 발송은 팀을 1개 이상 선택해야 합니다.');
      else if (message === 'recipient-required') setStatusText('받는 대상이 없습니다. 조건을 다시 선택하세요.');
      else if (message === 'body-required') setStatusText('내용을 입력하세요.');
      else setStatusText('메시지 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const markSelectedRead = async () => {
    if (!currentUser?.uid || !selectedMessage) return;
    await messageService.markAsRead(selectedMessage.id, currentUser.uid);
  };

  const openMessageAction = (message: ErpMessage) => {
    if (!message.actionUrl) return;

    if (/^https?:\/\//i.test(message.actionUrl)) {
      window.open(message.actionUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    navigate(message.actionUrl);
  };

  const markInboxRead = async () => {
    if (!currentUser?.uid) return;
    await messageService.markAllAsRead(inboxMessages, currentUser.uid);
  };

  const receiptUsers = selectedMessage ? getReceiptUsers(selectedMessage, users) : [];
  const readRecipientCount = selectedMessage
    ? receiptUsers.filter((recipient) => selectedMessage.readBy.includes(recipient.uid)).length
    : 0;

  return (
    <div className="erp-message-shell">
      <header className="erp-message-page-header">
        <div>
          <h1 className="erp-message-page-title">{isComposeMode ? '메시지 보내기' : '메시지 보기'}</h1>
          <p className="erp-message-page-description">
            {isComposeMode ? '받는 대상을 선택하고 업무 메시지를 발송합니다.' : '받은 메시지와 보낸 메시지를 확인합니다.'}
          </p>
        </div>

        <div className="erp-message-page-header-actions">
          <MessagePageTabs active={isComposeMode ? 'compose' : 'view'} />
          {!isComposeMode && (
            <button type="button" className="erp-message-secondary-button" onClick={markInboxRead} disabled={unreadCount === 0}>
              <FontAwesomeIcon icon={faCheck} />
              받은 메시지 모두 읽음
            </button>
          )}
        </div>
      </header>

      {!isComposeMode && (
      <section className="erp-message-workspace">
        <div className="erp-message-panel">
          <div className="erp-message-tabs" role="tablist" aria-label="메시지 필터">
            {([
              ['inbox', '수신함', faInbox],
              ['unread', `안 읽음 ${unreadCount}`, faEnvelope],
              ['sent', '보낸 메시지', faPaperPlane],
              ['all', '전체 메시지', faUserGroup],
              ['system', '시스템 메시지', faShieldHalved]
            ] as const).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`erp-message-tab ${tab === key ? 'active' : ''}`}
                onClick={() => {
                  setTab(key);
                  setSelectedId(null);
                  navigate('/messages', { replace: true });
                }}
              >
                <FontAwesomeIcon icon={icon} /> {label}
              </button>
            ))}
          </div>

          <div className="erp-message-list">
            {visibleMessages.length === 0 ? (
              <div className="erp-message-empty">표시할 메시지가 없습니다.</div>
            ) : (
              visibleMessages.map((message) => {
                const unread = currentUser?.uid ? !messageService.isReadBy(message, currentUser.uid) : false;
                const active = selectedId === message.id;

                return (
                  <button
                    key={message.id}
                    type="button"
                    className={`erp-message-preview ${unread ? 'unread' : ''} ${active ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedId(message.id);
                      navigate(`/messages?messageId=${message.id}`, { replace: true });
                    }}
                  >
                    <div className="erp-message-preview-topline">
                      <span className="erp-message-preview-title">{message.title}</span>
                      <span className="erp-message-preview-time">{formatDateTime(message)}</span>
                    </div>
                    <div className="erp-message-preview-body">{message.body}</div>
                    <div className="erp-message-preview-meta">
                      {unread && <span className="erp-message-dot" />}
                      <span>{typeLabels[message.type]}</span>
                      <span>·</span>
                      <span>{message.senderName}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="erp-message-panel erp-message-detail">
          {!selectedMessage ? (
            <div className="erp-message-detail-empty">목록에서 메시지를 선택하세요.</div>
          ) : (
            <>
              <div className="erp-message-detail-header">
                <div>
                  <div className="erp-message-tag-row">
                    <span className={`erp-message-tag ${selectedMessage.priority}`}>{priorityLabels[selectedMessage.priority]}</span>
                    <span className="erp-message-tag">{typeLabels[selectedMessage.type]}</span>
                  </div>
                  <h2 className="erp-message-detail-title">{selectedMessage.title}</h2>
                  <div className="erp-message-detail-meta">
                    <span>보낸 사람: {selectedMessage.senderName}</span>
                    <span>발송 시간: {formatDateTime(selectedMessage)}</span>
                    <span>
                      수신 범위: {selectedMessage.recipientScope === 'all' ? '전체 사용자' : `${selectedMessage.recipientNames.length || selectedMessage.recipientIds.length}명`}
                    </span>
                  </div>
                </div>

                <button type="button" className="erp-message-secondary-button" onClick={markSelectedRead}>
                  <FontAwesomeIcon icon={faCheck} />
                  읽음 처리
                </button>
              </div>

              <div className="erp-message-body">
                <div className="erp-message-body-text">{selectedMessage.body}</div>

                {selectedMessage.actionUrl && (
                  <div className="erp-message-action-row">
                    <button
                      type="button"
                      className="erp-message-primary-button"
                      onClick={() => openMessageAction(selectedMessage)}
                    >
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      {selectedMessage.actionLabel || '바로가기'}
                    </button>
                  </div>
                )}
              </div>

              <section className="erp-message-receipts">
                <h3 className="erp-message-receipts-title">
                  확인 현황 {readRecipientCount}/{receiptUsers.length || selectedMessage.readBy.length}
                </h3>
                <div className="erp-message-receipt-list">
                  {(receiptUsers.length > 0 ? receiptUsers : selectedMessage.readBy.map((uid) => ({ uid, name: uid }))).slice(0, 24).map((recipient) => {
                    const read = selectedMessage.readBy.includes(recipient.uid);
                    const readAt = messageService.getReadAt(selectedMessage, recipient.uid);
                    const meta = recipientMetaByUid.get(recipient.uid);
                    const teamIcon = resolveIcon(meta?.teamIconName || 'fa-users', faUsers);

                    return (
                      <div key={recipient.uid} className={`erp-message-receipt ${read ? 'read' : ''}`}>
                        <span className="erp-message-receipt-identity">
                          <span
                            className="erp-message-recipient-team-icon small"
                            style={{ backgroundColor: meta?.teamColor || '#94a3b8' }}
                            aria-hidden="true"
                          >
                            <FontAwesomeIcon icon={teamIcon} />
                          </span>
                          <span className="erp-message-receipt-copy">
                            <span className="erp-message-receipt-name">{recipient.name}</span>
                            <span className="erp-message-receipt-worker">
                              {meta?.workerLabel ? `작업자 ${meta.workerLabel}` : '연결 작업자 없음'}
                              {meta?.teamLabel ? ` · ${meta.teamLabel}` : ''}
                            </span>
                          </span>
                        </span>
                        <span className="erp-message-receipt-state">
                          {read ? (readAt ? readAt.toDate().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '확인') : '미확인'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
      )}

      {isComposeMode && (
      <section className="erp-message-compose-panel" aria-label="메시지 작성">
        <div className="erp-message-detail-header">
          <div>
            <div className="erp-message-tag-row">
              <span className="erp-message-tag">업무 메시지</span>
              <span className="erp-message-tag">{resolvedComposeRecipients.description}</span>
            </div>
            <h2 className="erp-message-detail-title">새 메시지 작성</h2>
          </div>
        </div>

        <div className="erp-message-compose-layout">
          <div className="erp-message-compose-column">
            <div className="erp-message-field full">
              <span className="erp-message-label">받는 대상</span>
              <div className="erp-message-mode-row">
                {recipientModeOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    className={`erp-message-mode-button ${compose.recipientMode === option.mode ? 'active' : ''}`}
                    onClick={() => setCompose((prev) => ({
                      ...prev,
                      recipientMode: option.mode,
                      recipientIds: option.mode === 'users' ? prev.recipientIds : [],
                      teamIds: option.mode === 'teamMembers' || option.mode === 'teamLeaders' ? prev.teamIds : []
                    }))}
                  >
                    <FontAwesomeIcon icon={option.icon} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {compose.recipientMode === 'users' && (
              <div className="erp-message-field full">
                <input
                  className="erp-message-input"
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  placeholder="이름, 이메일, 작업자, 직책, 팀명 검색"
                />
                <div className="erp-message-recipient-grid compose-recipient-list">
                  {filteredUsers.map((user) => {
                    const meta = recipientMetaByUid.get(user.uid);
                    const selected = compose.recipientIds.includes(user.uid);
                    const teamIcon = resolveIcon(meta?.teamIconName || 'fa-users', faUsers);

                    return (
                      <label key={user.uid} className={`erp-message-recipient-option ${selected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRecipient(user.uid)}
                        />
                        <span
                          className="erp-message-recipient-team-icon"
                          style={{ backgroundColor: meta?.teamColor || '#94a3b8' }}
                          aria-hidden="true"
                        >
                          <FontAwesomeIcon icon={teamIcon} />
                        </span>
                        <span className="erp-message-recipient-copy">
                          <span className="erp-message-recipient-name">{getUserDisplayLabel(user)}</span>
                          <span className="erp-message-recipient-worker">
                            {meta?.workerLabel ? `작업자 ${meta.workerLabel}` : '연결 작업자 없음'}
                          </span>
                          {meta?.teamLabel && (
                            <span className="erp-message-recipient-team">{meta.teamLabel}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {(compose.recipientMode === 'teamMembers' || compose.recipientMode === 'teamLeaders') && (
              <div className="erp-message-field full">
                <input
                  className="erp-message-input"
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="팀명, 유형, 팀장, 회사명 검색"
                />
                <div className="erp-message-team-grid compose-recipient-list">
                  {filteredTeams.map((team) => {
                    const key = getTeamKey(team);
                    const selected = compose.teamIds.includes(key);
                    const teamIcon = resolveIcon(team.iconKey || team.icon || 'fa-users', faUsers);

                    return (
                      <label key={key || team.name} className={`erp-message-team-option ${selected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleComposeTeam(team)}
                        />
                        <span
                          className="erp-message-recipient-team-icon"
                          style={{ backgroundColor: team.color || '#94a3b8' }}
                          aria-hidden="true"
                        >
                          <FontAwesomeIcon icon={teamIcon} />
                        </span>
                        <span className="erp-message-recipient-copy">
                          <span className="erp-message-recipient-name">{team.name}</span>
                          <span className="erp-message-recipient-worker">
                            {[team.leaderName ? `팀장 ${team.leaderName}` : '', team.companyName].filter(Boolean).join(' · ') || '팀 정보 없음'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="erp-message-compose-column">
            <div className="erp-message-form-grid">
              <label className="erp-message-field">
                <span className="erp-message-label">중요도</span>
                <select
                  className="erp-message-select"
                  value={compose.priority}
                  onChange={(event) => setCompose((prev) => ({ ...prev, priority: event.target.value as ErpMessagePriority }))}
                >
                  <option value="normal">보통</option>
                  <option value="high">중요</option>
                  <option value="urgent">긴급</option>
                  <option value="low">낮음</option>
                </select>
              </label>

              <div className="erp-message-field">
                <span className="erp-message-label">예상 수신</span>
                <div className="erp-message-recipient-summary">
                  {resolvedComposeRecipients.recipientScope === 'all' ? '전체 사용자' : `${resolvedComposeRecipients.count}명`}
                </div>
              </div>

              <label className="erp-message-field full">
                <span className="erp-message-label">내용</span>
                <textarea
                  className="erp-message-textarea compose-body"
                  value={compose.body}
                  onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder={'전달 내용을 입력하세요.\n첫 줄은 메시지 제목으로 사용됩니다.'}
                />
              </label>
            </div>

            <div className="erp-message-form-actions">
              {statusText && (
                <span className={`erp-message-status-text ${statusTone === 'error' ? 'error' : ''}`}>{statusText}</span>
              )}
              <button
                type="button"
                className="erp-message-secondary-button"
                onClick={() => {
                  setCompose(initialCompose);
                  setRecipientSearch('');
                  setTeamSearch('');
                  setStatusText('');
                }}
              >
                초기화
              </button>
              <button
                type="button"
                className="erp-message-primary-button"
                onClick={() => void sendMessage()}
                disabled={sending}
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                {sending ? '발송 중' : '발송'}
              </button>
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

export default MessageCenterPage;
