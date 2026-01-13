import { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { fetchCompletion, rewriteText } from '../lib/gemini';
import { getMetaKey } from '../lib/utils';

const NoteEditor = ({ onExit, initialNoteId, settings }) => {
    const [content, setContent] = useState('');
    const [noteId, setNoteId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState(''); // 'thinking', 'error', 'success'
    const [showAiInput, setShowAiInput] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    // Vim Mode State
    const [vimMode, setVimMode] = useState('insert'); // 'normal' or 'insert'
    const [yankBuffer, setYankBuffer] = useState('');
    const [pendingKey, setPendingKey] = useState(''); // For multi-key commands like 'gg'
    const textareaRef = useRef(null);
    const metaKey = getMetaKey();

    // Save to history helper
    const saveToHistory = (newContent) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newContent);
        // Limit history size
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    useEffect(() => {
        const initNote = async () => {
            if (initialNoteId) {
                const note = await db.notes.get(initialNoteId);
                if (note) {
                    setNoteId(note.id);
                    setContent(note.content);
                    // Init history
                    setHistory([note.content]);
                    setHistoryIndex(0);
                } else {
                    // Handle case where note doesn't exist? Fallback to new.
                    createNew();
                }
            } else {
                createNew();
            }
        };

        const createNew = async () => {
            try {
                const id = uuidv4();
                await db.notes.add({
                    id,
                    title: '',
                    content: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString(),
                    deleted: false
                });
                setNoteId(id);
            } catch (error) {
                console.error("Failed to create new note:", error);
            }
        };

        initNote();
        textareaRef.current?.focus();
    }, [initialNoteId]);

    const handleChange = async (e) => {
        const val = e.target.value;
        setContent(val);

        // Simple debounce for history could go here, but for now we rely on explicit saves or coarse updates
        // To make undo "feel" native, we usually save on word breaks or pauses. 
        // For simplicity, we won't save EVERY character to history state to avoid performance issues, 
        // OR we can save it. Let's try saving every change for now but it might be heavy.
        // Better: Don't save to history on every keystroke here. 
        // Rely on a "capture" mechanism or specific check.
        // Actually, preventing native undo is the main issue. 
        // Let's rely on saving history ONLY when AI changes things or significant pauses.

        // *Amendment*: Controlled inputs break native undo. We MUST implement a stack or use uncontrolled.
        // Let's push to history if the length difference is > 5 chars or it's a newline.


        // Using a ref to track last saved content to avoid state staleness in debounce
        const lastSavedContent = useRef(content);

        // Better History Strategy: Save on space/enter or pause
        useEffect(() => {
            const handler = setTimeout(() => {
                if (content !== history[historyIndex]) {
                    saveToHistory(content);
                }
            }, 1000); // Save snapshot 1s after typing stops
            return () => clearTimeout(handler);
        }, [content]);

        if (noteId) {
            const title = val.split('\n')[0] || 'Untitled';
            await db.notes.update(noteId, {
                content: val,
                title: title,
                updatedAt: new Date(),
                syncStatus: 'pending',
                lastModified: new Date().toISOString()
            });
        }
    };


    const handleKeyDown = (e) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursor = textarea.selectionStart;
        const lines = content.split('\n');

        // Helper: Get current line index and position within line
        const getLineInfo = () => {
            let charCount = 0;
            for (let i = 0; i < lines.length; i++) {
                if (charCount + lines[i].length >= cursor || i === lines.length - 1) {
                    return { lineIndex: i, lineStart: charCount, posInLine: cursor - charCount };
                }
                charCount += lines[i].length + 1; // +1 for newline
            }
            return { lineIndex: 0, lineStart: 0, posInLine: 0 };
        };

        // Helper: Set cursor position
        const setCursor = (pos) => {
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = Math.max(0, Math.min(pos, content.length));
            }, 0);
        };

        // ===== NORMAL MODE =====
        if (vimMode === 'normal') {
            e.preventDefault(); // Block all typing in Normal mode

            // Multi-key commands (gg, etc.)
            if (pendingKey) {
                if (pendingKey === 'g' && e.key === 'g') {
                    setCursor(0); // gg -> start of document
                }
                if (pendingKey === 'd' && e.key === 'd') {
                    // dd -> delete line
                    const { lineIndex, lineStart } = getLineInfo();
                    const lineEnd = lineStart + lines[lineIndex].length + (lineIndex < lines.length - 1 ? 1 : 0);
                    saveToHistory(content);
                    setYankBuffer(lines[lineIndex]);
                    const newContent = content.slice(0, lineStart) + content.slice(lineEnd);
                    setContent(newContent);
                    setCursor(lineStart);
                }
                if (pendingKey === 'y' && e.key === 'y') {
                    // yy -> yank line
                    const { lineIndex } = getLineInfo();
                    setYankBuffer(lines[lineIndex]);
                    setAiStatus('yanked!');
                    setTimeout(() => setAiStatus(''), 1000);
                }
                setPendingKey('');
                return;
            }

            // Redo (Ctrl+r) - Check BEFORE switch to avoid 'r' case capturing it
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                if (historyIndex < history.length - 1) {
                    setHistoryIndex(historyIndex + 1);
                    setContent(history[historyIndex + 1]);
                }
                return;
            }

            // Single-key commands
            switch (e.key) {
                case 'i': // Enter Insert Mode
                    setVimMode('insert');
                    return;
                case 'a': // Append (enter insert after cursor)
                    setVimMode('insert');
                    setCursor(cursor + 1);
                    return;
                case 'Escape': // Exit editor from Normal mode
                    onExit();
                    return;

                // Navigation
                case 'h': // Left
                    setCursor(cursor - 1);
                    return;
                case 'l': // Right
                    setCursor(cursor + 1);
                    return;
                case 'j': { // Down
                    const { lineIndex, posInLine } = getLineInfo();
                    if (lineIndex < lines.length - 1) {
                        let newPos = 0;
                        for (let i = 0; i <= lineIndex; i++) newPos += lines[i].length + 1;
                        newPos += Math.min(posInLine, lines[lineIndex + 1].length);
                        setCursor(newPos);
                    }
                    return;
                }
                case 'k': { // Up
                    const { lineIndex, posInLine } = getLineInfo();
                    if (lineIndex > 0) {
                        let newPos = 0;
                        for (let i = 0; i < lineIndex - 1; i++) newPos += lines[i].length + 1;
                        newPos += Math.min(posInLine, lines[lineIndex - 1].length);
                        setCursor(newPos);
                    }
                    return;
                }
                case 'w': { // Next word
                    const match = content.slice(cursor).match(/\W\w/);
                    if (match) setCursor(cursor + match.index + 1);
                    else setCursor(content.length);
                    return;
                }
                case 'b': { // Previous word
                    const before = content.slice(0, cursor);
                    const match = before.match(/\w\W+$/);
                    if (match) setCursor(cursor - match[0].length);
                    else setCursor(0);
                    return;
                }
                case '0': // Start of line
                    setCursor(getLineInfo().lineStart);
                    return;
                case '$': { // End of line
                    const { lineIndex, lineStart } = getLineInfo();
                    setCursor(lineStart + lines[lineIndex].length);
                    return;
                }
                case 'G': // End of document
                    setCursor(content.length);
                    return;
                case 'g': // Pending for gg
                    setPendingKey('g');
                    return;
                case 'd': // Pending for dd
                    setPendingKey('d');
                    return;
                case 'y': // Pending for yy
                    setPendingKey('y');
                    return;
                case 'p': { // Paste after cursor
                    if (yankBuffer) {
                        saveToHistory(content);
                        const { lineIndex, lineStart } = getLineInfo();
                        const lineEnd = lineStart + lines[lineIndex].length;
                        const newContent = content.slice(0, lineEnd) + '\n' + yankBuffer + content.slice(lineEnd);
                        setContent(newContent);
                        setCursor(lineEnd + 1);
                    }
                    return;
                }
                case 'x': { // Delete char under cursor
                    if (cursor < content.length) {
                        saveToHistory(content);
                        setContent(content.slice(0, cursor) + content.slice(cursor + 1));
                    }
                    return;
                }
                case 'u': // Undo
                    if (historyIndex > 0) {
                        setHistoryIndex(historyIndex - 1);
                        setContent(history[historyIndex - 1]);
                    }
                    return;
                case 'r': // Redo check is handled via Ctrl+r check below/above or we can add it here if unique
                    // standard vim replace char is 'r' then char. We are skipping advanced replace for now.
                    return;
            }


            return; // Don't process further in normal mode
        }

        // ===== INSERT MODE =====
        // Escape -> Normal Mode
        if (e.key === 'Escape') {
            setVimMode('normal');
            return;
        }

        // All other Insert Mode handlers (existing code)
        // Ctrl+Z (Undo)
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                const prevContent = history[newIndex];
                setContent(prevContent);
                setHistoryIndex(newIndex);
            }
            return;
        }

        // Ctrl+Shift+Z (Redo)
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                const nextContent = history[newIndex];
                setContent(nextContent);
                setHistoryIndex(newIndex);
            }
            return;
        }

        // Ctrl+D to delete (custom requirement)
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            if (noteId) {
                db.notes.update(noteId, {
                    deleted: true,
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString()
                }).then(() => onExit())
                    .catch(e => console.error("Update failed:", e));
            }
        }
        // AI Autocomplete (Ctrl+Space)
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault();
            if (isGenerating) return;

            setIsGenerating(true);
            setAiStatus('thinking');
            const currentContent = content;

            fetchCompletion(currentContent).then(async (completion) => {
                if (!completion) {
                    setAiStatus('success');
                    setTimeout(() => setAiStatus(''), 2000);
                    return;
                }

                // Append completion
                saveToHistory(currentContent);
                const newContent = currentContent + completion;
                setContent(newContent);
                setAiStatus('success');
                setTimeout(() => setAiStatus(''), 2000);

                // Save to DB
                if (noteId) {
                    const title = newContent.split('\n')[0] || 'Untitled';
                    await db.notes.update(noteId, {
                        content: newContent,
                        title: title,
                        updatedAt: new Date(),
                        syncStatus: 'pending',
                        lastModified: new Date().toISOString()
                    });
                }
            }).catch(err => {
                console.error("AI Completion Failed:", err);
                setAiStatus(`error: ${err.message}`);
                setTimeout(() => setAiStatus(''), 5000);
            }).finally(() => {
                setIsGenerating(false);
                textareaRef.current?.focus();
            });
        }
        // AI Editor (Cmd+K)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();

            if (showAiInput) {
                setShowAiInput(false);
                return;
            }

            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;

            if (start !== end) {
                setShowAiInput(true);
            } else {
                setAiStatus('select text first');
                setTimeout(() => setAiStatus(''), 2000);
            }
        }
    };

    const handleRewrite = async () => {
        if (!aiInstruction.trim()) return;

        // setShowAiInput(false); // Keep it open to show loading state
        // setAiStatus('rewriting...'); // remove global status
        setIsGenerating(true);

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selectedText = content.substring(start, end);

        try {
            const rewritten = await rewriteText(selectedText, aiInstruction);

            saveToHistory(content);
            const newContent = content.substring(0, start) + rewritten + content.substring(end);
            setContent(newContent);

            // Save
            if (noteId) {
                const title = newContent.split('\n')[0] || 'Untitled';
                await db.notes.update(noteId, {
                    content: newContent,
                    title: title,
                    updatedAt: new Date(),
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString()
                });
            }
            setAiStatus('rewritten!');
        } catch (err) {
            console.error(err);
            setAiStatus('rewrite failed');
        } finally {
            setIsGenerating(false);
            setAiInstruction('');
            setShowAiInput(false); // Close after done
            setTimeout(() => setAiStatus(''), 2000);
            textareaRef.current?.focus();
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

            {/* AI Action Input */}
            {showAiInput && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[35rem] p-4 rounded-xl border shadow-2xl animate-in slide-in-from-top-4 backdrop-blur-md bg-opacity-90 max-h-[60vh] overflow-y-auto flex flex-col"
                    style={{
                        backgroundColor: 'var(--surface-color)',
                        borderColor: 'var(--border-color)',
                        zIndex: 60
                    }}>

                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="text-purple-400">✨</span>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted-color)' }}>
                            AI Editor
                        </span>
                    </div>

                    {/* Editor Mode (Rewrite) */}
                    {!isGenerating ? (
                        <>
                            <input
                                className="w-full bg-transparent outline-none font-mono text-sm"
                                style={{ color: 'var(--text-color)' }}
                                placeholder="Describe change... (e.g. 'Fix grammar', 'Make professional')"
                                value={aiInstruction}
                                onChange={(e) => setAiInstruction(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRewrite();
                                    if (e.key === 'Escape') {
                                        setShowAiInput(false);
                                        textareaRef.current?.focus();
                                    }
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                                        e.preventDefault();
                                        setShowAiInput(false);
                                        textareaRef.current?.focus();
                                    }
                                }}
                                autoFocus
                            />
                            <div className="flex gap-2 mt-3 text-xs" style={{ color: 'var(--muted-color)' }}>
                                <button className="hover:text-purple-400 transition-colors" onClick={() => setAiInstruction('Fix grammar')}>[Fix Grammar]</button>
                                <button className="hover:text-purple-400 transition-colors" onClick={() => setAiInstruction('Make concise')}>[Concise]</button>
                                <button className="hover:text-purple-400 transition-colors" onClick={() => setAiInstruction('Professional tone')}>[Professional]</button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center gap-3 py-4 text-sm font-mono animate-pulse" style={{ color: 'var(--text-color)' }}>
                            <span className="animate-spin text-purple-400">⚡</span>
                            Updating text...
                        </div>
                    )}

                </div>
            )}

            {aiStatus === 'thinking' && (
                <div className="absolute top-6 right-8 text-xs font-mono animate-pulse text-purple-400">
                    ✨ thinking...
                </div>
            )}
            {aiStatus.startsWith('error') && (
                <div className="absolute top-6 right-8 text-xs font-mono text-red-400">
                    {aiStatus}
                </div>
            )}
            {aiStatus === 'success' && (
                <div className="absolute top-6 right-8 text-xs font-mono text-green-400">
                    ✨ done
                </div>
            )}

            {/* Vim Mode Indicator */}
            <div className="absolute bottom-6 left-8 text-xs font-mono font-bold" style={{ color: vimMode === 'normal' ? '#a855f7' : 'var(--muted-color)' }}>
                -- {vimMode.toUpperCase()} --
            </div>

            <div className="absolute bottom-6 right-8 text-xs font-mono" style={{ color: 'var(--muted-color)' }}>
                {vimMode === 'normal' ? `i/a ins | hjkl move | w/b 0/$ G/gg nav | x/dd del | yy/p copy | u/${metaKey}+r undo/redo` : `esc normal | ${metaKey}+space AI | ${metaKey}+k edit`}
            </div>

        </div>
    );
};

export default NoteEditor;
