import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { CopilotView, VIEW_TYPE_COPILOT } from "./ui/CopilotView";

export default class ObsidianGeminiCopilot extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(
			VIEW_TYPE_COPILOT,
			(leaf) => new CopilotView(leaf, this)
		);

		// Add ribbon icon to toggle the view
		this.addRibbonIcon('bot', 'Gemini Copilot', (evt: MouseEvent) => {
			this.activateView();
		});

		// Add command to open the view
		this.addCommand({
			id: 'open-gemini-copilot',
			name: 'Open Gemini Copilot',
			callback: () => {
				this.activateView();
			}
		});

		// Add settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		// Clean up the view when the plugin is disabled
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_COPILOT);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null | undefined = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_COPILOT);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_COPILOT, active: true });
			}
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		
		// Migration: if the old 'model' setting exists, move it to 'defaultModel' and delete 'model'
		if (loadedData && (loadedData as any).model) {
			this.settings.defaultModel = (loadedData as any).model;
			delete (this.settings as any).model;
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
