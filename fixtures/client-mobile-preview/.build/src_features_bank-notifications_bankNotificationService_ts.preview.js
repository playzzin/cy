"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_features_bank-notifications_bankNotificationService_ts"],{

/***/ "./src/features/bank-notifications/bankNotificationService.ts"
/*!********************************************************************!*\
  !*** ./src/features/bank-notifications/bankNotificationService.ts ***!
  \********************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BANK_NOTIFICATION_COLLECTIONS: () => (/* binding */ BANK_NOTIFICATION_COLLECTIONS),
/* harmony export */   BANK_NOTIFICATION_HEALTH_DOCUMENT_ID: () => (/* binding */ BANK_NOTIFICATION_HEALTH_DOCUMENT_ID),
/* harmony export */   BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID: () => (/* binding */ BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID),
/* harmony export */   confirmBankTransactionCandidate: () => (/* binding */ confirmBankTransactionCandidate),
/* harmony export */   disableNotificationDeviceForToken: () => (/* binding */ disableNotificationDeviceForToken),
/* harmony export */   disableRememberedNotificationDevice: () => (/* binding */ disableRememberedNotificationDevice),
/* harmony export */   forgetCurrentNotificationDevice: () => (/* binding */ forgetCurrentNotificationDevice),
/* harmony export */   getBankNotificationSettings: () => (/* binding */ getBankNotificationSettings),
/* harmony export */   ignoreBankTransactionCandidate: () => (/* binding */ ignoreBankTransactionCandidate),
/* harmony export */   mapBankCandidateDocument: () => (/* binding */ mapBankCandidateDocument),
/* harmony export */   registerNotificationDevice: () => (/* binding */ registerNotificationDevice),
/* harmony export */   rememberCurrentNotificationDevice: () => (/* binding */ rememberCurrentNotificationDevice),
/* harmony export */   reprocessBankSmsCandidate: () => (/* binding */ reprocessBankSmsCandidate),
/* harmony export */   saveBankNotificationSettings: () => (/* binding */ saveBankNotificationSettings),
/* harmony export */   setNotificationDeviceEnabled: () => (/* binding */ setNotificationDeviceEnabled),
/* harmony export */   subscribeBankNotificationHealth: () => (/* binding */ subscribeBankNotificationHealth),
/* harmony export */   subscribeBankNotificationSettings: () => (/* binding */ subscribeBankNotificationSettings),
/* harmony export */   subscribeBankTransactionCandidates: () => (/* binding */ subscribeBankTransactionCandidates),
/* harmony export */   subscribeNotificationDevices: () => (/* binding */ subscribeNotificationDevices)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var firebase_functions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/functions */ "./node_modules/firebase/functions/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./types */ "./src/features/bank-notifications/types.ts");
/* harmony import */ var _bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./bankNotificationUtils */ "./src/features/bank-notifications/bankNotificationUtils.ts");





