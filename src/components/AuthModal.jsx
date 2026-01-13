import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db } from '../db';
import { syncNotes } from '../lib/sync';
import { v4 as uuidv4 } from 'uuid';

const AuthModal = ({ onClose, onRequestMerge }) => {
    // view: 'MENU', 'EMAIL', 'PROFILE'
    const [view, setView] = useState('MENU');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ total: 0, synced: 0, pending: 0, localOnly: 0 });

    // Menu Navigation State
    const [menuIndex, setMenuIndex] = useState(0); // 0: Google, 1: Email

    // Profile Navigation State
    const [profileIndex, setProfileIndex] = useState(0); // 0: Email, 1: Joined, 2: Stats, 3: Logout

    // Email Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('SIGN_IN'); // 'SIGN_IN' or 'SIGN_UP'
    const [emailStep, setEmailStep] = useState(0); // 0: Email, 1: Pass, 2: SignIn, 3: SignUp

    // Refs
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const signInRef = useRef(null);
    const signUpRef = useRef(null);
    const logoutRef = useRef(null);

    // Safety ref to prevent immediate key capture (event bleed-through)
    const isReady = useRef(false);

    // Initial focus & Safety Timer & Auth Check
    useEffect(() => {
        // Prevent key capture for first 200ms
        const timer = setTimeout(() => {
            isReady.current = true;
        }, 200);

        // Check Session and Stats
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                setView('PROFILE');
                setProfileIndex(0); // Reset to top

                setUser(session.user);
                setView('PROFILE');
                setProfileIndex(0); // Reset to top
            }
        });

        if (view === 'EMAIL') {
            setTimeout(() => emailRef.current?.focus(), 50);
            setEmailStep(0);
        }

        return () => clearTimeout(timer);
    }, [view]);

    const liveStats = useLiveQuery(async () => {
        if (!user) return { total: 0, synced: 0, pending: 0, localOnly: 0 };
        const allNotes = await db.notes.toArray();
        const total = allNotes.filter(n => !n.deleted).length;
        const synced = allNotes.filter(n => !n.deleted && n.syncStatus === 'synced' && n.userId === user.id).length;
        const pending = allNotes.filter(n => !n.deleted && n.syncStatus === 'pending' && n.userId === user.id).length;
        // Local only = Orphans ONLY (Strict) - Hide foreign notes from this count
        const localOnly = allNotes.filter(n => !n.deleted && !n.userId).length;
        return { total, synced, pending, localOnly };
    }, [user]) || { total: 0, synced: 0, pending: 0, localOnly: 0 };

    // Use live stats instead of state
    useEffect(() => {
        setStats(liveStats);
    }, [liveStats]);

    // Handle Google Login
    const handleOAuth = async () => {
        if (!isSupabaseConfigured()) {
            setError('Supabase is not configured.');
            return;
        }
        setLoading(true);
        sessionStorage.setItem('vylite_logging_in', 'true'); // Flag for welcome msg
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) setError(error.message);
        setLoading(false);
    };

    // Handle Logout
    const handleLogout = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setLoading(false);
        onClose();
    };

    const handleForceSync = async (e) => {
        e.stopPropagation();
        setLoading(true);
        try {
            const res = await syncNotes();
            if (res.error) {
                if (res.error.includes('row-level security')) {
                    setError('Fixing ID conflict (RLS)... retrying...');
                    // Auto-Fix: Regenerate IDs for all pending notes
                    await db.transaction('rw', db.notes, async () => {
                        const pending = await db.notes.where('syncStatus').equals('pending').toArray();
                        let fixedCount = 0;
                        for (const n of pending) {
                            if (n.userId === user.id) {
                                const newId = uuidv4();
                                await db.notes.add({ ...n, id: newId }); // Clone
                                await db.notes.delete(n.id); // Delete old
                                fixedCount++;
                            }
                        }
                        console.log(`RLS Fix: Regenerated ${fixedCount} IDs`);
                    });

                    // Retry Sync
                    await handleForceSync(e);
                    return;
                }
                setError(`Sync failed: ${res.error}`);
            } else {
                // If we pushed items, it worked
                if (res.pushed > 0) {
                    // Success!
                    setError(''); // Clear error
                } else if (res.pendingFound > 0 && res.pushed === 0) {
                    setError(`Sync blocked: found ${res.pendingFound}, pushed 0. User mismatch?`);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle Email Login/Signup
    const handleEmailAuth = async () => {
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }
        if (!isSupabaseConfigured()) {
            setError('Supabase is not configured.');
            return;
        }

        setLoading(true);
        setError('');
        sessionStorage.setItem('vylite_logging_in', 'true'); // Flag for welcome msg

        try {
            if (mode === 'SIGN_IN') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (error) throw error;
                setError('Check your email for the confirmation link.');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Global Key Listener for Modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check safety flag
            if (!isReady.current) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (view === 'EMAIL') {
                    setView('MENU');
                    setMenuIndex(1); // Reset to Email option
                    return;
                }
                onClose();
                return;
            }

            if (view === 'PROFILE') {
                const maxIndex = stats.localOnly > 0 ? 4 : 3;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setProfileIndex(prev => Math.min(prev + 1, maxIndex));
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setProfileIndex(prev => Math.max(prev - 1, 0));
                }
                if (e.key === 'Enter') {
                    if (profileIndex === 3 && stats.localOnly > 0) {
                        onRequestMerge?.();
                    } else if (profileIndex === maxIndex) {
                        handleLogout();
                    }
                }
            }

            if (view === 'MENU') {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault(); // Prevent scrolling
                    setMenuIndex(prev => prev === 0 ? 1 : 0);
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (menuIndex === 0) handleOAuth();
                    else setView('EMAIL');
                }
            }

            if (view === 'EMAIL') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextStep = Math.min(emailStep + 1, 3);
                    setEmailStep(nextStep);
                    if (nextStep === 1) passwordRef.current?.focus();
                    if (nextStep === 2) { signInRef.current?.focus(); setMode('SIGN_IN'); }
                    if (nextStep === 3) { signUpRef.current?.focus(); setMode('SIGN_UP'); }
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevStep = Math.max(emailStep - 1, 0);
                    setEmailStep(prevStep);
                    if (prevStep === 0) emailRef.current?.focus();
                    if (prevStep === 1) passwordRef.current?.focus();
                    if (prevStep === 2) { signInRef.current?.focus(); setMode('SIGN_IN'); }
                }
                if (e.key === 'Enter') {
                    // Allow Enter on buttons to trigger action
                    if (emailStep === 2 || emailStep === 3) {
                        handleEmailAuth();
                    }
                    // Enter on fields moves to next
                    if (emailStep === 0) {
                        setEmailStep(1);
                        passwordRef.current?.focus();
                    } else if (emailStep === 1) {
                        setEmailStep(2);
                        signInRef.current?.focus();
                        setMode('SIGN_IN');
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, menuIndex, mode, email, password, emailStep, profileIndex]);

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50 animate-in fade-in duration-200"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-[500px] flex flex-col relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Badge */}
                <div className="mb-4">
                    <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold font-mono"
                        style={{
                            backgroundColor: 'var(--surface-color)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--muted-color)'
                        }}
                    >
                        /acc
                    </div>
                    <span className="text-xs ml-2 opacity-50 font-mono">backspace to exit</span>
                </div>

                {/* Main Card */}
                <div
                    className="border rounded-xl shadow-2xl overflow-hidden"
                    style={{
                        backgroundColor: 'var(--bg-color)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-color)'
                    }}
                >
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-500/10 text-red-400 text-xs font-mono border-b border-red-500/20">
                            &gt; {error}
                        </div>
                    )}

                    {view === 'PROFILE' && user && (
                        <div className="flex flex-col animate-in slide-in-from-right-4 duration-200">
                            {/* Email */}
                            <div
                                onClick={() => setProfileIndex(0)}
                                className={`p-6 font-mono text-sm flex items-center gap-4 border-b transition-colors cursor-pointer ${profileIndex === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <span className="opacity-50 w-24">email:</span>
                                <span className="opacity-80">{user.email}</span>
                            </div>

                            {/* Joined */}
                            <div
                                onClick={() => setProfileIndex(1)}
                                className={`p-6 font-mono text-sm flex items-center gap-4 border-b transition-colors cursor-pointer ${profileIndex === 1 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <span className="opacity-50 w-24">joined:</span>
                                <span className="opacity-80">
                                    {new Date(user.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    })}
                                </span>
                            </div>

                            {/* Stats (Synced Notes) */}
                            <div
                                onClick={() => setProfileIndex(2)}
                                className={`p-6 font-mono text-sm flex items-center gap-4 border-b transition-colors cursor-pointer ${profileIndex === 2 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <span className="opacity-50 w-24">synced:</span>
                                <span className="opacity-80 text-green-400">{stats.synced} notes</span>
                                {stats.pending > 0 && (
                                    <span
                                        className="text-yellow-400 text-xs flex items-center gap-2 cursor-pointer hover:underline"
                                        onClick={handleForceSync}
                                        title="Click to force sync"
                                    >
                                        ({stats.pending} pending)
                                        <span className="opacity-50 hover:opacity-100">↻</span>
                                    </span>
                                )}
                            </div>

                            {/* Local Orphans (Merge Option) */}
                            {stats.localOnly > 0 && (
                                <div
                                    onClick={() => { setProfileIndex(3); onRequestMerge?.(); }}
                                    className={`p-6 font-mono text-sm flex items-center gap-4 border-b transition-colors cursor-pointer ${profileIndex === 3 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    style={{ borderColor: 'var(--border-color)' }}
                                >
                                    <span className="opacity-50 w-24">local:</span>
                                    <span className="text-yellow-400 font-bold">{stats.localOnly} notes</span>
                                    <span className="text-xs opacity-50 ml-auto flex items-center gap-1 group">
                                        [merge] {profileIndex === 3 && <span>↵</span>}
                                    </span>
                                </div>
                            )}

                            {/* Logout */}
                            <div
                                ref={logoutRef}
                                onClick={() => { setProfileIndex(stats.localOnly > 0 ? 4 : 3); handleLogout(); }}
                                className={`p-6 font-mono text-sm cursor-pointer transition-colors text-red-400 outline-none font-bold ${profileIndex === (stats.localOnly > 0 ? 4 : 3) ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                logout
                                {profileIndex === (stats.localOnly > 0 ? 4 : 3) && <span className="ml-auto float-right opacity-50 text-xs">↵</span>}
                            </div>
                        </div>
                    )}

                    {view === 'MENU' && (
                        <div className="flex flex-col">
                            {/* Google Option */}
                            <div
                                onClick={handleOAuth} // Click still works
                                className={`p-6 font-mono text-sm cursor-pointer transition-colors flex items-center gap-4 border-b ${menuIndex === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <span className={`font-bold transition-opacity ${menuIndex === 0 ? 'opacity-100' : 'opacity-60'}`}>G</span>
                                <span className={`transition-opacity ${menuIndex === 0 ? 'opacity-100' : 'opacity-80'}`}>continue with <span className="text-blue-400">Google</span></span>
                                {menuIndex === 0 && <span className="ml-auto opacity-50 text-xs">↵</span>}
                            </div>

                            {/* Email Option */}
                            <div
                                onClick={() => setView('EMAIL')}
                                className={`p-6 font-mono text-sm cursor-pointer transition-colors flex items-center gap-4 ${menuIndex === 1 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <span className={`font-bold transition-opacity ${menuIndex === 1 ? 'opacity-100' : 'opacity-60'}`}>email</span>
                                <span className={`transition-opacity ${menuIndex === 1 ? 'opacity-100' : 'opacity-80'}`}>continue with <span className="text-red-300">Email</span></span>
                                {menuIndex === 1 && <span className="ml-auto opacity-50 text-xs">↵</span>}
                            </div>
                        </div>
                    )}

                    {view === 'EMAIL' && (
                        <div className="animate-in slide-in-from-right-4 duration-200">
                            {/* Inputs */}
                            <div className="flex flex-col">
                                <input
                                    ref={emailRef}
                                    type="email"
                                    placeholder="email address"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    // onFocus={() => setEmailStep(0)} 
                                    // Removed manual onFocus set to verify if it conflicts. 
                                    // Actually keeping it is better for click-to-focus updating the step.
                                    // Re-adding safety check:
                                    onFocus={() => setEmailStep(0)}
                                    className="w-full p-6 bg-transparent outline-none font-mono text-sm placeholder:opacity-30 border-b transition-colors focus:bg-white/5"
                                    style={{ borderColor: 'var(--border-color)' }}
                                />
                                <input
                                    ref={passwordRef}
                                    type="password"
                                    placeholder="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onFocus={() => setEmailStep(1)}
                                    className="w-full p-6 bg-transparent outline-none font-mono text-sm placeholder:opacity-30 transition-colors focus:bg-white/5"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col border-t" style={{ borderColor: 'var(--border-color)' }}>
                                {/* Sign In */}
                                <div
                                    ref={signInRef}
                                    tabIndex={0}
                                    onFocus={() => { setEmailStep(2); setMode('SIGN_IN'); }}
                                    onClick={() => { setMode('SIGN_IN'); handleEmailAuth(); }}
                                    className={`p-4 font-mono text-sm cursor-pointer outline-none transition-colors flex items-center gap-3 ${emailStep === 2 ? 'bg-white/10' : 'hover:bg-white/5 opacity-50'}`}
                                >
                                    {loading && mode === 'SIGN_IN' ? (
                                        <span className="animate-pulse">... processing</span>
                                    ) : (
                                        <>
                                            <span className="font-bold">→</span>
                                            <span>sign in</span>
                                            {emailStep === 2 && <span className="ml-auto opacity-50 text-xs">↵</span>}
                                        </>
                                    )}
                                </div>

                                {/* Sign Up */}
                                <div
                                    ref={signUpRef}
                                    tabIndex={0}
                                    onFocus={() => { setEmailStep(3); setMode('SIGN_UP'); }}
                                    onClick={() => { setMode('SIGN_UP'); if (mode === 'SIGN_UP') handleEmailAuth(); }}
                                    className={`p-4 font-mono text-sm cursor-pointer outline-none transition-colors flex items-center gap-3 ${emailStep === 3 ? 'bg-white/10' : 'hover:bg-white/5 opacity-50'}`}
                                >
                                    {loading && mode === 'SIGN_UP' ? (
                                        <span className="animate-pulse">... processing</span>
                                    ) : (
                                        <>
                                            <span className="font-bold">user+</span>
                                            <span>sign up</span>
                                            {emailStep === 3 && <span className="ml-auto opacity-50 text-xs">↵</span>}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Back Tip */}
                            <div className="p-2 text-center border-t border-white/5 cursor-pointer hover:bg-white/5" onClick={() => setView('MENU')}>
                                <span className="text-[10px] opacity-30 font-mono">press esc to go back</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
                        By using Vylite, you agree to the <span className="underline">Terms of Service</span>.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default AuthModal;
