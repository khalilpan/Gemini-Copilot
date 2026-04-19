import { requestUrl } from 'obsidian';

export class GeminiService {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateResponse(prompt: string, context?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API Key is missing. Please set it in the plugin settings.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const fullPrompt = context 
            ? `Context from current note:\n${context}\n\nUser Question:\n${prompt}`
            : prompt;

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: fullPrompt }]
                    }]
                })
            });

            if (response.status !== 200) {
                const errorData = response.json;
                throw new Error(errorData.error?.message || `API Error: ${response.status}`);
            }

            const data = response.json;
            if (data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error('No response generated from the model.');
            }
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }
}
