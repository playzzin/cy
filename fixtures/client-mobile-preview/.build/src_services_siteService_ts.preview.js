"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_siteService_ts"],{

/***/ "./src/services/siteFirestoreService.ts"
/*!**********************************************!*\
  !*** ./src/services/siteFirestoreService.ts ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   siteFirestoreService: () => (/* binding */ siteFirestoreService)
/* harmony export */ });
/* harmony import */ var _teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./teamScopedReadService */ "./src/services/teamScopedReadService.ts");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types_zod_siteSchema__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../types/zod/siteSchema */ "./src/types/zod/siteSchema.ts");
/* harmony import */ var _utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/firestoreConverter */ "./src/utils/firestoreConverter.ts");
/* harmony import */ var _utils_swal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/swal */ "./src/utils/swal.ts");






const COLLECTION_NAME = 'sites';
const siteConverter = (0,_utils_firestoreConverter__WEBPACK_IMPORTED_MODULE_4__.createConverter)(_types_zod_siteSchema__WEBPACK_IMPORTED_MODULE_3__.SiteSchema);
const siteFirestoreService = {
  getCollection() {
    return (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME).withConverter(siteConverter);
  },
  async getSite(id) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME, id).withConverter(siteConverter);
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDoc)(docRef);
    return snap.exists() ? snap.data() : null;
  },
  async getSites() {
    const scoped = await (0,_teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__.getTeamScopedRows)('sites');
    if (scoped !== null) return scoped;
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.orderBy)('createdAt', 'desc'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)(q);
    return snap.docs.map(d => d.data());
  },
  /**
   * 특정 업체의 현장 목록 조회
   */
  async getSitesByCompany(companyId) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('companyId', '==', companyId), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.orderBy)('createdAt', 'desc'));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)(q);
    return snap.docs.map(d => d.data());
  },
  /** 발주사 포털에서 사용하는 발주사 ID 기준 현장 조회 */
  async getSitesByClientCompany(companyId) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('clientCompanyId', '==', companyId));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)(q);
    return snap.docs.map(d => d.data());
  },
  async addSite(data) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME)).withConverter(siteConverter);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.setDoc)(docRef, {
      ...data,
      createdAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)(),
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)()
    });
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.saved('현장', 1);
    return docRef.id;
  },
  async updateSite(id, data) {
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME, id).withConverter(siteConverter);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.updateDoc)(docRef, {
      ...data,
      updatedAt: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.serverTimestamp)()
    });
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.updated('현장');
  },
  async deleteSite(id) {
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.deleteDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, COLLECTION_NAME, id));
    _utils_swal__WEBPACK_IMPORTED_MODULE_5__.toast.deleted('현장', 1);
  },
  async getSiteByCode(code) {
    const q = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)(this.getCollection(), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('code', '==', code), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.limit)(1));
    const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)(q);
    return snap.empty ? null : snap.docs[0].data();
  }
};

/***/ },

/***/ "./src/services/siteService.ts"
/*!*************************************!*\
  !*** ./src/services/siteService.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   siteService: () => (/* binding */ siteService)
/* harmony export */ });
/* harmony import */ var _teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./teamScopedReadService */ "./src/services/teamScopedReadService.ts");
/* harmony import */ var _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./siteFirestoreService */ "./src/services/siteFirestoreService.ts");
/* harmony import */ var _databaseLogService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./databaseLogService */ "./src/services/databaseLogService.ts");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/stripUndefinedFields */ "./src/utils/stripUndefinedFields.ts");






