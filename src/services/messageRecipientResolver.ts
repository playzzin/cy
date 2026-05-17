import type { UserData } from './userService';
import type { Worker } from './manpowerService';
import type { Team } from './teamService';
import type { ErpMessageRecipientScope } from '../types/erpMessage';

export type MessageRecipientMode =
  | 'global'
  | 'users'
  | 'allUsers'
  | 'allWorkers'
  | 'teamMembers'
  | 'teamLeaders'
  | 'relatedTeamLeaders';

export interface MessageRecipientRule {
  mode: MessageRecipientMode;
  recipientIds: string[];
  recipientNames: string[];
  teamIds: string[];
  teamNames: string[];
}

export interface MessageRecipientContext {
  teamId?: string | null;
  teamName?: string | null;
}

export interface MessageRecipientData {
  users: UserData[];
  workers: Worker[];
  teams: Team[];
}

export interface ResolvedMessageRecipients {
  recipientScope: ErpMessageRecipientScope;
  recipientIds: string[];
  recipientNames: string[];
  description: string;
  count: number;
}

interface RecipientLookups {
  workerById: Map<string, Worker>;
  workersByUid: Map<string, Worker[]>;
  workersByEmail: Map<string, Worker[]>;
  teamById: Map<string, Team>;
  teamByName: Map<string, Team>;
}

const MESSAGE_RECIPIENT_MODES: MessageRecipientMode[] = [
  'global',
  'users',
  'allUsers',
  'allWorkers',
  'teamMembers',
  'teamLeaders',
  'relatedTeamLeaders',
];

export const createDefaultRecipientRule = (
  mode: MessageRecipientMode = 'users'
): MessageRecipientRule => ({
  mode,
  recipientIds: [],
  recipientNames: [],
  teamIds: [],
  teamNames: [],
});

const normalize = (value: unknown): string => String(value ?? '').trim();
const normalizeLower = (value: unknown): string => normalize(value).toLowerCase();

const uniqueStrings = (values: unknown[] = []): string[] =>
  Array.from(new Set(values.map(normalize).filter(Boolean)));

const addToMapArray = <T>(map: Map<string, T[]>, key: string, value: T) => {
  map.set(key, [...(map.get(key) || []), value]);
};

export const getUserDisplayLabel = (user: UserData): string =>
  user.displayName || user.email || user.uid;

export const parseLinkedWorkerIds = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return uniqueStrings(raw);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? uniqueStrings(parsed) : [];
  } catch {
    return uniqueStrings(String(raw).split(','));
  }
};

export const normalizeRecipientRule = (
  raw?: Partial<MessageRecipientRule> | null,
  fallbackMode: MessageRecipientMode = 'users'
): MessageRecipientRule => {
  const rawMode = raw?.mode || fallbackMode;
  const mode = MESSAGE_RECIPIENT_MODES.includes(rawMode) ? rawMode : fallbackMode;

  return {
    mode,
    recipientIds: uniqueStrings(raw?.recipientIds || []),
    recipientNames: uniqueStrings(raw?.recipientNames || []),
    teamIds: uniqueStrings(raw?.teamIds || []),
    teamNames: uniqueStrings(raw?.teamNames || []),
  };
};

export const buildRecipientLookups = (data: MessageRecipientData): RecipientLookups => {
  const workerById = new Map<string, Worker>();
  const workersByUid = new Map<string, Worker[]>();
  const workersByEmail = new Map<string, Worker[]>();
  const teamById = new Map<string, Team>();
  const teamByName = new Map<string, Team>();

  data.workers.forEach((worker) => {
    [worker.id, worker.legacyId].forEach((id) => {
      const key = normalize(id);
      if (key) workerById.set(key, worker);
    });

    const uid = normalize(worker.uid);
    if (uid) addToMapArray(workersByUid, uid, worker);

    const email = normalizeLower(worker.email);
    if (email) addToMapArray(workersByEmail, email, worker);
  });

  data.teams.forEach((team) => {
    [team.id, team.legacyId].forEach((id) => {
      const key = normalize(id);
      if (key) teamById.set(key, team);
    });

    const name = normalize(team.name);
    if (name) teamByName.set(name, team);
  });

  return { workerById, workersByUid, workersByEmail, teamById, teamByName };
};

