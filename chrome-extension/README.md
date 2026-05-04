# RepoViz Chrome Extension

This extension is only an input bridge for the existing RepoViz server.

## Use it

1. Start RepoViz from the project root:

   ```powershell
   npm start
   ```

2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this `chrome-extension` folder.
5. Open a GitHub repository page and click **Analyze**.
6. Click **Upload Folder** to select a local project folder.

The extension sends URLs to `POST /api/visualize` and selected folder files to `POST /api/upload-folder`. The server still performs all analysis and visualization work.
