# Context Consolidator

Instantly capture and organize project files and code snippets—no more manual copying.  
Context Consolidator gathers, formats, and copies an ordered snapshot of your project’s files with a single click, saving you time and streamlining your workflow.

## ✅ What’s New in v1.1.0

- 🗂️ **Multi-select file support:** Ctrl/Shift-click multiple files in the Explorer and add them all at once.
- 🧠 **Smart skipping of binaries and junk:** Skips `.png`, `.mp3`, `__pycache__`, `node_modules`, etc.  
- 💾 **Save XML to file:** New “Save to File…” option alongside “Copy to Clipboard.”
- ♻️ **Per-folder persistence:** Your file list is remembered between sessions for each workspace.
- 🧮 **Accurate live token counter:** Tracks tokens and lines as you add/remove files or snippets.
- 🧼 **Cleaner menu UX:** Action buttons now grouped and better labeled.

## 🧠 Main Benefit

**One-Click Context Collection**  
Quickly copy or save selected files and code snippets into a structured XML format.  
Avoid tedious manual selection—get a complete, well-organized snapshot of your project in seconds!

## 🎥 Demo

![Context Consolidator Demo](https://i.imgur.com/CUsdJzn.gif)

## ⚡ Features

- 🤖 **AI-Optimized Formatting**  
  Wraps file paths, code, and snippets in XML for seamless LLM parsing and analysis.

- 🚀 **Fast Context Gathering**  
  Instantly add files, folders, or code snippets—individually or in bulk.

- ✨ **Live Snippet Tracking**  
  Snippets adjust automatically when you edit your code.

- 🧠 **Persistent Per-Workspace State**  
  File selection is saved per folder—you’ll pick up right where you left off.

- 📛 **Smart File Filtering**  
  Skips known binary formats and cache folders, reducing useless token bloat.

- 🖱️ **Dynamic Context Menu**  
  Right-click to manage files and folders directly from the Explorer.

- 💾 **Copy or Save**  
  Export the consolidated context to clipboard or a `.xml` file.

- ⌨️ **Customizable Hotkey**  
  Use `Ctrl+Alt+C` (`Cmd+Alt+C` on Mac) to open the consolidation menu instantly.

- 📊 **Live Status Overview**  
  Shows total files, lines, and estimated tokens in the status bar.

## 🧪 How It Works

### 📂 File & Folder Consolidation

1. **Select Files/Folders**  
   - ✅ Ctrl/Shift-click multiple files  
   - 📁 Right-click a folder → **"Add to Consolidate List"**

2. **Smart Filtering**  
   - 🚫 Skips binary-like files (e.g. `.png`, `.mp3`)  
   - ❌ Ignores junk folders like `__pycache__`, `.git`, `node_modules`, `dist`

3. **Manage Your List**  
   - View total items in the **status bar**  
   - Click it to open the **Consolidation Menu**  
   - Remove individual files/snippets with a click

4. **Export Context**  
   - 📝 Click “Consolidate → Clipboard” to copy XML  
   - 💾 Click “Save XML to file…” to export to disk

### ✂️ Snippet Consolidation

1. **Select Code**  
   - Highlight a code block  
   - Right-click → **"Add Selection to Consolidate List"**

2. **Automatic Range Tracking**  
   - Snippet updates live as you edit the document

3. **Export Accurate Snippets**  
   - Always reflects current content and line numbers

### 📄 Output Format (XML)

```xml
<ConsolidatedFilesContext>
  <FolderTree>
    src/app.ts
    src/utils.ts
  </FolderTree>
  <Code file="src/app.ts">
    // full file content...
  </Code>
  <Code file="src/utils.ts" snippet="lines 5-10">
    // snippet content...
  </Code>
</ConsolidatedFilesContext>
````

## 🧰 Ideal Use Cases

* 🔍 **Efficient Code Review & Debugging**
  Share exact lines of concern + file context instantly

* 🧠 **AI Prompt Engineering**
  Feed clean, structured input into LLMs for max understanding

* 🧑‍💻 **Team Collaboration**
  Copy precise context for PRs, issues, or architecture discussions

## 📦 Requirements

* VS Code `^1.96.0`
* Works on Windows, Mac, Linux

---

Happy coding! 🚀

