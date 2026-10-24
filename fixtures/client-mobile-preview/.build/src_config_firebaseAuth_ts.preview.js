"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_config_firebaseAuth_ts"],{

/***/ "./src/config/deploymentEnvironment.ts"
/*!*********************************************!*\
  !*** ./src/config/deploymentEnvironment.ts ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   assertDeploymentEnvironment: () => (/* binding */ assertDeploymentEnvironment),
/* harmony export */   isStaging: () => (/* binding */ isStaging)
/* harmony export */ });
const isStaging = process.env.REACT_APP_DEPLOYMENT_ENV === 'staging';
function assertDeploymentEnvironment(projectId, hostname) {
  const stagingProject = 'cy-erp-staging-9c1e4';
  if (isStaging && projectId !== stagingProject || !isStaging && projectId === stagingProject || hostname === `${stagingProject}.web.app` && !isStaging || hostname === 'cyee-9c1e4.web.app' && isStaging) {
    throw new Error('서버 주소와 데이터 연결이 일치하지 않아 접속을 중단했습니다.');
  }
}

/***/ },

/***/ "./src/config/firebaseAuth.ts"
/*!************************************!*\
  !*** ./src/config/firebaseAuth.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   auth: () => (/* binding */ auth),
/* harmony export */   rawAuth: () => (/* binding */ rawAuth)
/* harmony export */ });
/* harmony import */ var firebase_auth__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/auth */ "./node_modules/firebase/auth/dist/esm/index.esm.js");
/* harmony import */ var _firebaseBase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./firebaseBase */ "./src/config/firebaseBase.ts");
/* harmony import */ var _utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/devPreviewRuntime */ "./src/utils/devPreviewRuntime.ts");



const rawAuth = _utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__.isDevPreviewFrame ? (0,firebase_auth__WEBPACK_IMPORTED_MODULE_0__.initializeAuth)(_firebaseBase__WEBPACK_IMPORTED_MODULE_1__.app, {
  persistence: firebase_auth__WEBPACK_IMPORTED_MODULE_0__.inMemoryPersistence
}) : (0,firebase_auth__WEBPACK_IMPORTED_MODULE_0__.getAuth)(_firebaseBase__WEBPACK_IMPORTED_MODULE_1__.app);
const auth = (0,_utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__.previewAuthFacade)(rawAuth);
if ( true && process.env.REACT_APP_USE_EMULATORS === 'true') {
  (0,firebase_auth__WEBPACK_IMPORTED_MODULE_0__.connectAuthEmulator)(rawAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true
  });
}

/***/ },

/***/ "./src/config/firebaseBase.ts"
/*!************************************!*\
  !*** ./src/config/firebaseBase.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   app: () => (/* binding */ app),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var firebase_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/app */ "./node_modules/firebase/app/dist/esm/index.esm.js");
/* harmony import */ var _deploymentEnvironment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./deploymentEnvironment */ "./src/config/deploymentEnvironment.ts");
/* harmony import */ var _utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/devPreviewRuntime */ "./src/utils/devPreviewRuntime.ts");



const REQUIRED_ENV_KEYS = ['REACT_APP_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_APP_ID'];
const requireEnv = key => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Firebase] Missing environment variable: ${key}. Create .env.local and set REACT_APP_FIREBASE_* values.`);
  }
  return value;
};
const app = (() => {
  const existing = (0,firebase_app__WEBPACK_IMPORTED_MODULE_0__.getApps)().filter(candidate => candidate.name === (_utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__.isDevPreviewFrame ? 'cy-dev-preview' : '[DEFAULT]'));
  if (existing.length > 0) {
    var _existing$0$options;
    if ((_existing$0$options = existing[0].options) !== null && _existing$0$options !== void 0 && _existing$0$options.projectId) (0,_deploymentEnvironment__WEBPACK_IMPORTED_MODULE_1__.assertDeploymentEnvironment)(existing[0].options.projectId, typeof window === 'undefined' ? '' : window.location.hostname);
    return existing[0];
  }
  (0,_deploymentEnvironment__WEBPACK_IMPORTED_MODULE_1__.assertDeploymentEnvironment)(requireEnv('REACT_APP_FIREBASE_PROJECT_ID'), typeof window === 'undefined' ? '' : window.location.hostname);
  const measurementId = process.env.REACT_APP_FIREBASE_MEASUREMENT_ID;
  const firebaseConfig = {
    apiKey: requireEnv('REACT_APP_FIREBASE_API_KEY'),
    authDomain: requireEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('REACT_APP_FIREBASE_APP_ID'),
    ...(measurementId ? {
      measurementId
    } : {})
  };
  return (0,firebase_app__WEBPACK_IMPORTED_MODULE_0__.initializeApp)(firebaseConfig, _utils_devPreviewRuntime__WEBPACK_IMPORTED_MODULE_2__.isDevPreviewFrame ? 'cy-dev-preview' : '[DEFAULT]');
})();
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (app);

/***/ },

/***/ "./node_modules/firebase/app/dist/esm/index.esm.js"
/*!*********************************************************!*\
  !*** ./node_modules/firebase/app/dist/esm/index.esm.js ***!
  \*********************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FirebaseError: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.FirebaseError),
/* harmony export */   SDK_VERSION: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.SDK_VERSION),
/* harmony export */   _DEFAULT_ENTRY_NAME: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._DEFAULT_ENTRY_NAME),
/* harmony export */   _addComponent: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._addComponent),
/* harmony export */   _addOrOverwriteComponent: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._addOrOverwriteComponent),
/* harmony export */   _apps: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._apps),
/* harmony export */   _clearComponents: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._clearComponents),
/* harmony export */   _components: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._components),
/* harmony export */   _getProvider: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._getProvider),
/* harmony export */   _isFirebaseApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._isFirebaseApp),
/* harmony export */   _isFirebaseServerApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._isFirebaseServerApp),
/* harmony export */   _isFirebaseServerAppSettings: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._isFirebaseServerAppSettings),
/* harmony export */   _registerComponent: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._registerComponent),
/* harmony export */   _removeServiceInstance: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._removeServiceInstance),
/* harmony export */   _serverApps: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__._serverApps),
/* harmony export */   deleteApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.deleteApp),
/* harmony export */   getApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.getApp),
/* harmony export */   getApps: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.getApps),
/* harmony export */   initializeApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.initializeApp),
/* harmony export */   initializeServerApp: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.initializeServerApp),
/* harmony export */   onLog: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.onLog),
/* harmony export */   registerVersion: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.registerVersion),
/* harmony export */   setLogLevel: () => (/* reexport safe */ _firebase_app__WEBPACK_IMPORTED_MODULE_0__.setLogLevel)
/* harmony export */ });
/* harmony import */ var _firebase_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @firebase/app */ "./node_modules/@firebase/app/dist/esm/index.esm.js");



var name = "firebase";
var version = "12.13.0";

/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(0,_firebase_app__WEBPACK_IMPORTED_MODULE_0__.registerVersion)(name, version, 'app');
//# sourceMappingURL=index.esm.js.map


/***/ }

}]);