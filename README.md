# Context Consolidator

Instantly capture and organize project files and code snippets—no more manual copying.  
Context Consolidator gathers, formats, and copies an ordered snapshot of your project’s files with a single click, saving you time and streamlining your workflow.
## ✅ What's New in v1.3.0

| Feature | Why it matters |
|---|---|
| 📂 **History & Presets** | Automatically save consolidation history and create reusable presets. |
| 🎨 **New Manager UI** | A new Quick Pick UI to manage history and presets. |
| 💾 **Live Preset Sync** | Presets are automatically updated as you add/remove files and snippets. |

## ✅ What's New in v1.2.1

| Feature | Why it matters |
|---------|----------------|
| 🐛 **Fixed Stale File Content Bug** | Files now always show current content when consolidating, not the content from when they were first added to the list. |
| 🔄 **Real-time Content Updates** | Changes made to files are now properly reflected in consolidations without needing to re-add files. |

## ✅ What’s New in v1.2.0

| Feature | Why it matters |
|---------|----------------|
| 🚦 **Dynamic “Traffic-Light” Weights** | Each file/snippet in the menu now shows 🔴🟡🟢 based on *absolute* size (tokens/lines) **and** its share of the total. Big files stand out even in huge lists. |
| 🏷️ **Live Token & % Labels** | Every row shows exact tokens + percentage of context so you can trim fat fast. |
| 🖱️ **One Smart Explorer Button** | The old *Add* / *Remove* buttons are merged into a single **“Add/Remove from Consolidation List”** entry—always visible, never out of sync. |
| 📈 **Auto-Adjusting Thresholds** | ≥ 7 500 tokens / 800 lines **or** ≥ 40 % of total ⇒ 🔴. Medium = ≥ 2 500 tokens / 400 lines **or** ≥ 15 %. Everything else is green. |
| 🐞 **Misc Fixes & Polish** | Better icon alignment, faster status-bar updates, minor bug fixes. |

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

- 🤖 **AI-Optimized XML Formatting**
- 🚀 **Fast File / Folder / Snippet Gathering**
- 🚦 **Color-Coded Weight Indicators** *(new!)*
- 📊 **Exact Token & Percentage Stats** *(new!)*
- 🚀 **Multi-Select Explorer Support**
- ✂️ **Live Snippet Range Tracking**
- 🧠 **Per-Workspace Persistence**
- 📛 **Smart Binary & Junk Filtering**
- 🖱️ **Single Add/Remove Context Menu** *(new!)*
- 💾 **Copy to Clipboard or Save XML**
- ⌨️ **Customizable Hotkey** (`Ctrl+Alt+C` / `Cmd+Alt+C`)
- 📟 **Live Status Bar Counter**

---

## 🧪 How It Works

### 📂 File & Folder Consolidation
1. **Select** files/folders (supports Ctrl/Shift multi-select).  
2. **Right-click** → **Add/Remove from Consolidation List**.  
3. **Review** the list via the *status-bar* Quick Pick:  
   - 🔴🟡🟢 weight emoji  
   - exact tokens & percentage  
   - click any row’s 🗑️ icon to remove.  
4. **Export** → *Clipboard* or *Save XML to file…*

### ✂️ Snippet Consolidation
Highlight code → right-click **Add Selection to Consolidate List**.  
Snippets track edits automatically.

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

