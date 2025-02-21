# Context Consolidator  

Instantly capture and organize project files and code snippets—no more manual copying. Context Consolidator gathers, formats, and copies an ordered snapshot of your project's files with a single click, saving you time and streamlining your workflow.

## Main Benefit  

**One-Click Context Collection:**  
Quickly copy selected files and code snippets into a structured XML format. Avoid tedious manual selection—get a complete, well-organized snapshot of your project in seconds!

## Demo  

![Context Consolidator Demo](https://i.imgur.com/CUsdJzn.gif)

## Features  

- 🤖 **AI-Optimized Formatting:**  
  Automatically wraps file paths, code, and snippets in XML for seamless LLM parsing and analysis.  
- 🚀 **Fast Context Gathering:**  
  Instantly add files, folders, or specific code snippets to your selection.  
- ✨ **Live Snippet Tracking:**  
  Snippets automatically adjust as you modify your code, keeping them updated without manual intervention.  
- 🖱️ **Persistent File & Snippet List:**  
  Manage your selection easily—add or remove files and snippets dynamically.  
- ⌨️ **Hotkey Support:**  
  Trigger consolidation instantly using `Ctrl+Alt+C` (or `Cmd+Alt+C` on Mac).  
- 📊 **Real-Time Overview:**  
  Track the number of selected files and snippets in the status bar.  
- 🔍 **Complete Project Snapshot:**  
  Generate an XML-formatted summary of both files and snippets, preserving their structure and contents.

## How It Works  

### 📂 File & Folder Consolidation  

1. **Select Files/Folders:**  
   - **Right-click a Folder:** Choose **"Add to consolidated list"** to include all its files.  
   - **Select Individual Files:** Right-click a file and add it to your list.  

2. **Manage Your List:**  
   - See **"Files to consolidate (n)"** in the status bar.  
   - Click the status bar to open the consolidation menu and remove unwanted files.  

3. **Consolidate with One Click:**  
   - Click **"Consolidate All"** in the menu to copy the full XML-formatted snapshot to your clipboard.  

### ✂️ Snippet Consolidation  

1. **Highlight a Code Snippet:**  
   - Select any block of code and right-click **"Add Selection to Consolidate List."**  
   - The snippet is now tracked separately, along with its file name and line numbers.  

2. **Automatic Snippet Tracking:**  
   - If you edit your document, the snippet range adjusts dynamically.  
   - Insert lines above, inside, or around it—your selection stays accurate.  

3. **Consolidate Updated Snippets:**  
   - When you consolidate, snippets reflect their latest state in the document.  
   - They appear alongside full files in the XML snapshot, preserving their position.  

### XML Structure Example  

```xml
<ConsolidatedFilesContext>
  <FolderTree>
    path/to/file1.ts
  </FolderTree>
  <Code file="path/to/file1.ts">
    // Full file content...
  </Code>
  <Code file="path/to/file1.ts" snippet="lines 10-15">
    // Snippet content...
  </Code>
</ConsolidatedFilesContext>
```

## Supported Workflows  

- **Efficient Code Review & Debugging:**  
  Track key snippets and file context without copy-pasting manually.  
- **Clear AI-Powered Explanations:**  
  Provide structured input for AI models, keeping code context intact.  
- **Seamless Collaboration:**  
  Share precise, updated code excerpts in discussions, documentation, or pull requests.  

## Requirements  

- VS Code 1.96.0 or newer  

Happy coding! 🚀  