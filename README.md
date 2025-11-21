# YouTube Transcript Downloader & AI Summarizer

A Chrome extension to download YouTube video transcriptions and generate AI-powered summaries in multiple languages.

## Features

### Transcript Download
- Download YouTube video transcripts as `.txt` files
- Toggle timestamps on/off
- Automatic filename generation based on video title
- Saves your timestamp preference

### AI Summary (OpenAI Integration)
- Generate concise, adaptive summaries using GPT-4o-mini
- Summaries adapt to video type (tutorials, comparisons, interviews, conferences, etc.)
- Multi-language support: French, English, German, Spanish
- Summary displayed in a modal with copy functionality

### In-Page Controls
- Download and summarize buttons directly in YouTube's transcript panel
- Timestamp toggle checkbox
- Visual loading indicators during processing

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select this folder (`vid-transcriptions`)
5. The extension should now appear in your browser toolbar

## Setup

### OpenAI API Key (Required for AI Summary)

1. Get your API key from [OpenAI](https://platform.openai.com/api-keys)
2. Click the extension icon in your browser toolbar
3. Enter your API key in the settings section
4. Click "Save API Key"

Your key is stored locally and never shared. You can modify it anytime by clicking the "Modify" button.

### Language Selection

Choose your preferred summary language from the dropdown:
- Français (French) - Default
- English
- Deutsch (German)
- Español (Spanish)

## Usage

### Method 1: Extension Popup
1. Navigate to any YouTube video with captions available
2. Click the extension icon in your browser toolbar
3. Choose whether to include timestamps
4. Click "Download Transcript"

### Method 2: In-Page Buttons (Recommended)
1. Navigate to any YouTube video with captions
2. Open the transcript panel (click "Show transcript" below the video)
3. Use the buttons in the transcript header:
   - **Checkbox**: Toggle timestamps on/off
   - **Download button**: Download transcript as `.txt`
   - **Summarize button**: Generate AI summary

## File Format

### With timestamps:
```
[0:00] Welcome to this video
[0:05] Today we're going to talk about...
[0:12] First, let's cover the basics
```

### Without timestamps:
```
Welcome to this video
Today we're going to talk about...
First, let's cover the basics
```

## Summary Format

Summaries are adaptive based on video content and include:
- A general overview
- Main points covered
- Key comparisons or steps (if relevant)
- Key takeaways

## Requirements

- Google Chrome (or Chromium-based browser)
- YouTube videos must have captions/transcripts available
- OpenAI API key (for AI summary feature)

## Permissions

- `activeTab`: To access the current YouTube page
- `scripting`: To inject the transcript extraction script
- `downloads`: To save the transcript file
- `storage`: To remember preferences and API key

## Troubleshooting

If the extension doesn't work:
1. Make sure you're on a YouTube video page
2. Verify the video has captions (look for the CC button in the video player)
3. Refresh the page and try again
4. Check the browser console for errors

If AI summary fails:
1. Verify your OpenAI API key is correct
2. Check your OpenAI account has available credits
3. Ensure you have internet connectivity

## Privacy

- Your OpenAI API key is stored locally in Chrome storage
- Transcripts are sent directly to OpenAI's API for summarization
- No data is collected or stored by this extension

## License

Free to use and modify as needed.
