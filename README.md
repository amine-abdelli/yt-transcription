# YouTube Transcript Downloader

A Chrome extension to download YouTube video transcriptions as text files with optional timestamps (horodatage).

## Features

- Download YouTube video transcripts as `.txt` files
- Toggle timestamps on/off
- Clean, simple interface
- Automatic filename generation based on video title
- Saves your timestamp preference

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select this folder (`vid-transcriptions`)
5. The extension should now appear in your browser toolbar

## Usage

1. Navigate to any YouTube video that has captions/transcripts available
2. Click the extension icon in your browser toolbar
3. Choose whether to include timestamps (checked by default)
4. Click "Download Transcript"
5. Choose where to save the `.txt` file

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

## Requirements

- Google Chrome (or Chromium-based browser)
- YouTube videos must have captions/transcripts available

## Notes

- The extension only works on YouTube video pages (`youtube.com/watch`)
- Make sure the video has captions enabled
- The extension will automatically open the transcript panel if needed

## Permissions

- `activeTab`: To access the current YouTube page
- `scripting`: To inject the transcript extraction script
- `downloads`: To save the transcript file
- `storage`: To remember your timestamp preference

## Troubleshooting

If the extension doesn't work:
1. Make sure you're on a YouTube video page
2. Verify the video has captions (look for the CC button in the video player)
3. Refresh the page and try again
4. Check the browser console for errors

## Adding Icons

Currently, the extension references icon files (`icon16.png`, `icon48.png`, `icon128.png`). You can:
1. Create your own icons at these sizes
2. Or temporarily remove the icon references from `manifest.json` until you add them

## License

Free to use and modify as needed.
