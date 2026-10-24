"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_rolePermissionService_ts"],{

/***/ "./src/services/rolePermissionService.ts"
/*!***********************************************!*\
  !*** ./src/services/rolePermissionService.ts ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   rolePermissionService: () => (/* binding */ rolePermissionService)
/* harmony export */ });
/* harmony import */ var _firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./firestoreCrudCompat */ "./src/services/firestoreCrudCompat.ts");
/* harmony import */ var _types_roles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../types/roles */ "./src/types/roles.ts");
/* harmony import */ var _positionService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./positionService */ "./src/services/positionService.ts");
/* harmony import */ var _menuServiceV11__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./menuServiceV11 */ "./src/services/menuServiceV11.ts");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");





const PERMISSION_DOC_ID = 'permissions';
const normalizeRole = role => String(role || '').trim();
const ADMIN_ROLE_KEYS = ['admin', 'super_admin', 'administrator', 'owner', 'dev', 'developer', 'system_admin', 'jhl2vtnk9v3c4eiz4qqi', 'pos_jhl2vtnk9v3c4eiz4qqi', '관리자', '사장', '실장', '개발', '개발자', '시스템관리자'];
const isAdminRole = role => {
  const normalized = normalizeRole(role).toLowerCase();
  return ADMIN_ROLE_KEYS.includes(normalized);
};
const getSystemRole = role => {
  const value = normalizeRole(role);
  const normalized = value.toLowerCase();
  if (isAdminRole(value)) return _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN;
  if (['manager', '매니저', '메니저', '대표'].includes(normalized) || normalized.startsWith('manager') || normalized.startsWith('매니저') || normalized.startsWith('메니저')) {
    return _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER;
  }
  if (['user', 'general', _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL].includes(normalized)) return _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL;
  return _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL;
};
const uniqueKeys = keys => Array.from(new Set(keys.filter(Boolean)));
class RolePermissionService {
  constructor() {
    this.permissions = {};
    this.listeners = [];
    this.menuUnsubscribe = null;
    void this.initialize();
  }
  async initialize() {
    await this.refreshPermissions();
    if (typeof window !== 'undefined' && this.menuUnsubscribe == null) {
      // Follow the canonical menus_v12 document through the menu service.
      this.menuUnsubscribe = _menuServiceV11__WEBPACK_IMPORTED_MODULE_3__.menuServiceV11.subscribe(() => {
        console.log("[rolePermissionService] Menu settings updated, refreshing permissions...");
        void this.refreshPermissions();
      });
    }
  }
  async refreshPermissions() {
    try {
      var _row;
      const mergeWithPositionKeys = (loaded, positions) => {
        const merged = {};
        const loadedByRole = role => {
          const legacy = role === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN ? loaded === null || loaded === void 0 ? void 0 : loaded.ADMIN : role === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER ? loaded === null || loaded === void 0 ? void 0 : loaded.MANAGER : loaded === null || loaded === void 0 ? void 0 : loaded.GENERAL;
          const legacyEng = role === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN ? loaded === null || loaded === void 0 ? void 0 : loaded.admin : role === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER ? loaded === null || loaded === void 0 ? void 0 : loaded.manager : loaded === null || loaded === void 0 ? void 0 : loaded.user;
          return {
            ...(legacyEng && typeof legacyEng === 'object' ? legacyEng : {}),
            ...(legacy && typeof legacy === 'object' ? legacy : {}),
            ...((loaded === null || loaded === void 0 ? void 0 : loaded[role]) || {})
          };
        };
        const baseBySystemRole = {
          [_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN]: {
            ...(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN] || {}),
            ...loadedByRole(_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.ADMIN)
          },
          [_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER]: {
            ...(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER] || {}),
            ...loadedByRole(_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER)
          },
          [_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL]: {
            ...(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL] || {}),
            ...loadedByRole(_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL)
          }
        };
        const normalizeKey = v => typeof v === 'string' ? v.trim() : '';
        const positionNames = positions.map(p => normalizeKey(p === null || p === void 0 ? void 0 : p.name)).filter(v => Boolean(v));

        // Seed per-position permissions
        positionNames.forEach(positionName => {
          const pos = positions.find(p => normalizeKey(p === null || p === void 0 ? void 0 : p.name) === positionName);
          const systemRole = getSystemRole((pos === null || pos === void 0 ? void 0 : pos.systemRole) || _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL);
          const direct = loaded === null || loaded === void 0 ? void 0 : loaded[positionName];
          merged[positionName] = {
            ...(baseBySystemRole[systemRole] || baseBySystemRole[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL]),
            ...(direct || {})
          };
        });
        Object.keys(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS).forEach(key => {
          if (!merged[key]) {
            merged[key] = {
              ...(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[key] || {}),
              ...((loaded === null || loaded === void 0 ? void 0 : loaded[key]) || {})
            };
          }
        });

        // Always ensure a safe fallback key
        if (!merged[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL]) {
          merged[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL] = {
            ...(baseBySystemRole[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL] || {})
          };
        }

