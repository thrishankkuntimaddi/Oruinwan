// client/src/utils/tokenUtils.js

/** Save Access Token to localStorage */
export const saveAccessToken = (token) => {
  localStorage.setItem("accessToken", token);

};

/** Get Access Token from localStorage */
export const getAccessToken = () => {
  return localStorage.getItem("accessToken");
};

/** Clear Access Token from localStorage */
export const clearAccessToken = () => {
  localStorage.removeItem("accessToken");

};
