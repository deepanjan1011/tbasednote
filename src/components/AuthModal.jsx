import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthModal = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (provider) => {
        if (!isSupabaseConfigured()) {
            setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: provider,
        });
        if (error) setError(error.message);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 animate-in fade-in duration-200" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div
                className="border p-8 w-full max-w-sm text-center rounded-xl shadow-2xl"
                style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-mono mb-6">Account</h2>

                {error && (
                    <div className="mb-4 text-xs border p-2 rounded bg-red-500/10 text-red-500 border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={() => handleLogin('google')}
                        disabled={loading}
                        className="w-full py-3 border transition-all rounded font-mono text-sm flex items-center justify-center gap-2 group"
                        style={{
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-color)',
                            opacity: 0.8
                        }}
                    >
                        {loading ? 'Connecting...' : 'Continue with Google'}
                    </button>
                    <button
                        onClick={() => handleLogin('github')}
                        disabled={loading}
                        className="w-full py-3 border transition-all rounded font-mono text-sm"
                        style={{
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-color)',
                            opacity: 0.8
                        }}
                    >
                        Continue with Email
                    </button>
                </div>

                <div className="mt-8 text-xs leading-relaxed" style={{ color: 'var(--muted-color)' }}>
                    By continuing, you agree to our <span className="underline cursor-pointer hover:opacity-100" style={{ opacity: 0.7 }}>Terms of Service</span> and <span className="underline cursor-pointer hover:opacity-100" style={{ opacity: 0.7 }}>Privacy Policy</span>.
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
