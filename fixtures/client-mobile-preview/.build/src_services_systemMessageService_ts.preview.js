"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_systemMessageService_ts"],{

/***/ "./src/services/auditService.ts"
/*!**************************************!*\
  !*** ./src/services/auditService.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   auditService: () => (/* binding */ auditService)
/* harmony export */ });
/* harmony import */ var _firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./firestoreCrudCompat */ "./src/services/firestoreCrudCompat.ts");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types_timestamp__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../types/timestamp */ "./src/types/timestamp.ts");




const generateId = () => {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
const toTimestamp = value => {
  if (!value) return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.now();
  if (value instanceof _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.fromDate(d);
  }
  return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.now();
};
const safeJsonParse = raw => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};
const auditService = {
  // Write a log entry
  log: async logData => {
    try {
      var _logData$action, _logData$category, _logData$actorId, _logData$actorEmail, _logData$actorName, _logData$targetId, _logData$targetName;
      await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.createAuditLog)({
        id: generateId(),
        action: (_logData$action = logData.action) !== null && _logData$action !== void 0 ? _logData$action : null,
        category: (_logData$category = logData.category) !== null && _logData$category !== void 0 ? _logData$category : null,
        actorId: (_logData$actorId = logData.actorId) !== null && _logData$actorId !== void 0 ? _logData$actorId : null,
        actorEmail: (_logData$actorEmail = logData.actorEmail) !== null && _logData$actorEmail !== void 0 ? _logData$actorEmail : null,
        actorName: (_logData$actorName = logData.actorName) !== null && _logData$actorName !== void 0 ? _logData$actorName : null,
        targetId: (_logData$targetId = logData.targetId) !== null && _logData$targetId !== void 0 ? _logData$targetId : null,
        targetName: (_logData$targetName = logData.targetName) !== null && _logData$targetName !== void 0 ? _logData$targetName : null,
        details: logData.details !== undefined ? JSON.stringify(logData.details) : null,
        timestamp: new Date().toISOString()
      });
      console.log(`[Audit] ${logData.category}:${logData.action} by ${logData.actorEmail}`);
    } catch (error) {
      console.error("Failed to write audit log", error);
      // Non-blocking error
    }
  },
  // Fetch logs with basic filtering
  getLogs: async (limitCount = 100, category, actorId) => {
    try {
      const fetchLimit = Math.min(Math.max(limitCount * 5, 200), 1000);
      const constraints = [(0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.orderBy)('timestamp', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.limit)(fetchLimit)];
      if (category) constraints.unshift((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('category', '==', category));
      if (actorId) constraints.unshift((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('actorId', '==', actorId));

      // firestoreCrudCompat deliberately ignores ordering/filter arguments. A
      // direct query is required for log screens to show recent records.
      const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, 'audit_logs'), ...constraints));
      const rows = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));
      const logs = rows.map(row => {
        var _row$timestamp;
        const rawTimestamp = (_row$timestamp = row === null || row === void 0 ? void 0 : row.timestamp) !== null && _row$timestamp !== void 0 ? _row$timestamp : row === null || row === void 0 ? void 0 : row.createdAt;
        return {
          id: row !== null && row !== void 0 && row.id ? String(row.id) : undefined,
          action: row !== null && row !== void 0 && row.action ? String(row.action) : '',
          category: row !== null && row !== void 0 && row.category ? String(row.category) : '',
          actorId: row !== null && row !== void 0 && row.actorId ? String(row.actorId) : '',
          actorEmail: row !== null && row !== void 0 && row.actorEmail ? String(row.actorEmail) : '',
          actorName: row !== null && row !== void 0 && row.actorName ? String(row.actorName) : undefined,
          targetId: row !== null && row !== void 0 && row.targetId ? String(row.targetId) : undefined,
          targetName: row !== null && row !== void 0 && row.targetName ? String(row.targetName) : undefined,
          details: safeJsonParse(row === null || row === void 0 ? void 0 : row.details),
          timestamp: toTimestamp(rawTimestamp)
        };
      });
      return logs.filter(log => !category || log.category === category).filter(log => !actorId || log.actorId === actorId).sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis()).slice(0, limitCount);
    } catch (error) {
      // The fallback keeps log screens usable while a newly added composite
      // index is still being created in Firestore.
      try {
        var _data;
        const res = await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.listAllAuditLogs)({
          limit: 1000
        });
        const rawRows = res === null || res === void 0 ? void 0 : (_data = res.data) === null || _data === void 0 ? void 0 : _data.auditLogs;
        const rows = Array.isArray(rawRows) ? rawRows : [];
        return rows.map(row => {
          var _row$timestamp2;
          return {
            id: row !== null && row !== void 0 && row.id ? String(row.id) : undefined,
            action: row !== null && row !== void 0 && row.action ? String(row.action) : '',
            category: row !== null && row !== void 0 && row.category ? String(row.category) : '',
            actorId: row !== null && row !== void 0 && row.actorId ? String(row.actorId) : '',
            actorEmail: row !== null && row !== void 0 && row.actorEmail ? String(row.actorEmail) : '',
            actorName: row !== null && row !== void 0 && row.actorName ? String(row.actorName) : undefined,
            targetId: row !== null && row !== void 0 && row.targetId ? String(row.targetId) : undefined,
            targetName: row !== null && row !== void 0 && row.targetName ? String(row.targetName) : undefined,
            details: safeJsonParse(row === null || row === void 0 ? void 0 : row.details),
            timestamp: toTimestamp((_row$timestamp2 = row === null || row === void 0 ? void 0 : row.timestamp) !== null && _row$timestamp2 !== void 0 ? _row$timestamp2 : row === null || row === void 0 ? void 0 : row.createdAt)
          };
        }).filter(log => !category || log.category === category).filter(log => !actorId || log.actorId === actorId).sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis()).slice(0, limitCount);
      } catch (fallbackError) {
        console.error('Failed to fetch logs', error, fallbackError);
        return [];
      }
    }
  }
};

/***/ },

/***/ "./src/services/messageRecipientResolver.ts"
/*!**************************************************!*\
  !*** ./src/services/messageRecipientResolver.ts ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildRecipientLookups: () => (/* binding */ buildRecipientLookups),