const clearSiteListCache = _teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__.invalidateTeamScopedCache;
const snapshotRecord = (id, data) => ({
  id,
  ...(0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(data)
});
const logDatabaseChange = async (action, entityType, before, after, source = 'siteService') => {
  await _databaseLogService__WEBPACK_IMPORTED_MODULE_2__.databaseLogService.safeCreateLog({
    action,
    entityType,
    before,
    after,
    source
  });
};
const siteService = {
  addSite: async site => {
    const id = await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.addSite(site);
    clearSiteListCache();
    await logDatabaseChange('created', 'site', null, snapshotRecord(id, site), 'siteService.addSite');

    // Sync: Add Site ID to Client Company (발주사) if selected
    if (site.clientCompanyId) {
      try {
        const clientCompanyRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'companies', site.clientCompanyId);
        const beforeSnap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.getDoc)(clientCompanyRef);
        const beforeCompany = beforeSnap.exists() ? snapshotRecord(beforeSnap.id, beforeSnap.data()) : null;
        await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.updateDoc)(clientCompanyRef, {
          siteIds: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.arrayUnion)(id),
          siteNames: (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.arrayUnion)(site.name),
          updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now()
        });
        if (beforeCompany) {
          const nextSiteIds = Array.from(new Set([...(Array.isArray(beforeCompany.siteIds) ? beforeCompany.siteIds : []).map(String), id]));
          const nextSiteNames = Array.from(new Set([...(Array.isArray(beforeCompany.siteNames) ? beforeCompany.siteNames : []).map(String), site.name].filter(Boolean)));
          await logDatabaseChange('updated', 'company', beforeCompany, {
            ...beforeCompany,
            siteIds: nextSiteIds,
            siteNames: nextSiteNames,
            updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now()
          }, 'siteService.addSite.syncClientCompany');
        }
      } catch (err) {
        console.error("Failed to sync site to client company:", err);
      }
    }
    return id;
  },
  updateSite: async (id, site) => {
    const existing = await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSite(id);
    const nameChanged = site.name && existing && existing.name !== site.name;
    const cleanedUpdates = (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(site);
    await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.updateSite(id, cleanedUpdates);
    clearSiteListCache();
    await logDatabaseChange('updated', 'site', existing ? snapshotRecord(id, existing) : null, snapshotRecord(id, {
      ...(existing ? existing : {}),
      ...cleanedUpdates
    }), 'siteService.updateSite');
    if (nameChanged && site.name) {
      try {
        const {
          manpowerService
        } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./manpowerService */ "./src/services/manpowerService.ts"));
        await manpowerService.updateWorkersSiteName(id, site.name);
      } catch (e) {
        console.error("Failed to sync site name to workers:", e);
      }
    }
  },
  deleteSite: async id => {
    const existing = await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSite(id);
    await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.deleteSite(id);
    clearSiteListCache();
    await logDatabaseChange('deleted', 'site', existing ? snapshotRecord(id, existing) : null, null, 'siteService.deleteSite');
  },
  updateSitesBatch: async (ids, updates) => {
    const {
      writeBatch
    } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js"));
    const beforeRows = await Promise.all(ids.map(async id => {
      const site = await _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSite(id);
      return site ? snapshotRecord(id, site) : null;
    }));
    const cleanedUpdates = (0,_utils_stripUndefinedFields__WEBPACK_IMPORTED_MODULE_5__.stripUndefinedFields)(updates);
    const updatedAt = firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now();
    const batch = writeBatch(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db);
    ids.forEach(id => {
      const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites', id);
      batch.update(docRef, {
        ...cleanedUpdates,
        updatedAt
      });
    });
    await batch.commit();
    clearSiteListCache();
    await Promise.all(beforeRows.map(before => before ? logDatabaseChange('updated', 'site', before, {
      ...before,
      ...cleanedUpdates,
      updatedAt
    }, 'siteService.updateSitesBatch') : Promise.resolve()));
  },
  getSite: async id => {
    return _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSite(id);
  },
  getSites: async () => {
    const scoped = await (0,_teamScopedReadService__WEBPACK_IMPORTED_MODULE_0__.getTeamScopedRows)('sites');
    if (scoped !== null) return scoped;
    return _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSites();
  },
  getSitesByClientCompanyIds: async companyIds => {
    const ids = Array.from(new Set(companyIds.map(value => String(value !== null && value !== void 0 ? value : '').trim()).filter(Boolean)));
    const groups = await Promise.all(ids.map(companyId => _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSitesByClientCompany(companyId)));
    const byId = new Map();
    groups.flat().forEach(site => {
      const id = String(site.id || '').trim();
      if (id) byId.set(id, site);
    });
    return Array.from(byId.values());
  },
  getSiteByName: async name => {
    return _siteFirestoreService__WEBPACK_IMPORTED_MODULE_1__.siteFirestoreService.getSiteByCode(name); // Note: Original was getSiteByName but implementing via code/name search
  },
  getSitesPaginated: async (limitCount, lastDoc = null) => {
    // Since siteFirestoreService doesn't have paginated yet, I'll add it or implement here
    // For consistency, I'll update siteFirestoreService to include paginated
    const {
      query,
      collection,
      orderBy,
      limit,
      startAfter,
      getDocs
    } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js"));
    let q = query(collection(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites'), orderBy('createdAt', 'desc'), limit(limitCount));
    if (lastDoc) {
      q = query(collection(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
    }
    const snap = await getDocs(q);
    return {
      sites: snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })),
      lastDoc: snap.docs[snap.docs.length - 1]
    };
  },
  incrementManDay: async (siteId, amount) => {
    const {
      increment
    } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js"));
    const docRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites', siteId);
    await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.updateDoc)(docRef, {
      totalManDay: increment(amount),
      updatedAt: firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now()
    });
  },
  updateSitesColorByResponsibleTeam: async (teamId, color, teamName) => {
    const snapshots = await Promise.all([(0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.where)('responsibleTeamId', '==', teamId)), ...(teamName ? [(0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db, 'sites'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.where)('responsibleTeamName', '==', teamName))] : [])].map(siteQuery => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.getDocs)(siteQuery)));
    const siteRefs = new Map();
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(siteDoc => {
        siteRefs.set(siteDoc.ref.path, siteDoc.ref);
      });
    });
    if (siteRefs.size === 0) return;
    const beforeRows = await Promise.all(Array.from(siteRefs.values()).map(async siteRef => {
      const snap = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.getDoc)(siteRef);
      return snap.exists() ? snapshotRecord(snap.id, snap.data()) : null;
    }));
    const updatedAt = firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.Timestamp.now();
    const batch = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_4__.writeBatch)(_config_firebase__WEBPACK_IMPORTED_MODULE_3__.db);
    siteRefs.forEach(siteRef => {
      batch.update(siteRef, {
        color,
        updatedAt
      });
    });
    await batch.commit();
    clearSiteListCache();
    await Promise.all(beforeRows.map(before => before ? logDatabaseChange('updated', 'site', before, {
      ...before,
      color,
      updatedAt
    }, 'siteService.updateSitesColorByResponsibleTeam') : Promise.resolve()));
  }
};

