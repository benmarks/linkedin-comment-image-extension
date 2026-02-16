# LinkedIn Comment Image Paste – Chrome Extension
LinkedIn doesn't natively support pasting images into comments. This Chrome extension fixes that. Just paste an image from your clipboard into any LinkedIn comment box, and it handles the rest.

## How It Works
The extension intercepts paste events in LinkedIn's comment editor (built on Quill) and converts clipboard image data into a format LinkedIn can accept. It works with screenshots, copied images, and anything else on your clipboard.

## Installation
Since this extension isn't on the Chrome Web Store, you'll need to install it manually:

1. Download or clone this repository to your machine
1. Open Chrome and go to chrome://extensions/
1. Enable Developer mode (toggle in the top-right corner)
1. Click Load unpacked
1. Select the folder containing this extension
1. Navigate to LinkedIn — the extension is now active

## Usage

1. Copy any image to your clipboard (screenshot, right-click → copy image, etc.)
1. Click into a LinkedIn comment box
1. Paste (Cmd+V on Mac / Ctrl+V on Windows)
1. The image will be inserted into your comment

## Warranty

Use at your own risk. Please feel free to contribute!

## License
MIT
