import { App, Modal, ButtonComponent } from 'obsidian';
import { setCssProps } from '../utils/helpers';

export class ConfirmationModal extends Modal {
    private message: string;
    private onConfirm: () => void;
    private title: string;
    private confirmLabel: string;

    constructor(app: App, title: string, message: string, onConfirm: () => void, confirmLabel: string = 'Confirm') {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
        this.confirmLabel = confirmLabel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        const buttonContainer = contentEl.createEl('div', { cls: 'confirmation-buttons' });
        setCssProps(buttonContainer, {
            'display': 'flex',
            'justify-content': 'flex-end',
            'gap': '10px',
            'margin-top': '20px'
        });

        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        new ButtonComponent(buttonContainer)
            .setButtonText(this.confirmLabel)
            .setWarning()
            .onClick(() => {
                this.onConfirm();
                this.close();
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}