/* harmony export */   createDefaultRecipientRule: () => (/* binding */ createDefaultRecipientRule),
/* harmony export */   getLinkedWorkersForUser: () => (/* binding */ getLinkedWorkersForUser),
/* harmony export */   getUserDisplayLabel: () => (/* binding */ getUserDisplayLabel),
/* harmony export */   normalizeRecipientRule: () => (/* binding */ normalizeRecipientRule),
/* harmony export */   parseLinkedWorkerIds: () => (/* binding */ parseLinkedWorkerIds),
/* harmony export */   resolveMessageRecipients: () => (/* binding */ resolveMessageRecipients)
/* harmony export */ });
const MESSAGE_RECIPIENT_MODES = ['global', 'users', 'allUsers', 'allWorkers', 'teamMembers', 'teamLeaders', 'relatedTeamLeaders', 'noticeTargetPositions'];
const createDefaultRecipientRule = (mode = 'users') => ({
  mode,
  recipientIds: [],
  recipientNames: [],
  teamIds: [],
  teamNames: []
});
const normalize = value => String(value !== null && value !== void 0 ? value : '').trim();
const normalizeLower = value => normalize(value).toLowerCase();
const uniqueStrings = (values = []) => Array.from(new Set(values.map(normalize).filter(Boolean)));
const normalizePositionKey = value => normalizeLower(value).replace(/[\s_-]/g, '');
const allPositionKeys = new Set(['all', '*', 'global', '전체', '전체직책', '전직책', '모든직책'].map(normalizePositionKey));
const addToMapArray = (map, key, value) => {
  map.set(key, [...(map.get(key) || []), value]);
};
const getUserDisplayLabel = user => user.displayName || user.email || user.uid;
const parseLinkedWorkerIds = raw => {
  if (Array.isArray(raw)) return uniqueStrings(raw);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? uniqueStrings(parsed) : [];
  } catch {
    return uniqueStrings(String(raw).split(','));
  }
};
const normalizeRecipientRule = (raw, fallbackMode = 'users') => {
  const rawMode = (raw === null || raw === void 0 ? void 0 : raw.mode) || fallbackMode;
  const mode = MESSAGE_RECIPIENT_MODES.includes(rawMode) ? rawMode : fallbackMode;
  return {
    mode,
    recipientIds: uniqueStrings((raw === null || raw === void 0 ? void 0 : raw.recipientIds) || []),
    recipientNames: uniqueStrings((raw === null || raw === void 0 ? void 0 : raw.recipientNames) || []),
    teamIds: uniqueStrings((raw === null || raw === void 0 ? void 0 : raw.teamIds) || []),
    teamNames: uniqueStrings((raw === null || raw === void 0 ? void 0 : raw.teamNames) || [])
  };
};
const buildRecipientLookups = data => {
  const workerById = new Map();
  const workersByUid = new Map();
  const workersByEmail = new Map();
  const teamById = new Map();
  const teamByName = new Map();
  data.workers.forEach(worker => {
    [worker.id, worker.legacyId].forEach(id => {
      const key = normalize(id);
      if (key) workerById.set(key, worker);
    });
    const uid = normalize(worker.uid);
    if (uid) addToMapArray(workersByUid, uid, worker);
    const email = normalizeLower(worker.email);
    if (email) addToMapArray(workersByEmail, email, worker);
  });
  data.teams.forEach(team => {
    [team.id, team.legacyId].forEach(id => {
      const key = normalize(id);
      if (key) teamById.set(key, team);
    });
    const name = normalize(team.name);
    if (name) teamByName.set(name, team);
  });
  return {
    workerById,
    workersByUid,
    workersByEmail,
    teamById,
    teamByName
  };
};
const getLinkedWorkersForUser = (user, data, lookups = buildRecipientLookups(data)) => {
  const linkedWorkers = [];
  const seen = new Set();
  const addWorker = worker => {
    if (!worker) return;
    const key = normalize(worker.id || worker.legacyId || worker.uid || worker.email || worker.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    linkedWorkers.push(worker);
  };
  parseLinkedWorkerIds(user.linkedWorkerIds).forEach(workerId => addWorker(lookups.workerById.get(workerId)));
  (lookups.workersByUid.get(user.uid) || []).forEach(addWorker);
  if (user.email) (lookups.workersByEmail.get(user.email.toLowerCase()) || []).forEach(addWorker);
  return linkedWorkers;
};
const resolveTeamSets = (data, lookups, teamIds = [], teamNames = [], context) => {
  const ids = new Set();
  const names = new Set();
  const addTeam = team => {
    if (!team) return;
    [team.id, team.legacyId].map(normalize).filter(Boolean).forEach(id => ids.add(id));
    const name = normalize(team.name);
    if (name) names.add(name);
  };
  [...teamIds, context === null || context === void 0 ? void 0 : context.teamId].map(normalize).filter(Boolean).forEach(id => {
    ids.add(id);
    addTeam(lookups.teamById.get(id));
  });
  [...teamNames, context === null || context === void 0 ? void 0 : context.teamName].map(normalize).filter(Boolean).forEach(name => {
    names.add(name);
    addTeam(lookups.teamByName.get(name));
  });
  return {
    ids,
    names
  };
};
const workerBelongsToTeam = (worker, teamIds, teamNames) => {
  const workerTeamIds = [worker.teamId].map(normalize).filter(Boolean);
  const workerTeamNames = [worker.teamName].map(normalize).filter(Boolean);
  return workerTeamIds.some(id => teamIds.has(id)) || workerTeamNames.some(name => teamNames.has(name));
};
const isLeaderRole = value => {
  const text = normalizeLower(value).replace(/\s+/g, '');
  return Boolean(text && (text.includes('팀장') || text.includes('반장') || text.includes('조장') || text.includes('leader') || text.includes('foreman')));
};
const getLeaderIdentitySets = teams => {
  const ids = new Set();
  const names = new Set();
  teams.forEach(team => {
    [team.leaderId].map(normalize).filter(Boolean).forEach(id => ids.add(id));
    [team.leaderName].map(normalize).filter(Boolean).forEach(name => names.add(name));
  });
  return {
    ids,
    names
  };
};
const hasWorkerIdentity = (worker, ids, names) => {
  const workerIds = [worker.id, worker.legacyId].map(normalize).filter(Boolean);
  const workerNames = [worker.name].map(normalize).filter(Boolean);
  return workerIds.some(id => ids.has(id)) || workerNames.some(name => names.has(name));
};
const workerIsTeamLeader = (worker, teams) => {
  const leaders = getLeaderIdentitySets(teams);
  return isLeaderRole(worker.role) || hasWorkerIdentity(worker, leaders.ids, leaders.names);
};
const makeUsersResult = (users, description) => {
  const uniqueUsers = Array.from(new Map(users.map(user => [user.uid, user])).values());
  return {
    recipientScope: 'users',
    recipientIds: uniqueUsers.map(user => user.uid),
    recipientNames: uniqueUsers.map(getUserDisplayLabel),
    description,
    count: uniqueUsers.length
  };
};
const makeAllUsersResult = (count, description = '전체 사용자') => ({
  recipientScope: 'all',
  recipientIds: [],
  recipientNames: ['전체 사용자'],
  description,
  count
});
const isAllPositionTarget = positions => positions.length === 0 || positions.some(position => allPositionKeys.has(normalizePositionKey(position)));
const getUserPositionKeys = (user, data, lookups) => {
  const values = [user.role, user.position, ...(Array.isArray(user.additionalPositions) ? user.additionalPositions : []), ...getLinkedWorkersForUser(user, data, lookups).map(worker => worker.role)];
  return new Set(values.map(normalizePositionKey).filter(Boolean));
};
const resolveMessageRecipients = (rule, data, context) => {
  const normalizedRule = normalizeRecipientRule(rule);
  const lookups = buildRecipientLookups(data);
  if (normalizedRule.mode === 'allUsers') {
    return makeAllUsersResult(data.users.length);
  }
  if (normalizedRule.mode === 'users' || normalizedRule.mode === 'global') {
    const selectedUsers = normalizedRule.recipientIds.map(uid => data.users.find(user => user.uid === uid)).filter(user => Boolean(user));
    if (selectedUsers.length > 0) {
      return makeUsersResult(selectedUsers, `지정 사용자 ${selectedUsers.length}명`);
    }
    return {
      recipientScope: 'users',
      recipientIds: normalizedRule.recipientIds,
      recipientNames: normalizedRule.recipientNames,
      description: `지정 사용자 ${normalizedRule.recipientIds.length}명`,
      count: normalizedRule.recipientIds.length
    };
  }
  if (normalizedRule.mode === 'allWorkers') {
    const recipients = data.users.filter(user => getLinkedWorkersForUser(user, data, lookups).length > 0);
    return makeUsersResult(recipients, `전체 작업자 계정 ${recipients.length}명`);
  }
  if (normalizedRule.mode === 'noticeTargetPositions') {
    if (!context || !Array.isArray(context.targetPositions)) {
      return makeUsersResult([], '공지 대상 직책 0명');
    }
    const targetPositions = uniqueStrings(context.targetPositions);
    if (isAllPositionTarget(targetPositions)) {
      return makeAllUsersResult(data.users.length, '공지 대상 직책 · 전체 사용자');
    }
    const targetKeys = new Set(targetPositions.map(normalizePositionKey).filter(Boolean));
    const recipients = data.users.filter(user => {
      const userPositionKeys = getUserPositionKeys(user, data, lookups);
      return Array.from(targetKeys).some(key => userPositionKeys.has(key));
    });
    return makeUsersResult(recipients, `공지 대상 직책 ${recipients.length}명`);
  }
  const useRelatedTeam = normalizedRule.mode === 'relatedTeamLeaders';
  const teamSets = resolveTeamSets(data, lookups, normalizedRule.teamIds, normalizedRule.teamNames, useRelatedTeam ? context : undefined);
  const hasTeamFilter = teamSets.ids.size > 0 || teamSets.names.size > 0;
  if (normalizedRule.mode === 'teamMembers') {
    if (!hasTeamFilter) return makeUsersResult([], '선택 팀 소속 0명');
    const recipients = data.users.filter(user => getLinkedWorkersForUser(user, data, lookups).some(worker => workerBelongsToTeam(worker, teamSets.ids, teamSets.names)));
    return makeUsersResult(recipients, `선택 팀 소속 ${recipients.length}명`);
  }
  if (normalizedRule.mode === 'teamLeaders' || normalizedRule.mode === 'relatedTeamLeaders') {
    if (normalizedRule.mode === 'relatedTeamLeaders' && !hasTeamFilter) {
      return makeUsersResult([], '로그 해당 팀장 0명');
    }
    const selectedTeams = hasTeamFilter ? data.teams.filter(team => [team.id, team.legacyId].map(normalize).some(id => teamSets.ids.has(id)) || [team.name].map(normalize).some(name => teamSets.names.has(name))) : data.teams;
    const selectedLeaderSets = getLeaderIdentitySets(selectedTeams);
    const recipients = data.users.filter(user => getLinkedWorkersForUser(user, data, lookups).some(worker => {
      const leader = workerIsTeamLeader(worker, selectedTeams);
      if (!leader) return false;
      if (!hasTeamFilter) return true;
      return workerBelongsToTeam(worker, teamSets.ids, teamSets.names) || hasWorkerIdentity(worker, selectedLeaderSets.ids, selectedLeaderSets.names);
    }));
    return makeUsersResult(recipients, normalizedRule.mode === 'relatedTeamLeaders' ? `로그 해당 팀장 ${recipients.length}명` : `팀장 ${recipients.length}명`);
  }
  return makeUsersResult([], '대상 없음');
};

/***/ },

/***/ "./src/services/messageService.ts"
/*!****************************************!*\
  !*** ./src/services/messageService.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   messageService: () => (/* binding */ messageService)
/* harmony export */ });
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");



