// Placeholder until the live server adapter lands.
export const liveAdapter = {
  kind: 'live',
  async signIn() {
    throw new Error('Signing in to a server is not available in this build yet.');
  },
  async restore() {
    throw new Error('not available');
  },
};
