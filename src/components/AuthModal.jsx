import React, { useState } from 'react';
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#0D0D0D] border border-white/10 p-8 w-full max-w-sm text-center rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-mono mb-6 text-white/90">Account</h2>

                {error && (
                    <div className="mb-4 text-red-500 text-xs border border-red-500/20 p-2 rounded bg-red-500/10">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={() => handleLogin('google')}
                        disabled={loading}
                        className="w-full py-3 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all rounded font-mono text-sm flex items-center justify-center gap-2 group"
                    >
                        {loading ? 'Connecting...' : 'Continue with Google'}
                    </button>
                    <button
                        onClick={() => handleLogin('github')}
                        disabled={loading}
                        className="w-full py-3 border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all rounded font-mono text-sm"
                    >
                        Continue with Email
                    </button>
                </div>

                <div className="mt-8 text-xs text-white/30 leading-relaxed">
                    By continuing, you agree to our <span className="underline hover:text-white/50 cursor-pointer">Terms of Service</span> and <span className="underline hover:text-white/50 cursor-pointer">Privacy Policy</span>.
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
