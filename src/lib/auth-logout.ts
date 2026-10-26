export const LOGOUT_EVENT = "hynox:sign-out";
export type LoginPath = "/login" | "/super-admin-login";

export function notifySignOut(redirectTo: LoginPath) {
  const message = { redirectTo, nonce: crypto.randomUUID() };
  try { localStorage.setItem(LOGOUT_EVENT, JSON.stringify(message)); } catch { /* BroadcastChannel remains available when storage is blocked. */ }
  try {
    const channel = new BroadcastChannel(LOGOUT_EVENT);
    channel.postMessage(message);
    channel.close();
  } catch { /* The storage event is the fallback on older browsers. */ }
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT, { detail: message }));
}

export function navigateAfterSignOut(path: LoginPath) {
  // Discard the client router's cached private pages after an identity change.
  window.location.replace(path);
}
