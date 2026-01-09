import { useState, useEffect, useRef } from 'react';
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
        <div className="fixed inset-0 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: 'var(--bg-color)' }}
        >
            <div
                className="w-full max-w-4xl h-[75vh] border shadow-2xl flex flex-col p-8 relative"
                style={{
                    backgroundColor: 'var(--surface-color)', // key for the "card" look
                    borderColor: 'var(--border-color)',
                    borderRadius: '1rem'
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Start typing..."
                    className="w-full h-full bg-transparent resize-none outline-none"
                    style={{
                        fontFamily: settings?.editor_font || 'inherit',
                        fontSize: settings?.editor_font_size ? `${settings.editor_font_size}px` : 'inherit',
                        color: 'var(--text-color)'
                    }}
                    spellCheck="false"
                />
            </div>

            <div className="absolute bottom-6 right-8 text-xs font-mono" style={{ color: 'var(--muted-color)' }}>
                esc to exit <span className="mx-2">|</span> ctrl+d to delete
            </div>
        </div>
    );
};

export default NoteEditor;
