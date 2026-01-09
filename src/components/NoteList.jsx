import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDistanceToNow } from 'date-fns';

const NoteList = ({ searchTerm, onSelectNote, settings, limit }) => {
    const notes = useLiveQuery(
        async () => {
            let collection = db.notes.orderBy('updatedAt').reverse();
            const all = await collection.toArray();

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

    return (
        <div className="mt-8 w-full animate-in slide-in-from-top-2">
            {!notes || notes.length === 0 ? (
                <div className="text-center text-sm" style={{ color: 'var(--muted-color)' }}>No notes found</div>
            ) : (
                <ul className="space-y-2">
                    {notes.map(note => (
                        <li
                            key={note.id}
                            onClick={() => onSelectNote?.(note.id)}
                            className={`flex justify-between items-center text-sm p-2 rounded cursor-pointer group transition-colors hover:bg-[var(--surface-color)] ${settings?.zebra_striping === 'true' ? 'even:bg-[var(--stripe-color)]' : ''}`}
                        >
                            <span className="font-mono truncate max-w-[70%]" style={{ color: 'var(--text-color)', opacity: 0.8 }}>
                                {note.title || 'Untitled'}
                            </span>
                            <span className="text-xs text-right" style={{ color: 'var(--muted-color)' }}>
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
