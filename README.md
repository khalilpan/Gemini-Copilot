# Obsidian Gemini Copilot

A powerful Google Gemini-powered AI assistant for Obsidian that helps you write, brainstorm, and navigate your notes with full vault awareness.

## Setup: API Key

To use this plugin, you need a Google Gemini API key.

1. **Obtain an API Key**: Go to [Google AI Studio](https://aistudio.google.com/app/api-keys).
2. **Free Tier**: For most use cases, the free tier is more than enough.
3. **Configure Plugin**: 
   - Open Obsidian **Settings**.
   - Navigate to **Community plugins** -> **Obsidian Gemini Copilot**.
   - Paste your API key into the **Google AI API Key** field.

## Features

- **Context-Aware Chat**: Automatically includes your currently active note as context for every conversation.
- **Vault-wide @Mentions**: Link any file in your vault as context by simply typing `@` in the chat input.
- **Interactive Sidebar**: A dedicated side view for quick access to your AI assistant.
- **Model Selection**: Switch between various Gemini models (Gemma 3, Gemma 4, etc.) on the fly.
- **Markdown Rendering**: AI responses are rendered using Obsidian's native Markdown engine, including support for code blocks, formatting, and mathematical equations.
- **Copy to Clipboard**: Quickly copy any AI response with one click.
- **New Conversation**: Easily reset your chat session to start fresh.

## Usage

1. Click the **Gemini** icon in the left ribbon (or use the command palette) to open the Copilot sidebar.
2. Type your message in the text area at the bottom.
3. Use `@` followed by a file name to include specific notes in your query.
4. Hit **Enter** (or click the send icon) to chat.
5. Use the dropdown in the input area to switch models mid-conversation.
6. Click the **+** (New Conversation) button in the header to clear the history.

## Settings

- **Google AI API Key**: Your authentication key for the Gemini API.
- **Default Model**: The model that will be selected by default when you open a new chat.
- **Auto-Add Active Note**: Toggle whether the currently open note should be automatically added as context.

## Development

If you'd like to contribute or build the plugin from source:

1. Clone the repository into your vault's `.obsidian/plugins/` folder.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the development build with watch mode.
4. Run `npm run build` for a production-ready build.

## License

This project is licensed under the MIT License.
