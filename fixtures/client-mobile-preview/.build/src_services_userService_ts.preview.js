"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_userService_ts"],{

/***/ "./src/services/userFirestoreService.ts"
/*!**********************************************!*\
  !*** ./src/services/userFirestoreService.ts ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   userFirestoreService: () => (/* binding */ userFirestoreService)
/* harmony export */ });
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");


const COLLECTION_NAME = 'users';

/**
 * UserFirestoreService
 * Handles all direct Firestore operations for user data.
 */
const userFirestoreService = {
  // Get user by UID
  getUser: async uid => {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, uid);
    const docSnap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDoc)(docRef);
    if (docSnap.exists()) {
      return {
        uid: docSnap.id,
        ...docSnap.data()
      };
    }
    return null;
  },
  // Get all users
  getAllUsers: async () => {
    const querySnapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  },
  // Save or merge user data
  saveUser: async (uid, data) => {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, uid);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.setDoc)(docRef, {
      ...data,
      updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now()
    }, {
      merge: true
    });
  },
  // Update specific user fields
  updateUser: async (uid, updates) => {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_0__.db, COLLECTION_NAME, uid);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.updateDoc)(docRef, {
      ...updates,
      updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.now()
    });
  }
};

/***/ },

/***/ "./src/services/userService.ts"
/*!*************************************!*\
  !*** ./src/services/userService.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   userService: () => (/* binding */ userService)
/* harmony export */ });
/* harmony import */ var _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./userFirestoreService */ "./src/services/userFirestoreService.ts");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _types_accountLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types/accountLink */ "./src/types/accountLink.ts");
/* harmony import */ var _constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../constants/businessPartnerPositions */ "./src/constants/businessPartnerPositions.ts");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");
/* harmony import */ var _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/devAdminFixtures */ "./src/utils/devAdminFixtures.ts");







// In-memory cache for user data
const userCache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

