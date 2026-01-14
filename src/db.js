import Dexie from 'dexie';

export const db = new Dexie('VyliteCloneDB_v2');

db.version(4).stores({
    notes: 'id, title, syncStatus, lastModified, deleted, createdAt, updatedAt, userId', // Added userId index
    images: 'id, noteId, createdAt', // New images table
}).upgrade(() => {
    // Optional: Existing notes might need migration if we were strict, but Dexie handles adding tables fine.
});
