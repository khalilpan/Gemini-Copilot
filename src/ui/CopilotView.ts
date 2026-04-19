import { ItemView, WorkspaceLeaf, MarkdownView, Notice, TFile, setIcon, MarkdownRenderer } from 'obsidian';
import { GeminiService } from '../services/GeminiService';
import ObsidianGeminiCopilot from '../main';
import { AVAILABLE_MODELS, getModelName } from '../utils/constants';

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
        this.modelSelect = inputHeader.createEl('select', { cls: 'model-selector' });
        
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

        this.inputEl = inputContainer.createEl('textarea', {
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
        this.hideSuggestions();
    }

    async handleSendMessage() {
        const query = this.inputEl.value.trim();
        if (!query) return;

        this.inputEl.value = '';
        await this.addMessage('User', query);
        const loadingMsg = await this.addMessage('Assistant', 'Thinking...');

        try {
            const gemini = new GeminiService(this.plugin.settings.apiKey, this.sessionModel);

            let combinedContext = "";

            // 1. Check for @mentions in the query
            const mentionRegex = /@([^\s\n]+)/g;
            let match;
            const seenFiles = new Set<string>();

            while ((match = mentionRegex.exec(query)) !== null) {
                const fileName = match[1];
                const file = this.app.vault.getMarkdownFiles().find(f => f.basename === fileName);
                if (file && !seenFiles.has(file.path)) {
                    const content = await this.app.vault.read(file);
                    combinedContext += `--- Content of note: ${file.basename} ---\n${content}\n\n`;
                    seenFiles.add(file.path);
                }
            }

            // 2. Add current page context if enabled
            if (this.plugin.settings.useContext) {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    const activeFile = activeView.file;
                    if (activeFile && !seenFiles.has(activeFile.path)) {
                        const content = activeView.editor.getValue();
                        combinedContext += `--- Content of Current Note: ${activeFile.basename} ---\n${content}\n\n`;
                    }
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
