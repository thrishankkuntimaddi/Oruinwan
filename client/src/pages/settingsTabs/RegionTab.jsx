import React, { useEffect, useMemo, useState } from 'react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { SUPPORTED_LANGS } from '../../features/messaging/chatWindowComp/messages/TranslatePopover';
import { getAutoTranslateLang, setAutoTranslateLang } from '../../utils/autoTranslate';
import {
    REGION_DEFAULTS, DATE_FORMATS, detectedTimeZone, formatDate, formatTime, formatDateTime, zoneOffsetLabel,
} from '../../utils/userDateFormat';
import { useApplyPreferences } from '../../hooks/useUserPreferences';
import {
    PageIntro, Section, Row, Field, Select, Notice, LoadingState, ErrorState, SaveBar, useSettingsForm,
} from './settingsUi';
import './preferences.css';

const ENDPOINT = '/api/auth/me/preferences/region';
const KEYS = ['language', 'timezone', 'dateFormat', 'timeFormat'];

const FALLBACK_ZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Dubai',
    'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

const pick = (data) => {
    const src = data && typeof data === 'object' ? data : {};
    const out = { ...REGION_DEFAULTS };
    KEYS.forEach((k) => { if (typeof src[k] === 'string' && src[k]) out[k] = src[k]; });
    if (!['12h', '24h'].includes(out.timeFormat)) out.timeFormat = REGION_DEFAULTS.timeFormat;
    if (!DATE_FORMATS.includes(out.dateFormat)) out.dateFormat = REGION_DEFAULTS.dateFormat;
    return out;
};

function allTimeZones() {
    try {
        const list = Intl.supportedValuesOf?.('timeZone');
        if (Array.isArray(list) && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
    } catch { /* older browsers */ }
    return FALLBACK_ZONES;
}

/** Zones grouped by their area ("America", "Europe"…), each labelled with its current offset. */
function groupZones(extra) {
    const now = new Date();
    const zones = [...allTimeZones()];
    if (extra && extra !== 'auto' && !zones.includes(extra)) zones.push(extra);
    const groups = new Map();
    zones.forEach((z) => {
        const area = z.includes('/') ? z.split('/')[0] : 'Other';
        if (!groups.has(area)) groups.set(area, []);
        const offset = zoneOffsetLabel(z, now);
        groups.get(area).push({ id: z, label: `${z.replace(/_/g, ' ')}${offset ? ` (${offset})` : ''}` });
    });
    return [...groups.entries()].sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
}

function useNow(intervalMs = 15000) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

const DATE_FORMAT_LABELS = {
    'MM/DD/YYYY': 'MM/DD/YYYY',
    'DD/MM/YYYY': 'DD/MM/YYYY',
    'YYYY-MM-DD': 'YYYY-MM-DD (ISO 8601)',
    'DD MMM YYYY': 'DD MMM YYYY',
};

/**
 * Settings → Language & region. Time zone, date and clock format are saved to
 * the account and used for timestamps across the app (chat, tasks, notes).
 * Auto-translate is a per-browser choice and applies immediately.
 */
const RegionTab = () => {
    const { showToast } = useToast();
    const applyPreferences = useApplyPreferences();
    const [autoLang, setAutoLang] = useState(getAutoTranslateLang);
    const detected = useMemo(() => detectedTimeZone(), []);
    const now = useNow();

    const form = useSettingsForm({
        initial: { ...REGION_DEFAULTS },
        load: async () => pick((await api.get(ENDPOINT)).data),
        save: async (values) => {
            // Send every field: older servers replace the whole object on PUT.
            const { data } = await api.put(ENDPOINT, pick(values));
            const hasFields = data && typeof data === 'object' && KEYS.some((k) => k in data);
            return hasFields ? pick({ ...values, ...data }) : pick(values);
        },
        onSaved: (next) => {
            applyPreferences({ region: next });
            showToast('Language and region saved', 'success');
        },
        onError: (msg) => showToast(msg, 'error'),
    });

    const { values, set } = form;
    const zoneGroups = useMemo(() => groupZones(values.timezone), [values.timezone]);

    if (form.loading) return <><PageIntro title="Language & region" /><LoadingState label="Loading your region settings…" /></>;
    if (form.loadError) return <><PageIntro title="Language & region" /><ErrorState message={form.loadError} onRetry={form.reload} /></>;

    const zoneName = values.timezone === 'auto' ? detected : values.timezone;

    return (
        <>
            <PageIntro
                title="Language & region"
                description="Your time zone and how dates and times are written across Oruinwan."
            />

            <Section title="Time zone" pad>
                <div className="stg-pref-stack">
                    <Field
                        id="region-timezone"
                        label="Time zone"
                        hint={values.timezone === 'auto' ? `Uses the zone your device reports (${detected}), even when you travel.` : 'Times are shown in this zone on every device.'}
                    >
                        <Select
                            id="region-timezone"
                            className="stg-pref-select"
                            value={values.timezone}
                            onChange={(e) => set('timezone', e.target.value)}
                            data-testid="region-timezone"
                        >
                            <option value="auto">Automatic — {detected.replace(/_/g, ' ')}</option>
                            {zoneGroups.map(([area, zones]) => (
                                <optgroup key={area} label={area}>
                                    {zones.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
                                </optgroup>
                            ))}
                        </Select>
                    </Field>
                    <div>
                        <span className="stg-pref-preview" aria-live="polite">
                            Local time in {zoneName.replace(/_/g, ' ')}
                            <strong>{formatDateTime(now, values)}</strong>
                        </span>
                    </div>
                </div>
            </Section>

            <Section title="Date and time format">
                <Row label="Date format" description={`Today: ${formatDate(now, values)}`} htmlFor="region-date-format" stack>
                    <Select
                        id="region-date-format"
                        value={values.dateFormat}
                        onChange={(e) => set('dateFormat', e.target.value)}
                        data-testid="region-date-format"
                    >
                        {DATE_FORMATS.map((f) => <option key={f} value={f}>{DATE_FORMAT_LABELS[f]}</option>)}
                    </Select>
                </Row>
                <Row label="Clock" description={`Now: ${formatTime(now, values)}`} stack>
                    <div className="stg-segmented" role="group" aria-label="Clock format">
                        <button type="button" aria-pressed={values.timeFormat === '12h'} onClick={() => set('timeFormat', '12h')}>12-hour</button>
                        <button type="button" aria-pressed={values.timeFormat === '24h'} onClick={() => set('timeFormat', '24h')}>24-hour</button>
                    </div>
                </Row>
            </Section>

            <Section title="Language" description="Oruinwan is in English for now.">
                <Row
                    label="Auto-translate messages"
                    description="Translate other people's messages into this language as they arrive (uses Oruinwan AI). Applies to this browser right away."
                    htmlFor="auto-translate-lang"
                    stack
                >
                    <Select
                        id="auto-translate-lang"
                        data-testid="auto-translate-lang"
                        value={autoLang}
                        onChange={(e) => { setAutoLang(e.target.value); setAutoTranslateLang(e.target.value); }}
                    >
                        <option value="">Off</option>
                        {[{ code: 'en', label: 'English', flag: '🇬🇧' }, ...SUPPORTED_LANGS].map((l) => (
                            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                        ))}
                    </Select>
                </Row>
            </Section>

            {values.timezone !== 'auto' && values.timezone !== detected && (
                <Notice tone="info">
                    Your device is in <strong>{detected.replace(/_/g, ' ')}</strong>; timestamps will use <strong>{values.timezone.replace(/_/g, ' ')}</strong>.
                </Notice>
            )}

            <SaveBar visible={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} />
        </>
    );
};

export default RegionTab;
