# Testing Guide for YouTube Transcript Downloader

## Step 1: Create the Icons

1. Open [create-icons.html](create-icons.html) in your browser (double-click the file)
2. Click each button to download the three icon files:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
3. Save all three files in the same folder as the extension files

## Step 2: Load the Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (switch in the top-right corner)
4. Click **"Load unpacked"** button
5. Navigate to and select the folder: `/Users/amine/Documents/workspace/perso/vid-transcriptions`
6. The extension should now appear in your extensions list

## Step 3: Pin the Extension (Optional but Recommended)

1. Click the **puzzle piece icon** in Chrome's toolbar (extensions menu)
2. Find "YouTube Transcript Downloader" in the list
3. Click the **pin icon** next to it
4. The extension icon will now appear in your toolbar

## Step 4: Test the Extension

### Test Video Suggestions (with captions):
- **TED Talks**: https://www.youtube.com/watch?v=8S0FDjFBj8o
- **Any popular tutorial video** (most have auto-generated captions)

### Testing Steps:

1. **Navigate to a YouTube video** that has captions
   - Look for the "CC" button in the video player to confirm captions are available

2. **Click the extension icon** in your toolbar

3. **Test with timestamps**:
   - Make sure "Include timestamps (horodatage)" is checked
   - Click "Download Transcript"
   - Check the downloaded `.txt` file - it should show `[0:00] Text here`

4. **Test without timestamps**:
   - Uncheck "Include timestamps (horodatage)"
   - Click "Download Transcript"
   - Check the downloaded `.txt` file - it should show just the text

## Expected Behavior

### Success:
- Status changes to "Extracting transcript..."
- Then "Transcript downloaded successfully!"
- A `.txt` file downloads with the video title in the filename
- File contains the transcript with or without timestamps based on your selection

### Common Issues:

1. **"Please navigate to a YouTube video page"**
   - You're not on a `youtube.com/watch?v=...` page
   - Solution: Navigate to an actual video

2. **"Transcript button not found"**
   - The video doesn't have captions enabled
   - Solution: Try a different video with captions

3. **Extension icon doesn't appear**
   - Icons might be missing
   - Solution: Generate them using `create-icons.html`

## Debugging

If something doesn't work:

1. **Open Chrome DevTools** while on a YouTube video:
   - Right-click → "Inspect"
   - Go to the "Console" tab
   - Look for error messages

2. **Check the extension popup console**:
   - Click the extension icon
   - Right-click on the popup
   - Select "Inspect"
   - Look for errors in the console

3. **Check extension errors**:
   - Go to `chrome://extensions/`
   - Look for errors under the extension name
   - Click "Errors" if there are any

## Testing Checklist

- [ ] Icons created and saved in the extension folder
- [ ] Extension loaded in Chrome without errors
- [ ] Extension icon appears in toolbar
- [ ] Can open extension popup on YouTube video page
- [ ] Download works with timestamps enabled
- [ ] Download works with timestamps disabled
- [ ] Filename includes video title
- [ ] Preference is saved (checkbox stays checked/unchecked after closing popup)
- [ ] Error message shows when not on YouTube video page

## Next Steps

Once testing is successful, you can:
- Use the extension on any YouTube video
- Share it with others (they'll need to install it the same way)
- Customize the icons with better graphics
- Request features or report bugs
