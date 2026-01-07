import React, { useState, useEffect } from 'react';
import CommandBar from './components/CommandBar';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import AuthModal from './components/AuthModal';
import SettingsView from './components/SettingsView';

function App() {
    const [mode, setMode] = useState('ROOT'); // ROOT, EDITOR, LIST, HELP, AUTH, CONF
    const [statusMsg, setStatusMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [inputVal, setInputVal] = useState('');

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
        <div className="bg-[#0D0D0D] min-h-screen text-white font-mono flex items-center justify-center overflow-hidden">
            {mode === 'AUTH' && <AuthModal onClose={() => setMode('ROOT')} />}

            {mode === 'EDITOR' ? (
                <NoteEditor
                    initialNoteId={activeNoteId}
                    onExit={() => {
                        setMode('ROOT');
                        setActiveNoteId(null);
                    }}
                />
            ) : (
                <div className="w-full max-w-[600px] p-4 flex flex-col items-center h-screen pt-[20vh]">

                    <div className="w-full mb-2 h-6 text-center text-sm text-green-500 animate-pulse flex-shrink-0">
                        {statusMsg}
                    </div>

                    {/* Scrollable Content Container */}
                    <div className="w-full flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col items-center">
                        {mode === 'CONF' ? (
                            <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 flex-shrink-0">
                                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10 w-fit">
                                    <span className="bg-white/10 px-2 py-1 rounded text-white text-sm font-bold">/conf</span>
                                </div>
                                <div className="text-right text-xs text-white/20 mt-1">esc or backspace to exit</div>
                            </div>
                        ) : (
                            <CommandBar
                                value={inputVal}
                                onChange={setInputVal}
                                onCommand={handleCommand}
                                onSearch={handleSearch}
                            />
                        )}

                        {mode === 'ROOT' && !searchTerm && (
                            <div className="mt-4 flex gap-4 w-full animate-in fade-in slide-in-from-top-2 flex-shrink-0">
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/90 text-xs font-medium">/c</span>
                                    <span className="text-white/40 text-xs">create new note</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/90 text-xs font-medium">/a</span>
                                    <span className="text-white/40 text-xs">view all notes</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/90 text-xs font-medium">/h</span>
                                    <span className="text-white/40 text-xs">show commands</span>
                                </div>
                            </div>
                        )}

                        {mode === 'LIST' && (
                            <NoteList searchTerm={searchTerm} onSelectNote={handleSelectNote} />
                        )}

                        {mode === 'CONF' && (
                            <SettingsView />
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