const COLLECTION_NAME = 'erp_messages';
const DEFAULT_CATEGORY = '업무';
const safeReadAtKey = uid => uid.replace(/[^a-zA-Z0-9_-]/g, '_');
const asTimestamp = (value, fallback = firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now()) => {
  if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp) return value;
  if (value && typeof value.toDate === 'function') {
    return firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.fromDate(value.toDate());
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.fromDate(date);
  }
  return fallback;
};
const timestampMillis = value => value ? value.toMillis() : 0;
const uniqueStrings = (values = []) => Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
const deriveTitleFromBody = body => {
  const firstLine = body.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  return (firstLine || '메시지').slice(0, 80);
};
const normalizeMessage = (id, data) => {
  var _data$senderEmail;
  const now = firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now();
  return {
    id,
    type: data.type || 'direct',
    title: String(data.title || ''),
    body: String(data.body || ''),
    category: String(data.category || DEFAULT_CATEGORY),
    priority: data.priority || 'normal',
    status: data.status || 'active',
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || '알 수 없음'),
    senderEmail: (_data$senderEmail = data.senderEmail) !== null && _data$senderEmail !== void 0 ? _data$senderEmail : null,
    recipientScope: data.recipientScope || 'users',
    recipientIds: uniqueStrings(data.recipientIds || []),
    recipientNames: uniqueStrings(data.recipientNames || []),
    readBy: uniqueStrings(data.readBy || []),
    readAtBy: data.readAtBy || {},
    pinned: Boolean(data.pinned),
    actionLabel: data.actionLabel ? String(data.actionLabel) : null,
    actionUrl: data.actionUrl ? String(data.actionUrl) : null,
    createdAt: asTimestamp(data.createdAt, now),
    updatedAt: asTimestamp(data.updatedAt, now),
    expiresAt: data.expiresAt ? asTimestamp(data.expiresAt) : null,
    requiresConfirmation: data.requiresConfirmation === true,
    dueAt: data.dueAt ? asTimestamp(data.dueAt) : null
  };
};
const sortMessages = messages => [...messages].sort((left, right) => {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  return timestampMillis(right.createdAt) - timestampMillis(left.createdAt);
});
const isActiveMessage = message => {
  if (message.status === 'archived') return false;
  if (message.expiresAt && message.expiresAt.toMillis() < Date.now()) return false;
  return true;
};
const publishMergedSnapshots = (snapshots, callback, limitCount) => {
  const merged = new Map();
  snapshots.forEach(snapshot => {
    snapshot === null || snapshot === void 0 ? void 0 : snapshot.docs.forEach(docSnap => {
      const message = normalizeMessage(docSnap.id, docSnap.data());
      if (isActiveMessage(message)) merged.set(message.id, message);
    });
  });
  const messages = sortMessages(Array.from(merged.values()));
  callback(typeof limitCount === 'number' ? messages.slice(0, limitCount) : messages);
};
const subscribeMergedQueries = (queries, callback, onError, limitCount) => {
  const snapshots = queries.map(() => null);
  const failures = new Set();
  const unsubscribes = queries.map((messageQuery, index) => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.onSnapshot)(messageQuery, snapshot => {
    snapshots[index] = snapshot;
    failures.delete(index);
    if (snapshots.every(Boolean) && failures.size === 0) publishMergedSnapshots(snapshots, callback, limitCount);
  }, error => {
    failures.add(index);
    console.error('[messageService] subscription failed:', error);
    onError === null || onError === void 0 ? void 0 : onError(error);
  }));
  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
};
const isReadBy = (message, uid) => message.readBy.includes(uid);
const buildSummary = (uid, messages) => {
  const unreadMessages = messages.filter(message => !isReadBy(message, uid));
  return {
    total: messages.length,
    unread: unreadMessages.length,
    urgentUnread: unreadMessages.filter(message => message.priority === 'urgent' || message.priority === 'high').length,
    latest: messages[0]
  };
};
const messageService = {
  collectionName: COLLECTION_NAME,
  getReadAtKey: safeReadAtKey,
  isReadBy,
  getReadAt: (message, uid) => {
    var _message$readAtBy;
    return (_message$readAtBy = message.readAtBy) === null || _message$readAtBy === void 0 ? void 0 : _message$readAtBy[safeReadAtKey(uid)];
  },
  buildSummary,
  createMessage: async input => {
    var _input$title, _input$category, _input$senderEmail, _input$actionLabel, _input$actionUrl;
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      return `dev-message-${Date.now()}`;
    }
    const body = input.body.trim();
    const title = ((_input$title = input.title) === null || _input$title === void 0 ? void 0 : _input$title.trim()) || deriveTitleFromBody(body);
    const recipientIds = uniqueStrings(input.recipientIds || []);
    const recipientNames = uniqueStrings(input.recipientNames || []);
    if (!input.senderId) throw new Error('sender-required');
    if (!body) throw new Error('body-required');
    if (input.recipientScope === 'users' && recipientIds.length === 0) {
      throw new Error('recipient-required');
    }
    const now = firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now();
    const messageRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME));
    const initialReadBy = input.senderId ? [input.senderId] : [];
    const readAtBy = input.senderId ? {
      [safeReadAtKey(input.senderId)]: now
    } : {};
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.setDoc)(messageRef, {
      type: input.type,
      title,
      body,
      category: ((_input$category = input.category) === null || _input$category === void 0 ? void 0 : _input$category.trim()) || DEFAULT_CATEGORY,
      priority: input.priority || 'normal',
      status: 'active',
      senderId: input.senderId,
      senderName: input.senderName || '알 수 없음',
      senderEmail: (_input$senderEmail = input.senderEmail) !== null && _input$senderEmail !== void 0 ? _input$senderEmail : null,
      recipientScope: input.recipientScope,
      recipientIds,
      recipientNames,
      readBy: initialReadBy,
      readAtBy,
      pinned: Boolean(input.pinned),
      actionLabel: ((_input$actionLabel = input.actionLabel) === null || _input$actionLabel === void 0 ? void 0 : _input$actionLabel.trim()) || null,
      actionUrl: ((_input$actionUrl = input.actionUrl) === null || _input$actionUrl === void 0 ? void 0 : _input$actionUrl.trim()) || null,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt || null
    });
    return messageRef.id;
  },
  subscribeInbox: (uid, callback, onError, limitCount) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      callback([]);
      return () => undefined;
    }
    const directQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('recipientIds', 'array-contains', uid));
    const broadcastQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('recipientScope', '==', 'all'));
    return subscribeMergedQueries([directQuery, broadcastQuery], callback, onError, limitCount);
  },
  subscribeSent: (uid, callback, onError) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      callback([]);
      return () => undefined;
    }
    const sentQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('senderId', '==', uid));
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.onSnapshot)(sentQuery, snapshot => {
      callback(sortMessages(snapshot.docs.map(docSnap => normalizeMessage(docSnap.id, docSnap.data()))));
    }, error => {
      console.error('[messageService] sent subscription failed:', error);
      onError === null || onError === void 0 ? void 0 : onError(error);
    });
  },
  subscribeAllMessages: (callback, onError) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      callback([]);
      return () => undefined;
    }
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.onSnapshot)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), snapshot => {
      callback(sortMessages(snapshot.docs.map(docSnap => normalizeMessage(docSnap.id, docSnap.data()))));
    }, error => {
      console.error('[messageService] all subscription failed:', error);
      onError === null || onError === void 0 ? void 0 : onError(error);
    });
  },
  getRecentMessages: async (limitCount = 50) => {
    var _auth$currentUser;
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      return [];
    }
    const uid = (_auth$currentUser = _config_firebase__WEBPACK_IMPORTED_MODULE_0__.auth.currentUser) === null || _auth$currentUser === void 0 ? void 0 : _auth$currentUser.uid;
    if (!uid) return [];

    // Keep this one-shot dashboard read aligned with the least-privilege inbox
    // queries. A collection-wide query would be rejected once a protected bank
    // alert exists for another recipient.
    const [directSnapshot, broadcastSnapshot] = await Promise.all([(0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('recipientIds', 'array-contains', uid))), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('recipientScope', '==', 'all')))]);
    const merged = new Map();
    [...directSnapshot.docs, ...broadcastSnapshot.docs].forEach(docSnap => {
      const message = normalizeMessage(docSnap.id, docSnap.data());
      if (isActiveMessage(message)) merged.set(message.id, message);
    });
    return sortMessages(Array.from(merged.values())).slice(0, limitCount);
  },
  markAsRead: async (messageId, uid) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) return;
    if (!messageId || !uid) return;
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.updateDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, messageId), {
      readBy: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.arrayUnion)(uid),
      [`readAtBy.${safeReadAtKey(uid)}`]: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)(),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)()
    });
  },
  markAllAsRead: async (messages, uid) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) return;
    if (!uid) return;
    const unreadMessages = Array.from(new Map(messages.filter(message => !message.readBy.includes(uid)).map(message => [message.id, message])).values());
    if (unreadMessages.length === 0) return;
    for (let index = 0; index < unreadMessages.length; index += 450) {
      const batch = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.writeBatch)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db);
      unreadMessages.slice(index, index + 450).forEach(message => {
        batch.update((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, message.id), {
          readBy: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.arrayUnion)(uid),
          [`readAtBy.${safeReadAtKey(uid)}`]: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)(),
          updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)()
        });
      });
      await batch.commit();
    }
  },
  archiveMessage: async messageId => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) return;
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.updateDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, messageId), {
      status: 'archived',
      updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now()
    });
  }
};

/***/ },

/***/ "./src/services/systemMessageService.ts"
/*!**********************************************!*\
  !*** ./src/services/systemMessageService.ts ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS: () => (/* binding */ DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS),
/* harmony export */   SYSTEM_MESSAGE_EVENT_GROUPS: () => (/* binding */ SYSTEM_MESSAGE_EVENT_GROUPS),
/* harmony export */   SYSTEM_MESSAGE_EVENT_LABELS: () => (/* binding */ SYSTEM_MESSAGE_EVENT_LABELS),
/* harmony export */   systemMessageService: () => (/* binding */ systemMessageService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _messageService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./messageService */ "./src/services/messageService.ts");
/* harmony import */ var _auditService__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./auditService */ "./src/services/auditService.ts");
/* harmony import */ var _messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./messageRecipientResolver */ "./src/services/messageRecipientResolver.ts");
/* harmony import */ var _manpowerService__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./manpowerService */ "./src/services/manpowerService.ts");
/* harmony import */ var _teamService__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./teamService */ "./src/services/teamService.ts");
/* harmony import */ var _userService__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./userService */ "./src/services/userService.ts");








