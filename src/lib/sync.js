import { db } from '../db';
import { supabase } from './supabase';

/**
 * Synchronizes notes between local Dexie DB and Supabase.
 * - Pushes local changes (created/updated/deleted) to Supabase.
 * - Pulls remote changes from Supabase to local.
 * - Strategy: Last Write Wins (based on updatedAt).
 */
export async function syncNotes() {
    const result = { pushed: 0, pulled: 0, error: null, pendingFound: 0, userMismatch: 0 };
    if (!supabase) return result;

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return result;

    try {
        // --- 1. PUSH: Send local changes to Supabase ---
        const pendingNotes = await db.notes.where('syncStatus').equals('pending').toArray();

        if (pendingNotes.length > 0) {
            console.log(`Syncing ${pendingNotes.length} notes to cloud...`);
            result.pendingFound = pendingNotes.length;

            // Debug: Check IDs
            pendingNotes.forEach(n => {
                if (n.userId !== user.id) {
                    console.warn(`Mismatch: Note ${n.id} user=${n.userId}, session=${user.id}`);
                    result.userMismatch++;
                }
            });

            // Transform for Supabase (Snake Case)

            // Transform for Supabase (Snake Case)
            // CRITICAL: Only sync notes that explicitly belong to this user. 
            // Do NOT auto-assign 'user.id' to orphans here.
            const upsertData = pendingNotes
                .filter(n => n.userId === user.id) // Only push notes claimed by this user
                .map(n => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    updated_at: n.updatedAt,
                    // created_at is usually managed by default, but we can pass it if we want to preserve local creation time
                    created_at: n.createdAt,
                    user_id: n.userId, // Must be present
                    deleted: n.deleted || false
                }));

            if (upsertData.length === 0) {
                // No notes to push for this user
            } else {
                const { error: pushError } = await supabase
                    .from('notes')
                    .upsert(upsertData);

                if (pushError) {
                    console.error('Push failed:', pushError);
                    result.error = `Push failed: ${pushError.message}`;
                    // Don't update syncStatus if failed, so we retry next time
                } else {
                    // On success, mark these IDs as synced locally
                    await db.transaction('rw', db.notes, async () => {
                        for (const note of upsertData) {
                            await db.notes.update(note.id, { syncStatus: 'synced' });
                        }
                    });
                    console.log(`Pushed ${upsertData.length} notes.`);
                    result.pushed = upsertData.length;
                }
            }
        }

        // --- 2. PULL: Fetch remote changes ---
        const lastSyncedAt = localStorage.getItem('vylite_last_synced');
        let query = supabase.from('notes').select('*');

        if (lastSyncedAt) {
            query = query.gt('updated_at', lastSyncedAt);
        }

        const { data: remoteNotes, error: pullError } = await query;

        if (pullError) {
            console.error('Pull failed:', pullError);
            result.error = `Pull failed: ${pullError.message}`;
            return result;
        }

        if (remoteNotes && remoteNotes.length > 0) {
            console.log(`Received ${remoteNotes.length} updates from cloud.`);

            await db.transaction('rw', db.notes, async () => {
                for (const remote of remoteNotes) {
                    const local = await db.notes.get(remote.id);

                    // Conflict Resolution: Remote Wins if it's newer
                    // Or if local doesn't exist.
                    const remoteTime = new Date(remote.updated_at).getTime();
                    const localTime = local ? new Date(local.updatedAt).getTime() : 0;

                    if (!local || remoteTime > localTime) {
                        if (remote.deleted) {
                            if (local) await db.notes.delete(local.id);
                        } else {
                            await db.notes.put({
                                id: remote.id,
                                title: remote.title,
                                content: remote.content,
                                createdAt: new Date(remote.created_at), // trust remote creation time
                                updatedAt: new Date(remote.updated_at),
                                syncStatus: 'synced', // It came from server, so it's synced
                                lastModified: remote.updated_at, // align
                                userId: remote.user_id, // Persist ownership
                                deleted: false
                            });
                        }
                    }
                }
            });

            // Save new high-water mark
            const latestUpdate = remoteNotes.reduce((max, n) => {
                return n.updated_at > max ? n.updated_at : max;
            }, lastSyncedAt || '1970-01-01');

            localStorage.setItem('vylite_last_synced', latestUpdate);
            result.pulled = remoteNotes.length;
        }

        return result;

    } catch (err) {
        console.error('Sync process error:', err);
        return { pushed: 0, pulled: 0, error: err.message };
    }
}
