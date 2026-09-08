type AccessTokenListener = (token: string | null) => void;

let accessToken: string | null = null;
let authenticationLostHandler: (() => void) | null = null;
const listeners = new Set<AccessTokenListener>();

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
};

export const subscribeAccessToken = (listener: AccessTokenListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setAuthenticationLostHandler = (
  handler: (() => void) | null,
): void => {
  authenticationLostHandler = handler;
};

export const notifyAuthenticationLost = (): void => {
  setAccessToken(null);
  authenticationLostHandler?.();
};

export const removeLegacyStoredAccessToken = (): void => {
  try {
    localStorage.removeItem('access_token');
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
};

