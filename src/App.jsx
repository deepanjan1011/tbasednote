import { useState, useEffect } from 'react';
import { db } from './db';
import { supabase } from './lib/supabase'; // Import supabase here
import { v4 as uuidv4 } from 'uuid';
import { fetchJoke } from './lib/joke';
import { syncNotes } from './lib/sync';
import CommandBar from './components/CommandBar';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import AuthModal from './components/AuthModal';
import MergeModal from './components/MergeModal';
import SettingsView from './components/SettingsView';
import ExportMenu from './components/ExportMenu';
import HelpMenu from './components/HelpMenu';

import { getInitialSettings } from './config/settings';

function App() {
    const [mode, setMode] = useState('ROOT');
    const [statusMsg, setStatusMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [inputVal, setInputVal] = useState('');
    const [jokeText, setJokeText] = useState('');

    // Settings State
    // Settings State
    const [settings, setSettings] = useState(getInitialSettings());

    // Merge State
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeCandidates, setMergeCandidates] = useState([]);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    // Start Sync Loop
    useEffect(() => {
        // Initial sync
        syncNotes();

        // Sync every 30 seconds
        const intervalId = setInterval(() => {
            syncNotes();
        }, 30000);

        // Sync when coming back online
        const handleOnline = () => {
            console.log('Online detected, syncing...');
            syncNotes();
        };

        // Sync when tab becomes visible (user returns)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('Tab visible, syncing...');
                syncNotes();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Auth & Data Merge Logic
    useEffect(() => {
        if (!supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                // User logged in!
                setMode('ROOT'); // Close auth modal if open

                // Only show welcome message and prompt merge if this is a fresh login action
                const isFreshLogin = sessionStorage.getItem('vylite_logging_in');

                if (isFreshLogin) {
                    setStatusMsg(`> welcome ${session.user.email?.split('@')[0]}... syncing...`);
                    setTimeout(() => setStatusMsg(''), 1500);
                    sessionStorage.removeItem('vylite_logging_in');

                    // Delayed check for fresh logins
                    setTimeout(async () => {
                        try {
                            // Check for Orphans AND Foreign notes
                            const candidates = await db.notes.filter(n => !n.userId || n.userId !== session.user.id).toArray();
                            if (candidates.length > 0) {
                                setMergeCandidates(candidates);
                                setShowMergeModal(true);
                            } else {
                                syncNotes();
                            }
                        } catch (e) {
                            console.error("Data check failed:", e);
                        }
                    }, 2200);
                } else {
                    // Immediate sync for page refreshes
                    syncNotes();
                }

                setCurrentUserEmail(session.user.email);
                setCurrentUserId(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setStatusMsg('> signing out...');
                setTimeout(() => setStatusMsg(''), 2000);
                setMode('ROOT');
                // Optional: Clear local data?
                // For Vylite "Local First", we might keep them, but it's risky for shared public computers.
                // Let's keep them for now as per "Speed" requirement, or clear them if strictly "Auth" focused.
                // Given the instructions, we'll keep the session-based approach simple.
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Apply Settings (Themes & Layout)
    useEffect(() => {
        // Theme Logic
        const root = document.documentElement;

        // Reset classes
        root.classList.remove('theme-light', 'theme-dark', 'theme-velvet');

        // Apply theme class (assuming we set these up in CSS, or just handle styles manually here)
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
            // Velvet (Void default) - High Visibility Refinement
            root.style.setProperty('--bg-color', '#1E1113');
            root.style.setProperty('--text-color', '#EBD9DD');
            root.style.setProperty('--border-color', '#593238');
            root.style.setProperty('--surface-color', '#2D181C');
            root.style.setProperty('--muted-color', '#9A7A82');
            root.style.setProperty('--stripe-color', 'rgba(235, 217, 221, 0.05)');
        }

        // Apply visual settings (border radius, width, etc)
        const formatValue = (val, unit) => {
            if (!val) return '0';
            if (isNaN(val)) return val;
            return `${val}${unit}`;
        };

        root.style.setProperty('--border-radius', formatValue(settings.border_radius, 'rem'));
        root.style.setProperty('--border-width', formatValue(settings.border_width, 'px'));

        // Persist settings
        localStorage.setItem('vylite_settings', JSON.stringify(settings));

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

    const handleMerge = async () => {
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log(`Merging ${mergeCandidates.length} orphaned notes to user ${user.id}`);
        await db.transaction('rw', db.notes, async () => {
            for (const note of mergeCandidates) {
                await db.notes.update(note.id, {
                    userId: user.id,
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString()
                });
            }
        });

        setShowMergeModal(false);
        setMergeCandidates([]);
        syncNotes(); // Push changes
    };

    const handleSkipMerge = () => {
        setShowMergeModal(false);
        setMergeCandidates([]);
        syncNotes(); // Just pull remote notes
    };


    // Global Key Handler for Navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (['CONF', 'HELP', 'LIST', 'PHILOSOPHY', 'JOKE'].includes(mode)) {
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
            setTimeout(async () => {
                // Create note explicitly here to avoid double-creation in NoteEditor due to React StrictMode
                try {
                    const newId = uuidv4();
                    await db.notes.add({
                        id: newId,
                        title: '',
                        content: '',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        syncStatus: 'pending',
                        lastModified: new Date().toISOString(),
                        deleted: false
                    });
                    setActiveNoteId(newId);
                    setMode('EDITOR');
                    setStatusMsg('');
                    setInputVal('');
                    // Trigger background sync
                    syncNotes();
                } catch (e) {
                    console.error("Failed to create note:", e);
                    setStatusMsg('error creating note');
                }
            }, 800);
        } else if (cmd === '/a') {
            setMode('LIST');
        } else if (cmd === '/h') {
            if (mode === 'HELP') {
                setMode('ROOT');
                setInputVal('');
            } else {
                setMode('HELP');
            }
        } else if (cmd === '/acc') {
            setMode('AUTH');
        } else if (cmd === '/conf') {
            setMode('CONF');
        } else if (cmd === '/export') {
            setMode('EXPORT');
            // Old direct download logic removed in favor of UI menu
        } else if (cmd === '/joke') {
            setMode('JOKE');
            setJokeText('thinking...');
            fetchJoke().then(joke => setJokeText(joke)).catch((err) => {
                console.error('Joke fetch error:', err);
                setJokeText('Failed to fetch joke. Please check your API key.');
            });
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

    const handleRequestMerge = async () => {
        if (!currentUserId) return;
        // Collect Orphans AND Foreign notes
        const candidates = await db.notes.filter(n => !n.userId || n.userId !== currentUserId).toArray();
        if (candidates.length > 0) {
            setMergeCandidates(candidates);
            setShowMergeModal(true);
            setMode('ROOT');
        }
    };

    return (
        <div
            className="min-h-screen font-mono flex items-center justify-center overflow-hidden transition-colors duration-300"
            style={{
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-color)'
            }}
        >
            {mode === 'AUTH' && <AuthModal onClose={() => setMode('ROOT')} onRequestMerge={handleRequestMerge} />}

            {showMergeModal && (
                <MergeModal
                    count={mergeCandidates.length}
                    userEmail={currentUserEmail}
                    onMerge={handleMerge}
                    onSkip={handleSkipMerge}
                />
            )}

            {mode === 'EDITOR' ? (
                <NoteEditor
                    initialNoteId={activeNoteId}
                    onExit={() => {
                        setMode('ROOT');
                        setActiveNoteId(null);
                        // Trigger sync when closing editor
                        syncNotes();
                    }}
                    settings={settings}
                />
            ) : (
                <div
                    className="w-full p-4 flex flex-col items-center h-screen transition-all duration-300 ease-in-out justify-center"
                    style={{
                        paddingTop: settings.margin_top_of_line ? (isNaN(settings.margin_top_of_line) ? settings.margin_top_of_line : `${settings.margin_top_of_line}vh`) : undefined,
                        maxWidth: settings.width_of_line ? (isNaN(settings.width_of_line) ? settings.width_of_line : `${settings.width_of_line}rem`) : '600px',
                        justifyContent: settings.margin_top_of_line ? 'flex-start' : 'center'
                    }}
                >


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
                    ) : mode === 'EXPORT' ? (
                        <div className="w-full mb-8">
                            <ExportMenu onClose={() => setMode('ROOT')} />
                        </div>
                    ) : (
                        <div
                            className="w-full max-w-2xl p-8 rounded-2xl border shadow-xl transition-all duration-300 relative mb-8"
                            style={{
                                backgroundColor: 'var(--surface-color)',
                                borderColor: 'var(--border-color)'
                            }}
                        >
                            {statusMsg ? (
                                <div className="font-mono animate-in fade-in slide-in-from-bottom-2">
                                    <div className="text-xl mb-3 text-blue-400 font-bold">{inputVal || (statusMsg.includes('creating') ? '/c' : '/')}</div>
                                    <div className="text-sm opacity-70 flex items-center gap-2">
                                        <span className="text-blue-400">&gt;</span>
                                        {statusMsg}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <CommandBar
                                        value={inputVal}
                                        onChange={setInputVal}
                                        onCommand={handleCommand}
                                        onSearch={handleSearch}
                                        placeholder={settings.placeholder_text}
                                    />

                                    {mode === 'ROOT' && !searchTerm && settings.show_commands_on_homepage !== 'false' && (
                                        <>
                                            <div
                                                className="w-full h-px my-6"
                                                style={{ backgroundColor: 'var(--border-color)' }}
                                            />
                                            <div className="flex gap-4 w-full animate-in fade-in slide-in-from-top-2 flex-shrink-0 flex-wrap">
                                                <div
                                                    className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors hover:bg-white/5 cursor-pointer"
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    onClick={() => { setInputVal('/c'); handleCommand('/c'); }}
                                                >
                                                    <span
                                                        className="px-1.5 py-0.5 rounded font-bold font-mono"
                                                        style={{ backgroundColor: 'var(--muted-color)', color: 'var(--text-color)' }}
                                                    >/c</span>
                                                    <span style={{ color: 'var(--muted-color)' }}>create new note</span>
                                                </div>
                                                <div
                                                    className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors hover:bg-white/5 cursor-pointer"
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    onClick={() => { setInputVal('/a'); handleCommand('/a'); }}
                                                >
                                                    <span
                                                        className="px-1.5 py-0.5 rounded font-bold font-mono"
                                                        style={{ backgroundColor: 'var(--muted-color)', color: 'var(--text-color)' }}
                                                    >/a</span>
                                                    <span style={{ color: 'var(--muted-color)' }}>view all notes</span>
                                                </div>
                                                <div
                                                    className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors hover:bg-white/5 cursor-pointer"
                                                    style={{ borderColor: 'var(--border-color)' }}
                                                    onClick={() => { setInputVal('/h'); handleCommand('/h'); }}
                                                >
                                                    <span
                                                        className="px-1.5 py-0.5 rounded font-bold font-mono"
                                                        style={{ backgroundColor: 'var(--muted-color)', color: 'var(--text-color)' }}
                                                    >/h</span>
                                                    <span style={{ color: 'var(--muted-color)' }}>show commands</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {mode === 'ROOT' && !searchTerm && settings.show_recent_notes_on_homepage === 'true' && (
                        <div className="w-full mt-8">
                            <div className="text-xs mb-2 font-mono" style={{ color: 'var(--muted-color)' }}>RECENT</div>
                            <NoteList
                                onSelectNote={handleSelectNote}
                                settings={settings}
                                limit={3}
                                currentUserId={currentUserId}
                            />
                        </div>
                    )}

                    {mode === 'LIST' && (
                        <NoteList searchTerm={searchTerm} onSelectNote={handleSelectNote} settings={settings} currentUserId={currentUserId} />
                    )}

                    {mode === 'CONF' && (
                        <SettingsView settings={settings} onUpdateSettings={handleUpdateSettings} />
                    )}



                    {mode === 'HELP' && <HelpMenu />}

                    {mode === 'JOKE' && (
                        <div className="mt-20 max-w-md text-center animate-in fade-in zoom-in-95">
                            <div className="text-4xl mb-6">👻</div>
                            <p className="text-lg font-medium leading-relaxed mb-8">
                                {jokeText}
                            </p>
                            <div className="text-xs opacity-50 font-mono">
                                press esc to return
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
