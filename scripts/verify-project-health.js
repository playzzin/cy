const fs = require('fs');
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';

const jsonFiles = [
  'package.json',
  'firebase.json',
  'public/manifest.json',
  'functions/package.json',
];

const optionalJsonFiles = ['server/package.json'];

const commandSteps = [
  {
    name: 'TypeScript typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
  },
  {
    name: 'React test suite',
    command: 'npm',
    args: ['run', 'test:ci'],
  },
  {
    name: 'Firebase Functions build',
    command: 'npm',
    args: ['run', 'functions:build'],
  },
];

function runCommand(name, command, args) {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${name} failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

function verifyJsonFiles() {
  console.log('== JSON syntax ==');
  for (const file of jsonFiles) {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`OK ${file}`);
  }
  for (const file of optionalJsonFiles) {
    if (!fs.existsSync(file)) {
      console.log(`SKIP optional ${file}`);
      continue;
    }
    JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`OK ${file}`);
  }
}

function warnIfJavaIsMissing() {
  const result = spawnSync('java', ['-version'], {
    stdio: 'ignore',
    shell: isWindows,
  });

  if (result.status !== 0) {
    console.warn('\nWARN Java was not found on PATH. Firestore/Storage emulator rule tests cannot run locally.');
  }
}

verifyJsonFiles();
warnIfJavaIsMissing();

for (const step of commandSteps) {
  runCommand(step.name, step.command, step.args);
}

console.log('\nProject health checks passed.');
