const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripServerAiCredentials } = require('./browser-env-security.cjs');
test('legacy server credentials never enter the CRA browser environment', () => {
  const environment = { REACT_APP_GEMINI_API_KEY: 'synthetic-secret', REACT_APP_GOOGLE_API_KEY: 'synthetic-secret',
    REACT_APP_GOOGLE_GENAI_API_KEY: 'synthetic-secret', REACT_APP_FIREBASE_API_KEY: 'public-firebase-config',
    REACT_APP_GOOGLE_DRIVE_API_KEY: 'restricted-picker-config', GEMINI_API_KEY: 'server-only' };
  stripServerAiCredentials(environment);
  assert.deepEqual(Object.keys(environment).sort(), ['GEMINI_API_KEY', 'REACT_APP_FIREBASE_API_KEY', 'REACT_APP_GOOGLE_DRIVE_API_KEY']);
});
