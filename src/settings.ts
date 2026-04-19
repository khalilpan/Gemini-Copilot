import {App, PluginSettingTab, Setting} from "obsidian";
import ObsidianGeminiCopilot from "./main";

export interface MyPluginSettings {
	apiKey: string;
	model: string;
	useContext: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: '',
	model: 'gemma-3-27b-it',
	useContext: true
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: ObsidianGeminiCopilot;

	constructor(app: App, plugin: ObsidianGeminiCopilot) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Gemini Copilot'});

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
			.setName('Model')
			.setDesc('Select the model to use')
			.addDropdown(dropdown => dropdown
				.addOption('gemma-3-27b-it', 'Gemma 3 27B IT')
				.addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
				.addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use Page Context')
			.setDesc('Automatically include the content of the active note in your queries.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useContext)
				.onChange(async (value) => {
					this.plugin.settings.useContext = value;
					await this.plugin.saveSettings();
				}));
	}
}
