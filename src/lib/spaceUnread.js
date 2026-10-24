const getSpaceReadKey = (userId, spaceId) => `space_messages_read_${userId}_${spaceId}`;

export function getSpaceMessagesReadAt(userId, spaceId) {
  try {
    const key = getSpaceReadKey(userId, spaceId);
    const stored = localStorage.getItem(key);
    if (stored) return stored;

    const initialReadAt = new Date().toISOString();
    localStorage.setItem(key, initialReadAt);
    return initialReadAt;
  } catch {
    return new Date().toISOString();
  }
}

export function markSpaceMessagesRead(userId, spaceId) {
  if (!userId || !spaceId) return;
  try {
    localStorage.setItem(getSpaceReadKey(userId, spaceId), new Date().toISOString());
  } catch {
    // Read markers are a best-effort convenience when browser storage is unavailable.
  }
}
