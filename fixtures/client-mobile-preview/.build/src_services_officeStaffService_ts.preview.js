"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_officeStaffService_ts"],{

/***/ "./src/services/officeStaffService.ts"
/*!********************************************!*\
  !*** ./src/services/officeStaffService.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   officeStaffService: () => (/* binding */ officeStaffService)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types_zod_officeStaffSchema__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types/zod/officeStaffSchema */ "./src/types/zod/officeStaffSchema.ts");
/* harmony import */ var _utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/firestoreConverter */ "./src/utils/firestoreConverter.ts");
/* harmony import */ var _utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/stripUndefinedFields */ "./src/utils/stripUndefinedFields.ts");
/* harmony import */ var _utils_swal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/swal */ "./src/utils/swal.ts");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");
/* harmony import */ var _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../utils/devAdminFixtures */ "./src/utils/devAdminFixtures.ts");








const COLLECTION_NAME = 'office_staff';
const CACHE_TTL = 300000;
const officeStaffConverter = (0,_utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_3__.createConverter)(_types_zod_officeStaffSchema__WEBPACK_IMPORTED_MODULE_2__.OfficeStaffSchema);
let cachedOfficeStaff = null;
let lastFetchTime = 0;
const normalizeSalaryFields = row => {
  const salaryModel = row.salaryModel || row.payType || '월급제';
  return {
    ...row,
    salaryModel,
    payType: row.payType || salaryModel,
    status: row.status || '재직',
    unitPrice: Number(row.unitPrice || 0)
  };
};
const getStaffKeys = (staffId, staff) => Array.from(new Set([String(staffId || '').trim(), String((staff === null || staff === void 0 ? void 0 : staff.id) || '').trim(), String((staff === null || staff === void 0 ? void 0 : staff.legacyId) || '').trim()].filter(Boolean)));
const officeStaffService = {
  getCollection() {
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME).withConverter(officeStaffConverter);
  },
  async getOfficeStaff(forceRefresh = false) {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_6__.isDevAdminSessionEnabled)()) {
      return [..._utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_7__.devOfficeStaff];
    }
    const now = Date.now();
    if (!forceRefresh && cachedOfficeStaff && now - lastFetchTime < CACHE_TTL) {
      return cachedOfficeStaff;
    }
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.orderBy)('name', 'asc'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    cachedOfficeStaff = snap.docs.map(item => normalizeSalaryFields(item.data()));
    lastFetchTime = now;
    return cachedOfficeStaff;
  },
  async getOfficeStaffMember(id) {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_6__.isDevAdminSessionEnabled)()) {
      return _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_7__.devOfficeStaff.find(staff => String(staff.id) === String(id)) || null;
    }
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id).withConverter(officeStaffConverter));
    return snap.exists() ? normalizeSalaryFields(snap.data()) : null;
  },
  async getOfficeStaffByEmail(email) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('email', '==', email.trim()), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(1));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    if (snap.empty) return null;
    return normalizeSalaryFields({
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    });
  },
  async getOfficeStaffByUid(uid) {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_6__.isDevAdminSessionEnabled)()) {
      return _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_7__.devOfficeStaff.find(staff => String(staff.uid || '') === String(uid)) || null;
    }
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('uid', '==', uid), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.limit)(1));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    if (snap.empty) return null;
    return normalizeSalaryFields({
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    });
  },
  async findOfficeStaffForLinking(name, idNumber) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.where)('name', '==', name.trim()));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDocs)(q);
    const found = snap.docs.find(item => {
      const data = item.data();
      return String(data.idNumber || '').trim() === idNumber.trim();
    });
    return found ? normalizeSalaryFields({
      id: found.id,
      ...found.data()
    }) : null;
  },
  async addOfficeStaff(staff) {
    var _staff$isActive;
    const salaryModel = staff.salaryModel || staff.payType || '월급제';
    const data = (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_4__.stripUndefinedFields)({
      ...staff,
      salaryModel,
      payType: staff.payType || salaryModel,
      status: staff.status || '재직',
      isActive: (_staff$isActive = staff.isActive) !== null && _staff$isActive !== void 0 ? _staff$isActive : true,
      unitPrice: Number(staff.unitPrice || 0),
      createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME)).withConverter(officeStaffConverter);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(docRef, data);
    cachedOfficeStaff = null;
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.saved('사무실 직원', 1);
    return docRef.id;
  },
  async updateOfficeStaff(id, updates) {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_6__.isDevAdminSessionEnabled)()) {
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_7__.updateDevOfficeStaff)(id, updates);
      return;
    }
    const shouldSyncUserPosition = Object.prototype.hasOwnProperty.call(updates, 'role');
    const before = shouldSyncUserPosition ? await this.getOfficeStaffMember(id) : null;
    const salaryModel = updates.salaryModel || updates.payType;
    const data = (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_4__.stripUndefinedFields)({
      ...updates,
      ...(salaryModel ? {
        salaryModel,
        payType: updates.payType || salaryModel
      } : {}),
      ...(updates.unitPrice !== undefined ? {
        unitPrice: Number(updates.unitPrice || 0)
      } : {})
    });
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.updateDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id).withConverter(officeStaffConverter), {
      ...data,
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.serverTimestamp)()
    });
    cachedOfficeStaff = null;
    if (shouldSyncUserPosition && before !== null && before !== void 0 && before.uid) {
      var _updates$role;
      const {
        userService
      } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./userService */ "./src/services/userService.ts"));
      await userService.updateUserProfile(String(before.uid), {
        position: String((_updates$role = updates.role) !== null && _updates$role !== void 0 ? _updates$role : '').trim()
      });
    }
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.updated('사무실 직원');
  },
  async deleteOfficeStaff(id) {
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.deleteDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, id));
    cachedOfficeStaff = null;
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.deleted('사무실 직원', 1);
  },
  async resolveOfficeStaff(staffId) {
    let staff = await this.getOfficeStaffMember(staffId);
    if (!staff) {
      const rows = await this.getOfficeStaff(true);
      const keys = getStaffKeys(staffId);
      staff = rows.find(item => keys.includes(String(item.id)) || keys.includes(String(item.legacyId))) || null;
    }
    return staff;
  }
};

/***/ },

/***/ "./src/types/zod/officeStaffSchema.ts"
/*!********************************************!*\
  !*** ./src/types/zod/officeStaffSchema.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OfficeStaffSchema: () => (/* binding */ OfficeStaffSchema),
/* harmony export */   OfficeStaffStatusSchema: () => (/* binding */ OfficeStaffStatusSchema)
/* harmony export */ });
/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! zod */ "./node_modules/zod/v3/types.js");

const OfficeStaffStatusSchema = zod__WEBPACK_IMPORTED_MODULE_0__.string().default('재직');
const OfficeStaffSchema = zod__WEBPACK_IMPORTED_MODULE_0__.object({
  id: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  legacyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  uid: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  name: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, '이름은 필수입니다.'),
  idNumber: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  address: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  contact: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  email: zod__WEBPACK_IMPORTED_MODULE_0__.string().email('올바른 이메일 형식이 아닙니다.').optional().nullable().or(zod__WEBPACK_IMPORTED_MODULE_0__.literal('')),
  role: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  department: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  employmentType: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  status: OfficeStaffStatusSchema,
  unitPrice: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().default(0),
  payType: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  salaryModel: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  bankName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  accountNumber: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  accountHolder: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  joinDate: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  memo: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  fileNameSaved: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  isActive: zod__WEBPACK_IMPORTED_MODULE_0__.boolean().optional().default(true),
  createdAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional(),
  updatedAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional()
});

/***/ }

}]);