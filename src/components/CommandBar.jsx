import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const CommandBar = ({ onCommand, onSearch, value, onChange }) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
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
                type="text"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Search or command..."
                className={cn(
                    "w-full bg-transparent text-white placeholder-white/20 text-lg outline-none border-b border-white/10 py-2 transition-all duration-300",
                    "focus:border-white/30 focus:placeholder-white/10"
                )}
                autoComplete="off"
                spellCheck="false"
            />
        </div>
    );
};

export default CommandBar;
