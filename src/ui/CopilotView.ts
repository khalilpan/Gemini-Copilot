import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon, MarkdownRenderer, MarkdownView } from 'obsidian';
import { GeminiService } from '../services/GeminiService';
import ObsidianGeminiCopilot from '../main';
import { getModelName } from '../utils/constants';
import { ContextFileModal } from './ContextFileModal';
import { setCssProps } from '../utils/helpers';

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
    private isAutoNoteExcluded: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianGeminiCopilot) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_COPILOT;
    }

    getDisplayText(): string {
        return "Gemini copilot";
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
        header.createEl('h4', { text: 'Gemini copilot' });

        const headerActions = header.createEl('div', { cls: 'header-actions' });
        const newChatBtn = headerActions.createEl('button', {
            cls: 'new-chat-button',
            attr: { 'aria-label': 'New conversation' }
        });
        setIcon(newChatBtn, 'plus');
        newChatBtn.onclick = () => this.handleNewChat();

        // Message Container
        this.messageContainer = container.createEl('div', { cls: 'copilot-messages' });
        await this.addMessage('System', 'Hello! I am your Gemini copilot. How can I help you today? Type @ to mention a note.');

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
        
        this.plugin.models.forEach(model => {
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
        this.renderContextChips();

        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.isAutoNoteExcluded = false;
            if (this.plugin.settings.autoAddActiveNote) {
                this.renderContextChips();
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
        this.isAutoNoteExcluded = false;
        this.renderContextChips();
        this.messageContainer.empty();
        await this.addMessage('System', 'Hello! I am your Gemini copilot. How can I help you today? Type @ to mention a note.');
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
        setCssProps(this.inputEl, { 'height': 'auto' });
        setCssProps(this.inputEl, { 'height': `${this.inputEl.scrollHeight}px` });
        
        // Show scrollbar only when max height is reached
        if (this.inputEl.scrollHeight > this.inputEl.offsetHeight) {
            setCssProps(this.inputEl, { 'overflow-y': 'auto' });
        } else {
            setCssProps(this.inputEl, { 'overflow-y': 'hidden' });
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
            void this.handleSendMessage();
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

            item.createSpan({ text: file.basename });

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
        
        const activeFile = this.app.workspace.getActiveFile();
        const showActive = this.plugin.settings.autoAddActiveNote && activeFile && activeFile.extension === 'md' && !this.isAutoNoteExcluded;

        if (this.contextFiles.length === 0 && !showActive) {
            this.chipsContainer.hide();
            return;
        }
        this.chipsContainer.show();

        if (showActive && activeFile) {
            const chip = this.chipsContainer.createEl('div', { cls: 'context-chip active-note' });
            chip.createEl('span', { text: `Active: ${activeFile.basename}`, cls: 'context-chip-name' });
            
            const removeBtn = chip.createEl('div', { cls: 'context-chip-remove' });
            setIcon(removeBtn, 'x');
            removeBtn.onclick = () => {
                this.isAutoNoteExcluded = true;
                this.renderContextChips();
            };
        }

        this.contextFiles.forEach(file => {
            // Don't duplicate if it's already shown as active
            if (showActive && activeFile && file.path === activeFile.path) return;

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
        setCssProps(this.inputEl, {
            'height': 'auto',
            'overflow-y': 'hidden'
        });
        await this.addMessage('User', query);
        const loadingMsg = await this.addMessage('Assistant', 'Thinking...');

        try {
            const gemini = new GeminiService(this.plugin.settings.apiKey, this.sessionModel);

            let combinedContext = "";

            // Gather all markdown files once for lookup
            const allFiles = this.app.vault.getMarkdownFiles();
            const seenFiles = new Set<string>();
            
            // 0. Add selected text from active editor
            const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();
            const activeView = mostRecentLeaf?.view instanceof MarkdownView ? mostRecentLeaf.view : null;
            if (activeView) {
                const selection = activeView.editor.getSelection();
                if (selection && selection.trim().length > 0) {
                    combinedContext += `SELECTED TEXT FROM "${activeView.file?.basename}":\n${selection}\n---\n\n`;
                }
            }

            // 0. Add active file if auto-add is enabled and not excluded
            if (this.plugin.settings.autoAddActiveNote && !this.isAutoNoteExcluded) {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === 'md') {
                    try {
                        const content = await this.app.vault.read(activeFile);
                        combinedContext += `Note: ${activeFile.basename}\nContent:\n${content}\n---\n\n`;
                        seenFiles.add(activeFile.path);
                    } catch (err) {
                        console.error(`Failed to read active file context: ${activeFile.path}`, err);
                    }
                }
            }

            // 1. Add files from context chips (explicitly added)
            for (const file of this.contextFiles) {
                if (!seenFiles.has(file.path)) {
                    try {
                        const content = await this.app.vault.read(file);
                        combinedContext += `Note: ${file.basename}\nContent:\n${content}\n---\n\n`;
                        seenFiles.add(file.path);
                    } catch (err) {
                        console.error(`Failed to read context file: ${file.path}`, err);
                    }
                }
            }

            // 2. Scan for @mentions in the query text to pick up any others
            let i = query.indexOf('@');
            while (i !== -1) {
                const textAfterAt = query.substring(i + 1);
                let bestMatch: TFile | null = null;
                
                for (const file of allFiles) {
                    // Check if query contains this filename right after @
                    if (textAfterAt.startsWith(file.basename)) {
                        if (!bestMatch || file.basename.length > bestMatch.basename.length) {
                            bestMatch = file;
                        }
                    }
                }

                if (bestMatch && !seenFiles.has(bestMatch.path)) {
                    try {
                        const content = await this.app.vault.read(bestMatch);
                        combinedContext += `Note: ${bestMatch.basename}\nContent:\n${content}\n---\n\n`;
                        seenFiles.add(bestMatch.path);
                    } catch (err) {
                        console.error(`Failed to read mentioned file: ${bestMatch.path}`, err);
                    }
                }
                i = query.indexOf('@', i + 1);
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
        await MarkdownRenderer.render(this.app, content, contentEl, "", this);

        if (role === 'Assistant') {
            const footerEl = msgEl.createEl('div', { cls: 'message-footer' });
            
            if (modelId) {
                footerEl.createEl('div', { 
                    cls: 'message-model-name', 
                    text: getModelName(modelId, this.plugin.models) 
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

            const insertBtn = footerEl.createEl('button', {
                cls: 'insert-message-button',
                attr: { 'aria-label': 'Insert at cursor' }
            });
            setIcon(insertBtn, 'text-cursor-input');
            insertBtn.onclick = () => {
                const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();
                const activeView = mostRecentLeaf?.view instanceof MarkdownView ? mostRecentLeaf.view : null;
                if (activeView) {
                    activeView.editor.replaceSelection(content);
                    new Notice('Inserted at cursor');
                } else {
                    new Notice('No active note to insert into');
                }
            };
        }

        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        return msgEl;
    }
}
