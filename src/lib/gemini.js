
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
}

export const fetchJoke = async () => {
    if (!genAI) {
        return "Please add VITE_GEMINI_API_KEY to your .env file to enable AI jokes.";
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Tell me a short, witty one-liner joke for a developer or tech enthusiast. Keep it clean and under 100 characters if possible.");
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error fetching joke:", error);
        return "Why did the AI cross the road? To get to the other side of the firewall. (Fallback joke due to API error)";
    }
};