const parseLinkedWorkerIds = raw => {
  if (Array.isArray(raw)) return raw.map(String);
  const value = raw ? String(raw) : '';
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(v => String(v)).filter(Boolean);
  } catch {
    return [];
  }
};
const serializeLinkedWorkerIds = ids => {
  return Array.from(new Set(ids.map(v => String(v)).filter(Boolean)));
};
const buildDevUnlinkUserPatch = (existing, updates, removedLinkId) => {
  const hasRemainingLink = [...(updates.linkedWorkerIds || []), ...(updates.linkedOfficeStaffIds || []), ...(updates.linkedCompanyIds || [])].length > 0;
  return {
    ...updates,
    primaryLinkId: existing.primaryLinkId === removedLinkId ? '' : existing.primaryLinkId,
    ...(hasRemainingLink ? {} : {
      position: '',
      department: '',
      status: 'pending',
      primaryLinkId: '',
      linkedSiteIds: [],
      requestedAccountType: existing.accountType
    })
  };
};
const deriveExistingAccountDefaults = existing => {
  if (!existing) return {};
  const role = String(existing.role || '').trim().toLowerCase();
  const linkedWorkerIds = parseLinkedWorkerIds(existing.linkedWorkerIds);
  const linkedCompanyIds = parseLinkedWorkerIds(existing.linkedCompanyIds);
  const linkedOfficeStaffIds = parseLinkedWorkerIds(existing.linkedOfficeStaffIds);
  const adminLikeRoles = ['admin', 'administrator', '관리자', '사장', '실장', 'manager', '매니저', '메니저'];
  const updates = {};
  if (!existing.accountType) {
    if (linkedWorkerIds.length > 0) {
      updates.accountType = 'worker';
    } else if (linkedOfficeStaffIds.length > 0) {
      updates.accountType = 'office';
    } else if (linkedCompanyIds.length > 0) {
      updates.accountType = 'partner_company';
    } else if (adminLikeRoles.includes(role)) {
      updates.accountType = 'office';
    }
  }
  if (!existing.status && updates.accountType) {
    updates.status = 'active';
  }
  return updates;
};
const getWorkerLinkKeys = (workerId, worker) => {
  return Array.from(new Set([String(workerId || '').trim(), String((worker === null || worker === void 0 ? void 0 : worker.id) || '').trim(), String((worker === null || worker === void 0 ? void 0 : worker.legacyId) || '').trim()].filter(Boolean)));
};
const resolveWorkerForLinking = async workerId => {
  const {
    manpowerService
  } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./manpowerService */ "./src/services/manpowerService.ts"));
  let worker = await manpowerService.getWorker(workerId);
  if (!worker) {
    const workers = await manpowerService.getWorkers(true);
    worker = workers.find(item => item.id === workerId || item.legacyId === workerId) || null;
  }
  return {
    manpowerService,
    worker
  };
};
const getOfficeStaffLinkKeys = (staffId, staff) => {
  return Array.from(new Set([String(staffId || '').trim(), String((staff === null || staff === void 0 ? void 0 : staff.id) || '').trim(), String((staff === null || staff === void 0 ? void 0 : staff.legacyId) || '').trim()].filter(Boolean)));
};
const resolveOfficeStaffForLinking = async staffId => {
  const {
    officeStaffService
  } = await __webpack_require__.e(/*! import() */ "src_services_officeStaffService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./officeStaffService */ "./src/services/officeStaffService.ts"));
  let staff = await officeStaffService.getOfficeStaffMember(staffId);
  if (!staff) {
    const rows = await officeStaffService.getOfficeStaff(true);
    staff = rows.find(item => item.id === staffId || item.legacyId === staffId) || null;
  }
  return {
    officeStaffService,
    staff
  };
};

/**
 * UserService (Facade)
 * Completely migrated to Firestore-only operations.
 */
const userService = {
  // Save or update user on login
  saveUser: async user => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      return;
    }
    try {
      var _existing$displayName;
      const existing = await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.getUser(user.uid);
      const now = new Date();
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: (_existing$displayName = existing === null || existing === void 0 ? void 0 : existing.displayName) !== null && _existing$displayName !== void 0 ? _existing$displayName : user.displayName,
        photoURL: user.photoURL,
        lastLogin: firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.Timestamp.fromDate(now)
      };
      if (!existing) {
        userData.role = 'user';
        userData.linkedWorkerIds = [];
        userData.linkedCompanyIds = [];
        userData.linkedOfficeStaffIds = [];
        userData.linkedSiteIds = [];
        userData.status = 'pending';
      } else {
        Object.assign(userData, deriveExistingAccountDefaults(existing));
      }
      await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.saveUser(user.uid, userData);
      userCache.delete(user.uid); // Invalidate cache
    } catch (error) {
      console.error("Error saving user:", error);
      throw error;
    }
  },
  // Get a single user by UID
  getUser: async (uid, forceRefresh = false) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      return _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid) || null;
    }
    const now = Date.now();
    const cached = userCache.get(uid);
    if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const user = await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.getUser(uid);
    if (user) {
      userCache.set(uid, {
        data: user,
        timestamp: now
      });
    }
    return user;
  },
  // Get all users
  getAllUsers: async () => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      return [..._utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers].sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
    }
    return _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.getAllUsers();
  },
  // Link a user to a worker
  linkUserToWorker: async (uid, workerId, _actorEmail = 'system') => {
    try {
      const {
        worker
      } = await resolveWorkerForLinking(workerId);
      if (!(worker !== null && worker !== void 0 && worker.id)) {
        throw new Error('worker-not-found');
      }
      const workerKeys = getWorkerLinkKeys(workerId, worker);
      const {
        accountLinkService
      } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
      if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
        const alreadyLinked = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid !== uid && parseLinkedWorkerIds(user.linkedWorkerIds).some(id => workerKeys.includes(id)));
        if (alreadyLinked || worker.uid && worker.uid !== uid) throw new Error('worker-already-managed');
        const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
        if (!existing) throw new Error('user-not-found');
        (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, {
          linkedWorkerIds: serializeLinkedWorkerIds([...parseLinkedWorkerIds(existing.linkedWorkerIds), worker.id]),
          accountType: 'worker',
          status: 'active',
          primaryLinkId: accountLinkService.getLinkId(uid, 'worker', worker.id),
          position: worker.role || '일반',
          department: worker.teamName || ''
        });
        (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevWorker)(worker.id, {
          uid
        });
        return;
      }
      await accountLinkService.linkConnection({
        uid,
        entityType: 'worker',
        entityId: worker.id,
        relationRole: 'staff'
      });
      userCache.delete(uid);
    } catch (error) {
      console.error("Error linking user to worker:", error);
      throw error;
    }
  },
  // Unlink a user from a worker
  unlinkUserFromWorker: async (uid, workerId, _actorEmail = 'system') => {
    try {
      const {
        worker
      } = await resolveWorkerForLinking(workerId);
      const workerKeys = getWorkerLinkKeys(workerId, worker);
      const {
        accountLinkService
      } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
      const canonicalWorkerId = (worker === null || worker === void 0 ? void 0 : worker.id) || workerId;
      if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
        const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
        if (!existing) return;
        const linkedWorkerIds = parseLinkedWorkerIds(existing.linkedWorkerIds).filter(id => !workerKeys.includes(id));
        (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, buildDevUnlinkUserPatch(existing, {
          linkedWorkerIds,
          linkedOfficeStaffIds: parseLinkedWorkerIds(existing.linkedOfficeStaffIds),
          linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds)
        }, accountLinkService.getLinkId(uid, 'worker', canonicalWorkerId)));
        const devWorker = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devWorkers.find(row => workerKeys.includes(String(row.id || '')));
        if (devWorker !== null && devWorker !== void 0 && devWorker.id && devWorker.uid === uid) (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevWorker)(devWorker.id, {
          uid: ''
        });
        return;
      }
      await accountLinkService.unlinkConnection({
        uid,
        entityType: 'worker',
        entityId: canonicalWorkerId,
        entityIds: workerKeys
      });
      userCache.delete(uid);
    } catch (error) {
      console.error("Error unlinking user from worker:", error);
      throw error;
    }
  },
  // Cleanup invalid links
  cleanupInvalidLinks: async (users, allWorkerIds) => {
    try {
      const workerIdSet = new Set(allWorkerIds);
      for (const user of users) {
        const currentLinks = parseLinkedWorkerIds(user.linkedWorkerIds);
        const validLinks = currentLinks.filter(id => workerIdSet.has(id));
        if (validLinks.length !== currentLinks.length) {
          await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.updateUser(user.uid, {
            linkedWorkerIds: validLinks
          });
        }
      }
    } catch (error) {
      console.error("Error cleaning up invalid links:", error);
    }
  },
  // Update user role
  updateUserRole: async (uid, role) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, {
        role
      });
      return;
    }
    await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.updateUser(uid, {
      role
    });
    userCache.delete(uid); // Invalidate cache
  },
  // Update user profile
  updateUserProfile: async (uid, updates) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, updates);
      return;
    }
    await _userFirestoreService__WEBPACK_IMPORTED_MODULE_0__.userFirestoreService.updateUser(uid, updates);
    userCache.delete(uid); // Invalidate cache
  },
  linkUserToOfficeStaff: async (uid, staffId, _actorEmail = 'system', relationRole = 'staff', _status = 'active') => {
    const {
      staff
    } = await resolveOfficeStaffForLinking(staffId);
    if (!(staff !== null && staff !== void 0 && staff.id)) {
      throw new Error('office-staff-not-found');
    }
    const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
    const {
      accountLinkService
    } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      const alreadyLinked = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid !== uid && parseLinkedWorkerIds(user.linkedOfficeStaffIds).some(id => staffKeys.includes(id)));
      if (alreadyLinked || staff.uid && staff.uid !== uid) throw new Error('office-staff-already-managed');
      const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
      if (!existing) throw new Error('user-not-found');
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, {
        linkedOfficeStaffIds: serializeLinkedWorkerIds([...parseLinkedWorkerIds(existing.linkedOfficeStaffIds), staff.id]),
        accountType: 'office',
        status: 'active',
        primaryLinkId: accountLinkService.getLinkId(uid, 'office', staff.id),
        position: staff.role || '사무실직원',
        department: staff.department || ''
      });
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevOfficeStaff)(staff.id, {
        uid
      });
      return;
    }
    await accountLinkService.linkConnection({
      uid,
      entityType: 'office',
      entityId: staff.id,
      relationRole
    });
    userCache.delete(uid);
  },
  unlinkUserFromOfficeStaff: async (uid, staffId, _actorEmail = 'system') => {
    const {
      staff
    } = await resolveOfficeStaffForLinking(staffId);
    const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
    const {
      accountLinkService
    } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
    const canonicalStaffId = (staff === null || staff === void 0 ? void 0 : staff.id) || staffId;
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
      if (!existing) return;
      const linkedOfficeStaffIds = parseLinkedWorkerIds(existing.linkedOfficeStaffIds).filter(id => !staffKeys.includes(id));
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, buildDevUnlinkUserPatch(existing, {
        linkedWorkerIds: parseLinkedWorkerIds(existing.linkedWorkerIds),
        linkedOfficeStaffIds,
        linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds)
      }, accountLinkService.getLinkId(uid, 'office', canonicalStaffId)));
      const devStaff = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devOfficeStaff.find(row => staffKeys.includes(String(row.id || '')));
      if (devStaff !== null && devStaff !== void 0 && devStaff.id && devStaff.uid === uid) (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevOfficeStaff)(devStaff.id, {
        uid: ''
      });
      return;
    }
    await accountLinkService.unlinkConnection({
      uid,
      entityType: 'office',
      entityId: canonicalStaffId,
      entityIds: staffKeys
    });
    userCache.delete(uid);
  },
  linkUserToCompany: async (uid, company, _actorEmail = 'system', relationRole = 'staff', _status = 'active') => {
    const companyId = String(company.id || '').trim();
    if (!companyId) throw new Error('company-not-found');
    const {
      accountLinkService
    } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      var _findBusinessPartnerP;
      const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
      if (!existing) throw new Error('user-not-found');
      const accountType = (0,_types_accountLink__WEBPACK_IMPORTED_MODULE_2__.resolveAccountTypeFromCompanyType)(company.type);
      const position = ((_findBusinessPartnerP = (0,_constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__.findBusinessPartnerPositionDefinition)(company.type, company.type)) === null || _findBusinessPartnerP === void 0 ? void 0 : _findBusinessPartnerP.name) || String(company.type || '협력사');
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, {
        linkedCompanyIds: serializeLinkedWorkerIds([...parseLinkedWorkerIds(existing.linkedCompanyIds), companyId]),
        accountType,
        status: 'active',
        primaryLinkId: accountLinkService.getLinkId(uid, 'company', companyId),
        position
      });
      return;
    }
    await accountLinkService.linkConnection({
      uid,
      entityType: 'company',
      entityId: companyId,
      relationRole
    });
    userCache.delete(uid);
  },
  unlinkUserFromCompany: async (uid, companyId, _actorEmail = 'system') => {
    const {
      accountLinkService
    } = await __webpack_require__.e(/*! import() */ "src_services_accountLinkService_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./accountLinkService */ "./src/services/accountLinkService.ts"));
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      const existing = _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.devUsers.find(user => user.uid === uid);
      if (!existing) return;
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_5__.updateDevUser)(uid, buildDevUnlinkUserPatch(existing, {
        linkedWorkerIds: parseLinkedWorkerIds(existing.linkedWorkerIds),
        linkedOfficeStaffIds: parseLinkedWorkerIds(existing.linkedOfficeStaffIds),
        linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds).filter(id => id !== companyId)
      }, accountLinkService.getLinkId(uid, 'company', companyId)));
      return;
    }
    await accountLinkService.unlinkConnection({
      uid,
      entityType: 'company',
      entityId: companyId
    });
    userCache.delete(uid);
  }
};

