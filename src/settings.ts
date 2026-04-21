import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianGeminiCopilot from "./main";
import { AVAILABLE_MODELS } from "./utils/constants";

export interface GeminiCopilotSettings {
	apiKey: string;
	defaultModel: string;
	autoAddActiveNote: boolean;
}

export const DEFAULT_SETTINGS: GeminiCopilotSettings = {
	apiKey: '',
	defaultModel: 'gemma-3-27b-it',
	autoAddActiveNote: true
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
			.setName('Google AI API key')
			.setDesc('Enter your API key from https://aistudio.google.com/')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default model')
			.setDesc('Select the default model to use for new conversations')
			.addDropdown(dropdown => {
				AVAILABLE_MODELS.forEach(model => {
					dropdown.addOption(model.id, model.name);
				});
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
}
