export const fetchCompletion = async (context, prompt) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Supabase/Gemini API key is missing in .env');
    }

    try {
        const fullPrompt = `${context}\n\n[USER REQUEST]: ${prompt || 'Continue the text above creatively and concisely.'}`;

        // Using gemini-2.5-flash as confirmed working
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};

export const rewriteText = async (text, instruction) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing API Key');

    try {
        const prompt = `Original Text: "${text}"\n\nInstruction: ${instruction}\n\nRewrite the text following the instruction. Return ONLY the rewritten text, no explanations.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates?.[0]?.content?.parts?.[0]?.text || text;
    } catch (error) {
        console.error("Gemini Rewrite Error:", error);
        throw error;
    }
};

export const getEmbedding = async (text) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: {
                    parts: [{ text: text }]
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Embedding Error:", data.error);
            return null;
        }

        return data.embedding.values;
    } catch (error) {
        console.error("Gemini Embedding Error:", error);
        return null;
    }
};

export const askAI = async (notesContext, question) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing API Key');

    try {
        const prompt = `Context (User Notes):\n${notesContext}\n\nQuestion: ${question}\n\nAnswer the question based strictly on the context provided. If the answer is not in the notes, say "I couldn't find that in your notes."`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5 }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer found.";
    } catch (error) {
        console.error("Gemini RAG Error:", error);
        throw error;
    }
};
