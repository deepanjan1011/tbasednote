import { db } from '../db';
import { supabase } from './supabase';

export async function syncNotes() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // VERY BASIC ONE-WAY SYNC (Local -> Remote)
    // In a real app, this would be much more complex (Conflict resolution, etc.)
    const notes = await db.notes.toArray();

    // Upsert notes to Supabase
    // Assuming table 'notes' exists in Supabase with matching schema
    const { error } = await supabase
        .from('notes')
        .upsert(notes.map(n => ({
            id: n.id, // Need to handle ID matching (Dexie uses auto-increment vs UUID)
            // Implementation detail: Dexie uses ID, Supabase usually standardizes on UUID. 
            // For now, we just log it as a stub.
            title: n.title,
            content: n.content,
            updated_at: n.updatedAt,
            user_id: user.id
        })));

    if (error) {
        console.error('Sync error:', error);
    } else {
        console.log('Synced notes to cloud');
    }
}