const COLLECTION_NAME = 'erp_message_settings';
const DAILY_REPORT_SETTINGS_ID = 'daily_report';
const SYSTEM_MESSAGE_EVENT_LABELS = {
  'dailyReport.created': '출력일보 저장',
  'dailyReport.updated': '출력일보 수정',
  'dailyReport.deleted': '출력일보 삭제',
  'databaseLog.created': '통합 DB 저장 로그',
  'databaseLog.updated': '통합 DB 수정 로그',
  'databaseLog.deleted': '통합 DB 삭제 로그',
  'scheduleBoard.confirmed': '현장 일정 확정',
  'scheduleBoard.updated': '현장 일정 변경',
  'scheduleBoard.deleted': '현장 일정 삭제',
  'teamSettlement.confirmed': '팀정산 확정',
  'teamSettlement.unconfirmed': '팀정산 확정 취소',
  'materialLog.created': '자재관리 저장 로그',
  'materialLog.updated': '자재관리 수정 로그',
  'materialLog.deleted': '자재관리 삭제 로그',
  'vehicleBillingLog.created': '차량 청구 저장 로그',
  'vehicleBillingLog.updated': '차량 청구 수정 로그',
  'vehicleBillingLog.deleted': '차량 청구 삭제 로그',
  'cardBillingLog.created': '카드 청구 저장 로그',
  'cardBillingLog.updated': '카드 청구 수정 로그',
  'cardBillingLog.deleted': '카드 청구 삭제 로그',
  'accommodationBillingLog.created': '숙소 청구 저장 로그',
  'accommodationBillingLog.updated': '숙소 청구 수정 로그',
  'accommodationBillingLog.deleted': '숙소 청구 삭제 로그',
  'notice.created': '공지사항 등록',
  'loginLog.login_success': '로그인 성공',
  'loginLog.login_failed': '로그인 실패',
  'loginLog.logout': '로그아웃',
  'loginLog.signup_success': '회원가입'
};
const SYSTEM_MESSAGE_EVENT_GROUPS = [{
  id: 'dailyReport',
  label: '출력일보 로그',
  description: '출력일보 저장, 수정, 삭제 이력',
  events: ['dailyReport.created', 'dailyReport.updated', 'dailyReport.deleted']
}, {
  id: 'databaseLog',
  label: '통합 DB 로그',
  description: '작업자, 팀, 현장, 회사, 계좌 변경 이력',
  events: ['databaseLog.created', 'databaseLog.updated', 'databaseLog.deleted']
}, {
  id: 'scheduleBoard',
  label: '현장 일정',
  description: '현장 일정 확정, 변경, 삭제 알림',
  events: ['scheduleBoard.confirmed', 'scheduleBoard.updated', 'scheduleBoard.deleted']
}, {
  id: 'teamSettlement',
  label: '팀정산',
  description: '팀정산 확정 및 확정 취소 알림',
  events: ['teamSettlement.confirmed', 'teamSettlement.unconfirmed']
}, {
  id: 'materialLog',
  label: '자재관리 로그',
  description: '자재 마스터, 입고, 출고 변경 이력',
  events: ['materialLog.created', 'materialLog.updated', 'materialLog.deleted']
}, {
  id: 'vehicleBillingLog',
  label: '차량 청구 로그',
  description: '차량 청구서 생성, 수정, 확정, 취소 이력',
  events: ['vehicleBillingLog.created', 'vehicleBillingLog.updated', 'vehicleBillingLog.deleted']
}, {
  id: 'cardBillingLog',
  label: '카드 청구 로그',
  description: '카드 청구서 생성, 수정, 확정, 취소 이력',
  events: ['cardBillingLog.created', 'cardBillingLog.updated', 'cardBillingLog.deleted']
}, {
  id: 'accommodationBillingLog',
  label: '숙소 청구 로그',
  description: '숙소 청구서 생성, 수정, 확정, 취소 이력',
  events: ['accommodationBillingLog.created', 'accommodationBillingLog.updated', 'accommodationBillingLog.deleted']
}, {
  id: 'notice',
  label: '공지사항',
  description: '공지사항 등록 시 대상 직책에게 메시지 발송',
  events: ['notice.created']
}, {
  id: 'loginLog',
  label: '로그인 접근 로그',
  description: '로그인, 로그아웃, 회원가입 접속 이력',
  events: ['loginLog.login_success', 'loginLog.login_failed', 'loginLog.logout', 'loginLog.signup_success']
}];
const ALL_SYSTEM_MESSAGE_EVENTS = SYSTEM_MESSAGE_EVENT_GROUPS.flatMap(group => group.events);
const DEFAULT_EVENT_SETTINGS = {
  'dailyReport.created': {
    enabled: true
  },
  'dailyReport.updated': {
    enabled: true
  },
  'dailyReport.deleted': {
    enabled: true
  },
  'databaseLog.created': {
    enabled: false
  },
  'databaseLog.updated': {
    enabled: false
  },
  'databaseLog.deleted': {
    enabled: false
  },
  'scheduleBoard.confirmed': {
    enabled: false
  },
  'scheduleBoard.updated': {
    enabled: false
  },
  'scheduleBoard.deleted': {
    enabled: false
  },
  'teamSettlement.confirmed': {
    enabled: false
  },
  'teamSettlement.unconfirmed': {
    enabled: false
  },
  'materialLog.created': {
    enabled: false
  },
  'materialLog.updated': {
    enabled: false
  },
  'materialLog.deleted': {
    enabled: false
  },
  'vehicleBillingLog.created': {
    enabled: false
  },
  'vehicleBillingLog.updated': {
    enabled: false
  },
  'vehicleBillingLog.deleted': {
    enabled: false
  },
  'cardBillingLog.created': {
    enabled: false
  },
  'cardBillingLog.updated': {
    enabled: false
  },
  'cardBillingLog.deleted': {
    enabled: false
  },
  'accommodationBillingLog.created': {
    enabled: false
  },
  'accommodationBillingLog.updated': {
    enabled: false
  },
  'accommodationBillingLog.deleted': {
    enabled: false
  },
  'notice.created': {
    enabled: false,
    recipientRule: (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.createDefaultRecipientRule)('noticeTargetPositions')
  },
  'loginLog.login_success': {
    enabled: false
  },
  'loginLog.login_failed': {
    enabled: false
  },
  'loginLog.logout': {
    enabled: false
  },
  'loginLog.signup_success': {
    enabled: false
  }
};
const DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS = {
  id: DAILY_REPORT_SETTINGS_ID,
  enabled: false,
  recipientScope: 'users',
  recipientIds: [],
  recipientNames: [],
  events: DEFAULT_EVENT_SETTINGS
};
const normalizeSettings = data => {
  const incomingEvents = (data === null || data === void 0 ? void 0 : data.events) || {};
  const normalizedEvents = ALL_SYSTEM_MESSAGE_EVENTS.reduce((events, event) => {
    var _incomingEvents$event, _incomingEvents$event2, _incomingEvents$event3;
    events[event] = {
      enabled: Boolean((_incomingEvents$event = (_incomingEvents$event2 = incomingEvents[event]) === null || _incomingEvents$event2 === void 0 ? void 0 : _incomingEvents$event2.enabled) !== null && _incomingEvents$event !== void 0 ? _incomingEvents$event : DEFAULT_EVENT_SETTINGS[event].enabled),
      recipientRule: (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.normalizeRecipientRule)((_incomingEvents$event3 = incomingEvents[event]) === null || _incomingEvents$event3 === void 0 ? void 0 : _incomingEvents$event3.recipientRule, 'global')
    };
    return events;
  }, {});
  return {
    ...DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS,
    ...(data || {}),
    id: DAILY_REPORT_SETTINGS_ID,
    recipientScope: (data === null || data === void 0 ? void 0 : data.recipientScope) === 'all' ? 'all' : 'users',
    recipientIds: Array.isArray(data === null || data === void 0 ? void 0 : data.recipientIds) ? data.recipientIds.map(String).filter(Boolean) : [],
    recipientNames: Array.isArray(data === null || data === void 0 ? void 0 : data.recipientNames) ? data.recipientNames.map(String).filter(Boolean) : [],
    events: normalizedEvents
  };
};
const formatManDay = value => Number(value || 0).toLocaleString('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const formatValue = value => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length > 0 ? value.map(formatValue).join(', ') : '-';
  if (typeof (value === null || value === void 0 ? void 0 : value.toDate) === 'function') {
    return value.toDate().toLocaleString('ko-KR');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const formatCreatedAt = value => value !== null && value !== void 0 && value.toDate ? value.toDate().toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
const buildFieldChangeLines = (changes, maxCount = 12) => {
  if (changes.length === 0) return ['- 상세 변경 항목 없음'];
  const lines = changes.slice(0, maxCount).map(change => `- ${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`);
  if (changes.length > maxCount) lines.push(`- 외 ${changes.length - maxCount}개 항목 추가 변경`);
  return lines;
};
const buildLogMessageBody = params => {
  const actor = `${params.actorName}${params.actorEmail ? ` (${params.actorEmail})` : ''}`;
  return [params.headline, `구분: ${params.eventLabel}`, `발생일시: ${params.occurredAt}`, `처리자: ${actor}`, '', ...params.identityLines, '', '변동 요약', ...params.summaryLines.map(line => `- ${line}`), '', '상세 변동내용', ...params.detailLines].join('\n');
};
const buildDailyReportBody = (event, report, log) => {
  var _log$summaryLines, _log$actor, _log$actor2;
  const actionLabel = SYSTEM_MESSAGE_EVENT_LABELS[event];
  const siteName = report.siteName || report.siteId || '현장 미지정';
  const teamName = report.teamName || report.responsibleTeamName || report.teamId || '팀 미지정';
  const workerCount = Array.isArray(report.workers) ? report.workers.length : 0;
  const summaryLines = log !== null && log !== void 0 && (_log$summaryLines = log.summaryLines) !== null && _log$summaryLines !== void 0 && _log$summaryLines.length ? log.summaryLines : [`출력일보 ${actionLabel} 처리가 완료되었습니다.`];
  const fieldChanges = (log === null || log === void 0 ? void 0 : log.fieldChanges) || [];
  const workerChanges = log === null || log === void 0 ? void 0 : log.workerChanges;
  const changedBy = (log === null || log === void 0 ? void 0 : (_log$actor = log.actor) === null || _log$actor === void 0 ? void 0 : _log$actor.name) || 'ERP 시스템';
  const changedAt = formatCreatedAt(log === null || log === void 0 ? void 0 : log.createdAt);
  const detailLines = [];
  fieldChanges.slice(0, 12).forEach(change => {
    detailLines.push(`- ${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`);
  });
  workerChanges === null || workerChanges === void 0 ? void 0 : workerChanges.added.slice(0, 8).forEach(worker => {
    var _after$manDay;
    const after = worker.after;
    detailLines.push(`- 작업자 추가: ${worker.name} / ${(_after$manDay = after === null || after === void 0 ? void 0 : after.manDay) !== null && _after$manDay !== void 0 ? _after$manDay : 0}공수 / ${(after === null || after === void 0 ? void 0 : after.workContent) || '작업내용 없음'}`);
  });
  workerChanges === null || workerChanges === void 0 ? void 0 : workerChanges.removed.slice(0, 8).forEach(worker => {
    var _before$manDay;
    const before = worker.before;
    detailLines.push(`- 작업자 삭제: ${worker.name} / ${(_before$manDay = before === null || before === void 0 ? void 0 : before.manDay) !== null && _before$manDay !== void 0 ? _before$manDay : 0}공수 / ${(before === null || before === void 0 ? void 0 : before.workContent) || '작업내용 없음'}`);
  });
  workerChanges === null || workerChanges === void 0 ? void 0 : workerChanges.updated.slice(0, 8).forEach(worker => {
    var _worker$changes;
    const fields = (_worker$changes = worker.changes) === null || _worker$changes === void 0 ? void 0 : _worker$changes.map(change => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
    detailLines.push(`- 작업자 수정: ${worker.name}${fields ? ` - ${fields}` : ''}`);
  });
  if (detailLines.length === 0) {
    detailLines.push('- 주요 변경 항목 없음');
  }
  return ['출력일보가 변동되었습니다.', `구분: ${actionLabel}`, `변경일시: ${changedAt}`, `처리자: ${changedBy}${log !== null && log !== void 0 && (_log$actor2 = log.actor) !== null && _log$actor2 !== void 0 && _log$actor2.email ? ` (${log.actor.email})` : ''}`, `일보 ID: ${report.id || (log === null || log === void 0 ? void 0 : log.reportId) || '-'}`, '', `현장: ${siteName}`, `팀: ${teamName}`, `날짜: ${report.date || '-'}`, `총공수: ${formatManDay(report.totalManDay)}공수`, `작업자: ${workerCount.toLocaleString('ko-KR')}명`, '', '변동 요약', ...summaryLines.map(line => `- ${line}`), '', '상세 변동내용', ...detailLines].join('\n');
};
const buildDatabaseLogBody = log => {
  var _log$summaryLines2;
  return buildLogMessageBody({
    headline: '통합 DB 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`databaseLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [`대상: ${log.entityLabel} / ${log.entityName}`, `대상 ID: ${log.entityId || '-'}`, log.entitySubtitle ? `식별 정보: ${log.entitySubtitle}` : '', log.siteName ? `현장: ${log.siteName}` : '', log.teamName ? `팀: ${log.teamName}` : '', log.companyName ? `회사: ${log.companyName}` : ''].filter(Boolean),
    summaryLines: (_log$summaryLines2 = log.summaryLines) !== null && _log$summaryLines2 !== void 0 && _log$summaryLines2.length ? log.summaryLines : [`${log.entityLabel} ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: buildFieldChangeLines(log.fieldChanges || [])
  });
};
const buildMaterialLogBody = log => {
  var _log$summaryLines3;
  return buildLogMessageBody({
    headline: '자재관리 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`materialLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [`대상: ${log.entityLabel} / ${log.materialName}`, `대상 ID: ${log.entityId || '-'}`, log.category ? `분류: ${log.category}` : '', log.spec ? `규격: ${log.spec}` : '', log.siteName ? `현장: ${log.siteName}` : '', log.transactionDate ? `거래일자: ${log.transactionDate}` : '', log.quantity !== undefined ? `수량: ${formatValue(log.quantity)}${log.unit ? ` ${log.unit}` : ''}` : ''].filter(Boolean),
    summaryLines: (_log$summaryLines3 = log.summaryLines) !== null && _log$summaryLines3 !== void 0 && _log$summaryLines3.length ? log.summaryLines : [`${log.entityLabel} ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: buildFieldChangeLines(log.fieldChanges || [])
  });
};
const buildVehicleBillingLogBody = log => {
  var _log$summaryLines4;
  const lineItemChanges = log.lineItemChanges || {
    added: [],
    removed: [],
    updated: []
  };
  const lineItemDetailLines = [...lineItemChanges.added.slice(0, 8).map(item => `- 청구 항목 추가: ${item.label}`), ...lineItemChanges.removed.slice(0, 8).map(item => `- 청구 항목 삭제: ${item.label}`), ...lineItemChanges.updated.slice(0, 8).map(item => {
    var _item$changes;
    const fields = (_item$changes = item.changes) === null || _item$changes === void 0 ? void 0 : _item$changes.map(change => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
    return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
  })];
  return buildLogMessageBody({
    headline: '차량 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`vehicleBillingLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [`청구서 ID: ${log.billingId || '-'}`, `차량: ${log.vehiclePlate || '차량 미지정'}`, `청구월: ${log.yearMonth || '-'}`, `청구대상: ${log.teamName || log.issuedToWorkerName || '-'}`, `상태: ${log.status || '-'}`],
    summaryLines: (_log$summaryLines4 = log.summaryLines) !== null && _log$summaryLines4 !== void 0 && _log$summaryLines4.length ? log.summaryLines : [`차량 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [...buildFieldChangeLines(log.fieldChanges || []), ...lineItemDetailLines]
  });
};
const buildCardBillingLogBody = log => {
  var _log$summaryLines5;
  const lineItemChanges = log.lineItemChanges || {
    added: [],
    removed: [],
    updated: []
  };
  const lineItemDetailLines = [...lineItemChanges.added.slice(0, 8).map(item => `- 청구 항목 추가: ${item.label}`), ...lineItemChanges.removed.slice(0, 8).map(item => `- 청구 항목 삭제: ${item.label}`), ...lineItemChanges.updated.slice(0, 8).map(item => {
    var _item$changes2;
    const fields = (_item$changes2 = item.changes) === null || _item$changes2 === void 0 ? void 0 : _item$changes2.map(change => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
    return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
  })];
  return buildLogMessageBody({
    headline: '카드 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`cardBillingLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [`청구서 ID: ${log.billingId || '-'}`, `카드: ${log.cardLabel || '카드 미지정'}`, `청구월: ${log.yearMonth || '-'}`, `청구대상: ${log.teamName || log.issuedToWorkerName || '-'}`, `상태: ${log.status || '-'}`],
    summaryLines: (_log$summaryLines5 = log.summaryLines) !== null && _log$summaryLines5 !== void 0 && _log$summaryLines5.length ? log.summaryLines : [`카드 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [...buildFieldChangeLines(log.fieldChanges || []), ...lineItemDetailLines]
  });
};
const buildAccommodationBillingLogBody = log => {
  var _log$summaryLines6;
  const lineItemChanges = log.lineItemChanges || {
    added: [],
    removed: [],
    updated: []
  };
  const lineItemDetailLines = [...lineItemChanges.added.slice(0, 8).map(item => `- 청구 항목 추가: ${item.label}`), ...lineItemChanges.removed.slice(0, 8).map(item => `- 청구 항목 삭제: ${item.label}`), ...lineItemChanges.updated.slice(0, 8).map(item => {
    var _item$changes3;
    const fields = (_item$changes3 = item.changes) === null || _item$changes3 === void 0 ? void 0 : _item$changes3.map(change => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
    return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
  })];
  return buildLogMessageBody({
    headline: '숙소 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`accommodationBillingLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [`청구서 ID: ${log.billingId || '-'}`, `청구월: ${log.yearMonth || '-'}`, `팀: ${log.teamName || '-'}`, `청구대상: ${log.issuedToWorkerName || log.teamName || '-'}`, `상태: ${log.status || '-'}`, `총 청구액: ${formatValue(log.totalAmount)}원`],
    summaryLines: (_log$summaryLines6 = log.summaryLines) !== null && _log$summaryLines6 !== void 0 && _log$summaryLines6.length ? log.summaryLines : [`숙소 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [...buildFieldChangeLines(log.fieldChanges || []), ...lineItemDetailLines]
  });
};
const buildLoginLogBody = log => {
  var _log$summaryLines7;
  return buildLogMessageBody({
    headline: '로그인 접근 로그가 생성되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`loginLog.${log.action}`],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.displayName || log.actor.email || '알 수 없는 사용자',
    actorEmail: log.actor.email,
    identityLines: [`상태: ${log.actionLabel} / ${log.status}`, `계정: ${log.actor.displayName || log.actor.email || log.email || '-'}`, `접속 방식: ${log.provider} / ${log.method}`, `접속 환경: ${log.client.browser}, ${log.client.os}, ${log.client.viewport}`, `접속 경로: ${log.client.path || '-'}`, log.errorMessage ? `실패 사유: ${log.errorCode ? `${log.errorCode} - ` : ''}${log.errorMessage}` : ''].filter(Boolean),
    summaryLines: (_log$summaryLines7 = log.summaryLines) !== null && _log$summaryLines7 !== void 0 && _log$summaryLines7.length ? log.summaryLines : [`${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [`- 브라우저: ${log.client.browser}`, `- 운영체제: ${log.client.os}`, `- 화면: ${log.client.screen || '-'}`, `- 언어/시간대: ${log.client.language || '-'} / ${log.client.timezone || '-'}`]
  });
};
const formatDateTime = value => {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('ko-KR');
  }
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? String(value || '-') : date.toLocaleString('ko-KR');
};
const uniqueText = values => Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
const noticeToMessagePriority = priority => {
  if (priority === 'urgent') return 'urgent';
  if (priority === 'important') return 'high';
  return 'normal';
};
const buildNoticeCreatedBody = notice => {
  return ['새 공지사항이 등록되었습니다.', '', '아래 버튼을 눌러 공지사항 게시판에서 전체 내용을 확인해 주세요.', ''].filter(line => line !== '').join('\n');
};
const countScheduleVehicles = assignment => {
  if (Array.isArray(assignment.vehicleLabels) && assignment.vehicleLabels.length > 0) return assignment.vehicleLabels.length;
  if (Array.isArray(assignment.vehicleIds) && assignment.vehicleIds.length > 0) return assignment.vehicleIds.length;
  return assignment.vehicleId || assignment.vehicleLabel ? 1 : 0;
};
const buildScheduleAssignmentLines = (assignments, maxCount = 10) => {
  if (assignments.length === 0) return ['- 등록된 일정 없음'];
  const lines = assignments.slice(0, maxCount).map(assignment => {
    const siteName = assignment.siteName || '현장 미지정';
    const teamName = assignment.teamName || '팀 미지정';
    const workerCount = Array.isArray(assignment.workerIds) ? assignment.workerIds.length : 0;
    const vehicleCount = countScheduleVehicles(assignment);
    const timeRange = [assignment.startTime, assignment.endTime].filter(Boolean).join('~');
    return `- ${siteName} / ${teamName} / 작업자 ${workerCount}명 / 차량 ${vehicleCount}대${timeRange ? ` / ${timeRange}` : ''}`;
  });
  if (assignments.length > maxCount) lines.push(`- 외 ${assignments.length - maxCount}건`);
  return lines;
};
const buildScheduleBoardBody = (event, payload) => {
  const currentAssignments = payload.assignments || [];
  const previousAssignments = payload.previousAssignments || [];
  const teams = uniqueText(currentAssignments.map(assignment => assignment.teamName));
  const sites = uniqueText(currentAssignments.map(assignment => assignment.siteName));
  const workerCount = currentAssignments.reduce((sum, assignment) => sum + (Array.isArray(assignment.workerIds) ? assignment.workerIds.length : 0), 0);
  const vehicleCount = currentAssignments.reduce((sum, assignment) => sum + countScheduleVehicles(assignment), 0);
  const headline = event === 'scheduleBoard.deleted' ? '현장 일정이 삭제되었습니다.' : event === 'scheduleBoard.updated' ? '현장 일정이 변경되었습니다.' : '현장 일정이 확정되었습니다.';
  return [headline, `구분: ${SYSTEM_MESSAGE_EVENT_LABELS[event]}`, `처리일시: ${formatDateTime(payload.occurredAt)}`, `일정일자: ${payload.date}`, '', '요약', `- 일정: ${currentAssignments.length.toLocaleString('ko-KR')}건`, `- 현장: ${sites.length.toLocaleString('ko-KR')}곳`, `- 팀: ${teams.length.toLocaleString('ko-KR')}개`, `- 작업자: ${workerCount.toLocaleString('ko-KR')}명`, `- 차량: ${vehicleCount.toLocaleString('ko-KR')}대`, event === 'scheduleBoard.updated' ? `- 이전 일정: ${previousAssignments.length.toLocaleString('ko-KR')}건` : '', '', '일정 상세', ...buildScheduleAssignmentLines(currentAssignments)].filter(line => line !== '').join('\n');
};
const sumSettlementAmounts = (items = []) => items.reduce((sum, item) => {
  var _item$amount;
  const amount = typeof item.amount === 'number' ? item.amount : Number(String((_item$amount = item.amount) !== null && _item$amount !== void 0 ? _item$amount : '').replace(/,/g, ''));
  return sum + (Number.isFinite(amount) ? amount : 0);
}, 0);
const formatCurrency = value => `${Math.round(value).toLocaleString('ko-KR')}원`;
const buildTeamSettlementBody = (event, doc) => {
  var _doc$summary, _doc$summary2;
  const salesAmount = sumSettlementAmounts(doc.sales);
  const purchaseAmount = sumSettlementAmounts(doc.purchases);
  const deductionAmount = sumSettlementAmounts(doc.deductions);
  const additionAmount = sumSettlementAmounts(doc.additions);
  const headline = event === 'teamSettlement.unconfirmed' ? '팀정산 확정이 취소되었습니다.' : '팀정산이 확정되었습니다.';
  return [headline, `구분: ${SYSTEM_MESSAGE_EVENT_LABELS[event]}`, `처리일시: ${formatDateTime(doc.updatedAt)}`, `정산월: ${doc.yearMonth}`, `팀: ${doc.teamName || doc.teamId || '-'}`, `확정일시: ${doc.confirmedAt ? formatDateTime(doc.confirmedAt) : '미확정'}`, '', '금액 요약', `- 매출: ${formatCurrency(salesAmount)}`, `- 매입: ${formatCurrency(purchaseAmount)}`, `- 공제: ${formatCurrency(deductionAmount)}`, `- 추가: ${formatCurrency(additionAmount)}`, `- 전월이월: ${formatCurrency(((_doc$summary = doc.summary) === null || _doc$summary === void 0 ? void 0 : _doc$summary.prevCarryover) || 0)}`, `- 입금: ${formatCurrency(((_doc$summary2 = doc.summary) === null || _doc$summary2 === void 0 ? void 0 : _doc$summary2.deposit) || 0)}`, '', '항목 수', `- 매출 ${doc.sales.length.toLocaleString('ko-KR')}건`, `- 매입 ${doc.purchases.length.toLocaleString('ko-KR')}건`, `- 공제 ${doc.deductions.length.toLocaleString('ko-KR')}건`, `- 추가 ${doc.additions.length.toLocaleString('ko-KR')}건`].join('\n');
};
let recipientDataCache = null;
const RECIPIENT_DATA_TTL = 1000 * 60 * 3;
const getRecipientData = async (fresh = false) => {
  const now = Date.now();
  if (!fresh && recipientDataCache && now - recipientDataCache.timestamp < RECIPIENT_DATA_TTL) {
    return recipientDataCache.data;
  }
  const [users, workers, teams] = await Promise.all([_userService__WEBPACK_IMPORTED_MODULE_7__.userService.getAllUsers(), _manpowerService__WEBPACK_IMPORTED_MODULE_5__.manpowerService.getWorkers(true), _teamService__WEBPACK_IMPORTED_MODULE_6__.teamService.getTeams()]);
  const data = {
    users,
    workers,
    teams
  };
  recipientDataCache = {
    data,
    timestamp: now
  };
  return data;
};
const getSettings = async () => {
  const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, DAILY_REPORT_SETTINGS_ID));
  return normalizeSettings(snap.exists() ? snap.data() : null);
};
const saveSettings = async settings => {
  const normalized = normalizeSettings(settings);
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, DAILY_REPORT_SETTINGS_ID), {
    ...normalized,
    updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
  }, {
    merge: true
  });
};
const writeAutomationMessageLog = async params => {
  var _params$context, _params$context2;
  const action = params.result === 'sent' ? 'MESSAGE_AUTOMATION_SENT' : params.result === 'failed' ? 'MESSAGE_AUTOMATION_FAILED' : 'MESSAGE_AUTOMATION_SKIPPED';
  const errorMessage = params.error instanceof Error ? params.error.message : typeof params.error === 'string' ? params.error : params.error == null ? '' : String(params.error);
  await _auditService__WEBPACK_IMPORTED_MODULE_3__.auditService.log({
    action,
    category: 'MESSAGE_AUTOMATION',
    actorId: 'system',
    actorEmail: 'system',
    actorName: 'ERP 자동 메시지',
    targetId: params.messageId || params.event,
    targetName: SYSTEM_MESSAGE_EVENT_LABELS[params.event],
    details: {
      event: params.event,
      eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[params.event],
      result: params.result,
      messageId: params.messageId || null,
      messageTitle: params.payload.title,
      priority: params.payload.priority || 'normal',
      actionUrl: params.payload.actionUrl || null,
      recipientScope: params.recipientScope || null,
      recipientIds: params.recipientIds || [],
      recipientNames: params.recipientNames || [],
      recipientCount: params.recipientScope === 'all' ? null : (params.recipientIds || []).length,
      recipientDescription: params.recipientDescription || '',
      teamId: ((_params$context = params.context) === null || _params$context === void 0 ? void 0 : _params$context.teamId) || null,
      teamName: ((_params$context2 = params.context) === null || _params$context2 === void 0 ? void 0 : _params$context2.teamName) || null,
      reason: params.reason || null,
      errorMessage: errorMessage || null
    }
  });
};
const notifyConfiguredEvent = async (event, payload, context) => {
  let recipientScope;
  let recipientIds = [];
  let recipientNames = [];
  let recipientDescription = '';
  try {
    var _settings$events$even, _settings$events$even2;
    const settings = await getSettings();
    if (!settings.enabled || !((_settings$events$even = settings.events[event]) !== null && _settings$events$even !== void 0 && _settings$events$even.enabled)) return;
    const eventRule = (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.normalizeRecipientRule)(((_settings$events$even2 = settings.events[event]) === null || _settings$events$even2 === void 0 ? void 0 : _settings$events$even2.recipientRule) || (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.createDefaultRecipientRule)('global'), 'global');
    const resolvedRecipients = eventRule.mode === 'global' ? {
      recipientScope: settings.recipientScope,
      recipientIds: settings.recipientScope === 'users' ? settings.recipientIds : [],
      recipientNames: settings.recipientScope === 'users' ? settings.recipientNames : ['전체 사용자'],
      description: settings.recipientScope === 'users' ? `지정 사용자 ${settings.recipientIds.length}명` : '전체 사용자'
    } : (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.resolveMessageRecipients)(eventRule, await getRecipientData(), context);
    recipientScope = resolvedRecipients.recipientScope;
    recipientIds = resolvedRecipients.recipientScope === 'users' ? resolvedRecipients.recipientIds : [];
    recipientNames = resolvedRecipients.recipientNames;
    recipientDescription = resolvedRecipients.description;
    if (resolvedRecipients.recipientScope === 'users' && resolvedRecipients.recipientIds.length === 0) {
      await writeAutomationMessageLog({
        result: 'skipped',
        event,
        payload,
        recipientScope,
        recipientIds,
        recipientNames,
        recipientDescription,
        context,
        reason: 'recipient-empty'
      });
      return;
    }
    const messageId = await _messageService__WEBPACK_IMPORTED_MODULE_2__.messageService.createMessage({
      type: 'system',
      title: payload.title,
      body: payload.body,
      category: '시스템',
      priority: payload.priority || 'normal',
      senderId: 'system',
      senderName: 'ERP 시스템',
      recipientScope: resolvedRecipients.recipientScope,
      recipientIds,
      recipientNames: recipientNames.length > 0 ? recipientNames : ['전체 사용자'],
      actionLabel: payload.actionLabel,
      actionUrl: payload.actionUrl
    });
    await writeAutomationMessageLog({
      result: 'sent',
      event,
      payload,
      messageId,
      recipientScope,
      recipientIds,
      recipientNames,
      recipientDescription,
      context
    });
  } catch (error) {
    await writeAutomationMessageLog({
      result: 'failed',
      event,
      payload,
      recipientScope,
      recipientIds,
      recipientNames,
      recipientDescription,
      context,
      error
    });
    throw error;
  }
};
const systemMessageService = {
  getDailyReportSettings: getSettings,
  saveDailyReportSettings: saveSettings,
  getLogAutomationSettings: getSettings,
  saveLogAutomationSettings: saveSettings,
  notifyDailyReportEvent: async (event, report, log) => {
    try {
      const reportWithTeam = report;
      await notifyConfiguredEvent(event, {
        title: '출력일보가 변동되었습니다',
        body: buildDailyReportBody(event, report, log),
        priority: event === 'dailyReport.deleted' ? 'high' : 'normal'
      }, {
        teamId: (log === null || log === void 0 ? void 0 : log.teamId) || reportWithTeam.teamId || reportWithTeam.responsibleTeamId,
        teamName: (log === null || log === void 0 ? void 0 : log.teamName) || reportWithTeam.teamName || reportWithTeam.responsibleTeamName
      });
    } catch (error) {
      console.warn('[systemMessageService] daily report notification failed:', error);
    }
  },
  notifyDatabaseLogEvent: async log => {
    try {
      const event = `databaseLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[통합 DB] ${log.entityLabel} ${log.actionLabel}: ${log.entityName}`,
        body: buildDatabaseLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal'
      }, {
        teamId: log.teamId,
        teamName: log.teamName
      });
    } catch (error) {
      console.warn('[systemMessageService] database log notification failed:', error);
    }
  },
  notifyScheduleBoardEvent: async (event, payload) => {
    try {
      const teamIds = uniqueText(payload.assignments.map(assignment => assignment.teamId));
      const teamNames = uniqueText(payload.assignments.map(assignment => assignment.teamName));
      await notifyConfiguredEvent(event, {
        title: `[현장 일정] ${SYSTEM_MESSAGE_EVENT_LABELS[event]}: ${payload.date}`,
        body: buildScheduleBoardBody(event, payload),
        priority: event === 'scheduleBoard.deleted' ? 'high' : 'normal'
      }, teamIds.length === 1 || teamNames.length === 1 ? {
        teamId: teamIds[0],
        teamName: teamNames[0]
      } : undefined);
    } catch (error) {
      console.warn('[systemMessageService] schedule board notification failed:', error);
    }
  },
  notifyTeamSettlementEvent: async (event, doc) => {
    try {
      await notifyConfiguredEvent(event, {
        title: `[팀정산] ${SYSTEM_MESSAGE_EVENT_LABELS[event]}: ${doc.teamName || doc.teamId || '-'} / ${doc.yearMonth}`,
        body: buildTeamSettlementBody(event, doc),
        priority: event === 'teamSettlement.confirmed' ? 'high' : 'normal'
      }, {
        teamId: doc.teamId,
        teamName: doc.teamName
      });
    } catch (error) {
      console.warn('[systemMessageService] team settlement notification failed:', error);
    }
  },
  notifyMaterialLogEvent: async log => {
    try {
      const event = `materialLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[자재관리] ${log.entityLabel} ${log.actionLabel}: ${log.materialName}`,
        body: buildMaterialLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal'
      });
    } catch (error) {
      console.warn('[systemMessageService] material log notification failed:', error);
    }
  },
  notifyVehicleBillingLogEvent: async log => {
    try {
      const event = `vehicleBillingLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[차량 청구] ${log.actionLabel}: ${log.vehiclePlate || '차량 미지정'} / ${log.yearMonth || '-'}`,
        body: buildVehicleBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal'
      }, {
        teamId: log.teamId,
        teamName: log.teamName
      });
    } catch (error) {
      console.warn('[systemMessageService] vehicle billing log notification failed:', error);
    }
  },
  notifyCardBillingLogEvent: async log => {
    try {
      const event = `cardBillingLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[카드 청구] ${log.actionLabel}: ${log.cardLabel || '카드 미지정'} / ${log.yearMonth || '-'}`,
        body: buildCardBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal'
      }, {
        teamId: log.teamId,
        teamName: log.teamName
      });
    } catch (error) {
      console.warn('[systemMessageService] card billing log notification failed:', error);
    }
  },
  notifyAccommodationBillingLogEvent: async log => {
    try {
      const event = `accommodationBillingLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[숙소 청구] ${log.actionLabel}: ${log.issuedToWorkerName || log.teamName || '청구대상 미지정'} / ${log.yearMonth || '-'}`,
        body: buildAccommodationBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal'
      }, {
        teamId: log.teamId,
        teamName: log.teamName
      });
    } catch (error) {
      console.warn('[systemMessageService] accommodation billing log notification failed:', error);
    }
  },
  notifyNoticeCreatedEvent: async (notice, actor) => {
    try {
      var _settings$events$even3, _settings$events$even4;
      const event = 'notice.created';
      const settings = await getSettings();
      if (!settings.enabled || !((_settings$events$even3 = settings.events[event]) !== null && _settings$events$even3 !== void 0 && _settings$events$even3.enabled)) return 'disabled';
      const data = await getRecipientData(true);
      // Notification audiences must never exceed the notice's own target positions.
      const target = (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.resolveMessageRecipients)((0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.createDefaultRecipientRule)('noticeTargetPositions'), data, {
        targetPositions: notice.targetPositions
      });
      const rule = (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.normalizeRecipientRule)(((_settings$events$even4 = settings.events[event]) === null || _settings$events$even4 === void 0 ? void 0 : _settings$events$even4.recipientRule) || (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.createDefaultRecipientRule)('noticeTargetPositions'));
      const configured = rule.mode === 'global' ? settings : (0,_messageRecipientResolver__WEBPACK_IMPORTED_MODULE_4__.resolveMessageRecipients)(rule, data, {
        targetPositions: notice.targetPositions
      });
      const recipients = data.users.filter(user => (!user.status || user.status === 'active') && (target.recipientScope === 'all' || target.recipientIds.includes(user.uid)) && (configured.recipientScope === 'all' || configured.recipientIds.includes(user.uid)));
      if (!recipients.length) return 'no-recipients';
      const payload = {
        title: `[공지사항] ${notice.title}`,
        body: buildNoticeCreatedBody(notice),
        priority: noticeToMessagePriority(notice.priority),
        actionLabel: '공지사항 바로가기',
        actionUrl: `/notices?noticeId=${encodeURIComponent(notice.id)}`
      };
      const messageId = await _messageService__WEBPACK_IMPORTED_MODULE_2__.messageService.createMessage({
        ...payload,
        type: 'direct',
        category: '공지',
        senderId: actor.uid,
        senderName: actor.name,
        recipientScope: 'users',
        recipientIds: recipients.map(user => user.uid),
        recipientNames: recipients.map(user => user.displayName || '사용자'),
        expiresAt: notice.expiresAt || null
      });
      // Logging failure must not report an already-delivered notice as unsent.
      await writeAutomationMessageLog({
        result: 'sent',
        event,
        payload,
        messageId,
        recipientScope: 'users',
        recipientIds: recipients.map(user => user.uid),
        recipientNames: recipients.map(user => user.displayName || '사용자'),
        context: {
          targetPositions: notice.targetPositions
        }
      }).catch(() => undefined);
      return 'sent';
    } catch (error) {
      console.warn('[systemMessageService] notice notification failed:', error);
      return 'failed';
    }
  },
  notifyLoginLogEvent: async log => {
    try {
      const event = `loginLog.${log.action}`;
      await notifyConfiguredEvent(event, {
        title: `[로그인] ${log.actionLabel}: ${log.actor.displayName || log.actor.email || log.email || '알 수 없는 사용자'}`,
        body: buildLoginLogBody(log),
        priority: log.action === 'login_failed' ? 'high' : 'normal'
      });
    } catch (error) {
      console.warn('[systemMessageService] login log notification failed:', error);
    }
  }
};

