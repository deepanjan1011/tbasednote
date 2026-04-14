import { db } from '../db';
import { getEmbedding, getEmbeddingModel, hasGeminiApiKey } from './gemini';

const MIN_INDEXABLE_LENGTH = 1;
const WORD_PATTERN = /[a-z0-9]+/gi;

const getContentHash = (text = '') => {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
};

const getThreshold = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.4;
    return numeric > 1 ? numeric / 100 : numeric;
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenizeQuery = (value = '') => value.toLowerCase().match(WORD_PATTERN) || [];

const hasWholeWord = (text, token) => {
    if (!token) return false;
    return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(text);
};

const isVisibleToUser = (note, currentUserId) => (
    !note.userId || (currentUserId && note.userId === currentUserId)
);

const isPlaintextNote = (note) => !note.content?.startsWith('U2F');

const isIndexableNote = (note, currentUserId) => (
    !note.deleted &&
    isVisibleToUser(note, currentUserId) &&
    isPlaintextNote(note) &&
    (note.content || '').trim().length >= MIN_INDEXABLE_LENGTH
);

const rankLexicalMatches = (notes, query) => {
    const normalizedQuery = query.trim().toLowerCase();
    const tokens = tokenizeQuery(normalizedQuery);
    if (!normalizedQuery || tokens.length === 0) return [];

    return notes
        .map(note => {
            const title = (note.title || '').toLowerCase();
            const content = (note.content || '').toLowerCase();
            const haystack = `${title}\n${content}`.trim();
            if (!haystack) return null;

            let score = 0;
            let matched = false;

            if (title === normalizedQuery) {
                score += 500;
                matched = true;
            }

            if (tokens.length > 1 && title.includes(normalizedQuery)) {
                score += 260;
                matched = true;
            }

            if (tokens.length > 1 && content.includes(normalizedQuery)) {
                score += 180;
                matched = true;
            }

            let matchedTokens = 0;
            tokens.forEach(token => {
                const inTitle = hasWholeWord(title, token);
                const inContent = hasWholeWord(content, token);

                if (inTitle || inContent) {
                    matchedTokens += 1;
                    score += inTitle ? 120 : 60;
                }
            });

            if (matchedTokens === tokens.length) {
                score += 140;
                matched = true;
            }

            if (!matched) return null;

            return {
                ...note,
                searchMode: 'lexical',
                searchScore: score,
                updatedAtMs: new Date(note.updatedAt).getTime() || 0
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.searchScore - a.searchScore || b.updatedAtMs - a.updatedAtMs);
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Update embedding for a specific note
export const updateNoteEmbedding = async (noteId, content) => {
    if (!content || content.trim().length < MIN_INDEXABLE_LENGTH) return false;

    const embeddingModel = getEmbeddingModel();
    const embedding = await getEmbedding(content);
    if (embedding) {
        await db.notes.update(noteId, {
            embedding,
            embeddingModel,
            embeddingTextHash: getContentHash(content),
            embeddingUpdatedAt: new Date().toISOString()
        });
        console.log(`Updated embedding for note ${noteId}`);
        return true;
    }

    return false;
};

// Search notes using semantic similarity
export const searchNotes = async (query, options = {}) => {
    if (!query) return [];

    console.log("Fetching notes...");
    const notes = await db.notes.toArray();
    const currentUserId = options.currentUserId || null;
    const threshold = getThreshold(options.threshold);
    const embeddingModel = getEmbeddingModel();
    const indexableNotes = notes.filter(note => isIndexableNote(note, currentUserId));
    const lexicalResults = rankLexicalMatches(indexableNotes, query);
    const queryTokens = tokenizeQuery(query);

    if (lexicalResults.length > 0 || queryTokens.length <= 1) {
        return lexicalResults.slice(0, 20);
    }

    if (!hasGeminiApiKey()) {
        return [];
    }

    console.log("Generating query embedding...");
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
        throw new Error('Could not generate search embedding.');
    }

    const preparedNotes = [];
    for (const note of indexableNotes) {
        const contentHash = getContentHash(note.content || '');
        let preparedNote = note;

        if (!Array.isArray(note.embedding) || note.embeddingTextHash !== contentHash || note.embeddingModel !== embeddingModel) {
            await updateNoteEmbedding(note.id, note.content || '');
            preparedNote = await db.notes.get(note.id);
        }

        if (
            Array.isArray(preparedNote?.embedding) &&
            preparedNote.embeddingTextHash === contentHash &&
            preparedNote.embeddingModel === embeddingModel
        ) {
            preparedNotes.push(preparedNote);
        }
    }

    console.log(`Ranking ${preparedNotes.length} notes...`);
    const results = preparedNotes.map(note => ({
        ...note,
        similarity: cosineSimilarity(queryEmbedding, note.embedding)
    }));

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.filter(r => r.similarity > threshold).slice(0, 20);
};
