import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import { GeminiService } from '../services/GeminiService';
import ObsidianGeminiCopilot from '../main';

export const VIEW_TYPE_COPILOT = "gemini-copilot-view";

export class CopilotView extends ItemView {
    plugin: ObsidianGeminiCopilot;
    useContext: boolean = true;
    messageContainer: HTMLDivElement;
    inputEl: HTMLTextAreaElement;

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
        const container = this.contentEl;
        container.empty();
        container.addClass('gemini-copilot-container');

        // Header
        const header = container.createEl('div', { cls: 'copilot-header' });
        header.createEl('h4', { text: 'Gemini Copilot' });

        // Context Toggle
        const toggleContainer = header.createEl('div', { cls: 'context-toggle-container' });
        const toggleLabel = toggleContainer.createEl('label', { text: 'Use Page Context', cls: 'toggle-label' });
        const toggle = toggleContainer.createEl('input', { type: 'checkbox', cls: 'context-toggle' });
        toggle.checked = this.useContext;
        toggle.onclick = () => {
            this.useContext = toggle.checked;
        };

        // Message Container
        this.messageContainer = container.createEl('div', { cls: 'copilot-messages' });
        this.addMessage('System', 'Hello! I am your Gemini Copilot. How can I help you today?');

        // Input Area
        const inputContainer = container.createEl('div', { cls: 'copilot-input-container' });
        this.inputEl = inputContainer.createEl('textarea', { 
            cls: 'copilot-input', 
            placeholder: 'Ask me anything...' 
        });
        
        const sendButton = inputContainer.createEl('button', { 
            text: 'Send',
            cls: 'copilot-send-button' 
        });

        sendButton.onclick = () => this.handleSendMessage();
        
        this.inputEl.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        };
    }

    async handleSendMessage() {
        const query = this.inputEl.value.trim();
        if (!query) return;

        this.inputEl.value = '';
        this.addMessage('User', query);

        const loadingMsg = this.addMessage('Assistant', 'Thinking...');
        
        try {
            const gemini = new GeminiService(this.plugin.settings.apiKey, this.plugin.settings.model);
            
            let context = "";
            if (this.useContext) {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    context = activeView.editor.getValue();
                }
            }

            const response = await gemini.generateResponse(query, context);
            loadingMsg.remove();
            this.addMessage('Assistant', response);
        } catch (error) {
            loadingMsg.remove();
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.addMessage('System', `Error: ${errorMessage}`, true);
            new Notice(`Gemini Error: ${errorMessage}`);
        }
    }

    addMessage(role: string, content: string, isError: boolean = false): HTMLDivElement {
        const msgEl = this.messageContainer.createEl('div', { 
            cls: `copilot-message ${role.toLowerCase()}${isError ? ' error' : ''}` 
        });
        
        msgEl.createEl('div', { cls: 'message-role', text: role });
        const contentEl = msgEl.createEl('div', { cls: 'message-content' });
        
        // Basic line break handling for now
        contentEl.innerText = content;

        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        return msgEl;
    }
}
