import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCheck,
  faClock,
  faEnvelope,
  faInbox,
  faLink,
  faMagnifyingGlass,
  faPaperPlane,
  faRotateLeft,
  faShieldHalved,
  faThumbtack,
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
type MessageSortMode = 'newest' | 'oldest' | 'priority' | 'unreadFirst';
type MessagePriorityFilter = 'all' | ErpMessagePriority;
type ComposeRecipientMode = Extract<MessageRecipientMode, 'users' | 'teamMembers' | 'teamLeaders' | 'allWorkers' | 'allUsers'>;

interface ComposeState {
  recipientMode: ComposeRecipientMode;
  recipientIds: string[];
  teamIds: string[];
  title: string;
  category: string;
  body: string;
  priority: ErpMessagePriority;
  pinned: boolean;
  actionLabel: string;
  actionUrl: string;
  expiresInDays: string;
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
  title: '',
  category: '업무',
  body: '',
  priority: 'normal',
  pinned: false,
  actionLabel: '',
  actionUrl: '',
  expiresInDays: ''
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

const priorityOrder: Record<ErpMessagePriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1
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
  return Array.from(map.values()).sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.createdAt.toMillis() - left.createdAt.toMillis();
  });
};

const normalizeSearchText = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const getMessageSearchText = (message: ErpMessage): string =>
  [
    message.title,
    message.body,
    message.category,
    message.senderName,
    message.senderEmail,
    message.recipientNames.join(' '),
    priorityLabels[message.priority],
    typeLabels[message.type]
  ].map(normalizeSearchText).join(' ');

const isValidActionUrl = (value: string): boolean =>
  !value || /^https?:\/\//i.test(value) || value.startsWith('/');

