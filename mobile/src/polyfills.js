/**
 * Runtime polyfills — imported first from index.js.
 * Hermes has no Web Crypto; @noble/* only needs crypto.getRandomValues,
 * which expo-crypto provides from the platform CSPRNG.
 */
import { getRandomValues } from 'expo-crypto';

if (typeof globalThis.crypto !== 'object' || globalThis.crypto === null) {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto.getRandomValues = (array) => getRandomValues(array);
}
