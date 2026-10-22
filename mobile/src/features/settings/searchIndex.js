// Everything the Settings search can find: each screen and the main options inside it.
// `route` opens a settings screen; `action` names something the Settings screen runs itself.
export const SETTINGS_INDEX = [
  { title: 'Profile', route: 'settings.profile', keywords: 'name photo picture avatar about display name' },
  { title: 'Password & security', route: 'settings.security', keywords: 'password encryption keys unlock messages sign-in security' },
  { title: 'Two-factor authentication', in: 'Password & security', route: 'settings.twofactor', keywords: '2fa mfa authenticator code two-step verification' },
  { title: 'Passkeys', in: 'Password & security', route: 'settings.security', keywords: 'passkey fingerprint face touch id biometrics' },
  { title: 'Devices', route: 'settings.devices', keywords: 'devices sessions signed in sign out other devices phones computers' },
  { title: 'Scan to sign in', action: 'scan', keywords: 'qr code sign in computer desktop web scan' },
  { title: 'Your data', route: 'settings.account-data', keywords: 'export download data retention gdpr copy' },
  { title: 'Backup', route: 'settings.backup', keywords: 'google drive backup restore' },
  { title: 'Plan & usage', route: 'settings.plan', keywords: 'plan free pro limits usage ai requests calls members' },
  { title: 'Notifications', route: 'settings.notifications', keywords: 'notifications push alerts sound mentions dms threads tasks meetings' },
  { title: 'Email digest', in: 'Notifications', route: 'settings.notifications', keywords: 'email digest daily weekly smart summary' },
  { title: 'New sign-in emails', in: 'Notifications', route: 'settings.notifications', keywords: 'email security sign-in login new device alert' },
  { title: 'Appearance', route: 'settings.appearance', keywords: 'theme dark light text size font motion animations' },
  { title: 'Privacy', route: 'settings.privacy', keywords: 'privacy read receipts typing indicator discoverable analytics stats' },
  { title: 'Read receipts', in: 'Privacy', route: 'settings.privacy', keywords: 'seen read receipts' },
  { title: 'Oruinwan AI', route: 'settings.ai', keywords: 'ai assistant conversations history memory model' },
  { title: 'Workspace settings', action: 'workspace', keywords: 'workspace members invite people' },
  { title: 'Integrations', action: 'integrations', keywords: 'github jira slack integrations apps webhooks' },
  { title: 'Updates', route: 'settings.updates', keywords: 'update version new release download' },
  { title: "What's new", in: 'Updates', route: 'settings.updates', keywords: 'release notes changelog new features whats new' },
  { title: 'Data & storage', route: 'settings.data', keywords: 'cache storage clear delete account' },
  { title: 'Delete account', in: 'Data & storage', route: 'settings.data', keywords: 'delete erase remove account' },
  { title: 'Server', route: 'settings.server', keywords: 'server address switch self-hosted connection' },
  { title: 'Help center', route: 'settings.help', keywords: 'help docs documentation guide how to faq' },
  { title: 'Contact support', route: 'settings.support', keywords: 'support contact help team ticket request email' },
  { title: 'Report a problem', route: 'settings.support.new', keywords: 'bug problem crash issue report broken' },
  { title: 'Take the tour', action: 'tour', keywords: 'tour onboarding walkthrough introduction' },
  { title: 'About Oruinwan', route: 'settings.about', keywords: 'about version licence license open source privacy terms' },
  { title: 'Sign out', action: 'signout', keywords: 'sign out log out logout' },
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Matching entries, best first: every word must appear in the title or keywords. */
export function searchSettings(query, index = SETTINGS_INDEX) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return index
    .map((item, order) => {
      const title = norm(item.title);
      const keys = norm(item.keywords);
      let score = 0;
      for (const w of words) {
        if (title.startsWith(w)) score += 6;
        else if (title.includes(w)) score += 4;
        else if (keys.includes(w)) score += 1;
        else return null;
      }
      return { item, score, order };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.item);
}
