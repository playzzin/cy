const REQUIRED_FIREBASE_ENV_KEYS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const validateFirebaseBuildEnvironment = (environment = process.env) => {
  const missingKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
    const value = environment[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingKeys.length > 0) {
    throw new Error(
      [
        '[Firebase build] Required public Firebase configuration is missing.',
        `Missing: ${missingKeys.join(', ')}`,
        'Add the production environment file or inject the variables before building.',
      ].join(' ')
    );
  }
};

module.exports = {
  REQUIRED_FIREBASE_ENV_KEYS,
  validateFirebaseBuildEnvironment,
};
