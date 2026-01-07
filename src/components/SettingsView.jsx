import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

const SECTIONS = [
    // ... (no changes to SECTIONS, but I need to include context to match lines if I don't replace the whole file. Actually I can just replace the imports and the render part.
    // But the replace_file_content tool works on chunks. I will do 2 chunks if possible or 1 large one. 
    // The file is small enough to replace imports effectively. 
    // Wait, I can just replace the whole file to be safe and ensure everything is correct, or just the top and bottom.
    // Let's replace the top imports first.

    {
        title: 'Appearance',
        items: [
            { key: 'theme', value: 'velvet', type: 'select', options: ['light', 'dark', 'velvet'] },
            { key: 'border_radius', value: '0.5', unit: 'rem', type: 'number' },
            { key: 'border_width', value: '1', unit: 'px', type: 'number' },
            { key: 'zebra_striping', value: 'false', type: 'boolean' }
        ]
    },
    {
        title: 'Homepage',
        items: [
            { key: 'placeholder_text', value: 'Search or command...', type: 'text' },
            { key: 'show_recent_notes_on_homepage', value: 'false', type: 'boolean' },
            { key: 'show_commands_on_homepage', value: 'true', type: 'boolean' },
            { key: 'show_navigation_hints', value: 'true', type: 'boolean' }
        ]
    },
    {
        title: 'Editor',
        items: [
            { key: 'editor_font', value: 'Inter', type: 'text' },
            { key: 'editor_font_size', value: '16', unit: 'px', type: 'number' }
        ]
    },
    {
        title: 'Layout',
        items: [
            { key: 'margin_top_of_line', value: '25', unit: 'vh', type: 'number' },
            { key: 'width_of_line', value: '48', unit: 'rem', type: 'number' }
        ]
    },
    {
        title: 'Search',
        items: [
            { key: 'match_threshold', value: '48', unit: '%', type: 'number' }
        ]
    },
    {
        title: 'Actions',
        items: [
            { key: 'reset_defaults', type: 'action' }
        ]
    }
];

const SettingsView = () => {
    // Flatten implementation for easy index navigation
    const allItems = React.useMemo(() => {
        return SECTIONS.flatMap(section =>
            section.items.map(item => ({ ...item, sectionTitle: section.title }))
        );
    }, []);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = React.useRef([]);

    // Reset refs when items change (static for now but good practice)
    itemRefs.current = new Array(allItems.length);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(allItems.length - 1, prev + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allItems.length]);

    // Scroll into view logic
    useEffect(() => {
        const selectedEl = itemRefs.current[selectedIndex];
        if (selectedEl) {
            selectedEl.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedIndex]);

    let globalIndex = 0;

    return (
        <div className="w-full mt-4 animate-in fade-in slide-in-from-top-2 flex-1 min-h-0 flex flex-col">
            <div className="border border-white/10 rounded-lg p-6 font-mono text-sm overflow-y-auto w-full custom-scrollbar-hide flex-1">
                {SECTIONS.map((section) => (
                    <div key={section.title} className="mb-8 last:mb-0">
                        <div className="text-white/30 mb-4 text-xs">// {section.title}</div>
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const currentIndex = globalIndex++;
                                const isSelected = currentIndex === selectedIndex;

                                return (
                                    <div
                                        key={item.key}
                                        ref={el => itemRefs.current[currentIndex] = el}
                                        onClick={() => setSelectedIndex(currentIndex)}
                                        className={clsx(
                                            "group flex items-center py-1 px-4 -mx-4 rounded cursor-pointer transition-colors duration-200",
                                            isSelected ? "bg-white/10" : "hover:bg-white/5"
                                        )}
                                    >
                                        <span className={clsx(
                                            "w-4 mr-2 text-white/50 transition-opacity",
                                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                        )}>
                                            {'>'}
                                        </span>
                                        <span className="text-white/60 mr-2">"{item.key}"</span>
                                        <span className="text-white/30 mr-4">:</span>

                                        {item.type === 'action' ? (
                                            <span className="text-red-400">"{item.key}"</span>
                                        ) : (
                                            <span className="text-white/80">
                                                <span className={item.type === 'boolean' ? 'text-red-400' : 'text-blue-300'}>
                                                    "{item.value}"
                                                </span>
                                                {item.unit && <span className="text-white/40 ml-1">{item.unit}</span>}
                                            </span>
                                        )}
                                    </div>
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
