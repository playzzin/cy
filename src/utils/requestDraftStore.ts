// Sensitive fields and File objects stay in this tab's memory only.
// Account changes dispose attachments; nothing is written to browser storage.
type Entry = { value: unknown; dispose: () => void };
const drafts = new Map<string, Entry>();
let owner: string | null = null;

export function clearRequestDrafts() {
  drafts.forEach(entry => entry.dispose());
  drafts.clear();
}

export function setRequestDraftOwner(uid: string | null) {
  if (owner === uid) return;
  clearRequestDrafts();
  owner = uid;
}

export function readRequestDraft<T>(uid: string | null | undefined, key: string): T | undefined {
  setRequestDraftOwner(uid || null);
  return uid ? drafts.get(key)?.value as T | undefined : undefined;
}

export function saveRequestDraft<T>(uid: string | null | undefined, key: string, value: T, dispose: () => void) {
  if (!uid || uid !== owner) return;
  drafts.set(key, { value, dispose });
}

export function deleteRequestDraft(uid: string | null | undefined, key: string) {
  if (!uid || uid !== owner) return;
  drafts.get(key)?.dispose();
  drafts.delete(key);
}