export const getLinkedWorkersForUser = (
  user: UserData,
  data: MessageRecipientData,
  lookups = buildRecipientLookups(data)
): Worker[] => {
  const linkedWorkers: Worker[] = [];
  const seen = new Set<string>();

  const addWorker = (worker?: Worker | null) => {
    if (!worker) return;
    const key = normalize(worker.id || worker.legacyId || worker.uid || worker.email || worker.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    linkedWorkers.push(worker);
  };

  parseLinkedWorkerIds(user.linkedWorkerIds).forEach((workerId) => addWorker(lookups.workerById.get(workerId)));
  (lookups.workersByUid.get(user.uid) || []).forEach(addWorker);
  if (user.email) (lookups.workersByEmail.get(user.email.toLowerCase()) || []).forEach(addWorker);

  return linkedWorkers;
};

const resolveTeamSets = (
  data: MessageRecipientData,
  lookups: RecipientLookups,
  teamIds: string[] = [],
  teamNames: string[] = [],
  context?: MessageRecipientContext
) => {
  const ids = new Set<string>();
  const names = new Set<string>();

  const addTeam = (team?: Team | null) => {
    if (!team) return;
    [team.id, team.legacyId].map(normalize).filter(Boolean).forEach((id) => ids.add(id));
    const name = normalize(team.name);
    if (name) names.add(name);
  };

  [...teamIds, context?.teamId].map(normalize).filter(Boolean).forEach((id) => {
    ids.add(id);
    addTeam(lookups.teamById.get(id));
  });

  [...teamNames, context?.teamName].map(normalize).filter(Boolean).forEach((name) => {
    names.add(name);
    addTeam(lookups.teamByName.get(name));
  });

  return { ids, names };
};

const workerBelongsToTeam = (worker: Worker, teamIds: Set<string>, teamNames: Set<string>): boolean => {
  const workerTeamIds = [worker.teamId].map(normalize).filter(Boolean);
  const workerTeamNames = [worker.teamName].map(normalize).filter(Boolean);
  return workerTeamIds.some((id) => teamIds.has(id)) || workerTeamNames.some((name) => teamNames.has(name));
};

const isLeaderRole = (value: unknown): boolean => {
  const text = normalizeLower(value).replace(/\s+/g, '');
  return Boolean(text && (
    text.includes('팀장') ||
    text.includes('반장') ||
    text.includes('조장') ||
    text.includes('leader') ||
    text.includes('foreman')
  ));
};

const getLeaderIdentitySets = (teams: Team[]) => {
  const ids = new Set<string>();
  const names = new Set<string>();

  teams.forEach((team) => {
    [team.leaderId].map(normalize).filter(Boolean).forEach((id) => ids.add(id));
    [team.leaderName].map(normalize).filter(Boolean).forEach((name) => names.add(name));
  });

  return { ids, names };
};

const hasWorkerIdentity = (worker: Worker, ids: Set<string>, names: Set<string>): boolean => {
  const workerIds = [worker.id, worker.legacyId].map(normalize).filter(Boolean);
  const workerNames = [worker.name].map(normalize).filter(Boolean);
  return workerIds.some((id) => ids.has(id)) || workerNames.some((name) => names.has(name));
};

const workerIsTeamLeader = (worker: Worker, teams: Team[]): boolean => {
  const leaders = getLeaderIdentitySets(teams);
  return isLeaderRole(worker.role) || hasWorkerIdentity(worker, leaders.ids, leaders.names);
};

const makeUsersResult = (users: UserData[], description: string): ResolvedMessageRecipients => {
  const uniqueUsers = Array.from(new Map(users.map((user) => [user.uid, user])).values());
  return {
    recipientScope: 'users',
    recipientIds: uniqueUsers.map((user) => user.uid),
    recipientNames: uniqueUsers.map(getUserDisplayLabel),
    description,
    count: uniqueUsers.length,
  };
};

export const resolveMessageRecipients = (
  rule: MessageRecipientRule,
  data: MessageRecipientData,
  context?: MessageRecipientContext
): ResolvedMessageRecipients => {
  const normalizedRule = normalizeRecipientRule(rule);
  const lookups = buildRecipientLookups(data);

  if (normalizedRule.mode === 'allUsers') {
    return {
      recipientScope: 'all',
      recipientIds: [],
      recipientNames: ['전체 사용자'],
      description: '전체 사용자',
      count: data.users.length,
    };
  }

  if (normalizedRule.mode === 'users' || normalizedRule.mode === 'global') {
    const selectedUsers = normalizedRule.recipientIds
      .map((uid) => data.users.find((user) => user.uid === uid))
      .filter((user): user is UserData => Boolean(user));

    if (selectedUsers.length > 0) {
      return makeUsersResult(selectedUsers, `지정 사용자 ${selectedUsers.length}명`);
    }

    return {
      recipientScope: 'users',
      recipientIds: normalizedRule.recipientIds,
      recipientNames: normalizedRule.recipientNames,
      description: `지정 사용자 ${normalizedRule.recipientIds.length}명`,
      count: normalizedRule.recipientIds.length,
    };
  }

  if (normalizedRule.mode === 'allWorkers') {
    const recipients = data.users.filter((user) =>
      getLinkedWorkersForUser(user, data, lookups).length > 0
    );
    return makeUsersResult(recipients, `전체 작업자 계정 ${recipients.length}명`);
  }

  const useRelatedTeam = normalizedRule.mode === 'relatedTeamLeaders';
  const teamSets = resolveTeamSets(
    data,
    lookups,
    normalizedRule.teamIds,
    normalizedRule.teamNames,
    useRelatedTeam ? context : undefined
  );
  const hasTeamFilter = teamSets.ids.size > 0 || teamSets.names.size > 0;

  if (normalizedRule.mode === 'teamMembers') {
    if (!hasTeamFilter) return makeUsersResult([], '선택 팀 소속 0명');

    const recipients = data.users.filter((user) =>
      getLinkedWorkersForUser(user, data, lookups).some((worker) =>
        workerBelongsToTeam(worker, teamSets.ids, teamSets.names)
      )
    );
    return makeUsersResult(recipients, `선택 팀 소속 ${recipients.length}명`);
  }

  if (normalizedRule.mode === 'teamLeaders' || normalizedRule.mode === 'relatedTeamLeaders') {
    if (normalizedRule.mode === 'relatedTeamLeaders' && !hasTeamFilter) {
      return makeUsersResult([], '로그 해당 팀장 0명');
    }

    const selectedTeams = hasTeamFilter
      ? data.teams.filter((team) =>
        [team.id, team.legacyId].map(normalize).some((id) => teamSets.ids.has(id)) ||
        [team.name].map(normalize).some((name) => teamSets.names.has(name))
      )
      : data.teams;
    const selectedLeaderSets = getLeaderIdentitySets(selectedTeams);

    const recipients = data.users.filter((user) =>
      getLinkedWorkersForUser(user, data, lookups).some((worker) => {
        const leader = workerIsTeamLeader(worker, selectedTeams);
        if (!leader) return false;
        if (!hasTeamFilter) return true;
        return workerBelongsToTeam(worker, teamSets.ids, teamSets.names) ||
          hasWorkerIdentity(worker, selectedLeaderSets.ids, selectedLeaderSets.names);
      })
    );

    return makeUsersResult(
      recipients,
      normalizedRule.mode === 'relatedTeamLeaders'
        ? `로그 해당 팀장 ${recipients.length}명`
        : `팀장 ${recipients.length}명`
    );
  }

  return makeUsersResult([], '대상 없음');
};
