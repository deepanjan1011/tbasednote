import React, { useState, useEffect, useRef } from 'react'; // React imported for Fragment
import { clsx } from 'clsx';
import { SECTIONS } from '../config/settings';

const EMPTY_OBJ = {};

const SettingsView = ({ settings, onUpdateSettings }) => {
    // Local state fallback if main app isn't ready (though we will update app next)
    // We use a ref to editing input to focus it
    const [editingKey, setEditingKey] = useState(null);
    const [editValue, setEditValue] = useState('');

    const [expanded, setExpanded] = useState(new Set());
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef(null);
    const itemRefs = useRef([]);
    const inputRef = useRef(null);

    // Use settings from props, or empty object if not provided (should be provided)
    const values = settings || EMPTY_OBJ;

    // Generate flat list
    const flatList = React.useMemo(() => {
        const list = [];
        SECTIONS.forEach(section => {
            section.items.forEach(item => {
                // Add the main item
                list.push({
                    type: 'item',
                    data: item,
                    key: item.key,
                    section: section.title
                });

                // If expanded, add options
                if (expanded.has(item.key) && item.options) {
                    item.options.forEach(opt => {
                        list.push({
                            type: 'option',
                            parentKey: item.key,
                            value: opt,
                            key: `${item.key}-opt-${opt}`
                        });
                    });
                }
            });
        });
        return list;
    }, [expanded]); // Re-calc if expansion changes

    // Reset refs array when list changes size
    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, flatList.length);
    }, [flatList.length]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingKey && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingKey]);

    // 3. Keyboard Handling
    // Refactored to use local handler instead of window listener to prevent event bleeding
    const handleKeyDown = (e) => {
        if (editingKey) return; // Disable nav while editing

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => {
                const next = prev - 1;
                if (expanded.size > 0) {
                    const expandedKey = Array.from(expanded)[0];
                    const parentIndex = flatList.findIndex(x => x.key === expandedKey);
                    if (parentIndex !== -1 && next < parentIndex) return prev;
                }
                return Math.max(0, next);
            });
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => {
                const next = prev + 1;
                if (expanded.size > 0) {
                    const expandedKey = Array.from(expanded)[0];
                    const parentIndex = flatList.findIndex(x => x.key === expandedKey);
                    let endIndex = parentIndex;
                    while (endIndex + 1 < flatList.length && flatList[endIndex + 1].parentKey === expandedKey) {
                        endIndex++;
                    }
                    if (next > endIndex) return prev;
                }
                return Math.min(flatList.length - 1, next);
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const current = flatList[selectedIndex];
            if (!current) return;

            if (current.type === 'item') {
                const item = current.data;
                if (item.type === 'boolean') {
                    onUpdateSettings?.(item.key, values[item.key] === 'true' ? 'false' : 'true');
                } else if (item.type === 'select') {
                    setExpanded(prev => {
                        const next = new Set();
                        if (!prev.has(item.key)) next.add(item.key);
                        return next;
                    });
                } else if (item.type === 'text' || item.type === 'number') {
                    setEditingKey(item.key);
                    setEditValue(values[item.key]);
                } else if (item.type === 'action') {
                    onUpdateSettings?.(item.key);
                }
            } else if (current.type === 'option') {
                onUpdateSettings?.(current.parentKey, current.value);
                setExpanded(new Set());
                const parentIdx = flatList.findIndex(x => x.key === current.parentKey);
                if (parentIdx !== -1) setSelectedIndex(parentIdx);
            }
        }
    };

    // Auto-focus the list on mount
    useEffect(() => {
        if (!editingKey) {
            listRef.current?.focus();
        }
    }, [editingKey]);

    // Scroll active item into view
    useEffect(() => {
        if (editingKey) return;
        const el = itemRefs.current[selectedIndex];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedIndex, editingKey]);

    const handleInputKeyDown = (e, key) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onUpdateSettings?.(key, editValue);
            setEditingKey(null);
            // Re-focus list after editing
            setTimeout(() => listRef.current?.focus(), 0);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditingKey(null);
            setTimeout(() => listRef.current?.focus(), 0);
        }
    };

    const renderValue = (item) => {
        if (editingKey === item.key) {
            return (
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, item.key)}
                    onBlur={() => {
                        onUpdateSettings?.(item.key, editValue);
                        setEditingKey(null);
                    }}
                    className="bg-transparent border-b text-center outline-none w-24"
                    style={{
                        color: 'var(--text-color)',
                        borderColor: 'var(--muted-color)'
                    }}
                    autoFocus
                />
            );
        }

        const val = values[item.key];
        const isBool = item.type === 'boolean';
        const colorClass = isBool
            ? (val === 'false' ? 'text-red-400' : 'text-green-400')
            : 'text-blue-300';

        return (
            <span style={{ color: 'var(--text-color)', opacity: 0.8 }}>
                <span className={colorClass}>&quot;{val}&quot;</span>
                {item.unit && <span style={{ color: 'var(--muted-color)' }} className="ml-1">{item.unit}</span>}
            </span>
        );
    };

    let renderIndex = 0;

    return (
        <div className="w-full mt-4 animate-in fade-in slide-in-from-top-2 flex-1 min-h-0 flex flex-col">
            <div
                className="border p-6 font-mono text-sm overflow-y-auto w-full custom-scrollbar-hide flex-1 rounded-lg outline-none focus:ring-1 focus:ring-white/10"
                ref={listRef}
                style={{ borderColor: 'var(--surface-color)' }}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                {SECTIONS.map((section) => (
                    <div key={section.title} className="mb-8 last:mb-0">
                        <div className="mb-4 text-xs" style={{ color: 'var(--muted-color)' }}>{`// ${section.title}`}</div>
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const myIndex = renderIndex++;
                                const isSelected = selectedIndex === myIndex;
                                const isExpanded = expanded.has(item.key);

                                const itemElement = (
                                    <div
                                        key={item.key}
                                        ref={el => itemRefs.current[myIndex] = el}
                                        onClick={() => {
                                            if (editingKey !== item.key) setSelectedIndex(myIndex);
                                            if (item.type === 'action') onUpdateSettings?.(item.key);
                                        }}
                                        className="group flex items-center py-1 px-4 -mx-4 rounded cursor-pointer transition-colors duration-200"
                                        style={{
                                            backgroundColor: isSelected ? 'var(--surface-color)' : 'transparent'
                                        }}
                                    >
                                        <span
                                            className={clsx(
                                                "w-4 mr-2 transition-opacity",
                                                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}
                                            style={{ color: 'var(--muted-color)' }}
                                        >
                                            {'>'}
                                        </span>
                                        <span className="mr-2" style={{ color: isSelected ? 'var(--text-color)' : 'var(--muted-color)' }}>
                                            &quot;{item.key}&quot;
                                        </span>
                                        <span className="mr-4" style={{ color: 'var(--muted-color)' }}>:</span>

                                        {item.type === 'action' ? (
                                            <span className="text-red-400">&quot;{item.key}&quot;</span>
                                        ) : renderValue(item)}
                                    </div>
                                );

                                const optionElements = [];
                                if (isExpanded && item.options) {
                                    item.options.forEach(opt => {
                                        const optIndex = renderIndex++;
                                        const isOptSelected = selectedIndex === optIndex;
                                        const isCurrentValue = values[item.key] === opt;

                                        optionElements.push(
                                            <div
                                                key={`${item.key}-opt-${opt}`}
                                                ref={el => itemRefs.current[optIndex] = el}
                                                onClick={() => {
                                                    // Select option, close dropdown, and focus back on parent item
                                                    onUpdateSettings?.(item.key, opt);
                                                    setExpanded(new Set());
                                                    const parentIdx = flatList.findIndex(x => x.key === item.key);
                                                    if (parentIdx !== -1) setSelectedIndex(parentIdx);
                                                }}
                                                onMouseEnter={() => setSelectedIndex(optIndex)}
                                                className="flex items-center py-1 px-4 -mx-4 rounded cursor-pointer transition-colors duration-200"
                                                style={{
                                                    backgroundColor: isOptSelected ? 'var(--surface-color)' : 'transparent'
                                                }}
                                            >
                                                {/* Indentation spacer */}
                                                <span className="w-4 mr-2"></span>
                                                <span className="w-[calc(100%-1.5rem)] text-center">
                                                    <span
                                                        className={clsx(
                                                            isCurrentValue ? "text-green-400" : "",
                                                        )}
                                                        style={{
                                                            color: isCurrentValue ? undefined : (isOptSelected ? 'var(--text-color)' : 'var(--muted-color)')
                                                        }}
                                                    >
                                                        {opt}
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    });
                                }

                                return (
                                    <React.Fragment key={item.key}>
                                        {itemElement}
                                        {optionElements}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                .custom-scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .custom-scrollbar-hide {
                    -ms-overflow-style: none; /* IE and Edge */
                    scrollbar-width: none; /* Firefox */
                }
            `}</style>
        </div>
    );
};

export default SettingsView;
