import { App, Modal, TFile, Notice, setIcon } from 'obsidian';
import { CHAT_FOLDER } from '../utils/constants';
import { ConfirmationModal } from './ConfirmationModal';

export class ChatHistoryModal extends Modal {
    onSelect: (file: TFile) => void;

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Chat history' });

        const folder = this.app.vault.getAbstractFileByPath(CHAT_FOLDER);
        if (!folder || !(folder instanceof Object && 'children' in folder)) {
            contentEl.createEl('p', { text: 'No saved chats found.' });
            return;
        }

        const files = this.app.vault.getMarkdownFiles()
            .filter(f => f.path.startsWith(CHAT_FOLDER + '/'))
            .sort((a, b) => b.stat.mtime - a.stat.mtime);

        if (files.length === 0) {
            contentEl.createEl('p', { text: 'No saved chats found.' });
            return;
        }

        const listEl = contentEl.createEl('div', { cls: 'chat-history-list' });

        for (const file of files) {
            const itemEl = listEl.createEl('div', { cls: 'chat-history-item' });

            const infoEl = itemEl.createEl('div', { cls: 'chat-history-info' });
            infoEl.createEl('div', { cls: 'chat-history-name', text: file.basename });
            infoEl.createEl('div', {
                cls: 'chat-history-date',
                text: new Date(file.stat.mtime).toLocaleString()
            });

            itemEl.onclick = () => {
                this.onSelect(file);
                this.close();
            };

            const deleteBtn = itemEl.createEl('div', { cls: 'chat-history-delete', attr: { 'aria-label': 'Delete chat' } });
            setIcon(deleteBtn, 'trash');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                new ConfirmationModal(
                    this.app,
                    'Delete chat',
                    `Are you sure you want to delete "${file.basename}"?`,
                    () => {
                        void (async () => {
                            await this.app.fileManager.trashFile(file);
                            new Notice('Chat deleted');
                            this.onOpen(); // Refresh
                        })();
                    },
                    'Delete'
                ).open();
            };
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