const buildExpiresAt = (expiresInDays: string) => {
  const days = Number(expiresInDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  return Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
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
  const [messageSearch, setMessageSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<MessagePriorityFilter>('all');
  const [sortMode, setSortMode] = useState<MessageSortMode>('newest');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusTone, setStatusTone] = useState<'info' | 'error'>('info');

  const isComposeMode = mode === 'compose';
  const admin = isAdminRole(currentProfile?.role as string | undefined);

  useEffect(() => {
    if (!admin && (tab === 'all' || tab === 'system')) {
      setTab('inbox');
      setSelectedId(null);
    }
  }, [admin, tab]);

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

  const messageStats = useMemo(() => {
    const combined = admin ? mergeMessages(allMessages, inboxMessages, sentMessages) : mergeMessages(inboxMessages, sentMessages);
    const unread = currentUser?.uid
      ? inboxMessages.filter((message) => !messageService.isReadBy(message, currentUser.uid)).length
      : 0;

    return {
      total: combined.length,
      inbox: inboxMessages.length,
      unread,
      sent: sentMessages.length,
      important: combined.filter((message) => message.priority === 'urgent' || message.priority === 'high').length,
      system: combined.filter((message) => message.type === 'system').length
    };
  }, [admin, allMessages, currentUser?.uid, inboxMessages, sentMessages]);

  const baseVisibleMessages = useMemo(() => {
    const combined = admin ? mergeMessages(allMessages, inboxMessages, sentMessages) : mergeMessages(inboxMessages, sentMessages);

    if (tab === 'inbox') return inboxMessages;
    if (tab === 'unread') return inboxMessages.filter((message) => currentUser?.uid && !messageService.isReadBy(message, currentUser.uid));
    if (tab === 'sent') return sentMessages;
    if (tab === 'system') return combined.filter((message) => message.type === 'system');
    return combined;
  }, [admin, allMessages, currentUser?.uid, inboxMessages, sentMessages, tab]);

  const visibleMessages = useMemo(() => {
    const keyword = normalizeSearchText(messageSearch);
    const filtered = baseVisibleMessages.filter((message) => {
      const matchesSearch = !keyword || getMessageSearchText(message).includes(keyword);
      const matchesPriority = priorityFilter === 'all' || message.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });

    return [...filtered].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      if (sortMode === 'oldest') return left.createdAt.toMillis() - right.createdAt.toMillis();
      if (sortMode === 'priority') {
        const priorityDiff = priorityOrder[right.priority] - priorityOrder[left.priority];
        if (priorityDiff !== 0) return priorityDiff;
      }
      if (sortMode === 'unreadFirst' && currentUser?.uid) {
        const leftUnread = !messageService.isReadBy(left, currentUser.uid);
        const rightUnread = !messageService.isReadBy(right, currentUser.uid);
        if (leftUnread !== rightUnread) return leftUnread ? -1 : 1;
      }
      return right.createdAt.toMillis() - left.createdAt.toMillis();
    });
  }, [baseVisibleMessages, currentUser?.uid, messageSearch, priorityFilter, sortMode]);

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
    if (isComposeMode || !selectedId) return;
    if (visibleMessages.some((message) => message.id === selectedId)) return;
    setSelectedId(visibleMessages[0]?.id || null);
  }, [isComposeMode, selectedId, visibleMessages]);

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

  const messageTabOptions = useMemo(() => {
    const options: Array<{ key: MessageTab; label: string; icon: typeof faInbox }> = [
      { key: 'inbox', label: `수신함 ${messageStats.inbox}`, icon: faInbox },
      { key: 'unread', label: `안 읽음 ${messageStats.unread}`, icon: faEnvelope },
      { key: 'sent', label: `보낸 메시지 ${messageStats.sent}`, icon: faPaperPlane }
    ];

    if (admin) {
      options.push(
        { key: 'all', label: `전체 ${messageStats.total}`, icon: faUserGroup },
        { key: 'system', label: `시스템 ${messageStats.system}`, icon: faShieldHalved }
      );
    }

    return options;
  }, [admin, messageStats.inbox, messageStats.sent, messageStats.system, messageStats.total, messageStats.unread]);

  const selectedRecipientPreview = useMemo(() => {
    if (resolvedComposeRecipients.recipientScope === 'all') return '전체 사용자에게 발송됩니다.';
    if (resolvedComposeRecipients.recipientNames.length === 0) return '선택된 수신자가 없습니다.';

    const visibleNames = resolvedComposeRecipients.recipientNames.slice(0, 8).join(', ');
    return resolvedComposeRecipients.recipientNames.length > 8
      ? `${visibleNames} 외 ${resolvedComposeRecipients.recipientNames.length - 8}명`
      : visibleNames;
  }, [resolvedComposeRecipients]);

  const canSend = useMemo(() => {
    if (sending || !currentUser?.uid || !compose.body.trim()) return false;
    if (resolvedComposeRecipients.recipientScope === 'users' && resolvedComposeRecipients.recipientIds.length === 0) return false;
    if ((compose.recipientMode === 'teamMembers' || compose.recipientMode === 'teamLeaders') && compose.teamIds.length === 0) return false;
    if (!isValidActionUrl(compose.actionUrl.trim())) return false;
    return true;
  }, [compose.actionUrl, compose.body, compose.recipientMode, compose.teamIds.length, currentUser?.uid, resolvedComposeRecipients, sending]);

  const resetCompose = () => {
    setCompose(initialCompose);
    setRecipientSearch('');
    setTeamSearch('');
    setStatusText('');
    setStatusTone('info');
  };

  const resetMessageFilters = () => {
    setMessageSearch('');
    setPriorityFilter('all');
    setSortMode('newest');
  };

  const toggleRecipient = (uid: string) => {
    setCompose((prev) => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(uid)
        ? prev.recipientIds.filter((id) => id !== uid)
        : [...prev.recipientIds, uid]
    }));
  };

  const selectVisibleRecipients = () => {
    const visibleIds = filteredUsers.map((user) => user.uid).filter((uid) => uid !== currentUser?.uid);
    setCompose((prev) => ({
      ...prev,
      recipientIds: Array.from(new Set([...prev.recipientIds, ...visibleIds]))
    }));
  };

  const clearVisibleRecipients = () => {
    const visibleIds = new Set(filteredUsers.map((user) => user.uid));
    setCompose((prev) => ({
      ...prev,
      recipientIds: prev.recipientIds.filter((uid) => !visibleIds.has(uid))
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

  const selectVisibleTeams = () => {
    const visibleIds = filteredTeams.map(getTeamKey).filter(Boolean);
    setCompose((prev) => ({
      ...prev,
      teamIds: Array.from(new Set([...prev.teamIds, ...visibleIds]))
    }));
  };

  const clearVisibleTeams = () => {
    const visibleIds = new Set(filteredTeams.map(getTeamKey).filter(Boolean));
    setCompose((prev) => ({
      ...prev,
      teamIds: prev.teamIds.filter((teamId) => !visibleIds.has(teamId))
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
      const actionUrl = compose.actionUrl.trim();
      if (!isValidActionUrl(actionUrl)) {
        throw new Error('invalid-action-url');
      }

      const payload: CreateErpMessageInput = {
        type: resolvedComposeRecipients.recipientScope === 'all' ? 'broadcast' : 'direct',
        title: compose.title.trim() || undefined,
        body: compose.body,
        category: compose.category.trim() || undefined,
        priority: compose.priority,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentProfile?.displayName || currentUser.email || '사용자',
        senderEmail: currentUser.email,
        recipientScope: resolvedComposeRecipients.recipientScope,
        recipientIds: resolvedComposeRecipients.recipientScope === 'users' ? resolvedComposeRecipients.recipientIds : [],
        recipientNames: resolvedComposeRecipients.recipientNames,
        pinned: compose.pinned,
        actionLabel: compose.actionLabel.trim() || null,
        actionUrl: actionUrl || null,
        expiresAt: buildExpiresAt(compose.expiresInDays)
      };

      const messageId = await messageService.createMessage(payload);
      resetCompose();
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
      else if (message === 'invalid-action-url') setStatusText('바로가기 URL은 /로 시작하는 내부 경로 또는 https:// 주소만 사용할 수 있습니다.');
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
  const selectedMessageUnread = Boolean(
    selectedMessage && currentUser?.uid && !messageService.isReadBy(selectedMessage, currentUser.uid)
  );

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
      <section className="erp-message-insight-grid" aria-label="메시지 요약">
        <div className="erp-message-insight-item">
          <span>수신</span>
          <strong>{messageStats.inbox.toLocaleString('ko-KR')}</strong>
        </div>
        <div className="erp-message-insight-item urgent">
          <span>안 읽음</span>
          <strong>{messageStats.unread.toLocaleString('ko-KR')}</strong>
        </div>
        <div className="erp-message-insight-item">
          <span>중요/긴급</span>
          <strong>{messageStats.important.toLocaleString('ko-KR')}</strong>
        </div>
        <div className="erp-message-insight-item">
          <span>보낸 메시지</span>
          <strong>{messageStats.sent.toLocaleString('ko-KR')}</strong>
        </div>
      </section>
      )}

      {!isComposeMode && (
      <section className="erp-message-workspace">
        <div className="erp-message-panel">
          <div className="erp-message-tabs" role="tablist" aria-label="메시지 필터">
            {messageTabOptions.map(({ key, label, icon }) => (
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

          <div className="erp-message-list-toolbar" aria-label="메시지 목록 도구">
            <label className="erp-message-search-field">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="제목, 내용, 보낸 사람 검색"
              />
            </label>

            <div className="erp-message-filter-grid">
              <label className="erp-message-compact-field">
                <span>중요도</span>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as MessagePriorityFilter)}
                >
                  <option value="all">전체</option>
                  <option value="urgent">긴급</option>
                  <option value="high">중요</option>
                  <option value="normal">보통</option>
                  <option value="low">낮음</option>
                </select>
              </label>

              <label className="erp-message-compact-field">
                <span>정렬</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as MessageSortMode)}
                >
                  <option value="newest">최신순</option>
                  <option value="oldest">오래된순</option>
                  <option value="priority">중요도순</option>
                  <option value="unreadFirst">안 읽음 우선</option>
                </select>
              </label>

              <button type="button" className="erp-message-icon-text-button" onClick={resetMessageFilters}>
                <FontAwesomeIcon icon={faRotateLeft} />
                초기화
              </button>
            </div>
          </div>

          <div className="erp-message-list">
            {visibleMessages.length === 0 ? (
              <div className="erp-message-empty">
                표시할 메시지가 없습니다.
                {(messageSearch || priorityFilter !== 'all') && (
                  <button type="button" className="erp-message-empty-action" onClick={resetMessageFilters}>
                    필터 초기화
                  </button>
                )}
              </div>
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
                      {message.pinned && (
                        <>
                          <FontAwesomeIcon icon={faThumbtack} />
                          <span>고정</span>
                          <span>·</span>
                        </>
                      )}
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
                    {selectedMessage.pinned && (
                      <span className="erp-message-tag pinned">
                        <FontAwesomeIcon icon={faThumbtack} />
                        고정
                      </span>
                    )}
                    {selectedMessage.expiresAt && (
                      <span className="erp-message-tag">
                        <FontAwesomeIcon icon={faClock} />
                        {selectedMessage.expiresAt.toDate().toLocaleDateString('ko-KR')} 만료
                      </span>
                    )}
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

                <div className="erp-message-detail-actions">
                  <button
                    type="button"
                    className="erp-message-secondary-button"
                    onClick={markSelectedRead}
                    disabled={!selectedMessageUnread}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    {selectedMessageUnread ? '읽음 처리' : '읽음 완료'}
                  </button>
                </div>
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
                <div className="erp-message-inline-actions">
                  <span>{compose.recipientIds.length.toLocaleString('ko-KR')}명 선택</span>
                  <button type="button" onClick={selectVisibleRecipients}>검색 결과 전체 선택</button>
                  <button type="button" onClick={clearVisibleRecipients}>검색 결과 해제</button>
                </div>
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
                <div className="erp-message-inline-actions">
                  <span>{compose.teamIds.length.toLocaleString('ko-KR')}개 팀 선택</span>
                  <button type="button" onClick={selectVisibleTeams}>검색 결과 전체 선택</button>
                  <button type="button" onClick={clearVisibleTeams}>검색 결과 해제</button>
                </div>
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
              <label className="erp-message-field full">
                <span className="erp-message-label">제목</span>
                <input
                  className="erp-message-input"
                  value={compose.title}
                  onChange={(event) => setCompose((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="비워두면 내용 첫 줄이 제목으로 사용됩니다."
                  maxLength={80}
                />
              </label>

              <label className="erp-message-field">
                <span className="erp-message-label">분류</span>
                <input
                  className="erp-message-input"
                  value={compose.category}
                  onChange={(event) => setCompose((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="업무, 공지, 현장 등"
                  maxLength={24}
                />
              </label>

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

              <label className="erp-message-field">
                <span className="erp-message-label">만료</span>
                <select
                  className="erp-message-select"
                  value={compose.expiresInDays}
                  onChange={(event) => setCompose((prev) => ({ ...prev, expiresInDays: event.target.value }))}
                >
                  <option value="">만료 없음</option>
                  <option value="1">1일 후</option>
                  <option value="7">7일 후</option>
                  <option value="30">30일 후</option>
                  <option value="90">90일 후</option>
                </select>
              </label>

              <label className="erp-message-field full">
                <span className="erp-message-label">바로가기 URL</span>
                <div className="erp-message-input-with-icon">
                  <FontAwesomeIcon icon={faLink} />
                  <input
                    value={compose.actionUrl}
                    onChange={(event) => setCompose((prev) => ({ ...prev, actionUrl: event.target.value }))}
                    placeholder="/notices 또는 https://example.com"
                  />
                </div>
                {compose.actionUrl.trim() && !isValidActionUrl(compose.actionUrl.trim()) && (
                  <span className="erp-message-helper-text error">내부 경로는 /로, 외부 링크는 https://로 시작해야 합니다.</span>
                )}
              </label>

              <label className="erp-message-field">
                <span className="erp-message-label">버튼 문구</span>
                <input
                  className="erp-message-input"
                  value={compose.actionLabel}
                  onChange={(event) => setCompose((prev) => ({ ...prev, actionLabel: event.target.value }))}
                  placeholder="바로가기"
                  maxLength={24}
                />
              </label>

              <label className="erp-message-checkbox-row">
                <input
                  type="checkbox"
                  checked={compose.pinned}
                  onChange={(event) => setCompose((prev) => ({ ...prev, pinned: event.target.checked }))}
                />
                <span>
                  <strong>상단 고정</strong>
                  <small>수신함 목록에서 우선 표시합니다.</small>
                </span>
              </label>

              <label className="erp-message-field full">
                <span className="erp-message-label">내용</span>
                <textarea
                  className="erp-message-textarea compose-body"
                  value={compose.body}
                  onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder={'전달 내용을 입력하세요.\n첫 줄은 메시지 제목으로 사용됩니다.'}
                />
                <span className="erp-message-helper-text">{compose.body.trim().length.toLocaleString('ko-KR')}자</span>
              </label>
            </div>

            <section className="erp-message-compose-preview" aria-label="발송 전 요약">
              <div>
                <strong>{compose.title.trim() || compose.body.trim().split(/\r?\n/).find(Boolean) || '제목 미리보기'}</strong>
                <span>{selectedRecipientPreview}</span>
              </div>
              <div className="erp-message-compose-preview-meta">
                <span>{compose.category.trim() || '업무'}</span>
                <span>{priorityLabels[compose.priority]}</span>
                {compose.pinned && <span>고정</span>}
                {compose.expiresInDays && <span>{compose.expiresInDays}일 후 만료</span>}
              </div>
            </section>

            <div className="erp-message-form-actions">
              {statusText && (
                <span className={`erp-message-status-text ${statusTone === 'error' ? 'error' : ''}`}>{statusText}</span>
              )}
              <button
                type="button"
                className="erp-message-secondary-button"
                onClick={resetCompose}
              >
                초기화
              </button>
              <button
                type="button"
                className="erp-message-primary-button"
                onClick={() => void sendMessage()}
                disabled={!canSend}
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
