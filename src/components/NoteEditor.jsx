import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';

const NoteEditor = ({ onExit, initialNoteId, settings }) => {
    const [content, setContent] = useState('');
    const [noteId, setNoteId] = useState(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        const initNote = async () => {
            if (initialNoteId) {
                const note = await db.notes.get(initialNoteId);
                if (note) {
                    setNoteId(note.id);
                    setContent(note.content);
                } else {
                    // Handle case where note doesn't exist? Fallback to new.
                    createNew();
                }
            } else {
                createNew();
            }
        };

        const createNew = async () => {
            const id = await db.notes.add({
                title: '',
                content: '',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            setNoteId(id);
        };

        initNote();
        textareaRef.current?.focus();
    }, [initialNoteId]);

    const handleChange = async (e) => {
        const val = e.target.value;
        setContent(val);

        if (noteId) {
            const title = val.split('\n')[0] || 'Untitled';
            await db.notes.update(noteId, {
                content: val,
                title: title,
                updatedAt: new Date()
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onExit();
        }
        // Ctrl+D to delete (custom requirement)
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            if (noteId) {
                db.notes.delete(noteId);
                onExit();
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0D0D0D] flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Start writing..."
                className="w-full max-w-3xl h-full bg-transparent text-white/90 resize-none outline-none"
                style={{
                    fontFamily: settings?.editor_font || 'inherit',
                    fontSize: settings?.editor_font_size ? `${settings.editor_font_size}px` : 'inherit'
                }}
                spellCheck="false"
            />
            <div className="absolute bottom-6 right-8 text-xs text-white/20 font-mono">
                esc to exit <span className="mx-2">|</span> ctrl+d to delete
            </div>
        </div>
    );
};

export default NoteEditor;