/***/ },

/***/ "./src/services/teamFirestoreService.ts"
/*!**********************************************!*\
  !*** ./src/services/teamFirestoreService.ts ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   teamFirestoreService: () => (/* binding */ teamFirestoreService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types_zod_teamSchema__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types/zod/teamSchema */ "./src/types/zod/teamSchema.ts");
/* harmony import */ var _utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/firestoreConverter */ "./src/utils/firestoreConverter.ts");
/* harmony import */ var _utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/stripUndefinedFields */ "./src/utils/stripUndefinedFields.ts");
/* harmony import */ var _utils_swal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/swal */ "./src/utils/swal.ts");






const COLLECTION_NAME = 'teams';
const teamConverter = (0,_utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_3__.createConverter)(_types_zod_teamSchema__WEBPACK_IMPORTED_MODULE_2__.TeamSchema);
const teamFirestoreService = {
  getCollection() {
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME).withConverter(teamConverter);
  },
  async getTeam(id) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id).withConverter(teamConverter);
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(docRef);
    return snap.exists() ? snap.data() : null;
  },
  async getTeams() {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    return snap.docs.map(d => d.data());
  },
  /**
   * 특정 업체의 팀 목록 조회
   */
  async getTeamsByCompany(companyId) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('companyId', '==', companyId), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    return snap.docs.map(d => d.data());
  },
  async addTeam(data) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME)).withConverter(teamConverter);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(docRef, {
      ...data,
      createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)(),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.saved('팀', 1);
    return docRef.id;
  },
  async updateTeam(id, data) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id).withConverter(teamConverter);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.updateDoc)(docRef, {
      ...(0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_4__.stripUndefinedFields)(data),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.updated('팀');
  },
  async deleteTeam(id) {
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.deleteDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id));
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.deleted('팀', 1);
  },
  // 누적 공수 증가/감소
  async incrementManDay(id, amount) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.updateDoc)(docRef, {
      totalManDay: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.increment)(amount),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
  }
};