const BANK_NOTIFICATION_COLLECTIONS = {
  candidates: 'bank_transaction_candidates',
  settings: 'bank_notification_settings',
  devices: 'notification_devices',
  health: 'bank_notification_health'
};
const BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID = 'global';
const BANK_NOTIFICATION_HEALTH_DOCUMENT_ID = 'current';
const CURRENT_DEVICE_STORAGE_PREFIX = 'cy-bank-push-device:';
const readText = value => String(value !== null && value !== void 0 ? value : '').trim();
const readOptionalNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toFiniteNumber)(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};
const readReviewer = value => {
  var _reviewer$uid, _ref, _reviewer$displayName;
  if (typeof value === 'string') return {
    id: value,
    name: ''
  };
  if (!value || typeof value !== 'object') return {
    id: '',
    name: ''
  };
  const reviewer = value;
  return {
    id: readText((_reviewer$uid = reviewer.uid) !== null && _reviewer$uid !== void 0 ? _reviewer$uid : reviewer.id),
    name: readText((_ref = (_reviewer$displayName = reviewer.displayName) !== null && _reviewer$displayName !== void 0 ? _reviewer$displayName : reviewer.name) !== null && _ref !== void 0 ? _ref : reviewer.email)
  };
};
const mapBankCandidateDocument = snapshot => {
  var _ref2, _ref3, _ref4, _data$accountMasked, _ref5, _ref6, _ref7, _data$sourceMasked, _ref8, _ref9, _data$messagePreview, _ref0, _data$direction, _data$bankName, _ref1, _data$counterpartyMas, _data$memo, _ref10, _ref11, _data$transactionAt, _ref12, _data$receivedAt, _data$createdAt, _data$updatedAt, _data$parseError, _data$parseVersion, _data$reviewedAt;
  const data = snapshot.data();
  const reviewer = readReviewer(data.reviewedBy);
  const accountSource = (_ref2 = (_ref3 = (_ref4 = (_data$accountMasked = data.accountMasked) !== null && _data$accountMasked !== void 0 ? _data$accountMasked : data.accountNumberMasked) !== null && _ref4 !== void 0 ? _ref4 : data.accountNumber) !== null && _ref3 !== void 0 ? _ref3 : data.account) !== null && _ref2 !== void 0 ? _ref2 : data.accountSuffix ? `••••${readText(data.accountSuffix)}` : '';
  const source = (_ref5 = (_ref6 = (_ref7 = (_data$sourceMasked = data.sourceMasked) !== null && _data$sourceMasked !== void 0 ? _data$sourceMasked : data.senderText) !== null && _ref7 !== void 0 ? _ref7 : data.senderMasked) !== null && _ref6 !== void 0 ? _ref6 : data.sender) !== null && _ref5 !== void 0 ? _ref5 : data.source;
  const messagePreview = (_ref8 = (_ref9 = (_data$messagePreview = data.messagePreview) !== null && _data$messagePreview !== void 0 ? _data$messagePreview : data.smsPreview) !== null && _ref9 !== void 0 ? _ref9 : data.rawMessage) !== null && _ref8 !== void 0 ? _ref8 : data.message;
  return {
    id: snapshot.id,
    status: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeCandidateStatus)(data.status),
    direction: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeCandidateDirection)((_ref0 = (_data$direction = data.direction) !== null && _data$direction !== void 0 ? _data$direction : data.transactionType) !== null && _ref0 !== void 0 ? _ref0 : data.type),
    amount: Math.max(0, (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toFiniteNumber)(data.amount, 0)),
    balance: readOptionalNumber(data.balance),
    bankName: readText((_data$bankName = data.bankName) !== null && _data$bankName !== void 0 ? _data$bankName : data.providerName) || (readText(data.provider).toLowerCase() === 'kb' ? 'KB국민은행' : '은행'),
    accountMasked: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.maskAccountIdentifier)(accountSource),
    sourceMasked: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.maskSourceIdentifier)(source),
    counterpartyMasked: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.maskSourceIdentifier)((_ref1 = (_data$counterpartyMas = data.counterpartyMasked) !== null && _data$counterpartyMas !== void 0 ? _data$counterpartyMas : data.counterparty) !== null && _ref1 !== void 0 ? _ref1 : data.ownerName),
    memo: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.maskSensitiveMessage)((_data$memo = data.memo) !== null && _data$memo !== void 0 ? _data$memo : data.description),
    messagePreview: (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.maskSensitiveMessage)(messagePreview),
    transactionAt: (_ref10 = (_ref11 = (_data$transactionAt = data.transactionAt) !== null && _data$transactionAt !== void 0 ? _data$transactionAt : data.occurredAt) !== null && _ref11 !== void 0 ? _ref11 : data.transactionDate) !== null && _ref10 !== void 0 ? _ref10 : null,
    receivedAt: (_ref12 = (_data$receivedAt = data.receivedAt) !== null && _data$receivedAt !== void 0 ? _data$receivedAt : data.ingestedAt) !== null && _ref12 !== void 0 ? _ref12 : null,
    createdAt: (_data$createdAt = data.createdAt) !== null && _data$createdAt !== void 0 ? _data$createdAt : null,
    updatedAt: (_data$updatedAt = data.updatedAt) !== null && _data$updatedAt !== void 0 ? _data$updatedAt : null,
    parseError: readText((_data$parseError = data.parseError) !== null && _data$parseError !== void 0 ? _data$parseError : data.errorMessage),
    parserVersion: readText((_data$parseVersion = data.parseVersion) !== null && _data$parseVersion !== void 0 ? _data$parseVersion : data.parserVersion),
    confidence: readOptionalNumber(data.confidence),
    reviewedById: reviewer.id,
    reviewedByName: reviewer.name,
    reviewedAt: (_data$reviewedAt = data.reviewedAt) !== null && _data$reviewedAt !== void 0 ? _data$reviewedAt : null
  };
};
const sortCandidatesNewestFirst = candidates => [...candidates].sort((left, right) => {
  var _ref13, _ref14, _toBankDate$getTime, _toBankDate, _toBankDate2, _toBankDate3, _ref15, _ref16, _toBankDate$getTime2, _toBankDate4, _toBankDate5, _toBankDate6;
  const leftTime = (_ref13 = (_ref14 = (_toBankDate$getTime = (_toBankDate = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(left.transactionAt)) === null || _toBankDate === void 0 ? void 0 : _toBankDate.getTime()) !== null && _toBankDate$getTime !== void 0 ? _toBankDate$getTime : (_toBankDate2 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(left.receivedAt)) === null || _toBankDate2 === void 0 ? void 0 : _toBankDate2.getTime()) !== null && _ref14 !== void 0 ? _ref14 : (_toBankDate3 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(left.createdAt)) === null || _toBankDate3 === void 0 ? void 0 : _toBankDate3.getTime()) !== null && _ref13 !== void 0 ? _ref13 : 0;
  const rightTime = (_ref15 = (_ref16 = (_toBankDate$getTime2 = (_toBankDate4 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(right.transactionAt)) === null || _toBankDate4 === void 0 ? void 0 : _toBankDate4.getTime()) !== null && _toBankDate$getTime2 !== void 0 ? _toBankDate$getTime2 : (_toBankDate5 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(right.receivedAt)) === null || _toBankDate5 === void 0 ? void 0 : _toBankDate5.getTime()) !== null && _ref16 !== void 0 ? _ref16 : (_toBankDate6 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(right.createdAt)) === null || _toBankDate6 === void 0 ? void 0 : _toBankDate6.getTime()) !== null && _ref15 !== void 0 ? _ref15 : 0;
  return rightTime - leftTime;
});
const subscribeBankTransactionCandidates = (onChange, onError, maximumRows = 300) => {
  const candidatesQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.candidates), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(Math.max(1, maximumRows)));
  return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(candidatesQuery, snapshot => onChange(sortCandidatesNewestFirst(snapshot.docs.map(mapBankCandidateDocument))), error => onError === null || onError === void 0 ? void 0 : onError(error));
};
const transitionCandidate = async (candidateId, nextStatus, actor) => {
  const reference = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.candidates, candidateId);
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.runTransaction)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, async transaction => {
    var _actor$email;
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('candidate-not-found');
    const currentStatus = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeCandidateStatus)(snapshot.data().status);
    const canTransition = nextStatus === 'confirmed' ? currentStatus === 'pending' : currentStatus === 'pending' || currentStatus === 'parse_failed';
    if (!canTransition) throw new Error('candidate-already-reviewed');
    transaction.update(reference, {
      status: nextStatus,
      reviewedBy: {
        uid: actor.uid,
        displayName: actor.displayName,
        email: (_actor$email = actor.email) !== null && _actor$email !== void 0 ? _actor$email : null
      },
      reviewedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)(),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
  });
};
const confirmBankTransactionCandidate = (candidateId, actor) => transitionCandidate(candidateId, 'confirmed', actor);
const ignoreBankTransactionCandidate = (candidateId, actor) => transitionCandidate(candidateId, 'ignored', actor);
const reprocessBankSmsCandidate = async candidateId => {
  const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'reprocessBankSmsCandidate');
  const result = await callable({
    candidateId
  });
  return result.data;
};
const settingsReference = () => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.settings, BANK_NOTIFICATION_SETTINGS_DOCUMENT_ID);
const subscribeBankNotificationSettings = (onChange, onError) => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(settingsReference(), snapshot => onChange(snapshot.exists() ? (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeBankNotificationSettings)(snapshot.data()) : (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeBankNotificationSettings)(_types__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_BANK_NOTIFICATION_SETTINGS)), error => onError === null || onError === void 0 ? void 0 : onError(error));
const getBankNotificationSettings = async () => {
  const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(settingsReference());
  return snapshot.exists() ? (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeBankNotificationSettings)(snapshot.data()) : (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeBankNotificationSettings)(_types__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_BANK_NOTIFICATION_SETTINGS);
};
const saveBankNotificationSettings = async (settings, actor) => {
  const normalized = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.normalizeBankNotificationSettings)(settings);
  if (normalized.directions.length === 0) throw new Error('direction-required');
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(settingsReference(), {
    enabled: normalized.enabled,
    recipientIds: normalized.recipientIds,
    minimumAmount: normalized.minimumAmount,
    directions: normalized.directions,
    notifyOnParseFailure: normalized.notifyOnParseFailure,
    quietHours: normalized.quietHours,
    updatedById: actor.uid,
    updatedByName: actor.displayName,
    updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
  }, {
    merge: true
  });
};
const createFallbackHash = input => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const createDeviceId = async (uid, token) => {
  const source = `${uid}:${token}`;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return `web_${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `web_${createFallbackHash(source)}`;
};
const mapNotificationDeviceDocument = snapshot => {
  var _data$token, _data$createdAt2, _data$updatedAt2, _data$lastSeenAt;
  const data = snapshot.data();
  const rawPermission = readText(data.permission);
  const permission = ['default', 'denied', 'granted', 'unsupported'].includes(rawPermission) ? rawPermission : 'default';
  return {
    id: snapshot.id,
    uid: readText(data.uid),
    token: readText((_data$token = data.token) !== null && _data$token !== void 0 ? _data$token : data.fcmToken),
    platform: 'web',
    label: readText(data.label) || '웹 브라우저',
    browser: readText(data.browser),
    userAgent: readText(data.userAgent),
    permission,
    enabled: data.enabled !== false,
    createdAt: (_data$createdAt2 = data.createdAt) !== null && _data$createdAt2 !== void 0 ? _data$createdAt2 : null,
    updatedAt: (_data$updatedAt2 = data.updatedAt) !== null && _data$updatedAt2 !== void 0 ? _data$updatedAt2 : null,
    lastSeenAt: (_data$lastSeenAt = data.lastSeenAt) !== null && _data$lastSeenAt !== void 0 ? _data$lastSeenAt : null
  };
};
const sortDevicesNewestFirst = devices => [...devices].sort((left, right) => {
  var _ref17, _toBankDate$getTime3, _toBankDate7, _toBankDate8, _ref18, _toBankDate$getTime4, _toBankDate9, _toBankDate0;
  return ((_ref17 = (_toBankDate$getTime3 = (_toBankDate7 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(right.lastSeenAt)) === null || _toBankDate7 === void 0 ? void 0 : _toBankDate7.getTime()) !== null && _toBankDate$getTime3 !== void 0 ? _toBankDate$getTime3 : (_toBankDate8 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(right.createdAt)) === null || _toBankDate8 === void 0 ? void 0 : _toBankDate8.getTime()) !== null && _ref17 !== void 0 ? _ref17 : 0) - ((_ref18 = (_toBankDate$getTime4 = (_toBankDate9 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(left.lastSeenAt)) === null || _toBankDate9 === void 0 ? void 0 : _toBankDate9.getTime()) !== null && _toBankDate$getTime4 !== void 0 ? _toBankDate$getTime4 : (_toBankDate0 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(left.createdAt)) === null || _toBankDate0 === void 0 ? void 0 : _toBankDate0.getTime()) !== null && _ref18 !== void 0 ? _ref18 : 0);
});
const subscribeNotificationDevices = (uid, onChange, onError) => {
  const devicesQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.devices), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('uid', '==', uid));
  return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(devicesQuery, snapshot => onChange(sortDevicesNewestFirst(snapshot.docs.map(mapNotificationDeviceDocument))), error => onError === null || onError === void 0 ? void 0 : onError(error));
};
const registerNotificationDevice = async input => {
  const deviceId = await createDeviceId(input.uid, input.token);
  const reference = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId);
  const existing = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(reference);
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(reference, {
    uid: input.uid,
    token: input.token,
    platform: 'web',
    label: input.label,
    browser: input.browser,
    userAgent: input.userAgent,
    permission: input.permission,
    enabled: true,
    ...(existing.exists() ? {} : {
      createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    }),
    updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)(),
    lastSeenAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
  }, {
    merge: true
  });
  return deviceId;
};
const rememberCurrentNotificationDevice = (uid, deviceId) => {
  if (typeof window === 'undefined' || !uid || !/^web_[a-f0-9]{8,64}$/.test(deviceId)) return;
  window.localStorage.setItem(`${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`, deviceId);
};
const forgetCurrentNotificationDevice = uid => {
  if (typeof window === 'undefined' || !uid) return;
  window.localStorage.removeItem(`${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`);
};

/** Revokes this browser's remembered registration while Firebase auth is still active. */
const disableRememberedNotificationDevice = async uid => {
  if (typeof window === 'undefined' || !uid) return false;
  const key = `${CURRENT_DEVICE_STORAGE_PREFIX}${uid}`;
  const deviceId = window.localStorage.getItem(key) || '';
  if (!/^web_[a-f0-9]{8,64}$/.test(deviceId)) return false;
  await setNotificationDeviceEnabled(deviceId, false);
  window.localStorage.removeItem(key);
  return true;
};
const setNotificationDeviceEnabled = async (deviceId, enabled) => {
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.updateDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId), {
    enabled,
    updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
  });
};
const disableNotificationDeviceForToken = async (uid, token) => {
  const deviceId = await createDeviceId(uid, token);
  await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.devices, deviceId), {
    uid,
    token,
    platform: 'web',
    enabled: false,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
  }, {
    merge: true
  });
};
const maskDeviceId = value => {
  const text = readText(value);
  if (!text) return '-';
  return text.length <= 6 ? '••••••' : `••••${text.slice(-6)}`;
};
const subscribeBankNotificationHealth = (onChange, onError) => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, BANK_NOTIFICATION_COLLECTIONS.health, BANK_NOTIFICATION_HEALTH_DOCUMENT_ID), snapshot => {
  var _healthySignals$, _data$lastReceivedAt, _data$updatedAt3;
  const data = snapshot.exists() ? snapshot.data() : {};
  const parserStatus = readText(data.lastParserStatus).toLowerCase();
  const healthySignals = [data.lastSuccessfulIngestionAt, data.lastConnectionTestAt].map(value => {
    var _toBankDate$getTime5, _toBankDate1;
    return {
      value,
      time: (_toBankDate$getTime5 = (_toBankDate1 = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.toBankDate)(value)) === null || _toBankDate1 === void 0 ? void 0 : _toBankDate1.getTime()) !== null && _toBankDate$getTime5 !== void 0 ? _toBankDate$getTime5 : 0
    };
  }).sort((left, right) => right.time - left.time);
  const state = (0,_bankNotificationUtils__WEBPACK_IMPORTED_MODULE_4__.resolveBankNotificationHealthState)({
    documentExists: snapshot.exists(),
    lastSuccessfulIngestionAt: data.lastSuccessfulIngestionAt,
    lastConnectionTestAt: data.lastConnectionTestAt,
    lastParserStatus: parserStatus
  });
  onChange({
    state,
    lastEventAt: (_healthySignals$ = healthySignals[0]) !== null && _healthySignals$ !== void 0 && _healthySignals$.time ? healthySignals[0].value : (_data$lastReceivedAt = data.lastReceivedAt) !== null && _data$lastReceivedAt !== void 0 ? _data$lastReceivedAt : null,
    lastDeviceIdMasked: maskDeviceId(data.lastBridgeDeviceHash),
    // Parser failures are represented by parse_failed candidates and do not
    // imply that the Android bridge itself is disconnected.
    lastErrorCode: '',
    updatedAt: (_data$updatedAt3 = data.updatedAt) !== null && _data$updatedAt3 !== void 0 ? _data$updatedAt3 : null
  });
}, error => onError === null || onError === void 0 ? void 0 : onError(error));

/***/ },

/***/ "./src/features/bank-notifications/bankNotificationUtils.ts"
/*!******************************************************************!*\
  !*** ./src/features/bank-notifications/bankNotificationUtils.ts ***!
  \******************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BANK_HEALTH_STALE_AFTER_MS: () => (/* binding */ BANK_HEALTH_STALE_AFTER_MS),
/* harmony export */   filterBankCandidates: () => (/* binding */ filterBankCandidates),
/* harmony export */   formatBankCurrency: () => (/* binding */ formatBankCurrency),
/* harmony export */   formatBankDateTime: () => (/* binding */ formatBankDateTime),
/* harmony export */   getCandidateEffectiveDate: () => (/* binding */ getCandidateEffectiveDate),
/* harmony export */   isWithinQuietHours: () => (/* binding */ isWithinQuietHours),
/* harmony export */   maskAccountIdentifier: () => (/* binding */ maskAccountIdentifier),
/* harmony export */   maskSensitiveMessage: () => (/* binding */ maskSensitiveMessage),
/* harmony export */   maskSourceIdentifier: () => (/* binding */ maskSourceIdentifier),
/* harmony export */   normalizeBankNotificationSettings: () => (/* binding */ normalizeBankNotificationSettings),
/* harmony export */   normalizeCandidateDirection: () => (/* binding */ normalizeCandidateDirection),
/* harmony export */   normalizeCandidateStatus: () => (/* binding */ normalizeCandidateStatus),
/* harmony export */   resolveBankNotificationHealthState: () => (/* binding */ resolveBankNotificationHealthState),
/* harmony export */   summarizeBankCandidates: () => (/* binding */ summarizeBankCandidates),
/* harmony export */   toBankDate: () => (/* binding */ toBankDate),
/* harmony export */   toFiniteNumber: () => (/* binding */ toFiniteNumber)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./types */ "./src/features/bank-notifications/types.ts");

const KOREAN_CURRENCY_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0
});
const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul'
});
const safeText = value => String(value !== null && value !== void 0 ? value : '').trim();
const BANK_HEALTH_STALE_AFTER_MS = 120 * 60 * 1000;
const toFiniteNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value !== null && value !== void 0 ? value : '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toBankDate = value => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null) {
    const timestampLike = value;
    if (typeof timestampLike.toDate === 'function') {
      try {
        const date = timestampLike.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    }
    if (typeof timestampLike.seconds === 'number') {
      const date = new Date(timestampLike.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatBankCurrency = amount => KOREAN_CURRENCY_FORMATTER.format(Number.isFinite(amount) ? Number(amount) : 0);
const formatBankDateTime = value => {
  const date = toBankDate(value);
  return date ? KOREAN_DATE_TIME_FORMATTER.format(date).replace('24:', '00:') : '-';
};

/**
 * Account numbers are masked at render time even when the server already sent a masked value.
 * Separators and the last four digits are retained so an accountant can distinguish accounts.
 */
const maskAccountIdentifier = value => {
  const text = safeText(value);
  if (!text) return '-';
  const totalDigits = (text.match(/\d/g) || []).length;
  if (totalDigits <= 4) {
    if (/[•*xX]/.test(text)) return text.replace(/[xX*]/g, '•');
    return totalDigits === 4 ? `••••${text}` : text.replace(/\d/g, '•');
  }
  let digitIndex = 0;
  const visibleAfter = totalDigits - 4;
  return text.replace(/\d/g, digit => {
    digitIndex += 1;
    return digitIndex <= visibleAfter ? '•' : digit;
  });
};
const maskSourceIdentifier = value => {
  const text = safeText(value);
  if (!text) return '-';
  if (text.includes('@')) {
    const [local, domain] = text.split('@');
    const visible = local.slice(0, 1);
    return `${visible}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`;
  }
  const digitCount = (text.match(/\d/g) || []).length;
  if (digitCount >= 7) return maskAccountIdentifier(text);
  return text;
};
const maskSensitiveMessage = value => {
  const text = safeText(value);
  if (!text) return '';
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, email => maskSourceIdentifier(email)).replace(/(?:\d[\s-]?){7,}/g, sequence => maskAccountIdentifier(sequence));
};
const normalizeCandidateStatus = value => {
  const normalized = safeText(value).toLowerCase().replace(/[-\s]/g, '_');
  if (_types__WEBPACK_IMPORTED_MODULE_0__.BANK_TRANSACTION_STATUSES.includes(normalized)) {
    return normalized;
  }
  if (['approved', 'matched', 'complete', 'completed'].includes(normalized)) return 'confirmed';
  if (['dismissed', 'rejected', 'duplicate'].includes(normalized)) return 'ignored';
  if (['failed', 'error', 'invalid'].includes(normalized)) return 'parse_failed';
  return 'pending';
};
const normalizeCandidateDirection = value => {
  const normalized = safeText(value).toLowerCase().replace(/[-\s]/g, '_');
  if (_types__WEBPACK_IMPORTED_MODULE_0__.BANK_TRANSACTION_DIRECTIONS.includes(normalized)) {
    return normalized;
  }
  if (['in', 'credit', 'income', '입금', 'deposit_received'].includes(normalized)) return 'deposit';
  if (['out', 'debit', 'expense', '출금', 'withdraw'].includes(normalized)) return 'withdrawal';
  return 'unknown';
};
const getCandidateEffectiveDate = candidate => toBankDate(candidate.transactionAt) || toBankDate(candidate.receivedAt) || toBankDate(candidate.createdAt);
const getLocalDayBounds = date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.getTime(),
    end: end.getTime()
  };
};
const parseLocalDateBoundary = (value, endOfDay) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setDate(date.getDate() + 1);
  return date.getTime();
};
const filterBankCandidates = (candidates, filters) => {
  const query = filters.query.trim().toLocaleLowerCase('ko-KR');
  const startAt = parseLocalDateBoundary(filters.startDate, false);
  const endAt = parseLocalDateBoundary(filters.endDate, true);
  return candidates.filter(candidate => {
    var _getCandidateEffectiv, _getCandidateEffectiv2;
    if (filters.status !== 'all' && candidate.status !== filters.status) return false;
    if (filters.direction !== 'all' && candidate.direction !== filters.direction) return false;
    if (filters.minimumAmount !== null && candidate.amount < filters.minimumAmount) return false;
    const candidateDate = (_getCandidateEffectiv = (_getCandidateEffectiv2 = getCandidateEffectiveDate(candidate)) === null || _getCandidateEffectiv2 === void 0 ? void 0 : _getCandidateEffectiv2.getTime()) !== null && _getCandidateEffectiv !== void 0 ? _getCandidateEffectiv : null;
    if (startAt !== null && (candidateDate === null || candidateDate < startAt)) return false;
    if (endAt !== null && (candidateDate === null || candidateDate >= endAt)) return false;
    if (query) {
      const searchable = [candidate.bankName, candidate.accountMasked, candidate.sourceMasked, candidate.counterpartyMasked, candidate.memo, candidate.amount].join(' ').toLocaleLowerCase('ko-KR');
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
};
const summarizeBankCandidates = (candidates, now = new Date()) => {
  const {
    start,
    end
  } = getLocalDayBounds(now);
  const summary = {
    pendingCount: 0,
    parseFailedCount: 0,
    todayDepositTotal: 0,
    todayWithdrawalTotal: 0
  };
  candidates.forEach(candidate => {
    var _getCandidateEffectiv3;
    if (candidate.status === 'pending') summary.pendingCount += 1;
    if (candidate.status === 'parse_failed') summary.parseFailedCount += 1;
    const transactionAt = (_getCandidateEffectiv3 = getCandidateEffectiveDate(candidate)) === null || _getCandidateEffectiv3 === void 0 ? void 0 : _getCandidateEffectiv3.getTime();
    if (transactionAt === undefined || transactionAt < start || transactionAt >= end) return;
    if (candidate.status === 'ignored' || candidate.status === 'parse_failed') return;
    if (candidate.direction === 'deposit') summary.todayDepositTotal += candidate.amount;
    if (candidate.direction === 'withdrawal') summary.todayWithdrawalTotal += candidate.amount;
  });
  return summary;
};
const isValidClockTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const normalizeBankNotificationSettings = value => {
  var _input$minimumAmount;
  const input = value && typeof value === 'object' ? value : {};
  const rawQuietHours = input.quietHours && typeof input.quietHours === 'object' ? input.quietHours : {};
  const rawDirections = Array.isArray(input.directions) ? input.directions : [];
  const directions = rawDirections.map(normalizeCandidateDirection).filter(direction => direction !== 'unknown');
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : _types__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_BANK_NOTIFICATION_SETTINGS.enabled,
    recipientIds: Array.isArray(input.recipientIds) ? Array.from(new Set(input.recipientIds.map(safeText).filter(Boolean))) : [],
    minimumAmount: Math.max(0, toFiniteNumber((_input$minimumAmount = input.minimumAmount) !== null && _input$minimumAmount !== void 0 ? _input$minimumAmount : input.minAmount, 0)),
    directions: directions.length > 0 ? Array.from(new Set(directions)) : [..._types__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_BANK_NOTIFICATION_SETTINGS.directions],
    notifyOnParseFailure: typeof input.notifyOnParseFailure === 'boolean' ? input.notifyOnParseFailure : _types__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_BANK_NOTIFICATION_SETTINGS.notifyOnParseFailure,
    quietHours: {
      enabled: Boolean(rawQuietHours.enabled),
      start: isValidClockTime(safeText(rawQuietHours.start)) ? safeText(rawQuietHours.start) : _types__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_BANK_NOTIFICATION_SETTINGS.quietHours.start,
      end: isValidClockTime(safeText(rawQuietHours.end)) ? safeText(rawQuietHours.end) : _types__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_BANK_NOTIFICATION_SETTINGS.quietHours.end,
      timezone: 'Asia/Seoul'
    },
    updatedAt: input.updatedAt,
    updatedById: safeText(input.updatedById),
    updatedByName: safeText(input.updatedByName)
  };
};
const isWithinQuietHours = (clockTime, start, end) => {
  if (!isValidClockTime(clockTime) || !isValidClockTime(start) || !isValidClockTime(end)) return false;
  if (start === end) return true;
  if (start < end) return clockTime >= start && clockTime < end;
  return clockTime >= start || clockTime < end;
};
const resolveBankNotificationHealthState = ({
  documentExists,
  lastSuccessfulIngestionAt,
  lastConnectionTestAt,
  lastParserStatus: _lastParserStatus,
  now = Date.now()
}) => {
  var _toBankDate$getTime, _toBankDate, _toBankDate$getTime2, _toBankDate2;
  if (!documentExists) return 'unconfigured';
  const successfulAt = (_toBankDate$getTime = (_toBankDate = toBankDate(lastSuccessfulIngestionAt)) === null || _toBankDate === void 0 ? void 0 : _toBankDate.getTime()) !== null && _toBankDate$getTime !== void 0 ? _toBankDate$getTime : 0;
  const connectionTestAt = (_toBankDate$getTime2 = (_toBankDate2 = toBankDate(lastConnectionTestAt)) === null || _toBankDate2 === void 0 ? void 0 : _toBankDate2.getTime()) !== null && _toBankDate$getTime2 !== void 0 ? _toBankDate$getTime2 : 0;
  const latestHealthySignalAt = Math.max(successfulAt, connectionTestAt);
  return latestHealthySignalAt > 0 && now - latestHealthySignalAt <= BANK_HEALTH_STALE_AFTER_MS ? 'healthy' : 'stale';
};

/***/ },

/***/ "./src/features/bank-notifications/types.ts"
/*!**************************************************!*\
  !*** ./src/features/bank-notifications/types.ts ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BANK_TRANSACTION_DIRECTIONS: () => (/* binding */ BANK_TRANSACTION_DIRECTIONS),
/* harmony export */   BANK_TRANSACTION_STATUSES: () => (/* binding */ BANK_TRANSACTION_STATUSES),
/* harmony export */   DEFAULT_BANK_CANDIDATE_FILTERS: () => (/* binding */ DEFAULT_BANK_CANDIDATE_FILTERS),
/* harmony export */   DEFAULT_BANK_NOTIFICATION_SETTINGS: () => (/* binding */ DEFAULT_BANK_NOTIFICATION_SETTINGS)
/* harmony export */ });
const BANK_TRANSACTION_STATUSES = ['pending', 'confirmed', 'ignored', 'parse_failed'];
const BANK_TRANSACTION_DIRECTIONS = ['deposit', 'withdrawal', 'unknown'];
const DEFAULT_BANK_NOTIFICATION_SETTINGS = {
  enabled: true,
  recipientIds: [],
  minimumAmount: 0,
  directions: ['deposit', 'withdrawal'],
  notifyOnParseFailure: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timezone: 'Asia/Seoul'
  }
};
const DEFAULT_BANK_CANDIDATE_FILTERS = {
  status: 'all',
  direction: 'all',
  query: '',
  startDate: '',
  endDate: '',
  minimumAmount: null
};

/***/ }

}]);