# Oruinwan on Google Play

Everything Play Console asks for, ready to paste. Package: `com.oruinwan.app`.

## Files in this folder

| Play Console field | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 |
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots (2–8) | take on a phone: workspace list, a channel, a thread, a huddle, Oruinwan AI | 9:16 |

## Main store listing

**App name** (30): `Oruinwan`

**Short description** (80):

```
Team chat, huddles, tasks, notes and AI in one encrypted workspace.
```

**Full description** (4000):

```
Oruinwan brings your team's conversations and work into one workspace.

CHANNELS, DIRECT MESSAGES AND THREADS
Talk in channels for every project, message people directly, and keep side discussions in threads so the main conversation stays readable.

ONE-TAP HUDDLES
Start a voice huddle in any channel or DM and talk it through, without scheduling a meeting.

TASKS AND NOTES
Turn a message into a task, assign it, and track it to done. Write notes and share them with your team.

ORUINWAN AI
Ask Oruinwan AI about your workspace: catch up on a channel, find a decision, or draft a reply. Mention @ai in any conversation.

ENCRYPTED MESSAGES
Messages are encrypted on your device before they are sent.

WORKS EVERYWHERE
Use the same workspace on Android phones and tablets, iPhone, Mac, Windows, Linux and the web at oruinwan.poelys.com.

GET STARTED
Sign in with Google or your email, create a workspace, and invite your team with a link.
```

## Store settings

- **App category:** Business
- **Tags:** Team communication, Productivity
- **Contact email:** admin@poelys.com
- **Website:** https://oruinwan.poelys.com

## App content (Policy → App content)

- **Privacy policy:** https://oruinwan.poelys.com/privacy
- **App access:** "All or some functionality is restricted" → give reviewers a test account (email + password) with a workspace that has a few messages.
- **Ads:** No, the app contains no ads.
- **Content rating:** Category "Communication". Answer Yes to "users can interact / exchange content"; No to violence, sexual content, gambling, etc.
- **Target audience:** 18 and over (keeps the app out of the Families programme).
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** None.
- **Account deletion:** https://oruinwan.poelys.com/delete-account. Users can also delete in the app: Settings → Data & storage → Delete account.

### Permission declarations (Policy → App content)

The Play build (`bundlePlayRelease`) asks for these. Only the first two need a form in Play Console.

| Permission | Form in Play Console | What to answer |
|---|---|---|
| `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_CAMERA` | **Foreground service permissions** | Tick *Microphone* and *Camera*. Use: "Keeps a voice or video call (huddle) running with a visible notification when the person leaves the app or locks the screen. Starts only when the person starts or answers a call and stops when it ends." Task type: *user-initiated*, can't be paused. Video: a 30–60 s screen recording (unlisted YouTube or Drive link) of starting a huddle, going to the home screen, the call notification, then hanging up. |
| `USE_FULL_SCREEN_INTENT` | **Full-screen intent** | Use case: *Calling*: "Shows the incoming call screen with Answer / Decline when a teammate calls, including on the lock screen." |
| `SCHEDULE_EXACT_ALARM` (from the notifications library) | none | Used for reminders at the chosen time. Android 14+ asks the person. |
| `CAMERA`, `RECORD_AUDIO`, `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS` | none (asked at runtime) | Calls, voice messages, QR sign-in, photos, Bluetooth headsets, notifications. |
| `REQUEST_INSTALL_PACKAGES` | none | **Not in the Play build** (removed by `src/play/AndroidManifest.xml`); only the GitHub APK updates itself. |

Other questions on the same page: **Advertising ID**: *No* (no ads SDK, no `AD_ID` permission). **Financial features**: *None*. **In-app purchases**: none in the Play build; Pro is not sold or priced there (see `mobile/src/features/plan/plan.js` → `sellsInApp`).

### Data safety

Data is encrypted in transit: **Yes**. Users can request deletion: **Yes**. No data is sold or shared with third parties for advertising.

| Data type | Collected | Why | Optional? |
|---|---|---|---|
| Personal info → Name | Yes | Account management, App functionality | Required |
| Personal info → Email address | Yes | Account management, App functionality | Required |
| Personal info → Other (date of birth) | Yes | Account management (age check) | Required |
| Personal info → User IDs | Yes | Account management | Required |
| Messages → Other in-app messages | Yes | App functionality | Required |
| Photos and videos | Yes | App functionality (attachments, profile photo) | Optional |
| Audio → Voice or sound recordings | Yes | App functionality (huddles, voice messages) | Optional |
| Files and docs | Yes | App functionality (attachments, notes) | Optional |
| App activity → App interactions | Yes | Analytics (Firebase screen views; can be turned off in Settings) | Optional |
| Device or other IDs | Yes | App functionality (push notifications, signed-in devices); Analytics (Firebase app instance id) | Required |
| Financial info → Purchase history | **No** in the Play build (Pro isn't sold or shown there) | — | — |
| Location, Contacts, Calendar, Health, Web browsing | No | — | — |
| App info and performance → Crash logs | No (the last crash stays on the phone; the person can copy it into a bug report) | — | — |

Google sign-in, Firebase (analytics, remote config, push), Anthropic (Oruinwan AI answers), Brevo (emails) and GIPHY (GIF search) process data on our behalf as service providers, which Play does not count as "sharing". Answer *No* to "Is data shared with third parties".

For each collected type Play also asks **"Is this data processed ephemerally?"**: *No* for all (stored on the server), and **"Is collection required or optional?"**: as in the table. Voice typing uses Android's own speech service, not ours, so it isn't listed.
