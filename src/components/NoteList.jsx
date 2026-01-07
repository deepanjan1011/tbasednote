import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { formatDistanceToNow } from 'date-fns';

const NoteList = ({ searchTerm, onSelectNote }) => {
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        const fetchNotes = async () => {
            let collection = db.notes.orderBy('updatedAt').reverse();

            if (searchTerm) {
                // Simple client-side search for now, Dexie has limitations on mixed query
                const all = await collection.toArray();
                const filtered = all.filter(n =>
                    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    n.content.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setNotes(filtered);
            } else {
                const all = await collection.toArray();
                setNotes(all);
            }
        };
        fetchNotes();
    }, [searchTerm]);

    return (
        <div className="mt-8 w-full animate-in slide-in-from-top-2">
            {notes.length === 0 ? (
                <div className="text-center text-white/20 text-sm">No notes found</div>
            ) : (
                <ul className="space-y-2">
                    {notes.map(note => (
                        <li
                            key={note.id}
                            onClick={() => onSelectNote?.(note.id)}
                            className="flex justify-between items-center text-sm p-2 hover:bg-white/5 rounded cursor-pointer group transition-colors"
                        >
                            <span className="text-white/80 font-mono truncate max-w-[70%]">
                                {note.title || 'Untitled'}
                            </span>
                            <span className="text-white/30 text-xs text-right">
                                {/* Force single line */}
                                {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default NoteList;
