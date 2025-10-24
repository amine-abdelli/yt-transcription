# GitHub Repository Setup

## Repository Information

### Name
`youtube-transcript-downloader`

### Description (short - for GitHub repo header)
```
Chrome extension to download YouTube video transcripts as text files with optional timestamps
```

### About Section / Topics (tags)
```
chrome-extension
youtube
transcript
download
captions
subtitles
accessibility
productivity
javascript
```

---

## Full README.md Content

Replace your current README.md with this enhanced version for GitHub:

```markdown
# YouTube Transcript Downloader

A Chrome extension that allows you to download YouTube video transcriptions as text files with optional timestamps (horodatage).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## ✨ Features

- 📥 **Download transcripts** from any YouTube video with captions
- ⏱️ **Toggle timestamps** (horodatage) on/off
- 🎯 **Automatic filename generation** based on video title
- 💾 **Saves your preference** for timestamps
- 🎨 **Clean, simple interface**
- 🚀 **Fast and lightweight**

## 📸 Screenshots

<!-- Add screenshots here when available -->
*Coming soon: Extension popup and downloaded transcript examples*

## 🚀 Installation

### Method 1: Install from Source (Developer Mode)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/youtube-transcript-downloader.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **"Developer mode"** (toggle in top-right corner)

4. Click **"Load unpacked"**

5. Select the extension folder

6. The extension icon will appear in your browser toolbar

### Method 2: Download Release

1. Go to [Releases](https://github.com/YOUR_USERNAME/youtube-transcript-downloader/releases)
2. Download the latest `.zip` file
3. Unzip the file
4. Follow steps 2-6 from Method 1

## 📖 Usage

1. Navigate to any YouTube video that has captions/transcripts available
2. Click the extension icon in your browser toolbar
3. Choose whether to include timestamps (checked by default)
4. Click **"Download Transcript"**
5. Choose where to save the `.txt` file

## 📝 Output Format

### With Timestamps (Default)
```
[0:00] Welcome to this video
[0:05] Today we're going to talk about machine learning
[0:12] First, let's cover the basics
```

### Without Timestamps
```
Welcome to this video
Today we're going to talk about machine learning
First, let's cover the basics
```

## 🔧 Requirements

- Google Chrome (or Chromium-based browser like Edge, Brave, etc.)
- YouTube videos must have captions/transcripts available

## 🛠️ Development

### Project Structure
```
youtube-transcript-downloader/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and download handler
├── popup.css             # Popup styling
├── content.js            # Content script for transcript extraction
└── README.md             # Documentation
```

### Building from Source

No build process required! This is a pure JavaScript extension.

To modify:
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## 🔐 Permissions

This extension requires the following permissions:

- **`activeTab`**: To access the current YouTube video page
- **`scripting`**: To inject the transcript extraction script
- **`downloads`**: To save the transcript as a text file
- **`storage`**: To remember your timestamp preference
- **`host_permissions`** (youtube.com): To run on YouTube pages only

**Privacy:** This extension does not collect, store, or transmit any user data.

## ❓ Troubleshooting

### "Transcript button not found" error
- Make sure the video has captions (look for the CC button in the video player)
- Try a different video with confirmed captions

### "Please refresh the YouTube page and try again" error
- Refresh the YouTube page (F5 or Cmd+R)
- Try clicking the extension icon again

### Extension icon doesn't appear
- Make sure Developer Mode is enabled
- Check if the extension is enabled in `chrome://extensions/`
- Try reloading the extension

### No transcript downloads
- Check your browser's download settings
- Make sure downloads are not blocked for the extension

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] Add support for multiple export formats (SRT, VTT)
- [ ] Add option to copy transcript to clipboard
- [ ] Support for video playlists
- [ ] Dark mode theme
- [ ] Publish to Chrome Web Store

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 👤 Author

**Your Name**
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)

## ⭐ Show your support

Give a ⭐️ if this project helped you!

## 📞 Support

If you encounter any issues or have questions:
- Open an [issue](https://github.com/YOUR_USERNAME/youtube-transcript-downloader/issues)
- Check existing issues for solutions

---

Made with ❤️ for the YouTube community
```

---

## Repository Settings

### Social Preview Image (Optional)
Create a 1280x640px image with:
- Extension logo/icon
- Title: "YouTube Transcript Downloader"
- Tagline: "Download video transcripts with one click"
- Screenshot of the extension in action

### GitHub Topics (Add these tags)
```
chrome-extension
youtube
transcript
download
captions
subtitles
accessibility
productivity
javascript
browser-extension
youtube-downloader
text-extraction
```

### Website (Optional)
Leave blank or add Chrome Web Store URL once published

---

## Initial Commit Message

```
Initial release: YouTube Transcript Downloader v1.0.0

Features:
- Download YouTube video transcripts as text files
- Optional timestamp (horodatage) toggle
- Automatic filename generation from video title
- Preference storage for timestamp option
- Clean, user-friendly interface

Technical:
- Chrome Manifest V3
- Pure JavaScript (no dependencies)
- Content script for transcript extraction
- Popup interface for user interaction
```

---

## Release Notes Template (for v1.0.0)

```markdown
## YouTube Transcript Downloader v1.0.0

Initial release of the YouTube Transcript Downloader Chrome extension.

### Features
✨ Download YouTube video transcripts as `.txt` files
⏱️ Toggle timestamps (horodatage) on/off
🎯 Automatic filename generation based on video title
💾 Remembers your timestamp preference
🎨 Clean, intuitive interface

### Installation
See the [README](https://github.com/YOUR_USERNAME/youtube-transcript-downloader#installation) for installation instructions.

### Requirements
- Chrome (or Chromium-based browser)
- YouTube videos with captions/transcripts

### Known Issues
- Extension requires page refresh after installation
- Only works on YouTube video pages (by design)

### What's Next
See our [roadmap](https://github.com/YOUR_USERNAME/youtube-transcript-downloader#roadmap) for upcoming features.
```

---

Use this content when setting up your GitHub repository!
