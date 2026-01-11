import Dexie from 'dexie';

export const db = new Dexie('VyliteCloneDB_v2');

db.version(2).stores({
    notes: 'id, title, syncStatus, lastModified, deleted, createdAt, updatedAt', // UUID primary key
});
