import sdkTokenManager from '@platform/sdk/auth/tokenManager.js';

export const { getAccessToken, setTokens, clearTokens, hasAccessToken } = sdkTokenManager;

export const saveAccessToken = (token) => sdkTokenManager.setTokens({ accessToken: token });

export const clearAccessToken = () => sdkTokenManager.clearTokens();
