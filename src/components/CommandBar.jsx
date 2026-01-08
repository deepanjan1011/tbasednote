import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const CommandBar = ({ onCommand, onSearch, value, onChange, placeholder }) => {
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
                placeholder={placeholder || "Search or command..."}
                className={cn(
                    "w-full bg-transparent text-lg outline-none border-b py-2 transition-all duration-300 placeholder-[var(--muted-color)]",
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