/***/ },

/***/ "./src/types/zod/siteSchema.ts"
/*!*************************************!*\
  !*** ./src/types/zod/siteSchema.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SiteSchema: () => (/* binding */ SiteSchema),
/* harmony export */   SiteStatusSchema: () => (/* binding */ SiteStatusSchema)
/* harmony export */ });
/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! zod */ "./node_modules/zod/v3/types.js");

const SiteStatusSchema = zod__WEBPACK_IMPORTED_MODULE_0__["enum"](['active', 'completed', 'planned']);
const SiteSchema = zod__WEBPACK_IMPORTED_MODULE_0__.object({
  id: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  legacyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  name: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, '\uD604\uC7A5\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
  code: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, '\uD604\uC7A5 \uCF54\uB4DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
  address: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  startDate: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  endDate: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  status: SiteStatusSchema.default('active'),
  responsibleTeamId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  responsibleTeamName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  siteManagerId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  siteManagerName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  companyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  companyName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  constructorCompanyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  constructorCompanyName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  clientCompanyId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  clientCompanyName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  partnerId: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  partnerName: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  siteType: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  // Construction scope fields are optional in legacy site documents.  Keep
  // the known aliases so downstream builders can prefill the plan wizard
  // instead of asking users to re-enter ERP data that already exists.
  buildings: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  buildingNames: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  buildingList: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  floors: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  floorNames: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  floorList: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  zones: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  zoneNames: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  workZones: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  paymentMethod: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  totalManDay: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional().default(0),
  color: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  imageUrl: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional().nullable(),
  photos: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional().default([]),
  createdAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional(),
  updatedAt: zod__WEBPACK_IMPORTED_MODULE_0__.any().optional()
});

/***/ }

}]);