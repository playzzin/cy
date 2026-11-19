// Firebase Hosting serves the OAuth helpers on both default domains. Keeping
// them on the app's own domain avoids third-party-storage-dependent redirects.
export function resolveFirebaseAuthDomain(projectId: string, configured: string, hostname: string): string {
  return hostname === `${projectId}.web.app` || hostname === `${projectId}.firebaseapp.com`
    ? hostname
    : configured;
}
