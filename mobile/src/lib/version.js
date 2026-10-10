// Semantic version helpers shared by the updater and the Android build (versionCode).

export function parseVersion(v) {
  const m = String(v ?? '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative when a < b, 0 when equal, positive when a > b. Unparseable versions sort first. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Mirrors android/app/build.gradle: major*10000 + minor*100 + patch. */
export function versionCode(v) {
  const p = parseVersion(v);
  return p ? p[0] * 10000 + p[1] * 100 + p[2] : 0;
}
