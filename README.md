# Context Consolidator

Quickly grab files and code snippets from your project and turn them into a clean XML prompt you can paste into ChatGPT or any LLM.

* One menu in the **status bar**.
* Always up to date (reads files fresh, not from stale copies).
* Generates XML with your files/snippets, plus optional prompt wrappers.

---

## Quick start

1. **Add files or folders**

   * Right-click in Explorer → **Add/Remove from Consolidation List** (works with multiple at once).

2. **Add a snippet**

   * Select code in the editor → right-click → **Add Selection to Consolidate List**.
   * Snippets update automatically if you edit the file later.

3. **Open the menu**

   * Click the status bar item on the left (`Context 📦 …`).

4. **Tune options (optional)**

   * Toggle **Advanced sections** ON/OFF.
   * Adjust **Reasoning Effort** and **Verbosity**.
   * Edit or save a **Prompt Preset**.

5. **Export**

   * Choose **Consolidate (TaskSpec) → Clipboard**.
   * Paste into your LLM and fill in `<UserPrompt>`.

---

## How it works

* **Status bar menu** shows your current list.

  * Each entry has a traffic light weight (🔴🟡🟢), token count, and % of total.
  * Click to remove items.

* **Files** are read fresh at export (so you always get the latest).

* **Snippets** follow their range in the document, so exports always match current content.

* **Binary/junk files** are skipped automatically.

---

## Output

### Minimal (no advanced sections)

```xml
<TaskSpec reasoning_effort="medium" verbosity="low">
  <UserPrompt>
  </UserPrompt>

  <ConsolidatedFilesContext>
    <FolderTree>
      src/app.ts
      src/utils.ts
    </FolderTree>
    <Code file="src/app.ts">
      // full file content...
    </Code>
    <Code file="src/utils.ts" snippet="lines 5-10">
      // current snippet content...
    </Code>
  </ConsolidatedFilesContext>
</TaskSpec>
```

### With advanced sections

```xml
<TaskSpec reasoning_effort="high" verbosity="low">
  <UserPrompt>
  </UserPrompt>

  <GeneralGuidelines>
    <!-- preset content -->
  </GeneralGuidelines>
  <CodingDirectives>
    <!-- preset content -->
  </CodingDirectives>
  <Assumptions></Assumptions>
  <StopConditions>- Stop when all subtasks are done.</StopConditions>

  <ConsolidatedFilesContext>
    <FolderTree>…</FolderTree>
    <Code file="…">…</Code>
  </ConsolidatedFilesContext>
</TaskSpec>
```

---

## Commands & tools

* **Status bar menu** (`Context 📦 …`):

  * Consolidate → Clipboard
  * Toggle advanced sections
  * Change Reasoning Effort / Verbosity
  * Edit or Save Prompt Preset
  * Clear list

* **Explorer**: Add/Remove files or folders

* **Editor selection**: Add selection as snippet

* **Hotkey** (configurable): `Ctrl+Alt+C` / `Cmd+Alt+C`

---

## Tips

* Keep `<UserPrompt>` short and specific — your context is already included.
* If you don’t need the wrapper, turn **Advanced sections OFF** or just copy `<ConsolidatedFilesContext>`.

---

## Requirements

* VS Code `^1.96.0`
* Works on Windows / macOS / Linux

Happy coding 🚀
