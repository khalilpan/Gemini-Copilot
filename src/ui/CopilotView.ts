import { ItemView, WorkspaceLeaf, MarkdownView, Notice, TFile, setIcon, MarkdownRenderer } from 'obsidian';
import { GeminiService } from '../services/GeminiService';
import ObsidianGeminiCopilot from '../main';
import { AVAILABLE_MODELS, getModelName } from '../utils/constants';
import { ContextFileModal } from './ContextFileModal';

export const VIEW_TYPE_COPILOT = "gemini-copilot-view";

export class CopilotView extends ItemView {
    plugin: ObsidianGeminiCopilot;
    messageContainer: HTMLDivElement;
    inputEl: HTMLTextAreaElement;
    suggestEl: HTMLDivElement;
    suggestions: TFile[] = [];
    selectedIndex: number = 0;
    triggerCharPos: number = -1;
    history: { role: string, parts: { text: string }[] }[] = [];
    sessionModel: string;
    modelSelect: HTMLSelectElement;
    contextFiles: TFile[] = [];
    chipsContainer: HTMLDivElement;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGeminiCopilot) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_COPILOT;
    }

    getDisplayText(): string {
        return "Gemini Copilot";
    }

    getIcon(): string {
        return "bot";
    }

    async onOpen() {
        this.sessionModel = this.plugin.settings.defaultModel;

        const container = this.contentEl;
        container.empty();
        container.addClass('gemini-copilot-container');

        // Header
        const header = container.createEl('div', { cls: 'copilot-header' });
        header.createEl('h4', { text: 'Gemini Copilot' });

        const headerActions = header.createEl('div', { cls: 'header-actions' });
        const newChatBtn = headerActions.createEl('button', {
            cls: 'new-chat-button',
            attr: { 'aria-label': 'New Conversation' }
        });
        setIcon(newChatBtn, 'plus');
        newChatBtn.onclick = () => this.handleNewChat();

        // Message Container
        this.messageContainer = container.createEl('div', { cls: 'copilot-messages' });
        await this.addMessage('System', 'Hello! I am your Gemini Copilot. How can I help you today? Type @ to mention a note.');

        // Suggestion List (Hidden initially)
        this.suggestEl = container.createEl('div', { cls: 'copilot-suggest' });
        this.suggestEl.hide();

        // Input Area
        const inputContainer = container.createEl('div', { cls: 'copilot-input-container' });
        
        const inputHeader = inputContainer.createEl('div', { cls: 'copilot-input-header' });
        
        // Add context button
        const addContextBtn = inputHeader.createEl('button', {
            cls: 'add-context-button',
            attr: { 'aria-label': 'Add context file' }
        });
        setIcon(addContextBtn, 'plus');
        addContextBtn.onclick = () => {
            new ContextFileModal(this.app, (file) => {
                if (!this.contextFiles.find(f => f.path === file.path)) {
                    this.contextFiles.push(file);
                    this.renderContextChips();
                } else {
                    new Notice('File already added as context');
                }
            }).open();
        };

        const modelSelectWrapper = inputHeader.createEl('div', { cls: 'model-selector-wrapper' });
        this.modelSelect = modelSelectWrapper.createEl('select', { cls: 'model-selector' });
        
        const iconEl = modelSelectWrapper.createEl('div', { cls: 'model-selector-icon' });
        setIcon(iconEl, 'chevron-down');
        
        AVAILABLE_MODELS.forEach(model => {
            const option = this.modelSelect.createEl('option', {
                text: model.name,
                value: model.id
            });
            if (model.id === this.sessionModel) {
                option.selected = true;
            }
        });

        this.modelSelect.onchange = () => {
            this.sessionModel = this.modelSelect.value;
        };

        const inputWrapper = inputContainer.createEl('div', { cls: 'copilot-input-wrapper' });

        this.chipsContainer = inputWrapper.createEl('div', { cls: 'context-chips-container' });
        if (this.plugin.settings.autoAddActiveNote) {
            this.addContextFile(this.app.workspace.getActiveFile());
        }
        this.renderContextChips();

        this.registerEvent(this.app.workspace.on('file-open', (file) => {
            if (this.plugin.settings.autoAddActiveNote) {
                this.addContextFile(file);
            }
        }));

        this.inputEl = inputWrapper.createEl('textarea', {
            cls: 'copilot-input',
            placeholder: 'Ask me anything... use @ to mention notes'
        });

        const sendButton = inputContainer.createEl('button', {
            text: 'Send',
            cls: 'copilot-send-button'
        });

        sendButton.onclick = () => this.handleSendMessage();

        this.inputEl.onkeydown = (e) => this.handleKeyDown(e);
        this.inputEl.oninput = () => this.handleInput();
    }

    async handleNewChat() {
        this.history = [];
        this.sessionModel = this.plugin.settings.defaultModel;
        this.modelSelect.value = this.sessionModel;
        this.contextFiles = [];
        if (this.plugin.settings.autoAddActiveNote) {
            this.addContextFile(this.app.workspace.getActiveFile());
        }
        this.renderContextChips();
        this.messageContainer.empty();
        await this.addMessage('System', 'Hello! I am your Gemini Copilot. How can I help you today? Type @ to mention a note.');
        new Notice('New conversation started');
    }

    handleInput() {
        const cursor = this.inputEl.selectionStart;
        const text = this.inputEl.value.substring(0, cursor);
        const lastAt = text.lastIndexOf('@');

        if (lastAt !== -1 && (lastAt === 0 || text[lastAt - 1] === ' ' || text[lastAt - 1] === '\n')) {
            const query = text.substring(lastAt + 1);
            this.triggerCharPos = lastAt;
            this.showSuggestions(query);
        } else {
            this.hideSuggestions();
        }

        this.adjustInputHeight();
    }

    private adjustInputHeight() {
        this.inputEl.style.height = 'auto';
        this.inputEl.style.height = this.inputEl.scrollHeight + 'px';
        
        // Show scrollbar only when max height is reached
        if (this.inputEl.scrollHeight > this.inputEl.offsetHeight) {
            this.inputEl.style.overflowY = 'auto';
        } else {
            this.inputEl.style.overflowY = 'hidden';
        }
    }

    handleKeyDown(e: KeyboardEvent) {
        if (this.suggestEl.style.display !== 'none') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
                this.renderSuggestions();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const suggestion = this.suggestions[this.selectedIndex];
                if (suggestion) {
                    this.selectSuggestion(suggestion);
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions();
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
        }
    }

    showSuggestions(query: string) {
        const activeFile = this.app.workspace.getActiveFile();
        const files = this.app.vault.getMarkdownFiles();

        // Prioritize current note
        this.suggestions = files
            .filter(f => f.basename.toLowerCase().contains(query.toLowerCase()))
            .sort((a, b) => {
                // Active file first
                if (a === activeFile) return -1;
                if (b === activeFile) return 1;
                // Then by name
                return a.basename.localeCompare(b.basename);
            })
            .slice(0, 10);

        if (this.suggestions.length > 0) {
            this.selectedIndex = 0;
            this.renderSuggestions();
            this.suggestEl.show();
        } else {
            this.hideSuggestions();
        }
    }

    hideSuggestions() {
        this.suggestEl.hide();
        this.triggerCharPos = -1;
    }

    renderSuggestions() {
        this.suggestEl.empty();
        this.suggestions.forEach((file, index) => {
            const isSelected = index === this.selectedIndex;
            const item = this.suggestEl.createEl('div', {
                cls: `suggest-item${isSelected ? ' is-selected' : ''}`
            });

            const nameEl = item.createSpan({ text: file.basename });

            if (file === this.app.workspace.getActiveFile()) {
                item.createSpan({ cls: 'suggest-hint', text: 'Current' });
            }

            if (isSelected) {
                // Ensure the selected item is visible in the scrollable list
                item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }

            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectSuggestion(file);
            };
        });
    }

    selectSuggestion(file: TFile) {
        const before = this.inputEl.value.substring(0, this.triggerCharPos);
        const after = this.inputEl.value.substring(this.inputEl.selectionStart);
        this.inputEl.value = before + '@' + file.basename + ' ' + after;
        this.inputEl.focus();
        this.inputEl.selectionStart = this.inputEl.selectionEnd = before.length + file.basename.length + 2;
        this.addContextFile(file);
        this.hideSuggestions();
        this.adjustInputHeight();
    }

    private addContextFile(file: TFile | null) {
        if (file && file instanceof TFile && file.extension === 'md') {
            if (!this.contextFiles.find(f => f.path === file.path)) {
                this.contextFiles.push(file);
                this.renderContextChips();
            }
        }
    }

    renderContextChips() {
        this.chipsContainer.empty();
        if (this.contextFiles.length === 0) {
            this.chipsContainer.hide();
            return;
        }
        this.chipsContainer.show();

        this.contextFiles.forEach(file => {
            const chip = this.chipsContainer.createEl('div', { cls: 'context-chip' });
            chip.createEl('span', { text: file.basename, cls: 'context-chip-name' });
            
            const removeBtn = chip.createEl('div', { cls: 'context-chip-remove' });
            setIcon(removeBtn, 'x');
            removeBtn.onclick = () => {
                this.contextFiles = this.contextFiles.filter(f => f.path !== file.path);
                this.renderContextChips();
            };
        });
    }

    async handleSendMessage() {
        const query = this.inputEl.value.trim();
        if (!query) return;

        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';
        this.inputEl.style.overflowY = 'hidden';
        await this.addMessage('User', query);
        const loadingMsg = await this.addMessage('Assistant', 'Thinking...');

        try {
            const gemini = new GeminiService(this.plugin.settings.apiKey, this.sessionModel);

            let combinedContext = "";

            // 1. Check for @mentions in the query
            const mentionRegex = /@([^\s\n]+)/g;
            let match;
            const seenFiles = new Set<string>();

            // Add files from context chips first
            for (const file of this.contextFiles) {
                if (!seenFiles.has(file.path)) {
                    const content = await this.app.vault.read(file);
                    combinedContext += `--- Content of note: ${file.basename} ---\n${content}\n\n`;
                    seenFiles.add(file.path);
                }
            }

            while ((match = mentionRegex.exec(query)) !== null) {
                const fileName = match[1];
                const file = this.app.vault.getMarkdownFiles().find(f => f.basename === fileName);
                if (file && !seenFiles.has(file.path)) {
                    const content = await this.app.vault.read(file);
                    combinedContext += `--- Content of note: ${file.basename} ---\n${content}\n\n`;
                    seenFiles.add(file.path);
                }
            }

            const response = await gemini.generateResponse(query, combinedContext, this.history);
            loadingMsg.remove();
            await this.addMessage('Assistant', response, false, this.sessionModel);

            // Update history
            this.history.push({
                role: "user",
                parts: [{ text: query }]
            });
            this.history.push({
                role: "model",
                parts: [{ text: response }]
            });
        } catch (error) {
            loadingMsg.remove();
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.addMessage('System', `Error: ${errorMessage}`, true);
            new Notice(`Gemini Error: ${errorMessage}`);
        }
    }

    async addMessage(role: string, content: string, isError: boolean = false, modelId?: string): Promise<HTMLDivElement> {
        const msgEl = this.messageContainer.createEl('div', {
            cls: `copilot-message ${role.toLowerCase()}${isError ? ' error' : ''}`
        });

        const headerEl = msgEl.createEl('div', { cls: 'message-header' });
        headerEl.createEl('div', { cls: 'message-role', text: role });

        const contentEl = msgEl.createEl('div', { cls: 'message-content' });
        await MarkdownRenderer.renderMarkdown(content, contentEl, "", this);

        if (role === 'Assistant') {
            const footerEl = msgEl.createEl('div', { cls: 'message-footer' });
            
            if (modelId) {
                footerEl.createEl('div', { 
                    cls: 'message-model-name', 
                    text: getModelName(modelId) 
                });
            }

            const copyBtn = footerEl.createEl('button', {
                cls: 'copy-message-button',
                attr: { 'aria-label': 'Copy response' }
            });
            setIcon(copyBtn, 'copy');
            copyBtn.onclick = async () => {
                await navigator.clipboard.writeText(content);
                new Notice('Copied to clipboard');
                setIcon(copyBtn, 'check');
                setTimeout(() => setIcon(copyBtn, 'copy'), 2000);
            };
        }

        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        return msgEl;
    }
}
