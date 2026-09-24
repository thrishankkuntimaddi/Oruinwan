export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:8080';

/** Server origin (for relative upload URLs like /uploads/...). */
export const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SERVER_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
