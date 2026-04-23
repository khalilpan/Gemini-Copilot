import { App, PluginSettingTab, Setting, DropdownComponent } from "obsidian";
import ObsidianGeminiCopilot from "./main";

export interface GeminiCopilotSettings {
	apiKey: string;
	defaultModel: string;
	autoAddActiveNote: boolean;
	userName: string;
}

export const DEFAULT_SETTINGS: GeminiCopilotSettings = {
	apiKey: '',
	defaultModel: 'gemma-3-27b-it',
	autoAddActiveNote: true,
	userName: 'User'
}

export class GeminiCopilotSettingTab extends PluginSettingTab {
	plugin: ObsidianGeminiCopilot;

	constructor(app: App, plugin: ObsidianGeminiCopilot) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Gemini copilot')
			.setHeading();

		new Setting(containerEl)
			.setName('User name')
			.setDesc('The name that will be displayed for your messages in the chat.')
			.addText(text => text
				.setPlaceholder('User')
				.setValue(this.plugin.settings.userName)
				.onChange(async (value) => {
					this.plugin.settings.userName = value || 'User';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Google AI API key')
			.setDesc('Enter your API key from https://aistudio.google.com/')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
					await this.plugin.refreshModels();
					this.display(); // Refresh the UI to update the model dropdown
				}));

		new Setting(containerEl)
			.setName('Default model')
			.setDesc('Select the default model to use for new conversations')
			.addDropdown(dropdown => {
				this.updateModelDropdown(dropdown);
				dropdown.setValue(this.plugin.settings.defaultModel)
					.onChange(async (value) => {
						this.plugin.settings.defaultModel = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Add the current note as context in new conversations/session')
			.setDesc('Automatically add the currently active note as context when starting a new chat or switching files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoAddActiveNote)
				.onChange(async (value) => {
					this.plugin.settings.autoAddActiveNote = value;
					await this.plugin.saveSettings();
				}));
	}

	private updateModelDropdown(dropdown: DropdownComponent) {
		dropdown.selectEl.empty();
		this.plugin.models.forEach(model => {
			dropdown.addOption(model.id, model.name);
		});
	}
}
