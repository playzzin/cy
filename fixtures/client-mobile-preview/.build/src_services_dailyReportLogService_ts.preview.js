"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_dailyReportLogService_ts"],{

/***/ "./src/services/dailyReportLogService.ts"
/*!***********************************************!*\
  !*** ./src/services/dailyReportLogService.ts ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildDailyReportChangeSet: () => (/* binding */ buildDailyReportChangeSet),
/* harmony export */   dailyReportLogService: () => (/* binding */ dailyReportLogService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");


const COLLECTION_NAME = 'daily_report_logs';
const ACTION_LABELS = {
  created: '저장',
  updated: '수정',
  deleted: '삭제'
};
const REPORT_FIELD_LABELS = {
  date: '날짜',
  siteId: '현장 ID',
  siteName: '현장명',
  teamId: '팀 ID',
  teamName: '팀명',
  responsibleTeamId: '담당팀 ID',
  responsibleTeamName: '담당팀',
  companyId: '거래처 ID',
  companyName: '거래처',
  constructorCompanyId: '시공사 ID',
  constructorCompanyName: '시공사',
  partnerId: '협력사 ID',
  partnerName: '협력사',
  writerId: '작성자 ID',
  totalManDay: '총공수',
  totalAmount: '총금액',
  weather: '날씨',
  workContent: '작업내용',
  siteType: '현장 구분',
  paymentType: '정산 구분'
};
const WORKER_FIELD_LABELS = {
  workerId: '작업자 ID',
  name: '작업자명',
  role: '직책',
  status: '출력 상태',
  manDay: '공수',
  workContent: '작업내용',
  teamId: '소속팀 ID',
  workerTeamName: '소속팀',
  unitPrice: '단가',
  payType: '급여 방식',
  salaryModel: '급여 모델',
  siteType: '현장 구분',
  paymentType: '정산 구분'
};
const REPORT_COMPARE_FIELDS = Object.keys(REPORT_FIELD_LABELS);
const WORKER_COMPARE_FIELDS = Object.keys(WORKER_FIELD_LABELS);
const formatNumber = value => Number(value || 0).toLocaleString('ko-KR', {
  maximumFractionDigits: 1
});
const getReportId = report => String((report === null || report === void 0 ? void 0 : report.id) || (report === null || report === void 0 ? void 0 : report.legacyId) || '').trim();
const asText = (value, fallback = '-') => {
  const text = String(value !== null && value !== void 0 ? value : '').trim();
  return text || fallback;
};
const normalizeComparableValue = value => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value;
};
const sameValue = (left, right) => JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));
const stripUndefined = value => {
  if (Array.isArray(value)) {
    return value.map(entry => stripUndefined(entry));
  }
  if (value && typeof value === 'object') {
    if (value instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp) return value;
    if (typeof value.toDate === 'function') return value;
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, stripUndefined(entry)]));
  }
  return value === undefined ? null : value;
};
const snapshotReport = report => {
  var _report$totalManDay, _report$totalAmount;
  if (!report) return null;
  return stripUndefined({
    id: report.id,
    legacyId: report.legacyId,
    date: report.date,
    teamId: report.teamId,
    teamName: report.teamName,
    siteId: report.siteId,
    siteName: report.siteName,
    responsibleTeamId: report.responsibleTeamId,
    responsibleTeamName: report.responsibleTeamName,
    companyId: report.companyId,
    companyName: report.companyName,
    constructorCompanyId: report.constructorCompanyId,
    constructorCompanyName: report.constructorCompanyName,
    partnerId: report.partnerId,
    partnerName: report.partnerName,
    writerId: report.writerId,
    workers: Array.isArray(report.workers) ? report.workers.map(worker => stripUndefined(worker)) : [],
    totalManDay: (_report$totalManDay = report.totalManDay) !== null && _report$totalManDay !== void 0 ? _report$totalManDay : 0,
    totalAmount: (_report$totalAmount = report.totalAmount) !== null && _report$totalAmount !== void 0 ? _report$totalAmount : 0,
    weather: report.weather,
    workContent: report.workContent,
    siteType: report.siteType,
    paymentType: report.paymentType,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  });
};
const fieldChanges = (before, after, fields, labels) => fields.reduce((changes, field) => {
  var _before$field, _after$field;
  const beforeValue = (_before$field = before === null || before === void 0 ? void 0 : before[field]) !== null && _before$field !== void 0 ? _before$field : null;
  const afterValue = (_after$field = after === null || after === void 0 ? void 0 : after[field]) !== null && _after$field !== void 0 ? _after$field : null;
  if (!sameValue(beforeValue, afterValue)) {
    changes.push({
      field,
      label: labels[field] || field,
      before: normalizeComparableValue(beforeValue),
      after: normalizeComparableValue(afterValue)
    });
  }
  return changes;
}, []);
const workerKeyFor = (worker, index, seen) => {
  const base = String(worker.workerId || worker.name || `row-${index + 1}`).trim();
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return `${base}#${count + 1}`;
};
const workerMap = workers => {
  const seen = new Map();
  const map = new Map();
  (workers || []).forEach((worker, index) => {
    const key = workerKeyFor(worker, index, seen);
    map.set(key, {
      key,
      workerId: worker.workerId,
      name: worker.name || `작업자 ${index + 1}`,
      role: worker.role,
      before: worker
    });
  });
  return map;
};
const buildWorkerChanges = (beforeWorkers, afterWorkers) => {
  const beforeMap = workerMap(beforeWorkers);
  const afterMap = workerMap(afterWorkers);
  const added = [];
  const removed = [];
  const updated = [];
  afterMap.forEach((afterEntry, key) => {
    const beforeEntry = beforeMap.get(key);
    if (!beforeEntry) {
      added.push({
        ...afterEntry,
        before: undefined,
        after: afterEntry.before
      });
      return;
    }
    const changes = fieldChanges(beforeEntry.before, afterEntry.before, WORKER_COMPARE_FIELDS, WORKER_FIELD_LABELS);
    if (changes.length > 0) {
      updated.push({
        key,
        workerId: afterEntry.workerId || beforeEntry.workerId,
        name: afterEntry.name || beforeEntry.name,
        role: afterEntry.role || beforeEntry.role,
        before: beforeEntry.before,
        after: afterEntry.before,
        changes
      });
    }
  });
  beforeMap.forEach((beforeEntry, key) => {
    if (!afterMap.has(key)) {
      removed.push(beforeEntry);
    }
  });
  return {
    added,
    removed,
    updated
  };
};
const buildDailyReportChangeSet = (action, beforeReport, afterReport) => {
  const before = snapshotReport(beforeReport);
  const after = snapshotReport(afterReport);
  const reportFieldChanges = action === 'updated' ? fieldChanges(before, after, REPORT_COMPARE_FIELDS, REPORT_FIELD_LABELS) : [];
  const workerChanges = buildWorkerChanges(before === null || before === void 0 ? void 0 : before.workers, after === null || after === void 0 ? void 0 : after.workers);
  const summaryLines = [];
  if (action === 'created') {
    summaryLines.push('출력일보가 신규 저장되었습니다.');
  } else if (action === 'deleted') {
    summaryLines.push('출력일보가 삭제되었습니다.');
  } else if (reportFieldChanges.length > 0) {
    summaryLines.push(`기본 정보 ${reportFieldChanges.length}개 항목이 변경되었습니다.`);
  }
  if (workerChanges.added.length > 0) summaryLines.push(`작업자 ${workerChanges.added.length}명이 추가되었습니다.`);
  if (workerChanges.removed.length > 0) summaryLines.push(`작업자 ${workerChanges.removed.length}명이 삭제되었습니다.`);
  if (workerChanges.updated.length > 0) summaryLines.push(`작업자 ${workerChanges.updated.length}명의 상세 정보가 수정되었습니다.`);
  const beforeManDay = Number((before === null || before === void 0 ? void 0 : before.totalManDay) || 0);
  const afterManDay = Number((after === null || after === void 0 ? void 0 : after.totalManDay) || 0);
  if (action === 'updated' && beforeManDay !== afterManDay) {
    summaryLines.push(`총공수 ${formatNumber(beforeManDay)}공수에서 ${formatNumber(afterManDay)}공수로 변경되었습니다.`);
  }
  if (summaryLines.length === 0) {
    summaryLines.push('저장 값은 갱신되었으나 주요 업무 필드 변경은 감지되지 않았습니다.');
  }
  const changeCount = reportFieldChanges.length + workerChanges.added.length + workerChanges.removed.length + workerChanges.updated.reduce((sum, worker) => {
    var _worker$changes;
    return sum + (((_worker$changes = worker.changes) === null || _worker$changes === void 0 ? void 0 : _worker$changes.length) || 0);
  }, 0);
  return {
    fieldChanges: reportFieldChanges,
    workerChanges,
    summaryLines,
    changeCount
  };
};
const resolveActor = () => {
  const user = _config_firebase__WEBPACK_IMPORTED_MODULE_1__.auth.currentUser;
  if (!user) {
    return {
      uid: 'system',
      name: 'ERP 시스템',
      email: null
    };
  }
  return {
    uid: user.uid,
    name: user.displayName || user.email || '사용자',
    email: user.email || null
  };
};
const normalizeLog = (id, data) => {
  var _data$actor, _data$actor2, _data$actor3, _data$workerChanges, _data$workerChanges2, _data$workerChanges3;
  return {
    id,
    action: data.action || 'updated',
    actionLabel: data.actionLabel || ACTION_LABELS[data.action] || '변경',
    reportId: String(data.reportId || ''),
    reportDate: String(data.reportDate || ''),
    siteId: data.siteId ? String(data.siteId) : undefined,
    siteName: String(data.siteName || '현장 미지정'),
    teamId: data.teamId ? String(data.teamId) : undefined,
    teamName: String(data.teamName || '팀 미지정'),
    actor: {
      uid: String(((_data$actor = data.actor) === null || _data$actor === void 0 ? void 0 : _data$actor.uid) || 'system'),
      name: String(((_data$actor2 = data.actor) === null || _data$actor2 === void 0 ? void 0 : _data$actor2.name) || 'ERP 시스템'),
      email: ((_data$actor3 = data.actor) === null || _data$actor3 === void 0 ? void 0 : _data$actor3.email) || null
    },
    source: String(data.source || 'dailyReportService'),
    before: data.before || null,
    after: data.after || null,
    fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
    workerChanges: {
      added: Array.isArray((_data$workerChanges = data.workerChanges) === null || _data$workerChanges === void 0 ? void 0 : _data$workerChanges.added) ? data.workerChanges.added : [],
      removed: Array.isArray((_data$workerChanges2 = data.workerChanges) === null || _data$workerChanges2 === void 0 ? void 0 : _data$workerChanges2.removed) ? data.workerChanges.removed : [],
      updated: Array.isArray((_data$workerChanges3 = data.workerChanges) === null || _data$workerChanges3 === void 0 ? void 0 : _data$workerChanges3.updated) ? data.workerChanges.updated : []
    },
    summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
    summaryText: String(data.summaryText || ''),
    changeCount: Number(data.changeCount || 0),
    createdAt: data.createdAt instanceof firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp ? data.createdAt : firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.now(),
    createdAtIso: String(data.createdAtIso || '')
  };
};
const dailyReportLogService = {
  collectionName: COLLECTION_NAME,
  actionLabels: ACTION_LABELS,
  buildChangeSet: buildDailyReportChangeSet,
  createLog: async input => {
    const before = snapshotReport(input.before);
    const after = snapshotReport(input.after);
    const anchor = after || before;
    const changeSet = buildDailyReportChangeSet(input.action, before, after);
    const now = firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.Timestamp.now();
    const logRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME));
    const log = {
      id: logRef.id,
      action: input.action,
      actionLabel: ACTION_LABELS[input.action],
      reportId: getReportId(anchor) || logRef.id,
      reportDate: String((anchor === null || anchor === void 0 ? void 0 : anchor.date) || ''),
      siteId: (anchor === null || anchor === void 0 ? void 0 : anchor.siteId) || undefined,
      siteName: asText((anchor === null || anchor === void 0 ? void 0 : anchor.siteName) || (anchor === null || anchor === void 0 ? void 0 : anchor.siteId), '현장 미지정'),
      teamId: (anchor === null || anchor === void 0 ? void 0 : anchor.teamId) || undefined,
      teamName: asText((anchor === null || anchor === void 0 ? void 0 : anchor.teamName) || (anchor === null || anchor === void 0 ? void 0 : anchor.responsibleTeamName) || (anchor === null || anchor === void 0 ? void 0 : anchor.teamId), '팀 미지정'),
      actor: resolveActor(),
      source: input.source || 'dailyReportService',
      before,
      after,
      fieldChanges: changeSet.fieldChanges,
      workerChanges: changeSet.workerChanges,
      summaryLines: changeSet.summaryLines,
      summaryText: changeSet.summaryLines.join('\n'),
      changeCount: changeSet.changeCount,
      createdAt: now,
      createdAtIso: now.toDate().toISOString()
    };
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(logRef, stripUndefined(log));
    return log;
  },
  subscribeRecentLogs: (callback, limitCount = 300, onError) => {
    const logsQuery = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('createdAt', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(limitCount));
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(logsQuery, snapshot => callback(snapshot.docs.map(docSnap => normalizeLog(docSnap.id, docSnap.data()))), error => {
      console.error('[dailyReportLogService] subscribe failed:', error);
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