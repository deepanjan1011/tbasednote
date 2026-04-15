const WORD_PATTERN = /[a-z0-9]+/gi;

export const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const tokenizeQuery = (value = '') => value.toLowerCase().match(WORD_PATTERN) || [];

export const hasWholeWord = (text, token) => {
    if (!token) return false;
    return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(text);
};

export const rankLexicalMatches = (notes, query) => {
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