/***/ },

/***/ "./src/services/teamService.ts"
/*!*************************************!*\
  !*** ./src/services/teamService.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   teamService: () => (/* binding */ teamService)
/* harmony export */ });
/* harmony import */ var _teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./teamScopedReadService */ "./src/services/teamScopedReadService.ts");
/* harmony import */ var _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./teamFirestoreService */ "./src/services/teamFirestoreService.ts");
/* harmony import */ var _databaseLogService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./databaseLogService */ "./src/services/databaseLogService.ts");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/stripUndefinedFields */ "./src/utils/stripUndefinedFields.ts");






const snapshotTeam = (id, data) => ({
  id,
  ...(0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(data)
});
const clearTeamListCache = _teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__.invalidateTeamScopedCache;
const getCachedTeams = () => _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.getTeams();
const logTeamChange = async (action, before, after, source = 'teamService') => {
  await _databaseLogService__WEBPACK_IMPORTED_MODULE_2__.databaseLogService.safeCreateLog({
    action,
    entityType: 'team',
    before,
    after,
    source
  });
};
const teamService = {
  addTeam: async team => {
    const normalizedTeam = {
      ...team
    };
    if (typeof normalizedTeam.iconKey !== 'string') {
      normalizedTeam.iconKey = '';
    }
    if (!normalizedTeam.iconKey && typeof normalizedTeam.icon === 'string') {
      normalizedTeam.iconKey = normalizedTeam.icon;
    }
    const id = await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.addTeam(normalizedTeam);
    clearTeamListCache();
    await logTeamChange('created', null, snapshotTeam(id, normalizedTeam), 'teamService.addTeam');
    return id;
  },
  updateTeam: async (id, team) => {
    const existing = await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.getTeam(id);
    const nameChanged = team.name && existing && existing.name !== team.name;
    const colorChanged = team.color && existing && existing.color !== team.color;
    const normalizedUpdates = {
      ...team
    };
    if (typeof normalizedUpdates.iconKey !== 'string' && normalizedUpdates.iconKey !== undefined) {
      delete normalizedUpdates.iconKey;
    }
    if (!normalizedUpdates.iconKey && typeof normalizedUpdates.icon === 'string') {
      normalizedUpdates.iconKey = normalizedUpdates.icon;
    }
    await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.updateTeam(id, normalizedUpdates);
    clearTeamListCache();
    await logTeamChange('updated', existing ? snapshotTeam(id, existing) : null, snapshotTeam(id, {
      ...(existing ? existing : {}),
      ...(0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(normalizedUpdates)
    }), 'teamService.updateTeam');

    // Sync team name to workers
    if (nameChanged && team.name) {
      try {
        const {
          manpowerService
        } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./manpowerService */ "./src/services/manpowerService.ts"));
        await manpowerService.updateWorkersTeamName(id, team.name);
      } catch (e) {
        console.error("Failed to sync team name to workers:", e);
      }
    }
    if (colorChanged && team.color) {
      try {
        const [{
          manpowerService
        }, {
          siteService
        }] = await Promise.all([Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./manpowerService */ "./src/services/manpowerService.ts")), __webpack_require__.e(/*! import() */ "src_services_siteService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./siteService */ "./src/services/siteService.ts"))]);
        await Promise.all([manpowerService.updateWorkersTeamColor(id, team.color), siteService.updateSitesColorByResponsibleTeam(id, team.color, team.name || (existing === null || existing === void 0 ? void 0 : existing.name))]);
      } catch (e) {
        console.error("Failed to sync team color:", e);
      }
    }
  },
  deleteTeam: async id => {
    const existing = await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.getTeam(id);
    await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.deleteTeam(id);
    clearTeamListCache();
    await logTeamChange('deleted', existing ? snapshotTeam(id, existing) : null, null, 'teamService.deleteTeam');
  },
  getTeams: async () => {
    const scoped = await (0,_teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__.getTeamScopedRows)('teams');
    if (scoped !== null) return scoped;
    return getCachedTeams();
  },
  getTeamByName: async name => {
    const teams = await getCachedTeams();
    return teams.find(t => t.name === name) || null;
  },
  getTeam: async id => {
    return _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.getTeam(id);
  },
  getTeamsPaginated: async (limitCount, lastDoc = null) => {
    const {
      query,
      collection,
      orderBy,
      limit,
      startAfter,
      getDocs
    } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js"));
    let q = query(collection(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'teams'), orderBy('createdAt', 'desc'), limit(limitCount));
    if (lastDoc) {
      q = query(collection(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'teams'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
    }
    const snap = await getDocs(q);
    return {
      teams: snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })),
      lastDoc: snap.docs[snap.docs.length - 1]
    };
  },
  incrementManDay: async (teamId, amount) => {
    await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.incrementManDay(teamId, amount);
  },
  updateTeamsBatch: async (ids, updates) => {
    const beforeRows = await Promise.all(ids.map(async id => {
      const team = await _teamFirestoreService__WEBPACK_IMPORTED_MODULE_1__.teamFirestoreService.getTeam(id);
      return team ? snapshotTeam(id, team) : null;
    }));
    const cleanedUpdates = (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(updates);
    const updatedAt = firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now();
    const batch = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.writeBatch)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db);
    ids.forEach(id => {
      const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'teams', id);
      batch.update(docRef, {
        ...cleanedUpdates,
        updatedAt
      });
    });
    await batch.commit();
    clearTeamListCache();
    await Promise.all(beforeRows.map(before => before ? logTeamChange('updated', before, {
      ...before,
      ...cleanedUpdates,
      updatedAt
    }, 'teamService.updateTeamsBatch') : Promise.resolve()));
  }
};

