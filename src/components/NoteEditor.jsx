import { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { fetchCompletion, rewriteText } from '../lib/gemini';
import { getMetaKey, isActionKey } from '../lib/utils';

import CryptoJS from 'crypto-js';
import MarkdownView from './MarkdownView';
import { updateNoteEmbedding } from '../lib/search';

const NoteEditor = ({ onExit, initialNoteId, settings }) => {
    const [content, setContent] = useState('');
    const [noteId, setNoteId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState(''); // 'thinking', 'error', 'success'
    const [showAiInput, setShowAiInput] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [isIndexing, setIsIndexing] = useState(false); // New: indexing status
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    // Vim Mode State
    const [vimMode, setVimMode] = useState('insert'); // 'normal' or 'insert'
    const [yankBuffer, setYankBuffer] = useState('');
    const [pendingKey, setPendingKey] = useState(''); // For multi-key commands like 'gg'
    const [showRaw, setShowRaw] = useState(false); // New debug mode
    const [showPreview, setShowPreview] = useState(false); // Preview mode
    const [rawContent, setRawContent] = useState(''); // Stored ciphertext
    const textareaRef = useRef(null);
    const metaKey = getMetaKey();

    // Refs for state access in effects/callbacks without deps
    const historyRef = useRef(history);
    const historyIndexRef = useRef(historyIndex);
    const aiStatusRef = useRef(aiStatus);

    useEffect(() => {
        historyRef.current = history;
        historyIndexRef.current = historyIndex;
    }, [history, historyIndex]);

    useEffect(() => {
        aiStatusRef.current = aiStatus;
    }, [aiStatus]);

    // Save to history helper
    // Save to history helper
    const saveToHistory = (newContent) => {
        const currentHistory = historyRef.current;
        const currentIndex = historyIndexRef.current;
        const newHistory = currentHistory.slice(0, currentIndex + 1);
        newHistory.push(newContent);
        // Limit history size
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    // Encryption Helpers
    // Encryption Helpers

    const encryptContent = (text) => {
        const key = settings?.encryption_key || '';
        if (!key || !text) return text;
        try {
            const encrypted = CryptoJS.AES.encrypt(text, key).toString();
            console.log("Encrypted:", text.substring(0, 10), "->", encrypted.substring(0, 10));
            return encrypted;
        } catch (e) {
            console.error("Encryption failed:", e);
            return text;
        }
    };

    const decryptContent = (text) => {
        const key = settings?.encryption_key || '';

        // If no key is set, but text looks encrypted, return it RAW (so user sees ciphertext)
        if (!key) {
            return text;
        }

        if (!text) return text;

        try {
            const bytes = CryptoJS.AES.decrypt(text, key);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);

            // If empty string returned, it means wrong key for this ciphertext
            if (!originalText && text.length > 0) {
                // Return raw ciphertext if decryption fails (Wrong Key)
                return text;
            }
            return originalText;
        } catch (e) {
            return text; // Return raw ciphertext on error
        }
    };

    // DB Save Helper
    const saveNote = async (id, data) => {
        const dataToSave = { ...data };
        if (dataToSave.content) {
            // Force encryption check
            const key = settings?.encryption_key || '';
            if (key) {
                // Direct call to avoid dependency issues or use the helper
                const encrypted = encryptContent(dataToSave.content);
                // Sanity check: did it actually encrypt? (Starts with U2F usually)
                if (encrypted === dataToSave.content && dataToSave.content.length > 0) {
                    console.error("Encryption SKIPPED despite key being present!");
                }
                dataToSave.content = encrypted;
            }
        }
        return db.notes.update(id, dataToSave);
    };

    useEffect(() => {
        const initNote = async () => {
            if (initialNoteId) {
                const note = await db.notes.get(initialNoteId);
                if (note) {
                    setNoteId(note.id);
                    // Use internal helper or direct logic, here we use the function defined in scope which uses latest settings props
                    const decrypted = decryptContent(note.content);
                    setContent(decrypted);
                    // Init history
                    setHistory([decrypted]);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNoteId, settings.encryption_key]); // Keep specific deps, disable exhaustive check for helper functions that depend on props anyway

    // Global Key Handlers (Cmd+P)
    useEffect(() => {
        const handleGlobalKeys = (e) => {
            // Toggle Preview (Cmd+P)
            if (isActionKey(e) && e.key === 'p') {
                e.preventDefault();
                setShowPreview(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, []);

    // Focus management when switching back from preview
    useEffect(() => {
        if (!showPreview) {
            // Small timeout to ensure DOM is ready if switching logic is heavy
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 0);
        }
    }, [showPreview]);

    // History debounce logic - moved out of handleChange
    useEffect(() => {
        const handler = setTimeout(() => {
            const currentHistory = historyRef.current;
            const currentIndex = historyIndexRef.current;

            if (content && currentHistory.length > 0 && content !== currentHistory[currentIndex]) {
                saveToHistory(content);
            } else if (content && currentHistory.length === 0) {
                saveToHistory(content);
            }
        }, 1000);
        return () => clearTimeout(handler);
        // saveToHistory depends on refs so it is stable enough, but strictly speaking it changes if defined inline.
        // However, we refactored saveToHistory to use refs, so it can be considered stable-ish or we ignore it.
        // Better: We refactored saveToHistory NOT to use useCallback but just access refs. 
        // But wait, saveToHistory definition changes on every render!
        // So we should put saveToHistory dependencies? No, we used refs inside it.
        // Let's just suppress the warning here because we managed deps manually via refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content]);

    // Embedding update debounce
    useEffect(() => {
        // Skip if encrypted or empty
        if (!content || !noteId || settings.encryption_key) return;

        const handler = setTimeout(async () => {
            console.log("Triggering background embedding update...");
            setIsIndexing(true);
            try {
                await updateNoteEmbedding(noteId, content);
                // Show brief success msg via aiStatus if idle
                // Check current status via ref to avoid stale closure issues if we were strict,
                // but here mainly we want to read it.
                if (!aiStatusRef.current) {
                    setAiStatus('indexed');
                    setTimeout(() => setAiStatus(''), 2000);
                }
            } catch (e) {
                console.error("Embedding failed:", e);
            } finally {
                setIsIndexing(false);
            }
        }, 3000); // 3 seconds idle time

        return () => clearTimeout(handler);
    }, [content, noteId, settings.encryption_key]);

    const handleChange = async (e) => {
        const val = e.target.value;
        setContent(val);

        if (noteId) {
            const title = val.split('\n')[0] || 'Untitled';
            await saveNote(noteId, {
                content: val,
                title: title,
                updatedAt: new Date(),
                syncStatus: 'pending',
                lastModified: new Date().toISOString()
            });
        }
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                    const imageId = uuidv4();
                    await db.images.add({
                        id: imageId,
                        noteId: noteId,
                        blob: blob,
                        createdAt: new Date().toISOString()
                    });

                    // Insert markdown image link
                    const cursor = textareaRef.current.selectionStart;
                    const textToInsert = `![Image](local-image://${imageId})`;
                    const newContent = content.slice(0, cursor) + textToInsert + content.slice(cursor);

                    saveToHistory(content);
                    setContent(newContent);

                    // Trigger Save
                    if (noteId) {
                        await saveNote(noteId, {
                            content: newContent,
                            title: newContent.split('\n')[0] || 'Untitled',
                            updatedAt: new Date(),
                            syncStatus: 'pending',
                            lastModified: new Date().toISOString()
                        });
                    }

                    setTimeout(() => {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursor + textToInsert.length;
                    }, 0);
                }
            }
        }

        // Handle Image URL Paste
        const pastedText = e.clipboardData?.getData('text');
        if (pastedText && pastedText.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)$/i)) {
            e.preventDefault();
            const cursor = textareaRef.current.selectionStart;
            const textToInsert = `![Image](${pastedText})`;
            const newContent = content.slice(0, cursor) + textToInsert + content.slice(cursor);

            saveToHistory(content);
            setContent(newContent);

            if (noteId) {
                await saveNote(noteId, {
                    content: newContent,
                    title: newContent.split('\n')[0] || 'Untitled',
                    updatedAt: new Date(),
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString()
                });
            }
        }
    };


    const handleKeyDown = (e) => {
        // SECURITY: Block most interactions if locked
        if (!settings.encryption_key && content.startsWith('U2F')) {
            // Allow exit keys
            if (e.key === 'Escape' || e.key === 'Backspace') {
                onExit();
            }
            return;
        }

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
            if (isActionKey(e) && e.key === 'r') {
                e.preventDefault();
                if (historyIndex < history.length - 1) {
                    setHistoryIndex(historyIndex + 1);
                    setContent(history[historyIndex + 1]);
                }
                return;
            }

            // Toggle OUT of Normal Mode (Ctrl+\)
            if (isActionKey(e) && e.key === '\\') {
                e.preventDefault();
                setVimMode('insert');
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
        // Escape -> Always Exit
        if (e.key === 'Escape') {
            onExit();
            return;
        }

        // Ctrl+\ -> Enter Normal Mode (if enabled)
        if (isActionKey(e) && e.key === '\\') {
            if (settings?.enable_vim_mode !== 'false') {
                e.preventDefault();
                setVimMode('normal');
            }
            return;
        }

        // Tab Indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            saveToHistory(content);
            const spaces = '    ';
            const newContent = content.substring(0, start) + spaces + content.substring(end);
            setContent(newContent);

            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
            }, 0);
            return;
        }

        // All other Insert Mode handlers (existing code)
        // Ctrl+Z (Undo)
        if (isActionKey(e) && e.key === 'z' && !e.shiftKey) {
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
        if (isActionKey(e) && e.shiftKey && e.key === 'z') {
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
        if (isActionKey(e) && e.key === 'd') {
            e.preventDefault();
            if (noteId) {
                saveNote(noteId, {
                    deleted: true,
                    syncStatus: 'pending',
                    lastModified: new Date().toISOString()
                }).then(() => onExit())
                    .catch(e => console.error("Update failed:", e));
            }
        }
        // AI Autocomplete (Ctrl+J)
        if (isActionKey(e) && e.key === 'j') {
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
                    await saveNote(noteId, {
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
        if (isActionKey(e) && e.key === 'k') {
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
        if (!settings.encryption_key && content.startsWith('U2F')) return; // Locked security check
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
                await saveNote(noteId, {
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

    const toggleRawMode = async () => {
        if (!showRaw) {
            // Fetch actual DB content
            if (noteId) {
                const note = await db.notes.get(noteId);
                setRawContent(note?.content || '');
            }
            setShowRaw(true);
        } else {
            setShowRaw(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
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
                {showPreview ? (
                    <div className="w-full h-full overflow-y-auto pr-2 custom-scrollbar">
                        <MarkdownView content={content} />
                    </div>
                ) : (
                    <textarea
                        ref={textareaRef}
                        value={showRaw ? rawContent : content}
                        onChange={showRaw ? undefined : handleChange}
                        onKeyDown={showRaw ? undefined : handleKeyDown}
                        onPaste={handlePaste}
                        readOnly={showRaw || (!settings.encryption_key && content.startsWith('U2F'))}
                        placeholder={(!settings.encryption_key && content.startsWith('U2F')) ? "LOCKED (Read-Only)" : "Start typing..."}
                        className={`w-full h-full bg-transparent resize-none outline-none ${showRaw ? 'font-mono text-xs opacity-70' : ''}`}
                        style={{
                            fontFamily: showRaw ? 'monospace' : (settings?.editor_font || 'inherit'),
                            fontSize: settings?.editor_font_size ? `${settings.editor_font_size}px` : 'inherit',
                            color: showRaw ? 'var(--muted-color)' : 'var(--text-color)'
                        }}
                        spellCheck="false"
                    />
                )}
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
                                    if (isActionKey(e) && e.key === 'k') {
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
            {aiStatus === 'indexed' && (
                <div className="absolute top-6 right-8 text-xs font-mono text-blue-400 opacity-70">
                    indexed
                </div>
            )}
            {isIndexing && !aiStatus && (
                <div className="absolute top-6 right-8 text-xs font-mono text-purple-400 opacity-50 animate-pulse">
                    indexing...
                </div>
            )}

            {/* Vim Mode Indicator */}
            <div className="absolute bottom-6 left-8 text-xs font-mono font-bold" style={{ color: vimMode === 'normal' ? '#a855f7' : 'var(--muted-color)' }}>
                -- {vimMode.toUpperCase()} --
                {settings?.encryption_key &&
                    <span
                        className="ml-4 text-xs font-normal opacity-70 cursor-pointer hover:text-white hover:underline transition-all"
                        onClick={toggleRawMode}
                        title="Click to view raw encrypted data"
                    >
                        {showRaw ? '🔓 View Plaintext' : '🔒 Encrypted (View Raw)'}
                    </span>
                }
            </div>

            <div className="absolute bottom-6 right-8 text-xs font-mono flex items-center gap-4" style={{ color: 'var(--muted-color)' }}>
                <span className={`cursor-pointer hover:text-white transition-colors ${showPreview ? 'text-purple-400 font-bold' : ''}`} onClick={() => setShowPreview(!showPreview)}>
                    [{showPreview ? 'PREVIEW' : 'EDIT'}] {metaKey}+P
                </span>
                <span>|</span>
                {settings?.enable_vim_mode === 'false'
                    ? `esc exit | ${metaKey}+j AI | ${metaKey}+k edit`
                    : vimMode === 'normal'
                        ? `i/a ins | hjkl move | w/b 0/$ G/gg nav | x/dd del | yy/p copy | u/${metaKey}+r undo/redo`
                        : `${metaKey.toLowerCase()}+\\ vim | esc exit | ${metaKey}+j AI | ${metaKey}+k edit`
                }
            </div>

        </div>
    );
};

export default NoteEditor;
