import Dexie from 'dexie';

export const db = new Dexie('VyliteCloneDB');

db.version(1).stores({
    notes: '++id, title, content, createdAt, updatedAt', // Primary key and indexed props
});
