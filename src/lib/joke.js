
export const fetchJoke = async () => {
    try {
        const response = await fetch('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single');
        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || 'Failed to fetch joke');
        }

        // Return the joke part
        return data.joke;
    } catch (error) {
        console.error("Error fetching joke:", error);
        return "Why do programmers prefer dark mode? Because light attracts bugs.";
    }
};
