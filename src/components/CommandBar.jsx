import { useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

const CommandBar = ({ onCommand, onSearch, value, onChange, placeholder }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        // slight delay to ensure render completion
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    const handleChange = (e) => {
        const newVal = e.target.value;
        onChange?.(newVal);

        if (newVal.startsWith('/')) {
            // We handle commands on enter, but could show preview here
        } else {
            onSearch?.(newVal);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (value.startsWith('/')) {
                onCommand?.(value);
            } else {
                onCommand?.(value);
            }
        }
        if (e.key === 'Backspace' && value === '') {
            onCommand?.('BACKSPACE_EMPTY');
        }
    };

    return (
        <div className="w-full relative group">
            <input
                ref={inputRef}
                autoFocus
                type="text"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || "Search or command..."}
                className={cn(
                    "w-full bg-transparent text-lg outline-none py-2 transition-all duration-300 placeholder-[var(--muted-color)]",
                )}
                style={{
                    color: 'var(--text-color)',
                    borderColor: 'var(--surface-color)'
                }}
                autoComplete="off"
                spellCheck="false"
            />
        </div>
    );
};

export default CommandBar;
