# Distribution Guide - YouTube Transcript Downloader

## Option 1: Chrome Web Store (Recommended for Wide Distribution)

### Requirements:
- Google account
- **$5 USD one-time developer registration fee**
- Extension icons (required)
- Screenshots and promotional images

### Steps:

#### 1. Prepare Your Extension

First, create the required icons:
```bash
open create-icons.html
```
Download all three icons (16px, 48px, 128px) and save them in the extension folder.

Then add them back to `manifest.json` in the `icons` section.

#### 2. Create a ZIP file

```bash
cd /Users/amine/Documents/workspace/perso/vid-transcriptions
zip -r youtube-transcript-downloader.zip . -x "*.git*" "*.DS_Store" "node_modules/*" "TESTING.md" "DISTRIBUTION.md" "create-icons.html"
```

Or manually:
- Select all extension files (manifest.json, popup.html, popup.js, popup.css, content.js, and icon files)
- Right-click → Compress
- Name it `youtube-transcript-downloader.zip`

#### 3. Register as a Chrome Web Store Developer

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the **$5 one-time registration fee**
4. Accept the Developer Agreement

#### 4. Upload Your Extension

1. Click **"New Item"**
2. Upload your ZIP file
3. Fill in the required information:

**Store Listing:**
- **Name**: YouTube Transcript Downloader
- **Summary**: Download YouTube video transcripts as text files with optional timestamps
- **Description**:
  ```
  Download YouTube video transcriptions as text files with a single click!

  Features:
  • Download transcripts from any YouTube video with captions
  • Toggle timestamps (horodatage) on/off
  • Automatic filename generation based on video title
  • Saves your timestamp preference
  • Clean, simple interface

  How to use:
  1. Navigate to any YouTube video with captions
  2. Click the extension icon
  3. Choose whether to include timestamps
  4. Click "Download Transcript"
  5. Save the .txt file

  The extension only works on YouTube video pages and requires videos to have captions/transcripts available.
  ```

- **Category**: Productivity
- **Language**: English (and/or French)

**Privacy:**
- Single purpose description: "Download YouTube video transcripts"
- Permission justifications:
  - `activeTab`: To access the current YouTube video page
  - `scripting`: To extract transcript data from the page
  - `downloads`: To save the transcript as a text file
  - `storage`: To remember user's timestamp preference
- Remote code: No
- Data usage: Does not collect any user data

**Graphics Requirements:**
- **Icon** (128x128): Already have from create-icons.html
- **Small promo tile** (440x280): Optional but recommended
- **Screenshots** (1280x800 or 640x400): At least 1 required
  - Take screenshots of the extension popup and downloaded transcript

#### 5. Submit for Review

1. Click **"Submit for Review"**
2. Review can take **1-3 days** (sometimes longer)
3. You'll receive an email when approved or if changes are needed

#### 6. Once Published

- Share the Chrome Web Store URL with anyone
- Users can install with one click
- Auto-updates when you publish new versions

---

## Option 2: GitHub Distribution (Free & Immediate)

### Steps:

#### 1. Create Icons First

```bash
open create-icons.html
```
Generate all three icon files.

#### 2. Initialize Git Repository

```bash
cd /Users/amine/Documents/workspace/perso/vid-transcriptions
git init
```

#### 3. Create a .gitignore file (if not exists)

Already created, but verify it contains:
```
.DS_Store
```

#### 4. Create a GitHub Repository

1. Go to https://github.com/new
2. Name: `youtube-transcript-downloader`
3. Description: "Chrome extension to download YouTube video transcripts with optional timestamps"
4. Make it **Public**
5. Don't initialize with README (we already have one)
6. Click **"Create repository"**

#### 5. Push Your Code to GitHub

```bash
# Add icons back to manifest.json first
git add .
git commit -m "Initial release: YouTube Transcript Downloader v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/youtube-transcript-downloader.git
git push -u origin main
```

#### 6. Create a Release

1. Go to your repository on GitHub
2. Click **"Releases"** → **"Create a new release"**
3. Tag: `v1.0.0`
4. Title: `YouTube Transcript Downloader v1.0.0`
5. Description:
   ```
   ## Features
   - Download YouTube transcripts as .txt files
   - Toggle timestamps on/off
   - Automatic filename generation

   ## Installation
   See README.md for instructions
   ```
6. Upload the ZIP file (create it first):
   ```bash
   zip -r youtube-transcript-downloader-v1.0.0.zip . -x "*.git*" "*.DS_Store" "TESTING.md" "DISTRIBUTION.md" "create-icons.html"
   ```
7. Click **"Publish release"**

#### 7. Update README.md

Add installation instructions at the top:

```markdown
## Installation

### Download from GitHub:
1. Download the [latest release](https://github.com/YOUR_USERNAME/youtube-transcript-downloader/releases/latest)
2. Unzip the file
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked"
6. Select the unzipped folder
```

#### 8. Share Your Extension

Share the GitHub URL:
- `https://github.com/YOUR_USERNAME/youtube-transcript-downloader`

Users will need to:
1. Download the ZIP from Releases
2. Unzip it
3. Load it as an unpacked extension

---

## Quick Comparison

| Feature | Chrome Web Store | GitHub |
|---------|-----------------|---------|
| Cost | $5 one-time | Free |
| Installation | One-click | Manual (4 steps) |
| Auto-updates | Yes | No |
| Review time | 1-3 days | Immediate |
| User trust | High | Medium |
| Analytics | Built-in | None |
| Best for | Everyone | Tech users |

---

## My Recommendation

**For maximum reach:** Start with GitHub (free, immediate), then publish to Chrome Web Store later if you want easier installation for non-technical users.

**For professional distribution:** Go straight to Chrome Web Store if you're willing to pay $5 and wait for review.

---

## Next Steps

Let me know which option you prefer, and I can help you:
1. Create the necessary graphics for Chrome Web Store
2. Set up the GitHub repository and create the release
3. Both!
