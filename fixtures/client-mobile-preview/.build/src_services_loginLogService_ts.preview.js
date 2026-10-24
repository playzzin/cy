"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_loginLogService_ts"],{

/***/ "./src/services/loginLogService.ts"
/*!*****************************************!*\
  !*** ./src/services/loginLogService.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loginLogService: () => (/* binding */ loginLogService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");
/* harmony import */ var _utils_loginLogLabels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/loginLogLabels */ "./src/utils/loginLogLabels.ts");




const COLLECTION_NAME = 'login_logs';
const DEV_STORAGE_KEY = 'cy_dev_login_logs_v1';
const DEV_LOG_CHANGED_EVENT = 'cy:login-log-changed';
const MAX_LOGS = 500;
const ACTION_LABELS = {
  login_success: '로그인 성공',
  login_failed: '로그인 실패',
  logout: '로그아웃',
  signup_success: '회원가입',
  session_access: '앱 재접속'
};
const STATUS_LABELS = {
  success: '성공',
  failed: '실패',
  info: '정보'
};
const sanitizeText = (value, fallback = '') => {
  const text = String(value !== null && value !== void 0 ? value : '').trim();
  return text || fallback;
};
const parseBrowser = userAgent => {
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) return 'Opera';
  if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
  return userAgent ? 'Unknown Browser' : 'Unknown';
};
const parseOs = (userAgent, platform) => {
  const source = `${userAgent} ${platform}`;
  if (/Windows/i.test(source)) return 'Windows';
  if (/iPhone|iPad|iPod/i.test(source)) return 'iOS';
  if (/Mac OS|MacIntel|Macintosh/i.test(source)) return 'macOS';
  if (/Android/i.test(source)) return 'Android';
  if (/Linux/i.test(source)) return 'Linux';
  return source.trim() ? 'Unknown OS' : 'Unknown';
};
const resolveClient = () => {
  var _window$screen, _window$screen2;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'server',
      browser: 'Server',
      os: 'Server',
      platform: 'server',
      language: 'ko-KR',
      timezone: 'Asia/Seoul',
      path: '',
      referrer: '',
      screen: '',
      viewport: ''
    };
  }
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  return {
    userAgent,
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent, platform),
    platform,
    language: navigator.language || '',
    timezone,
    // Query strings and fragments can contain login codes or private searches.
    path: window.location.pathname,
    referrer: safeReferrer(document.referrer),
    screen: `${((_window$screen = window.screen) === null || _window$screen === void 0 ? void 0 : _window$screen.width) || 0}x${((_window$screen2 = window.screen) === null || _window$screen2 === void 0 ? void 0 : _window$screen2.height) || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`
  };
};
const resolveActor = input => {
  var _input$user, _input$user2;
  const user = input.action === 'login_failed' ? (_input$user = input.user) !== null && _input$user !== void 0 ? _input$user : null : (_input$user2 = input.user) !== null && _input$user2 !== void 0 ? _input$user2 : (0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)() ? (0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.createDevAdminUser)() : _config_firebase__WEBPACK_IMPORTED_MODULE_1__.auth.currentUser;
  return {
    uid: (user === null || user === void 0 ? void 0 : user.uid) || null,
    email: input.email || (user === null || user === void 0 ? void 0 : user.email) || null,
    displayName: (user === null || user === void 0 ? void 0 : user.displayName) || (user === null || user === void 0 ? void 0 : user.email) || input.email || null,
    photoURL: (user === null || user === void 0 ? void 0 : user.photoURL) || null
  };
};
const resolveStatus = (action, status) => {
  if (status) return status;
  if (action === 'login_failed') return 'failed';
  if (action === 'logout') return 'info';
  return 'success';
};
const buildSummaryLines = log => {
  const actorName = log.actor.displayName || log.actor.email || '알 수 없는 사용자';
  const lines = [`${ACTION_LABELS[log.action]} 기록이 저장되었습니다.`, `대상 계정: ${actorName}${log.actor.email && log.actor.email !== actorName ? ` (${log.actor.email})` : ''}`, `접속 방식: ${(0,_utils_loginLogLabels__WEBPACK_IMPORTED_MODULE_3__.loginProviderLabel)(log.provider)} / ${(0,_utils_loginLogLabels__WEBPACK_IMPORTED_MODULE_3__.loginMethodLabel)(log.method)}`, `접속 환경: ${log.client.browser}, ${log.client.os}, ${log.client.viewport}`, `접속 경로: ${log.client.path || '-'}`];
  if (log.errorMessage) {
    lines.push(`실패 사유: ${log.errorCode ? `${log.errorCode} - ` : ''}${log.errorMessage}`);
  }
  return lines;
};
const stripUndefined = value => {
  if (Array.isArray(value)) return value.map(entry => stripUndefined(entry));
  if (value && typeof value === 'object') {
    if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp) return value;
    if (typeof value.toDate === 'function') return value;
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, stripUndefined(entry)]));
  }
  return value === undefined ? null : value;
};
const normalizeLog = (id, data) => {
  var _data$actor, _data$actor2, _data$actor3, _data$actor4, _data$actor5, _data$actor6, _data$client, _data$client2, _data$client3, _data$client4, _data$client5, _data$client6, _data$client7, _data$client8, _data$client9, _data$client0;
  return {
    id,
    action: data.action || 'login_success',
    actionLabel: data.actionLabel || ACTION_LABELS[data.action] || '로그인',
    status: data.status || 'success',
    provider: String(data.provider || 'unknown'),
    method: String(data.method || 'unknown'),
    actor: {
      uid: ((_data$actor = data.actor) === null || _data$actor === void 0 ? void 0 : _data$actor.uid) || null,
      email: ((_data$actor2 = data.actor) === null || _data$actor2 === void 0 ? void 0 : _data$actor2.email) || data.email || null,
      displayName: ((_data$actor3 = data.actor) === null || _data$actor3 === void 0 ? void 0 : _data$actor3.displayName) || ((_data$actor4 = data.actor) === null || _data$actor4 === void 0 ? void 0 : _data$actor4.email) || data.email || null,
      photoURL: ((_data$actor5 = data.actor) === null || _data$actor5 === void 0 ? void 0 : _data$actor5.photoURL) || null
    },
    email: data.email || ((_data$actor6 = data.actor) === null || _data$actor6 === void 0 ? void 0 : _data$actor6.email) || null,
    summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
    summaryText: String(data.summaryText || ''),
    errorCode: data.errorCode || null,
    errorMessage: data.errorMessage || null,
    client: {
      userAgent: String(((_data$client = data.client) === null || _data$client === void 0 ? void 0 : _data$client.userAgent) || ''),
      browser: String(((_data$client2 = data.client) === null || _data$client2 === void 0 ? void 0 : _data$client2.browser) || 'Unknown'),
      os: String(((_data$client3 = data.client) === null || _data$client3 === void 0 ? void 0 : _data$client3.os) || 'Unknown'),
      platform: String(((_data$client4 = data.client) === null || _data$client4 === void 0 ? void 0 : _data$client4.platform) || ''),
      language: String(((_data$client5 = data.client) === null || _data$client5 === void 0 ? void 0 : _data$client5.language) || ''),
      timezone: String(((_data$client6 = data.client) === null || _data$client6 === void 0 ? void 0 : _data$client6.timezone) || ''),
      path: String(((_data$client7 = data.client) === null || _data$client7 === void 0 ? void 0 : _data$client7.path) || ''),
      referrer: String(((_data$client8 = data.client) === null || _data$client8 === void 0 ? void 0 : _data$client8.referrer) || ''),
      screen: String(((_data$client9 = data.client) === null || _data$client9 === void 0 ? void 0 : _data$client9.screen) || ''),
      viewport: String(((_data$client0 = data.client) === null || _data$client0 === void 0 ? void 0 : _data$client0.viewport) || '')
    },
    createdAt: normalizeTimestamp(data.createdAt, data.createdAtIso),
    createdAtIso: String(data.createdAtIso || '')
  };
};
function safeReferrer(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}
function normalizeTimestamp(value, iso) {
  if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp) return value;
  const date = new Date(String(iso || ''));
  return Number.isNaN(date.getTime()) ? firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.fromMillis(0) : firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.fromDate(date);
}
const readDevLogs = limitCount => {
  const rows = JSON.parse(window.localStorage.getItem(DEV_STORAGE_KEY) || '[]');
  if (!Array.isArray(rows)) throw new Error('개발용 접속 기록을 읽을 수 없습니다.');
  return rows.map(row => normalizeLog(row.id, row)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, limitCount);
};
const loginLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  statusLabels: STATUS_LABELS,
  createLog: async input => {
    const isDev = (0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)();
    const now = firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.now();
    const actor = resolveActor(input);
    const logRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME));
    const baseLog = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      status: resolveStatus(input.action, input.status),
      provider: sanitizeText(input.provider, 'unknown'),
      method: sanitizeText(input.method, 'unknown'),
      actor,
      email: input.email || actor.email,
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage || null,
      client: resolveClient(),
      createdAt: now,
      createdAtIso: now.toDate().toISOString()
    };
    const summaryLines = buildSummaryLines(baseLog);
    const log = {
      ...baseLog,
      summaryLines,
      summaryText: summaryLines.join('\n')
    };
    if (isDev) {
      window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify([log, ...readDevLogs(MAX_LOGS)].slice(0, MAX_LOGS)));
      window.dispatchEvent(new Event(DEV_LOG_CHANGED_EVENT));
    } else {
      await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(logRef, {
        ...stripUndefined(log),
        createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
      });
    }
    if (!isDev && _config_firebase__WEBPACK_IMPORTED_MODULE_1__.auth.currentUser && input.action !== 'session_access') {
      try {
        const {
          systemMessageService
        } = await __webpack_require__.e(/*! import() */ "src_services_systemMessageService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./systemMessageService */ "./src/services/systemMessageService.ts"));
        await systemMessageService.notifyLoginLogEvent(log);
      } catch (error) {
        console.warn('[loginLogService] login log notification failed:', error);
      }
    }
    return log;
  },
  safeCreateLog: async input => {
    try {
      await loginLogService.createLog(input);
      return true;
    } catch {
      console.warn('[loginLogService] 접속 기록을 저장하지 못했습니다.');
      return false;
    }
  },
  subscribeRecentLogs: (callback, limitCount = 300, onError) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) {
      const refresh = () => {
        try {
          callback(readDevLogs(limitCount));
        } catch {
          onError === null || onError === void 0 ? void 0 : onError(new Error('개발용 접속 기록을 읽을 수 없습니다.'));
        }
      };
      const onStorage = event => {
        if (event.storageArea === window.localStorage && (event.key === DEV_STORAGE_KEY || event.key === null)) refresh();
      };
      window.addEventListener(DEV_LOG_CHANGED_EVENT, refresh);
      window.addEventListener('storage', onStorage);
      refresh();
      return () => {
        window.removeEventListener(DEV_LOG_CHANGED_EVENT, refresh);
        window.removeEventListener('storage', onStorage);
      };
    }
    const logsQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(limitCount));
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(logsQuery, snapshot => callback(snapshot.docs.map(docSnap => normalizeLog(docSnap.id, docSnap.data()))), error => {
      console.error('[loginLogService] subscribe failed:', error);
      onError === null || onError === void 0 ? void 0 : onError(error);
    });
  },
  getRecentLogs: async (limitCount = 300) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_2__.isDevAdminSessionEnabled)()) return readDevLogs(limitCount);
    const logsQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(limitCount));
    const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(logsQuery);
    return snapshot.docs.map(docSnap => normalizeLog(docSnap.id, docSnap.data()));
  }
};

/***/ },

/***/ "./src/utils/loginLogLabels.ts"
/*!*************************************!*\
  !*** ./src/utils/loginLogLabels.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loginMethodLabel: () => (/* binding */ loginMethodLabel),
/* harmony export */   loginProviderLabel: () => (/* binding */ loginProviderLabel)
/* harmony export */ });
const PROVIDERS = {
  password: '이메일',
  google: 'Google',
  'google.com': 'Google',
  firebase: '로그인 유지',
  'dev-admin': '개발용 계정',
  unknown: '알 수 없음'
};
const METHODS = {
  'email/password': '이메일 로그인',
  popup: 'Google 로그인',
  session_restore: '앱 다시 열기',
  manual: '직접 로그아웃',
  unknown: '알 수 없음'
};
const loginProviderLabel = value => PROVIDERS[value] || value;
const loginMethodLabel = value => METHODS[value] || value;

/***/ }

}]);