import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Settings persisted in localStorage.
 *
 * font:      'inter' | 'system' | 'serif' | 'mono'
 * darkMode:  boolean
 */
const DEFAULTS = {
    font: 'inter',
    darkMode: false,
};

const FONT_CLASS = {
    inter:  'font-inter',
    system: 'font-system',
    serif:  'font-serif-custom',
    mono:   'font-mono-custom',
};

function load() {
    try {
        const raw = localStorage.getItem('hms_settings');
        return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
        return { ...DEFAULTS };
    }
}

function save(settings) {
    localStorage.setItem('hms_settings', JSON.stringify(settings));
}

/** Apply font + dark-mode classes directly on <html> */
function applyToDOM(settings) {
    const html = document.documentElement;

    // Font — remove all, apply active
    Object.values(FONT_CLASS).forEach(c => html.classList.remove(c));
    html.classList.add(FONT_CLASS[settings.font] ?? FONT_CLASS.inter);

    // Dark mode
    if (settings.darkMode) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(load);

    // Apply on first render and whenever settings change
    useEffect(() => {
        applyToDOM(settings);
        save(settings);
    }, [settings]);

    const set = useCallback((key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, set }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
    return ctx;
}
