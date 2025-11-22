// client/src/utils/tokenUtils.js

let accessToken = null;

/** Save Access Token */
export const saveAccessToken = (token) => {
  accessToken = token;
};

/** Get Access Token */
export const getAccessToken = () => {
  return accessToken;
};

/** Clear Access Token */
export const clearAccessToken = () => {
  accessToken = null;
};
