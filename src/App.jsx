import React, { useState, useEffect } from 'react';
import CommandBar from './components/CommandBar';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import AuthModal from './components/AuthModal';
import SettingsView from './components/SettingsView';

import { getInitialSettings } from './config/settings';

function App() {
    const [mode, setMode] = useState('ROOT');
    const [statusMsg, setStatusMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [inputVal, setInputVal] = useState('');

    // Settings State
    const [settings, setSettings] = useState(getInitialSettings());

    // Apply Settings (Themes & Layout)
    useEffect(() => {
        // Theme Logic
        const root = document.documentElement;

        // Reset classes
        root.classList.remove('theme-light', 'theme-dark', 'theme-velvet');

        // Apply theme class (assuming we set these up in CSS, or just handle styles manually here)
        // For now, let's use the 'theme' value.
        // User requested "Velvet", "Dark", "Light".
        // Default is Velvet.
        if (settings.theme === 'light') {
            root.style.setProperty('--bg-color', '#F7F5F0'); // Warm beige
            root.style.setProperty('--text-color', '#1A1A1A');
            root.style.setProperty('--border-color', 'rgba(0,0,0,0.08)');
            root.style.setProperty('--surface-color', '#E8DCC0'); // Warm gold selection
            root.style.setProperty('--stripe-color', 'rgba(0,0,0,0.02)'); // Very subtle dark tint
            root.style.setProperty('--muted-color', 'rgba(0,0,0,0.4)');
        } else if (settings.theme === 'dark') {
            root.style.setProperty('--bg-color', '#111111');
            root.style.setProperty('--text-color', '#ffffff');
            root.style.setProperty('--border-color', 'rgba(255,255,255,0.1)');
            root.style.setProperty('--surface-color', 'rgba(255,255,255,0.1)');
            root.style.setProperty('--stripe-color', 'rgba(255,255,255,0.03)'); // Subtle white tint
            root.style.setProperty('--muted-color', 'rgba(255,255,255,0.5)');
        } else {
            // Velvet (Void default)
            root.style.setProperty('--bg-color', '#0D0D0D');
            root.style.setProperty('--text-color', '#ffffff');
            root.style.setProperty('--border-color', 'rgba(255,255,255,0.1)');
            root.style.setProperty('--surface-color', 'rgba(255,255,255,0.1)');
            root.style.setProperty('--muted-color', 'rgba(255,255,255,0.5)');
        }

        // Apply visual settings (border radius, width, etc)
        const formatValue = (val, unit) => {
            if (!val) return '0';
            // If value already has non-numeric chars (like 'px', 'rem'), use it as is
            if (isNaN(val)) return val;
            return `${val}${unit}`;
        };

        root.style.setProperty('--border-radius', formatValue(settings.border_radius, 'rem'));
        root.style.setProperty('--border-width', formatValue(settings.border_width, 'px'));
        // ... other settings can be applied here or used in components via props

    }, [settings]);

    const handleUpdateSettings = (key, value) => {
        if (key === 'reset_defaults') {
            setSettings(getInitialSettings());
            return;
        }
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // ... (rest of code) ...


    // Global Key Handler for Navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (['CONF', 'HELP', 'LIST', 'AUTH'].includes(mode)) {
                    setMode('ROOT');
                    setSearchTerm('');
                    setInputVal(''); // Clear input on escape
                    setActiveNoteId(null);
                }
            }
            if (e.key === 'Backspace' && mode === 'CONF') {
                // If editing (target is input), do not exit
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                    return;
                }
                setMode('ROOT');
                setInputVal(''); // Clear input on backspace exit too
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [mode]);

    const handleCommand = (cmd) => {
        if (cmd === '/c') {
            setStatusMsg('creating note...');
            setTimeout(() => {
                setActiveNoteId(null);
                setMode('EDITOR');
                setStatusMsg('');
                setInputVal('');
            }, 800);
        } else if (cmd === '/a') {
            setMode('LIST');
        } else if (cmd === '/h') {
            setMode('HELP');
        } else if (cmd === '/acc') {
            setMode('AUTH');
        } else if (cmd === '/conf') {
            setMode('CONF');
        } else if (cmd === 'BACKSPACE_EMPTY') {
            if (mode !== 'ROOT') {
                setMode('ROOT');
                setSearchTerm('');
                setInputVal('');
            }
        }
    };

    const handleSearch = (term) => {
        setSearchTerm(term);
        // Sync inputVal via onChange
        if (term && mode === 'ROOT') {
            setMode('LIST');
        } else if (!term && mode === 'LIST') {
            setMode('ROOT');
        }
    };

    const handleSelectNote = (id) => {
        setActiveNoteId(id);
        setMode('EDITOR');
        setInputVal(''); // Optional: clear search when opening note
    };

    return (
        <div
            className="min-h-screen font-mono flex items-center justify-center overflow-hidden transition-colors duration-300"
            style={{
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-color)'
            }}
        >
            {mode === 'AUTH' && <AuthModal onClose={() => setMode('ROOT')} />}

            {mode === 'EDITOR' ? (
                <NoteEditor
                    initialNoteId={activeNoteId}
                    onExit={() => {
                        setMode('ROOT');
                        setActiveNoteId(null);
                    }}
                    settings={settings}
                />
            ) : (
                <div
                    className="w-full p-4 flex flex-col items-center h-screen transition-all duration-300 ease-in-out"
                    style={{
                        paddingTop: settings.margin_top_of_line ? (isNaN(settings.margin_top_of_line) ? settings.margin_top_of_line : `${settings.margin_top_of_line}vh`) : '20vh',
                        maxWidth: settings.width_of_line ? (isNaN(settings.width_of_line) ? settings.width_of_line : `${settings.width_of_line}rem`) : '600px'
                    }}
                >

                    <div className="w-full mb-2 h-6 text-center text-sm text-green-500 animate-pulse flex-shrink-0">
                        {statusMsg}
                    </div>

                    {/* Scrollable Content Container */}
                    <div className="w-full flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col items-center">
                        {mode === 'CONF' ? (
                            <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 flex-shrink-0">
                                <div
                                    className="flex items-center gap-2 p-2 rounded-lg border w-fit"
                                    style={{
                                        backgroundColor: 'var(--surface-color)',
                                        borderColor: 'var(--border-color)'
                                    }}
                                >
                                    <span
                                        className="px-2 py-1 rounded text-sm font-bold"
                                        style={{
                                            backgroundColor: 'var(--muted-color)',
                                            color: 'var(--text-color)'
                                        }}
                                    >/conf</span>
                                </div>
                                <div className="text-right text-xs mt-1" style={{ color: 'var(--muted-color)' }}>esc or backspace to exit</div>
                            </div>
                        ) : (
                            <CommandBar
                                value={inputVal}
                                onChange={setInputVal}
                                onCommand={handleCommand}
                                onSearch={handleSearch}
                                placeholder={settings.placeholder_text}
                            />
                        )}

                        {mode === 'ROOT' && !searchTerm && (
                            <>
                                {settings.show_commands_on_homepage !== 'false' && (
                                    <div className="mt-4 flex gap-4 w-full animate-in fade-in slide-in-from-top-2 flex-shrink-0">
                                        <div
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
                                            style={{ borderColor: 'var(--border-color)' }}
                                        >
                                            <span
                                                className="px-1.5 py-0.5 rounded font-medium"
                                                style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                                            >/c</span>
                                            <span style={{ color: 'var(--muted-color)' }}>create new note</span>
                                        </div>
                                        <div
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
                                            style={{ borderColor: 'var(--border-color)' }}
                                        >
                                            <span
                                                className="px-1.5 py-0.5 rounded font-medium"
                                                style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                                            >/a</span>
                                            <span style={{ color: 'var(--muted-color)' }}>view all notes</span>
                                        </div>
                                        <div
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
                                            style={{ borderColor: 'var(--border-color)' }}
                                        >
                                            <span
                                                className="px-1.5 py-0.5 rounded font-medium"
                                                style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                                            >/h</span>
                                            <span style={{ color: 'var(--muted-color)' }}>show commands</span>
                                        </div>
                                    </div>
                                )}
                                {settings.show_recent_notes_on_homepage === 'true' && (
                                    <div className="w-full mt-8">
                                        <div className="text-xs mb-2 font-mono" style={{ color: 'var(--muted-color)' }}>RECENT</div>
                                        <NoteList
                                            onSelectNote={handleSelectNote}
                                            settings={settings}
                                            limit={3}
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {mode === 'LIST' && (
                            <NoteList searchTerm={searchTerm} onSelectNote={handleSelectNote} settings={settings} />
                        )}

                        {mode === 'CONF' && (
                            <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />
                        )}

                        {mode === 'HELP' && (
                            <div className="mt-8 w-full text-sm text-white/60 animate-in fade-in slide-in-from-bottom-4 space-y-6 pb-20">
                                <div>
                                    <h3 className="mb-2 text-xs text-white/30 tracking-wider">CORE</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/c</span>
                                            <span>create new note</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/a</span>
                                            <span>view all notes</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xs text-white/30 tracking-wider">SETTINGS</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/acc</span>
                                            <span>account details</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/conf</span>
                                            <span>edit configuration</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xs text-white/30 tracking-wider">TOOLS</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/export</span>
                                            <span>export notes</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xs text-white/30 tracking-wider">META</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/h</span>
                                            <span>hide commands</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/vylite</span>
                                            <span>vylite's philosophy</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-2 text-xs text-white/30 tracking-wider">OTHERS</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-white/10 px-2 py-1 rounded text-white font-medium text-xs">/joke</span>
                                            <span>get a random joke</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App;
