"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_accommodationBillingLogService_ts"],{

/***/ "./src/services/accommodationBillingLogService.ts"
/*!********************************************************!*\
  !*** ./src/services/accommodationBillingLogService.ts ***!
  \********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   accommodationBillingLogService: () => (/* binding */ accommodationBillingLogService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");


const COLLECTION_NAME = 'accommodation_billing_logs';
const ACTION_LABELS = {
  created: '저장',
  updated: '수정',
  deleted: '삭제'
};
const BILLING_FIELD_LABELS = {
  yearMonth: '청구 월',
  teamId: '청구대상 팀 ID',
  teamName: '청구대상 팀',
  issuedToType: '청구 방식',
  issuedToWorkerId: '청구대상 개인 ID',
  issuedToWorkerName: '청구대상 개인',
  status: '상태',
  memo: '메모',
  postedAdvancePaymentId: '대납출력부 연동 ID',
  confirmedAt: '확정일시'
};
const LINE_ITEM_FIELD_LABELS = {
  label: '항목명',
  amount: '금액',
  targetField: '청구 필드',
  sourceType: '출처',
  sourceAccommodationId: '숙소 ID',
  sourceUtilityRecordId: '공과금 행 ID'
};
const BILLING_COMPARE_FIELDS = Object.keys(BILLING_FIELD_LABELS);
const LINE_ITEM_COMPARE_FIELDS = Object.keys(LINE_ITEM_FIELD_LABELS);
const stripUndefined = value => {
  if (Array.isArray(value)) return value.map(entry => stripUndefined(entry));
  if (value && typeof value === 'object') {
    if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp) return value;
    if (typeof value.toDate === 'function') return value;
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, stripUndefined(entry)]));
  }
  return value === undefined ? null : value;
};
const normalizeComparableValue = value => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof (value === null || value === void 0 ? void 0 : value.toDate) === 'function') {
    return value.toDate().toISOString();
  }
  return value;
};
const sameValue = (left, right) => JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));
const asText = (value, fallback = '-') => {
  const text = String(value !== null && value !== void 0 ? value : '').trim();
  return text || fallback;
};
const formatAmount = value => Number(value || 0).toLocaleString('ko-KR');
const normalizeTimestamp = value => {
  if (!value) return undefined;
  if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp) return value;
  if (typeof value.toDate === 'function') {
    return firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.fromDate(value.toDate());
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.fromDate(date);
};
const resolveActor = () => {
  const user = _config_firebase__WEBPACK_IMPORTED_MODULE_1__.auth.currentUser;
  if (!user) return {
    uid: 'system',
    name: 'ERP 시스템',
    email: null
  };
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null
  };
};
const getTotalAmount = billing => ((billing === null || billing === void 0 ? void 0 : billing.lineItems) || []).reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
const snapshotLineItem = item => stripUndefined({
  id: item.id,
  label: item.label,
  amount: Number(item.amount || 0),
  targetField: item.targetField,
  sourceType: item.sourceType,
  sourceAccommodationId: item.sourceAccommodationId,
  sourceUtilityRecordId: item.sourceUtilityRecordId
});
const snapshotBilling = billing => {
  if (!billing) return null;
  return stripUndefined({
    id: billing.id,
    yearMonth: billing.yearMonth,
    teamId: billing.teamId,
    teamName: billing.teamName,
    issuedToType: billing.issuedToType === 'team_leader' ? 'team' : billing.issuedToType,
    issuedToWorkerId: billing.issuedToWorkerId,
    issuedToWorkerName: billing.issuedToWorkerName,
    status: billing.status,
    memo: billing.memo,
    lineItems: Array.isArray(billing.lineItems) ? billing.lineItems.map(snapshotLineItem) : [],
    createdAt: normalizeTimestamp(billing.createdAt),
    updatedAt: normalizeTimestamp(billing.updatedAt),
    confirmedAt: normalizeTimestamp(billing.confirmedAt),
    postedAdvancePaymentId: billing.postedAdvancePaymentId
  });
};
const getBillingId = billing => asText(billing === null || billing === void 0 ? void 0 : billing.id, '');
const resolveAnchor = (before, after) => after || before || {};
const buildFieldChanges = (before, after) => BILLING_COMPARE_FIELDS.reduce((changes, field) => {
  var _field, _field2;
  const beforeValue = (_field = before === null || before === void 0 ? void 0 : before[field]) !== null && _field !== void 0 ? _field : null;
  const afterValue = (_field2 = after === null || after === void 0 ? void 0 : after[field]) !== null && _field2 !== void 0 ? _field2 : null;
  if (!sameValue(beforeValue, afterValue)) {
    changes.push({
      field,
      label: BILLING_FIELD_LABELS[field] || field,
      before: normalizeComparableValue(beforeValue),
      after: normalizeComparableValue(afterValue)
    });
  }
  return changes;
}, []);
const getLineItemKey = item => asText(item.id || `${item.label}-${item.targetField}-${item.sourceAccommodationId}-${item.sourceUtilityRecordId}`, '');
const buildLineItemChange = (item, before, after) => ({
  key: getLineItemKey(item) || asText(item.label, '항목'),
  label: asText(item.label, '항목'),
  before,
  after
});
const buildLineItemChanges = (beforeItems = [], afterItems = []) => {
  const beforeByKey = new Map(beforeItems.map(item => [getLineItemKey(item), item]));
  const afterByKey = new Map(afterItems.map(item => [getLineItemKey(item), item]));
  const added = [];
  const removed = [];
  const updated = [];
  afterByKey.forEach((after, key) => {
    const before = beforeByKey.get(key);
    if (!before) {
      added.push(buildLineItemChange(after, undefined, after));
      return;
    }
    const changes = LINE_ITEM_COMPARE_FIELDS.reduce((acc, field) => {
      var _field3, _field4;
      const beforeValue = (_field3 = before[field]) !== null && _field3 !== void 0 ? _field3 : null;
      const afterValue = (_field4 = after[field]) !== null && _field4 !== void 0 ? _field4 : null;
      if (!sameValue(beforeValue, afterValue)) {
        acc.push({
          field,
          label: LINE_ITEM_FIELD_LABELS[field] || field,
          before: normalizeComparableValue(beforeValue),
          after: normalizeComparableValue(afterValue)
        });
      }
      return acc;
    }, []);
    if (changes.length > 0) {
      updated.push({
        ...buildLineItemChange(after, before, after),
        changes
      });
    }
  });
  beforeByKey.forEach((before, key) => {
    if (!afterByKey.has(key)) {
      removed.push(buildLineItemChange(before, before, undefined));
    }
  });
  return {
    added,
    removed,
    updated
  };
};
const buildSummaryLines = (action, anchor, fieldChanges, lineItemChanges) => {
  const lines = [];
  const targetName = asText(anchor.issuedToWorkerName || anchor.teamName, '청구대상 미지정');
  const totalAmount = formatAmount(getTotalAmount(anchor));
  if (action === 'created') lines.push('숙소 청구서가 생성되었습니다.');
  if (action === 'updated') {
    lines.push(fieldChanges.length > 0 || lineItemChanges.added.length > 0 || lineItemChanges.removed.length > 0 || lineItemChanges.updated.length > 0 ? '숙소 청구서 내용이 수정되었습니다.' : '숙소 청구서 저장 값이 갱신되었습니다.');
  }
  if (action === 'deleted') lines.push('숙소 청구서가 취소 또는 삭제되었습니다.');
  lines.push(`청구대상: ${targetName}`);
  lines.push(`팀: ${asText(anchor.teamName, '-')}`);
  lines.push(`청구월: ${asText(anchor.yearMonth, '-')}`);
  lines.push(`총 청구액: ${totalAmount}원`);
  if (anchor.status) lines.push(`상태: ${anchor.status}`);
  if (action === 'updated') {
    fieldChanges.slice(0, 5).forEach(change => {
      lines.push(`${change.label}: ${asText(change.before)} → ${asText(change.after)}`);
    });
    const lineItemCount = lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
    if (lineItemCount > 0) lines.push(`청구 항목 변경: ${lineItemCount}건`);
  }
  return lines;
};
const buildAccommodationBillingChangeSet = (action, before, after) => {
  const fieldChanges = action === 'updated' ? buildFieldChanges(before, after) : [];
  const lineItemChanges = action === 'updated' ? buildLineItemChanges((before === null || before === void 0 ? void 0 : before.lineItems) || [], (after === null || after === void 0 ? void 0 : after.lineItems) || []) : {
    added: action === 'created' ? ((after === null || after === void 0 ? void 0 : after.lineItems) || []).map(item => buildLineItemChange(item, undefined, item)) : [],
    removed: action === 'deleted' ? ((before === null || before === void 0 ? void 0 : before.lineItems) || []).map(item => buildLineItemChange(item, item, undefined)) : [],
    updated: []
  };
  const anchor = resolveAnchor(before, after);
  const changeCount = fieldChanges.length + lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
  return {
    fieldChanges,
    lineItemChanges,
    summaryLines: buildSummaryLines(action, anchor, fieldChanges, lineItemChanges),
    changeCount: Math.max(changeCount, action === 'updated' ? 0 : 1)
  };
};
const normalizeLog = (id, data) => {
  var _data$actor, _data$actor2, _data$actor3, _data$lineItemChanges, _data$lineItemChanges2, _data$lineItemChanges3;
  return {
    id,
    action: data.action || 'updated',
    actionLabel: data.actionLabel || ACTION_LABELS[data.action] || '변경',
    billingId: String(data.billingId || ''),
    yearMonth: String(data.yearMonth || ''),
    teamId: data.teamId ? String(data.teamId) : undefined,
    teamName: data.teamName ? String(data.teamName) : undefined,
    issuedToType: data.issuedToType ? String(data.issuedToType) : undefined,
    issuedToWorkerId: data.issuedToWorkerId ? String(data.issuedToWorkerId) : undefined,
    issuedToWorkerName: data.issuedToWorkerName ? String(data.issuedToWorkerName) : undefined,
    status: data.status ? String(data.status) : undefined,
    totalAmount: Number(data.totalAmount || 0),
    actor: {
      uid: String(((_data$actor = data.actor) === null || _data$actor === void 0 ? void 0 : _data$actor.uid) || 'system'),
      name: String(((_data$actor2 = data.actor) === null || _data$actor2 === void 0 ? void 0 : _data$actor2.name) || 'ERP 시스템'),
      email: ((_data$actor3 = data.actor) === null || _data$actor3 === void 0 ? void 0 : _data$actor3.email) || null
    },
    source: String(data.source || 'accommodationBillingService'),
    before: data.before || null,
    after: data.after || null,
    fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
    lineItemChanges: {
      added: Array.isArray((_data$lineItemChanges = data.lineItemChanges) === null || _data$lineItemChanges === void 0 ? void 0 : _data$lineItemChanges.added) ? data.lineItemChanges.added : [],
      removed: Array.isArray((_data$lineItemChanges2 = data.lineItemChanges) === null || _data$lineItemChanges2 === void 0 ? void 0 : _data$lineItemChanges2.removed) ? data.lineItemChanges.removed : [],
      updated: Array.isArray((_data$lineItemChanges3 = data.lineItemChanges) === null || _data$lineItemChanges3 === void 0 ? void 0 : _data$lineItemChanges3.updated) ? data.lineItemChanges.updated : []
    },
    summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
    summaryText: String(data.summaryText || ''),
    changeCount: Number(data.changeCount || 0),
    createdAt: data.createdAt instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp ? data.createdAt : firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.now(),
    createdAtIso: String(data.createdAtIso || '')
  };
};
const accommodationBillingLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  buildChangeSet: buildAccommodationBillingChangeSet,
  createLog: async input => {
    const before = snapshotBilling(input.before);
    const after = snapshotBilling(input.after);
    const anchor = resolveAnchor(before, after);
    const changeSet = buildAccommodationBillingChangeSet(input.action, before, after);
    const now = firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.now();
    const logRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME));
    const log = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      billingId: getBillingId(anchor) || logRef.id,
      yearMonth: asText(anchor.yearMonth, ''),
      teamId: anchor.teamId || undefined,
      teamName: anchor.teamName || undefined,
      issuedToType: anchor.issuedToType,
      issuedToWorkerId: anchor.issuedToWorkerId,
      issuedToWorkerName: anchor.issuedToWorkerName,
      status: anchor.status,
      totalAmount: getTotalAmount(anchor),
      actor: resolveActor(),
      source: input.source || 'accommodationBillingService',
      before,
      after,
      fieldChanges: changeSet.fieldChanges,
      lineItemChanges: changeSet.lineItemChanges,
      summaryLines: changeSet.summaryLines,
      summaryText: changeSet.summaryLines.join('\n'),
      changeCount: changeSet.changeCount,
      createdAt: now,
      createdAtIso: now.toDate().toISOString()
    };
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(logRef, stripUndefined(log));
    try {
      const {
        systemMessageService
      } = await __webpack_require__.e(/*! import() */ "src_services_systemMessageService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./systemMessageService */ "./src/services/systemMessageService.ts"));
      await systemMessageService.notifyAccommodationBillingLogEvent(log);
    } catch (error) {
      console.warn('[accommodationBillingLogService] accommodation billing log notification failed:', error);
    }
    return log;
  },
  subscribeRecentLogs: (callback, limitCount = 300, onError) => {
    const logsQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(limitCount));
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(logsQuery, snapshot => callback(snapshot.docs.map(docSnap => normalizeLog(docSnap.id, docSnap.data()))), error => {
      console.error('[accommodationBillingLogService] subscribe failed:', error);
      onError === null || onError === void 0 ? void 0 : onError(error);
    });
  },
  getRecentLogs: async (limitCount = 300) => {
    const logsQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(limitCount));
    const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(logsQuery);
    return snapshot.docs.map(docSnap => normalizeLog(docSnap.id, docSnap.data()));
  }
};

/***/ }

}]);