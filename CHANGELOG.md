# Changelog

All notable changes to Siftory are documented in this file. The project follows a lightweight, [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) inspired format.

## [0.1.0] - 2026-08-20

### Added

- Evidence-first Quick search flow with structured answers, claims, evidence, sources, and a visible search lifecycle.
- Deterministic, explainable confidence assessment based on claim relevance, authority / primary context, freshness, cross-verification, and conflicts.
- Replay mode for a deterministic offline demonstration; opt-in Live mode with Tavily / Brave Search and DeepSeek / OpenAI adapters.
- Bounded supplemental retrieval, durable run checkpoints, and recovery-aware runtime state.
- Search Notes with favorites, fixed categories, personal notes, local Library filters, and reopen support.
- English and Simplified Chinese product UI, preserving source text and evidence excerpts in their original language.
- Windows x64 Tauri desktop build with a native, Windows Credential Manager-backed Live credentials boundary.
- Public-project documentation, security guidance, source-run instructions, and release-asset checksum workflow.

### Not included

- Compare mode, Research mode, export, cloud sync, authentication, collaboration, mobile apps, and automatic monitoring are intentionally out of scope for this preview.

### Security

- API keys are not bundled into desktop artifacts or exposed to the browser workspace.
- Provider connection tests are explicit user actions and may consume provider quota or incur charges.

[0.1.0]: https://github.com/shadecyj/siftory/releases/tag/v0.1.0
