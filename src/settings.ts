import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianGeminiCopilot from "./main";
import { AVAILABLE_MODELS } from "./utils/constants";

export interface MyPluginSettings {
	apiKey: string;
	defaultModel: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: '',
	defaultModel: 'gemma-3-27b-it'
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianGeminiCopilot;

	constructor(app: App, plugin: ObsidianGeminiCopilot) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for Gemini Copilot' });

		new Setting(containerEl)
			.setName('Google AI API Key')
			.setDesc('Enter your API key from https://aistudio.google.com/')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Model')
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

	}
}
