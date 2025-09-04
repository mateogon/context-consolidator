# Context Consolidator

Capture project files + code snippets and spit out a clean XML prompt in one click.

- One menu in the **status bar**.
- Fresh content (no stale copies).
- XML built for LLMs: includes your files/snippets **and** an optional prompt wrapper.

---

## What’s new in v1.3.0

| Feature                           | Why it matters                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **TaskSpec composer**             | One-click XML that wraps your context with `<TaskSpec …>` for better prompting.                |
| **Advanced sections toggle**      | Include/omit `<GeneralGuidelines>`, `<CodingDirectives>`, `<Assumptions>`, `<StopConditions>`. |
| **Modes & knobs (per workspace)** | `mode`, `reasoning_effort`, `verbosity` are saved per workspace.                               |
| **Preset editor**                 | Edit the Advanced sections in an editor and save them for the workspace.                       |
| **Fresh snippets**                | Snippets read the **current** text from the doc on consolidation.                              |
| **Unified UI**                    | All from the status bar: add/remove, tune options, consolidate to clipboard.                   |

> v1.2.x goodies still here: traffic-light weights 🔴🟡🟢, live token + %, multi-select, binary/junk filtering, per-workspace persistence.

---

## Quick start

1. **Add files/folders**
   - Explorer: right-click → **Add/Remove from Consolidation List** (supports multi-select).
2. **Add a snippet**
   - Select code in the editor → right-click → **Add Selection to Consolidate List**.
   - Snippets track edits; on export we read the **latest** text.
3. **Open the menu**
   - Click the **status bar item** (left side) that shows `Context 📦 …` to open the Quick Pick.
4. **(Optional) tune options**
   - Toggle **Advanced sections** ON/OFF.
   - Cycle **Mode**, **Reasoning Effort**, **Verbosity**.
   - **Edit Prompt Preset** to customize the Advanced sections; **Save Preset From Active Editor** to persist.
5. **Export**
   - Hit **Consolidate (TaskSpec) → Clipboard**.
   - Paste into your LLM chat/window and fill `<UserPrompt>` (left intentionally empty).

---

## How it works

- The status bar menu shows your current list with:
  - 🔴🟡🟢 weight (size vs total), token count, and % of context.
  - Click a row to remove it.
- Files are read fresh when exporting. Binaries/junk are skipped automatically.
- Snippets: the range tracks edits; **export** reads current text from the doc to avoid stale content.

---

## Output formats

### Minimal (Advanced sections OFF)

```xml
<TaskSpec mode="balanced" reasoning_effort="medium" verbosity="low">
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

### With Advanced sections (Preset)

```xml
<TaskSpec mode="persistent" reasoning_effort="high" verbosity="low">
  <UserPrompt>
  </UserPrompt>

  <GeneralGuidelines>
    <!-- your preset content -->
  </GeneralGuidelines>
  <CodingDirectives>
    <!-- your preset content -->
  </CodingDirectives>
  <Assumptions></Assumptions>
  <StopConditions>- All sub-tasks completed or explicitly listed as pending.</StopConditions>

  <ConsolidatedFilesContext>
    <FolderTree>…</FolderTree>
    <Code file="…">…</Code>
  </ConsolidatedFilesContext>
</TaskSpec>
```

---

## Commands & UI

- **Status bar menu**: click `Context 📦 …`

  - Consolidate (TaskSpec) → Clipboard
  - Toggle: Include advanced sections (ON/OFF)
  - Mode / Reasoning Effort / Verbosity (cycle)
  - Edit Prompt Preset (opens an editor)
  - Save Preset From Active Editor
  - Clear List

- **Explorer (file/folder)**: Add/Remove from Consolidation List
- **Editor selection**: Add Selection to Consolidate List

> Hotkey (configurable): `Ctrl+Alt+C` / `Cmd+Alt+C` to open the menu.

---

## Tips

- Keep `<UserPrompt>` short and concrete. The context is already in `<ConsolidatedFilesContext>`.
- If your chat doesn’t need the wrapper, toggle **Advanced sections OFF** or paste only `<ConsolidatedFilesContext>…</ConsolidatedFilesContext>`.

---

## Requirements

- VS Code `^1.96.0`
- Windows / macOS / Linux

Happy coding 🚀
