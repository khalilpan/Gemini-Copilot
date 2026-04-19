export interface ModelInfo {
    id: string;
    name: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
    { id: 'gemma-3-1b', name: 'Gemma 3 1B' },
    { id: 'gemma-3-2b', name: 'Gemma 3 2B' },
    { id: 'gemma-3-3b', name: 'Gemma 3 3B' },
    { id: 'gemma-3-12b', name: 'Gemma 3 12B' },
    { id: 'gemma-4-26b', name: 'Gemma 4 26B' },
    { id: 'gemma-4-31b-it', name: 'Gemma 4 31B' },
    { id: 'gemma-3-27b-it', name: 'Gemma 3 27B IT' }
];

export function getModelName(id: string): string {
    const model = AVAILABLE_MODELS.find(m => m.id === id);
    return model ? model.name : id;
}
