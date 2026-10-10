// End-to-end encryption status for the signed-in user, shown in Chats and Settings.
//   none                demo mode or signed out
//   ready               keys unlocked on this phone
//   password_required   keys exist but this phone needs the password once
//   unsupported         an account type this app can't unlock yet
//   error               something went wrong; details in `message`
import { create } from 'zustand';

export const useE2ee = create(() => ({ status: 'none', message: null }));

export const setE2ee = (status, message = null) => useE2ee.setState({ status, message });