/***/ },

/***/ "./src/types/accountLink.ts"
/*!**********************************!*\
  !*** ./src/types/accountLink.ts ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ACCOUNT_RELATION_ROLE_LABELS: () => (/* binding */ ACCOUNT_RELATION_ROLE_LABELS),
/* harmony export */   ACCOUNT_TYPE_LABELS: () => (/* binding */ ACCOUNT_TYPE_LABELS),
/* harmony export */   getAccountRelationRoleLabel: () => (/* binding */ getAccountRelationRoleLabel),
/* harmony export */   resolveAccountTypeFromCompanyType: () => (/* binding */ resolveAccountTypeFromCompanyType),
/* harmony export */   resolveEntitySubTypeFromCompanyType: () => (/* binding */ resolveEntitySubTypeFromCompanyType)
/* harmony export */ });
const ACCOUNT_TYPE_LABELS = {
  worker: '작업자',
  office: '사무실',
  partner_company: '협력사',
  construction_company: '건설사',
  rental_company: '임대사'
};
const ACCOUNT_RELATION_ROLE_LABELS = {
  owner: '대표/소유자',
  manager: '관리자',
  staff: '담당자',
  viewer: '조회자'
};
const getAccountRelationRoleLabel = (role, entityType) => {
  if (entityType === 'worker') {
    if (role === 'owner') return '본인 작업자';
    if (role === 'staff') return '작업자';
  }
  return ACCOUNT_RELATION_ROLE_LABELS[role] || role;
};
const resolveAccountTypeFromCompanyType = companyType => {
  const type = String(companyType || '').trim();
  if (type === '협력사') return 'partner_company';
  if (type === '건설사' || type === '시공사') return 'construction_company';
  if (type === '임대사') return 'rental_company';
  return 'partner_company';
};
const resolveEntitySubTypeFromCompanyType = companyType => {
  const type = String(companyType || '').trim();
  if (type === '협력사' || type === '건설사' || type === '시공사' || type === '임대사') {
    return type;
  }
  return '기타';
};

/***/ }

}]);