/***/ },

/***/ "./src/types/timestamp.ts"
/*!********************************!*\
  !*** ./src/types/timestamp.ts ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Timestamp: () => (/* binding */ Timestamp)
/* harmony export */ });
class Timestamp {
  constructor(millis) {
    this._millis = void 0;
    this._millis = millis;
  }
  static fromDate(date) {
    return new Timestamp(date.getTime());
  }
  static fromMillis(millis) {
    return new Timestamp(millis);
  }
  static now() {
    return new Timestamp(Date.now());
  }
  toDate() {
    return new Date(this._millis);
  }
  toMillis() {
    return this._millis;
  }
  get seconds() {
    return Math.floor(this._millis / 1000);
  }
  get nanoseconds() {
    return this._millis % 1000 * 1000000;
  }
}

/***/ },

/***/ "./src/types/zod/teamSchema.ts"
/*!*************************************!*\
  !*** ./src/types/zod/teamSchema.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SupportModelSchema: () => (/* binding */ SupportModelSchema),
/* harmony export */   TeamSchema: () => (/* binding */ TeamSchema),
/* harmony export */   TeamStatusSchema: () => (/* binding */ TeamStatusSchema)
/* harmony export */ });
/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! zod */ "./node_modules/zod/v3/types.js");

const TeamStatusSchema = zod__WEBPACK_IMPORTED_MODULE_0__["enum"](['active', 'waiting', 'closed']);
const SupportModelSchema = zod__WEBPACK_IMPORTED_MODULE_0__["enum"](['man_day', 'fixed']);
const TeamSchema = zod__WEBPACK_IMPORTED_MODULE_0__.object({
  id: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  legacyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  name: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, '\uD300\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
  type: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, '\uD300 \uC720\uD615\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
  leaderId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  leaderName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  companyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  companyName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  parentTeamId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  parentTeamName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  memberCount: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().default(0),
  memberIds: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  memberNames: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  siteIds: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  siteNames: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  assignedSiteId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  assignedSiteName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  assignedWorkers: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  totalManDay: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().default(0),
  status: TeamStatusSchema.default('active'),
  supportRate: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().nullable(),
  supportModel: SupportModelSchema.optional().nullable(),
  supportDescription: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  serviceRate: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().nullable(),
  serviceModel: SupportModelSchema.optional().nullable(),
  serviceDescription: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  defaultSalaryModel: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  bankName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  accountNumber: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  accountHolder: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  color: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  icon: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  iconKey: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  role: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  createdAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional(),
  updatedAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional()
});

/***/ }

}]);