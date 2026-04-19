import { requestUrl } from 'obsidian';

export class GeminiService {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateResponse(prompt: string, context?: string, history: { role: string, parts: { text: string }[] }[] = []): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API Key is missing. Please set it in the plugin settings.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const fullPrompt = context
            ? `Context from current note:\n${context}\n\nUser Question:\n${prompt}`
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

            console.log('--- Gemini API Request ---');
            console.log('URL:', requestOptions.url);
            console.log('Method:', requestOptions.method);
            console.log('Headers:', { 'Content-Type': requestOptions.contentType });
            console.log('Body:', JSON.parse(requestOptions.body));

            const response = await requestUrl(requestOptions);

            console.log('--- Gemini API Response ---');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Response JSON:', response.json);

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
