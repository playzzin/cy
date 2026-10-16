const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env, NODE_ENV:'development', PORT:'3127', HOST:'127.0.0.1', BROWSER:'none',
  REACT_APP_USE_EMULATORS:'true', REACT_APP_DEPLOYMENT_ENV:'development',
  REACT_APP_FIREBASE_PROJECT_ID:'demo-dev-user-preview', REACT_APP_FIREBASE_API_KEY:'demo-key',
  REACT_APP_FIREBASE_AUTH_DOMAIN:'demo-dev-user-preview.firebaseapp.com',
  REACT_APP_FIREBASE_STORAGE_BUCKET:'demo-dev-user-preview.appspot.com',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID:'123456', REACT_APP_FIREBASE_APP_ID:'demo-preview-app', REACT_APP_FIREBASE_MEASUREMENT_ID:'',
  REACT_APP_FIREBASE_VAPID_KEY:'', GENERATE_SOURCEMAP:'false' };
const child=spawn(process.execPath,['scripts/react-scripts-start.js'],{cwd:path.resolve(__dirname,'..'),env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code||0;});
