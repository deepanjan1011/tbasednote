import { useState, useEffect } from 'react';

const MergeModal = ({ count, userEmail, onMerge, onSkip }) => {
    const [selectedIndex, setSelectedIndex] = useState(0); // 0: Sync, 1: Skip

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => prev === 0 ? 1 : 0);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex === 0) {
                    onMerge();
                } else {
                    onSkip();
                }
            } else if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                onSkip();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex, onMerge, onSkip]);

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-[60] animate-in fade-in duration-200"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="w-full max-w-[400px] flex flex-col relative border rounded-xl shadow-2xl overflow-hidden"
                style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                }}
            >
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-lg font-bold font-mono">Unsaved Notes Found</h3>
                    <p className="text-xs opacity-60 mt-2 font-mono">
                        We found <span className="text-yellow-400 font-bold">{count}</span> local notes on this device.
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 text-sm opacity-80 font-mono leading-relaxed">
                    Do you want to sync these notes to <span className="text-blue-400">{userEmail}</span>?
                </div>

                {/* Actions */}
                <div className="flex flex-col border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                        onClick={onMerge}
                        onMouseEnter={() => setSelectedIndex(0)}
                        className={`
                            p-4 text-sm font-bold font-mono text-left transition-colors flex justify-between group
                            ${selectedIndex === 0 ? 'bg-white/10' : 'hover:bg-white/5'}
                        `}
                    >
                        <span>Yes, Sync to Account</span>
                        <span className={`transition-opacity ${selectedIndex === 0 ? 'opacity-100' : 'opacity-0'}`}>↵</span>
                    </button>
                    <button
                        onClick={onSkip}
                        onMouseEnter={() => setSelectedIndex(1)}
                        className={`
                            p-4 text-sm font-mono text-left transition-colors border-t flex justify-between
                            ${selectedIndex === 1 ? 'bg-white/10 opacity-100' : 'hover:bg-white/5 opacity-60'}
                        `}
                        style={{ borderColor: 'var(--border-color)' }}
                    >
                        <span>No, Keep Local Only</span>
                        <span className={`transition-opacity ${selectedIndex === 1 ? 'opacity-100' : 'opacity-0'}`}>↵</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MergeModal;
