import Dexie from 'dexie';

export const db = new Dexie('VyliteCloneDB_v2');

db.version(3).stores({
    notes: 'id, title, syncStatus, lastModified, deleted, createdAt, updatedAt, userId', // Added userId index
});
