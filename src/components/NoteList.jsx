import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, isThisYear } from 'date-fns';

const NoteList = ({ searchTerm, onSelectNote, settings, limit }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const notes = useLiveQuery(
        async () => {
            let collection = db.notes.orderBy('updatedAt').reverse();
            const allRaw = await collection.toArray();
            const all = allRaw.filter(n => !n.deleted);

            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                return all.filter(n =>
                    (n.title && n.title.toLowerCase().includes(lowerTerm)) ||
                    (n.content && n.content.toLowerCase().includes(lowerTerm))
                );
            }
            if (limit && typeof limit === 'number') {
                return all.slice(0, limit);
            }
            return all;
        },
        [searchTerm, limit],
        []
    );

    // Reset selection when list changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [notes?.length, searchTerm]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!notes || notes.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, notes.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (notes[selectedIndex]) {
                    onSelectNote?.(notes[selectedIndex].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [notes, selectedIndex, onSelectNote]);

    // Scroll selected item into view check - rudimentary
    useEffect(() => {
        const el = document.getElementById(`note-item-${selectedIndex}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedIndex]);

    // Grouping Logic
    const getGroupLabel = (dateRaw) => {
        const date = new Date(dateRaw);
        if (isToday(date)) return '# TODAY';
        if (isYesterday(date)) return '# YESTERDAY';
        if (isThisWeek(date)) return '# THIS WEEK';
        if (isThisMonth(date)) return '# THIS MONTH';
        if (isThisYear(date)) return format(date, "'# 'MMMM").toUpperCase();
        return format(date, "'# 'MMMM yyyy").toUpperCase();
    };

    if (!notes || notes.length === 0) {
        return <div className="mt-8 text-center text-sm opacity-50 font-mono">No notes found</div>;
    }

    // Render Logic with Groups
    let lastGroup = null;

    return (
        <div className="mt-8 w-full animate-in slide-in-from-top-2">
            <div
                className="overflow-hidden border rounded-xl"
                style={{
                    backgroundColor: 'var(--bg-color)', // Or maybe slightly lighter/surface? Let keep transparent-ish or bg
                    borderColor: 'var(--border-color)',
                }}
            >
                {notes.map((note, index) => {
                    const group = getGroupLabel(note.updatedAt);
                    const showHeader = group !== lastGroup;
                    lastGroup = group;

                    return (
                        <div key={note.id}>
                            {showHeader && (
                                <div
                                    className="px-4 py-3 text-xs font-bold font-mono opacity-40 border-b flex items-center"
                                    style={{
                                        borderColor: 'var(--border-color)',
                                        backgroundColor: 'rgba(255,255,255,0.02)'
                                    }}
                                >
                                    {group}
                                </div>
                            )}
                            <div
                                id={`note-item-${index}`}
                                onClick={() => onSelectNote?.(note.id)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`
                                    flex justify-between items-center p-4 cursor-pointer transition-colors
                                    ${index !== notes.length - 1 ? 'border-b' : ''}
                                    ${index === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'}
                                `}
                                style={{ borderColor: 'var(--border-color)' }}
                            >
                                <span
                                    className="font-mono truncate max-w-[70%] text-sm"
                                    style={{ color: 'var(--text-color)', opacity: 0.9 }}
                                >
                                    {note.title || 'Untitled'}
                                </span>
                                <span
                                    className="text-xs font-mono opacity-40"
                                >
                                    {format(new Date(note.updatedAt), 'MMM do')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default NoteList;
