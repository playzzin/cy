"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_accountLinkService_ts"],{

/***/ "./src/services/accountLinkService.ts"
/*!********************************************!*\
  !*** ./src/services/accountLinkService.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   accountLinkService: () => (/* binding */ accountLinkService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var firebase_functions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/functions */ "./node_modules/firebase/functions/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");
/* harmony import */ var _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/devAdminFixtures */ "./src/utils/devAdminFixtures.ts");
/* harmony import */ var _utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/stripUndefinedFields */ "./src/utils/stripUndefinedFields.ts");
/* harmony import */ var _types_accountLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../types/accountLink */ "./src/types/accountLink.ts");







const COLLECTION_NAME = 'account_links';
const normalizeDocId = value => value.trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `link_${Date.now()}`;
const buildLinkId = (uid, entityType, entityId) => normalizeDocId(`${uid}_${entityType}_${entityId}`);
const sortByUpdatedDesc = links => [...links].sort((a, b) => {
  var _ref, _a$updatedAt$toMillis, _a$updatedAt, _a$updatedAt$toMillis2, _a$createdAt, _a$createdAt$toMillis, _ref2, _b$updatedAt$toMillis, _b$updatedAt, _b$updatedAt$toMillis2, _b$createdAt, _b$createdAt$toMillis;
  const aMillis = (_ref = (_a$updatedAt$toMillis = (_a$updatedAt = a.updatedAt) === null || _a$updatedAt === void 0 ? void 0 : (_a$updatedAt$toMillis2 = _a$updatedAt.toMillis) === null || _a$updatedAt$toMillis2 === void 0 ? void 0 : _a$updatedAt$toMillis2.call(_a$updatedAt)) !== null && _a$updatedAt$toMillis !== void 0 ? _a$updatedAt$toMillis : (_a$createdAt = a.createdAt) === null || _a$createdAt === void 0 ? void 0 : (_a$createdAt$toMillis = _a$createdAt.toMillis) === null || _a$createdAt$toMillis === void 0 ? void 0 : _a$createdAt$toMillis.call(_a$createdAt)) !== null && _ref !== void 0 ? _ref : 0;
  const bMillis = (_ref2 = (_b$updatedAt$toMillis = (_b$updatedAt = b.updatedAt) === null || _b$updatedAt === void 0 ? void 0 : (_b$updatedAt$toMillis2 = _b$updatedAt.toMillis) === null || _b$updatedAt$toMillis2 === void 0 ? void 0 : _b$updatedAt$toMillis2.call(_b$updatedAt)) !== null && _b$updatedAt$toMillis !== void 0 ? _b$updatedAt$toMillis : (_b$createdAt = b.createdAt) === null || _b$createdAt === void 0 ? void 0 : (_b$createdAt$toMillis = _b$createdAt.toMillis) === null || _b$createdAt$toMillis === void 0 ? void 0 : _b$createdAt$toMillis.call(_b$createdAt)) !== null && _ref2 !== void 0 ? _ref2 : 0;
  return bMillis - aMillis;
});
const accountLinkService = {
  getLinkId(uid, entityType, entityId) {
    return buildLinkId(uid, entityType, entityId);
  },
  async getAllLinks() {
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME));
    return sortByUpdatedDesc(snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    })));
  },
  async getLinksByUid(uid) {
    var _auth$currentUser;
    if (((_auth$currentUser = _config_firebase__WEBPACK_IMPORTED_MODULE_2__.auth.currentUser) === null || _auth$currentUser === void 0 ? void 0 : _auth$currentUser.uid) === uid) {
      return (await accountLinkService.getMyStatus()).links;
    }
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('uid', '==', uid));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    return sortByUpdatedDesc(snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    })));
  },
  async getActiveLinksByUid(uid) {
    return (await accountLinkService.getLinksByUid(uid)).filter(link => link.status === 'active');
  },
  async getPendingLinks() {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('status', '==', 'pending'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    return sortByUpdatedDesc(snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    })));
  },
  async getMyStatus() {
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'getMyAccountLinkStatus');
    const response = await callable({});
    return response.data;
  },
  async getMyWorkerCandidate(params) {
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'getMyAccountLinkCandidate');
    const response = await callable(params);
    return response.data.candidate;
  },
  async searchCompanies(params) {
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'searchAccountLinkCompanies');
    const response = await callable(params);
    return response.data.companies;
  },
  async submitRequest(input) {
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'submitAccountLinkRequest');
    const response = await callable(input);
    return response.data;
  },
  async upsertLink(input) {
    var _input$userEmail, _input$userDisplayNam;
    const entityId = String(input.entityId || '').trim();
    if (!input.uid || !entityId) {
      throw new Error('account-link-invalid-input');
    }
    const id = buildLinkId(input.uid, input.entityType, entityId);
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME, id);
    const status = input.status || 'active';
    const nowFields = status === 'pending' ? {
      requestedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    } : status === 'active' ? {
      approvedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    } : {};
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(docRef, (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)({
      uid: input.uid,
      userEmail: (_input$userEmail = input.userEmail) !== null && _input$userEmail !== void 0 ? _input$userEmail : null,
      userDisplayName: (_input$userDisplayNam = input.userDisplayName) !== null && _input$userDisplayNam !== void 0 ? _input$userDisplayNam : null,
      accountType: input.accountType,
      entityType: input.entityType,
      entityId,
      entityName: input.entityName,
      entitySubType: input.entitySubType,
      relationRole: input.relationRole || 'staff',
      status,
      requestedEntity: input.requestedEntity,
      memo: input.memo,
      createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)(),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)(),
      ...nowFields
    }), {
      merge: true
    });
    return id;
  },
  async requestOfficeLink(params) {
    const officeEntityName = params.staffName || params.userDisplayName || params.department || '사무실';
    const result = await accountLinkService.submitRequest({
      accountType: 'office',
      entityId: params.officeStaffId,
      entityName: officeEntityName,
      relationRole: 'staff',
      requestedEntity: {
        name: officeEntityName,
        address: params.address,
        department: params.department,
        role: params.position,
        employmentType: params.employmentType,
        salaryModel: params.salaryModel,
        unitPrice: params.unitPrice,
        phone: params.phoneNumber,
        memo: [params.position, params.memo].filter(Boolean).join(' / ')
      }
    });
    return result.linkId;
  },
  async requestWorkerLink(params) {
    const result = await accountLinkService.submitRequest({
      accountType: 'worker',
      entityId: params.entityId,
      entityName: params.name,
      relationRole: 'staff',
      workerPhone: params.identityPhone,
      requestedEntity: {
        name: params.name,
        phone: params.phone,
        address: params.address,
        memo: params.memo
      }
    });
    return result.linkId;
  },
  async requestCompanyLink(params) {
    const result = await accountLinkService.submitRequest({
      accountType: (0,_types_accountLink__WEBPACK_IMPORTED_MODULE_6__.resolveAccountTypeFromCompanyType)(params.companyType),
      entityId: params.companyId,
      entityName: params.companyName,
      companyType: params.companyType,
      relationRole: params.relationRole || 'staff',
      memo: params.memo
    });
    return result.linkId;
  },
  async requestNewCompanyLink(params) {
    const result = await accountLinkService.submitRequest({
      accountType: (0,_types_accountLink__WEBPACK_IMPORTED_MODULE_6__.resolveAccountTypeFromCompanyType)(params.companyType),
      entityName: params.requestedEntity.name || '신규 회사 요청',
      companyType: params.companyType,
      relationRole: params.relationRole || 'staff',
      requestedEntity: params.requestedEntity,
      memo: params.memo
    });
    return result.linkId;
  },
  async approveLink(link, actor) {
    if (!link.id) throw new Error('account-link-id-required');
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'approveAccountLinkRequest');
    await callable({
      linkId: link.id,
      siteIds: link.siteIds
    });
  },
  async rejectLink(link, actor, reason) {
    if (!link.id) throw new Error('account-link-id-required');
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'rejectAccountLinkRequest');
    await callable({
      linkId: link.id,
      reason: (reason === null || reason === void 0 ? void 0 : reason.trim()) || undefined
    });
  },
  async revokeUserAccessApproval(uid) {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) throw new Error('uid is required');
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_3__.isDevAdminSessionEnabled)()) {
      const user = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.devUsers.find(row => row.uid === normalizedUid);
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.updateDevUser)(normalizedUid, {
        position: '',
        department: '',
        additionalPositions: [],
        status: 'pending',
        requestedAccountType: user === null || user === void 0 ? void 0 : user.accountType,
        linkedSiteIds: []
      });
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.setDevUserPositions)(normalizedUid, []);
      return {
        uid: normalizedUid,
        status: 'pending',
        requeuedLinks: 0
      };
    }
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'revokeUserAccessApproval');
    const response = await callable({
      uid: normalizedUid
    });
    return response.data;
  },
  async unlinkConnection(params) {
    const uid = String(params.uid || '').trim();
    const entityId = String(params.entityId || '').trim();
    if (!uid || !entityId) throw new Error('account-link-target-required');
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'unlinkAccountConnection');
    const response = await callable({
      ...params,
      uid,
      entityId,
      entityIds: Array.from(new Set((params.entityIds || []).map(String).filter(Boolean)))
    });
    return response.data;
  },
  async linkConnection(params) {
    const uid = String(params.uid || '').trim();
    const entityId = String(params.entityId || '').trim();
    if (!uid || !entityId) throw new Error('account-link-target-required');
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'linkAccountConnection');
    const response = await callable({
      ...params,
      uid,
      entityId
    });
    return response.data;
  },
  async updateUserAccess(params) {
    const uid = String(params.uid || '').trim();
    const position = String(params.position || '').trim();
    if (!uid || !position) throw new Error('user-access-target-required');
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_3__.isDevAdminSessionEnabled)()) {
      const user = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.devUsers.find(row => row.uid === uid);
      if (!user) throw new Error('user-not-found');
      const additionalPositions = Array.from(new Set(params.additionalPositions.map(String).filter(value => value && value !== position)));
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.updateDevUser)(uid, {
        role: params.role,
        position,
        additionalPositions
      });
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.setDevUserPositions)(uid, additionalPositions);
      if (params.syncLinkedProfiles) {
        _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.devWorkers.filter(row => row.uid === uid && row.id).forEach(row => (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.updateDevWorker)(String(row.id), {
          role: position
        }));
        _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.devOfficeStaff.filter(row => row.uid === uid && row.id).forEach(row => (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_4__.updateDevOfficeStaff)(String(row.id), {
          role: position
        }));
      }
      return {
        uid,
        role: params.role,
        position,
        additionalPositions,
        status: user.status || 'pending'
      };
    }
    const callable = (0,firebase_functions__WEBPACK_IMPORTED_MODULE_1__.httpsCallable)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.functions, 'updateUserAccess');
    const response = await callable({
      ...params,
      uid,
      position
    });
    return response.data;
  },
  async deactivateLink(uid, entityType, entityId) {
    const id = buildLinkId(uid, entityType, entityId);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.updateDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME, id), {
      status: 'inactive',
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
  }
};

/***/ }

}]);