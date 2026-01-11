import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '../db';

const ExportMenu = ({ onClose }) => {
    // Stage: 'selection' (choose format) -> 'download' (download file)
    const [stage, setStage] = useState('selection');

    // Selection State
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Download State
    const [generatedFile, setGeneratedFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [selectedFormatLabel, setSelectedFormatLabel] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Gating for initial render to prevent "ghost" Enter key presses
    const [interactionReady, setInteractionReady] = useState(false);

    // Force reset on mount to ensure we always start at selection
    useEffect(() => {
        setStage('selection');
        setGeneratedFile(null);
        setFileName('');
        setIsGenerating(false);

        // Small delay before accepting input
        const timer = setTimeout(() => setInteractionReady(true), 200);
        return () => clearTimeout(timer);
    }, []);

    // Options for the first step
    const FORMAT_OPTIONS = [
        { id: 'markdown', label: 'export as markdown' },
        { id: 'json', label: 'export as json' }
    ];

    const handleGenerate = async (formatOption) => {
        setIsGenerating(true);
        setSelectedFormatLabel(formatOption.label);

        try {
            // Fetch all notes (excluding deleted ones handled by logic)
            const notes = await db.notes.toArray();
            const activeNotes = notes.filter(n => !n.deleted);
            const timestamp = new Date().toISOString().slice(0, 10);

            if (formatOption.id === 'json') {
                const blob = new Blob([JSON.stringify(activeNotes, null, 2)], { type: 'application/json' });
                setGeneratedFile(blob);
                setFileName(`vylite-notes-${timestamp}.json`);
                setStage('download');
            } else if (formatOption.id === 'markdown') {
                const zip = new JSZip();
                activeNotes.forEach(note => {
                    const safeTitle = (note.title || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const filename = `${safeTitle}-${note.id.slice(0, 8)}.md`;
                    const content = `# ${note.title || 'Untitled'}\n\n${note.content || ''}\n\n---\nCreated: ${new Date(note.createdAt).toLocaleString()}`;
                    zip.file(filename, content);
                });

                const blob = await zip.generateAsync({ type: 'blob' });
                setGeneratedFile(blob);
                setFileName(`vylite-notes-markdown-${timestamp}.zip`);
                setStage('download');
            }
        } catch (error) {
            console.error("Export failed:", error);
            // Stay in selection mode on error, maybe show error toast?
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (generatedFile) {
            saveAs(generatedFile, fileName);
            onClose(); // Close menu after download
        }
    };

    const handleKeyDown = useCallback((e) => {
        if (!interactionReady) return;

        // Backspace Handling
        if (e.key === 'Backspace') {
            if (stage === 'download') {
                // Return to selection
                setStage('selection');
                setGeneratedFile(null);
                return;
            }
            // If in selection, exit
            onClose();
            return;
        }

        if (e.key === 'Escape') {
            if (stage === 'download') {
                // Return to selection
                setStage('selection');
                setGeneratedFile(null);
                return;
            }
            onClose();
            return;
        }

        if (stage === 'selection') {
            if (e.key === 'ArrowUp') {
                setSelectedIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowDown') {
                setSelectedIndex(prev => Math.min(FORMAT_OPTIONS.length - 1, prev + 1));
            } else if (e.key === 'Enter') {
                handleGenerate(FORMAT_OPTIONS[selectedIndex]);
            }
        } else if (stage === 'download') {
            if (e.key === 'Enter') {
                handleDownload();
            }
        }
    }, [stage, selectedIndex, generatedFile, fileName, onClose, interactionReady]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-top-4">
            {/* Header / Current Path */}
            <div className="w-full mb-4 flex items-center justify-between">
                <div
                    className="flex items-center gap-2 p-2 rounded-lg border w-fit transition-colors"
                    style={{
                        backgroundColor: 'var(--surface-color)',
                        borderColor: 'var(--border-color)'
                    }}
                >
                    <span
                        className="px-2 py-1 rounded text-sm font-bold font-mono"
                        style={{
                            backgroundColor: 'var(--muted-color)',
                            color: 'var(--text-color)'
                        }}
                    >/export</span>
                </div>
                <div className="text-xs font-mono opacity-50" style={{ color: 'var(--text-color)' }}>
                    backspace to {stage === 'download' ? 'go back' : 'exit'}
                </div>
            </div>

            <div className="space-y-2 font-mono text-sm">
                {stage === 'selection' ? (
                    /* STEP 1: SELECT FORMAT */
                    <>
                        {FORMAT_OPTIONS.map((option, index) => (
                            <div
                                key={option.id}
                                className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-between ${selectedIndex === index ? 'scale-[1.02]' : 'opacity-60'}`}
                                style={{
                                    backgroundColor: selectedIndex === index ? 'var(--surface-color)' : 'transparent',
                                    borderColor: selectedIndex === index ? 'var(--border-color)' : 'transparent',
                                    color: 'var(--text-color)'
                                }}
                                onClick={() => {
                                    setSelectedIndex(index);
                                    handleGenerate(option);
                                }}
                            >
                                <span>{option.label}</span>
                                {selectedIndex === index && isGenerating && <span className="text-xs opacity-70 animate-pulse">generating...</span>}
                            </div>
                        ))}
                    </>
                ) : (
                    /* STEP 2: DOWNLOAD */
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-2 mb-2 text-xs italic opacity-50 border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                            Ready to {selectedFormatLabel}...
                        </div>
                        <div
                            className="p-4 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-between scale-[1.02]"
                            style={{
                                backgroundColor: 'var(--surface-color)',
                                borderColor: 'yellow',
                                color: 'var(--text-color)'
                            }}
                            onClick={handleDownload}
                        >
                            <span className="text-yellow-400 font-bold">download {fileName.endsWith('.zip') ? 'zip file' : 'json file'}</span>
                            <span className="text-xs opacity-50">enter to save</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExportMenu;
