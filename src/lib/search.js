import { db } from '../db';
import { getEmbedding } from './gemini';

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
    if (!content || content.length < 10) return; // Skip very short notes

    const embedding = await getEmbedding(content);
    if (embedding) {
        await db.notes.update(noteId, { embedding });
        console.log(`Updated embedding for note ${noteId}`);
    }
};

// Search notes using semantic similarity
export const searchNotes = async (query) => {
    if (!query) return [];

    console.log("Generating query embedding...");
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
        console.error("Failed to generate query embedding");
        return [];
    }

    console.log("Fetching notes...");
    const notes = await db.notes.toArray();

    // Filter out deleted notes or notes without embeddings
    const validNotes = notes.filter(n => !n.deleted && n.embedding);

    console.log(`Ranking ${validNotes.length} notes...`);
    const results = validNotes.map(note => ({
        ...note,
        similarity: cosineSimilarity(queryEmbedding, note.embedding)
    }));

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top 20 matches with score > 0.4 (threshold)
    return results.filter(r => r.similarity > 0.4).slice(0, 20);
};
