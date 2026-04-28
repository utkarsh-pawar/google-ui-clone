if (!global._locationSessions) {
  global._locationSessions = new Map();
}

const DURATION_MS = 30 * 60 * 1000;

export function createSession() {
  const id = Math.random().toString(36).substring(2, 10);
  const session = {
    id,
    lat: null,
    lng: null,
    accuracy: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + DURATION_MS,
    updatedAt: null,
  };
  global._locationSessions.set(id, session);
  return session;
}

export function getSession(id) {
  const session = global._locationSessions.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    global._locationSessions.delete(id);
    return null;
  }
  return session;
}

export function updateSession(id, lat, lng, accuracy) {
  const session = getSession(id);
  if (!session) return null;
  session.lat = lat;
  session.lng = lng;
  session.accuracy = accuracy;
  session.updatedAt = Date.now();
  return session;
}
