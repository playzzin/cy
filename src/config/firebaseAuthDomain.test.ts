import { resolveFirebaseAuthDomain } from './firebaseAuthDomain';
it.each(['example.web.app', 'example.firebaseapp.com'])('keeps Firebase Hosting auth on the same origin: %s', host => {
  expect(resolveFirebaseAuthDomain('example', 'example.firebaseapp.com', host)).toBe(host);
});
it.each(['localhost', 'other.web.app', 'example.web.app.attacker.test', 'custom.example.test'])('preserves the configured auth domain for %s', host => {
  expect(resolveFirebaseAuthDomain('example', 'example.firebaseapp.com', host)).toBe('example.firebaseapp.com');
});
