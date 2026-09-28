import React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { PageIntro, Section, Row, SwitchRow } from './settingsUi';
import './preferences.css';

const THEMES = [
    { id: 'light', label: 'Light', description: 'Clean and bright', icon: Sun },
    { id: 'dark', label: 'Dark', description: 'Easy on the eyes at night', icon: Moon },
    { id: 'auto', label: 'System', description: 'Matches your device, live', icon: Laptop },
];

const TEXT_SIZES = [
    { id: 'small', label: 'Small', px: 13 },
    { id: 'default', label: 'Default', px: 14 },
    { id: 'large', label: 'Large', px: 16 },
    { id: 'larger', label: 'Larger', px: 18 },
];

/**
 * Settings → Appearance. Choices apply instantly and are saved to your account
 * (theme, text size) or to this device (reduce motion) by ThemeContext.
 */
const AppearanceTab = () => {
    const { theme, resolvedTheme, setTheme, textSize, setTextSize, reduceMotion, setReduceMotion } = useTheme();
    const { showToast } = useToast();

    const warnIfFailed = (ok) => {
        if (ok === false) showToast('Applied here, but it could not be saved to your account. Try again later.', 'error');
    };

    const onThemeKey = (e, index) => {
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const next = THEMES[(index + delta + THEMES.length) % THEMES.length];
        Promise.resolve(setTheme(next.id)).then(warnIfFailed);
        e.currentTarget.parentElement?.children[(index + delta + THEMES.length) % THEMES.length]?.focus();
    };

    const sample = TEXT_SIZES.find((s) => s.id === textSize) || TEXT_SIZES[1];

    return (
        <>
            <PageIntro title="Appearance" description="How Oruinwan looks on your screens. Changes apply right away." />

            <Section
                title="Theme"
                description={theme === 'auto' ? `Following your device — currently ${resolvedTheme}.` : 'Choose a colour scheme.'}
                pad
            >
                <div className="stg-pref-themes" role="radiogroup" aria-label="Theme">
                    {THEMES.map((mode, index) => {
                        const active = theme === mode.id;
                        const Icon = mode.icon;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                tabIndex={active ? 0 : -1}
                                className="stg-pref-theme"
                                data-testid={`theme-${mode.id}`}
                                onClick={() => Promise.resolve(setTheme(mode.id)).then(warnIfFailed)}
                                onKeyDown={(e) => onThemeKey(e, index)}
                            >
                                <div className="stg-pref-mock" data-mode={mode.id} aria-hidden="true">
                                    <div className="stg-pref-mock-side" />
                                    <div className="stg-pref-mock-body">
                                        <div className="stg-pref-mock-line" style={{ width: '75%' }} />
                                        <div className="stg-pref-mock-line" style={{ width: '50%' }} />
                                        <div className="stg-pref-mock-line" style={{ width: '65%' }} />
                                    </div>
                                </div>
                                <div className="stg-pref-theme-label">
                                    <Icon size={14} />
                                    <div>
                                        <div className="stg-pref-theme-name">{mode.label}</div>
                                        <div className="stg-pref-theme-desc">{mode.description}</div>
                                    </div>
                                </div>
                                {active && <Check size={14} className="stg-pref-theme-check" />}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section title="Text" description="Readability in conversations.">
                <Row
                    label="Message text size"
                    description="Resizes message text in channels, direct messages and threads. Menus and labels keep their size — use your browser zoom (Ctrl/⌘ +) to scale everything."
                    stack
                >
                    <div className="stg-segmented" role="group" aria-label="Message text size">
                        {TEXT_SIZES.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                aria-pressed={textSize === s.id}
                                onClick={() => Promise.resolve(setTextSize(s.id)).then(warnIfFailed)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </Row>
                <div className="stg-pref-sample" style={{ fontSize: sample.px, marginBottom: 14 }} aria-label="Preview">
                    <span className="stg-pref-sample-name">Maya</span>
                    The launch notes are ready — take a look when you have a minute.
                </div>
            </Section>

            <Section title="Motion">
                <SwitchRow
                    label="Reduce motion"
                    description="Turn off animations and transitions on this device."
                    checked={reduceMotion}
                    onChange={setReduceMotion}
                />
            </Section>
        </>
    );
};

export default AppearanceTab;
