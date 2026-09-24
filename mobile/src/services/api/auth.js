import http from '../http';
import { getRefreshTokenSync } from '../tokens';

export const login = (email, password) => http.post('/auth/login', { email, password });
export const register = (username, email, password) => http.post('/auth/signup', { username, email, password });
export const logoutApi = () => {
  const refreshToken = getRefreshTokenSync();
  return http.post('/auth/logout', refreshToken ? { refreshToken } : {});
};
export const getMe = () => http.get('/auth/me');
export const updateMe = (fields) => http.put('/auth/me', fields);
export const updateStatus = (status) => http.patch('/users/status', { status });

export function uploadProfilePicture(asset) {
  const form = new FormData();
  const name = asset.fileName || `avatar.${(asset.mimeType || 'image/jpeg').split('/')[1] || 'jpg'}`;
  form.append('profilePicture', { uri: asset.uri, name, type: asset.mimeType || 'image/jpeg' });
  return http.post('/auth/me/profile-picture', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (d) => d,
  });
}
