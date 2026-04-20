export interface ModelInfo {
    id: string;
    name: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
    { id: 'gemma-3-1b-it', name: 'Gemma 3 1B' },
    { id: 'gemma-3-4b-it', name: 'Gemma 3 4B' },
    { id: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
    { id: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
    { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B' },
    { id: 'gemma-4-31b-it', name: 'Gemma 4 31B' }
];

export function getModelName(id: string): string {
    const model = AVAILABLE_MODELS.find(m => m.id === id);
    return model ? model.name : id;
}
