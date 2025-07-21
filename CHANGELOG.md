# Change Log

All notable changes to the "context-consolidator" extension will be documented in this file.

## [1.2.1] - 2025-07-21

### Fixed
- Fixed critical bug where file content was cached when added to consolidation list instead of reading current content during consolidation
- Files now always reflect their current state when consolidating, not their state when first added
- Improved reliability of content consolidation for modified files

## [1.2.0] - 2025-06-12

### Added
- Dynamic "Traffic-Light" weight indicators (🔴🟡🟢) based on file size and context share
- Live token count and percentage labels for each file/snippet
- Single "Add/Remove from Consolidation List" context menu button
- Auto-adjusting thresholds for weight indicators
- Save XML to file functionality
- Multi-select file support in Explorer

### Improved
- Better status bar updates and icon alignment
- Enhanced UX with cleaner menu organization
- Per-workspace persistence of file lists

## [1.1.0] - Previous Release

### Added
- Multi-select file support
- Smart binary and junk file skipping
- Save to file option
- Per-folder persistence
- Accurate token counter
- Cleaner menu UX

## [1.0.0] - Initial Release

### Added
- Basic file and snippet consolidation
- XML output format
- Clipboard integration
- Snippet range tracking