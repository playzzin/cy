const REQUIRED_FIREBASE_ENV_KEYS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const validateFirebaseBuildEnvironment = (environment = process.env) => {
  if (environment.REACT_APP_DEPLOYMENT_ENV === 'staging') {
    const project = 'cy-erp-staging-9c1e4';
    if (environment.REACT_APP_FIREBASE_PROJECT_ID !== project
      || environment.REACT_APP_FIREBASE_AUTH_DOMAIN !== `${project}.firebaseapp.com`
      || environment.REACT_APP_FIREBASE_STORAGE_BUCKET !== `${project}.firebasestorage.app`) {
      throw new Error('검증 빌드에 다른 프로젝트의 설정이 섞였습니다. 배포를 중단합니다.');
    }
  } else if (environment.REACT_APP_FIREBASE_PROJECT_ID === 'cy-erp-staging-9c1e4') {
    throw new Error('검증 프로젝트는 전용 검증 빌드로만 사용할 수 있습니다.');
  }
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