        // Preserve unknown/custom keys (including legacy values) as-is
        if (loaded && typeof loaded === 'object') {
          Object.keys(loaded).forEach(key => {
            const normalizedKey = normalizeKey(key);
            if (!normalizedKey) return;
            if (!merged[normalizedKey]) {
              merged[normalizedKey] = loaded[normalizedKey] || {};
            }
          });
        }
        return merged;
      };
      const positions = await _positionService__WEBPACK_IMPORTED_MODULE_2__.positionService.getPositions();
      if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
        this.permissions = mergeWithPositionKeys(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS, positions);
        this.notifyListeners();
        return;
      }
      const findRowInList = rows => {
        var _rows$find;
        if (!Array.isArray(rows)) return null;
        return (_rows$find = rows.find(r => {
          var _r$id;
          return String((_r$id = r === null || r === void 0 ? void 0 : r.id) !== null && _r$id !== void 0 ? _r$id : '') === String(PERMISSION_DOC_ID);
        })) !== null && _rows$find !== void 0 ? _rows$find : null;
      };
      let row = null;
      try {
        var _data$systemConfigs, _data;
        const response = await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.listSystemConfigs)();
        const rows = (_data$systemConfigs = response === null || response === void 0 ? void 0 : (_data = response.data) === null || _data === void 0 ? void 0 : _data.systemConfigs) !== null && _data$systemConfigs !== void 0 ? _data$systemConfigs : [];
        row = findRowInList(rows);
      } catch {
        row = null;
      }
      if (!row) {
        const limit = 1000;
        let offset = 0;
        let safety = 0;
        while (safety < 50) {
          var _data$systemConfigs2, _data2;
          safety += 1;
          const response = await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.listAllSystemConfigs)({
            limit,
            offset
          });
          const rows = (_data$systemConfigs2 = response === null || response === void 0 ? void 0 : (_data2 = response.data) === null || _data2 === void 0 ? void 0 : _data2.systemConfigs) !== null && _data$systemConfigs2 !== void 0 ? _data$systemConfigs2 : [];
          const page = Array.isArray(rows) ? rows : [];
          if (page.length === 0) break;
          row = findRowInList(page);
          if (row) break;
          if (page.length < limit) break;
          offset += limit;
        }
      }
      if ((_row = row) !== null && _row !== void 0 && _row.data) {
        const parsed = JSON.parse(String(row.data));
        this.permissions = mergeWithPositionKeys(parsed, positions);
        this.notifyListeners();
        return;
      }

      // Initialize with position keys derived from defaults
      const initial = mergeWithPositionKeys(_types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS, positions);
      await this.savePermissions(initial);
      this.permissions = initial;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
    }
  }
  async updatePermission(positionName, menuId, allowed) {
    const newPermissions = {
      ...this.permissions
    };
    const key = typeof positionName === 'string' ? positionName.trim() : '';
    if (!key) return;
    if (!newPermissions[key]) {
      newPermissions[key] = {};
    }
    newPermissions[key][menuId] = allowed;
    await this.savePermissions(newPermissions);
  }
  async renamePositionKey(oldName, newName) {
    const oldKey = normalizeRole(oldName);
    const newKey = normalizeRole(newName);
    const result = {
      renamed: false,
      oldKey,
      newKey,
      menuRules: 0
    };
    if (!oldKey || !newKey || oldKey === newKey) return result;
    await this.refreshPermissions();
    const oldPermissions = this.permissions[oldKey];
    if (!oldPermissions) return result;
    const nextPermissions = {
      ...this.permissions,
      [newKey]: {
        ...(this.permissions[newKey] || {}),
        ...oldPermissions
      }
    };
    delete nextPermissions[oldKey];
    result.renamed = true;
    result.menuRules = Object.keys(oldPermissions).length;
    await this.savePermissions(nextPermissions);
    this.notifyListeners();
    return result;
  }
  async removePositionKey(positionName) {
    const key = normalizeRole(positionName);
    if (!key) return false;
    await this.refreshPermissions();
    if (!this.permissions[key]) return false;
    const nextPermissions = {
      ...this.permissions
    };
    delete nextPermissions[key];
    await this.savePermissions(nextPermissions);
    this.notifyListeners();
    return true;
  }
  async savePermissions(permissions) {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_4__.isDevAdminSessionEnabled)()) {
      this.permissions = permissions;
      this.notifyListeners();
      return;
    }
    const payload = JSON.stringify(permissions);
    try {
      var _data3;
      const updated = await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.updateSystemConfig)({
        id: PERMISSION_DOC_ID,
        data: payload
      });
      const didUpdate = (updated === null || updated === void 0 ? void 0 : (_data3 = updated.data) === null || _data3 === void 0 ? void 0 : _data3.systemConfig_update) != null;
      if (!didUpdate) {
        try {
          await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.createSystemConfig)({
            id: PERMISSION_DOC_ID,
            data: payload
          });
        } catch {
          await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.updateSystemConfig)({
            id: PERMISSION_DOC_ID,
            data: payload
          });
        }
      }
    } catch (error) {
      try {
        await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.createSystemConfig)({
          id: PERMISSION_DOC_ID,
          data: payload
        });
      } catch {
        await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.updateSystemConfig)({
          id: PERMISSION_DOC_ID,
          data: payload
        });
      }
    }
    this.permissions = permissions;
  }
  hasAccess(userJobTitle, menuId) {
    const positionName = normalizeRole(userJobTitle);
    if (isAdminRole(positionName)) return true;
    const systemRole = getSystemRole(positionName);
    const lookupKeys = uniqueKeys([positionName, systemRole, systemRole === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.MANAGER ? 'manager' : '', systemRole === _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL ? 'user' : '', _types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL]);
    for (const key of lookupKeys) {
      const roleConfig = this.permissions[key];
      if (roleConfig && Object.prototype.hasOwnProperty.call(roleConfig, menuId)) {
        return !!roleConfig[menuId];
      }
    }
    const fallback = _types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[systemRole] || _types_roles__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_PERMISSIONS[_types_roles__WEBPACK_IMPORTED_MODULE_1__.UserRole.GENERAL];
    return fallback ? !!fallback[menuId] : false;
  }
  async getPermissions() {
    return this.permissions;
  }
  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.permissions); // Initial call

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.permissions));
  }
}
const rolePermissionService = new RolePermissionService();

/***/ }

}]);