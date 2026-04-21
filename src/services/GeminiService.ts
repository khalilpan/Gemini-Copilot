import { requestUrl } from 'obsidian';

interface GeminiResponse {
    candidates?: {
        content: {
            parts: { text: string }[];
        };
    }[];
    error?: {
        message: string;
    };
}

export class GeminiService {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateResponse(prompt: string, context?: string, history: { role: string, parts: { text: string }[] }[] = []): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key is missing. Please set it in the plugin settings.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const fullPrompt = context
            ? `I am providing you with the content of some notes from my Obsidian vault as context for our conversation. Please use this information to answer my question.

CONTEXT NOTES:
${context}

USER QUESTION:
${prompt}`
            : prompt;

        // Construct contents with history + new prompt
        const contents = [
            ...history,
            {
                role: "user",
                parts: [{ text: fullPrompt }]
            }
        ];

        try {
            const requestOptions = {
                url: url,
                method: 'POST' as const,
                contentType: 'application/json',
                body: JSON.stringify({ contents })
            };

            console.debug('--- Gemini API Request ---');
            console.debug('URL:', requestOptions.url);
            console.debug('Method:', requestOptions.method);
            console.debug('Headers:', { 'Content-Type': requestOptions.contentType });
            console.debug('Body:', JSON.parse(requestOptions.body));

            const response = await requestUrl(requestOptions);

            console.debug('--- Gemini API Response ---');
            console.debug('Status:', response.status);
            console.debug('Headers:', response.headers);
            console.debug('Response JSON:', response.json);

            const data = response.json as GeminiResponse;

            if (response.status !== 200) {
                throw new Error(data.error?.message || `API Error: ${response.status}`);
            }

            if (data.candidates && data.candidates.length > 0) {
                const firstCandidate = data.candidates[0];
                if (firstCandidate) {
                    return firstCandidate.content.parts[0]?.text || '';
                }
            }
            throw new Error('No response generated from the model.');
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }
}
