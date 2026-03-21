# Claude Code Impact

Desktop workspace for AI coding sessions, provider configuration, plugin management, and project launch flows.

`Claude Code Impact` is a heavily modified derivative of [lovcode](https://github.com/markshawn2020/lovcode). It keeps the original Apache-2.0 licensing obligations while adding a substantially different product direction, interaction model, and release pipeline.

## Status

- License: Apache-2.0
- Platforms: macOS, Windows, Linux
- Packaging: Tauri 2
- Current release: `v0.1.7`

## What It Does

- Chat-first launchpad for opening projects and starting new AI-assisted sessions
- Conversation history workspace with project grouping, session search, and message navigator
- LLM provider/profile management with runtime launch overrides
- Plugin and extension management for hooks, skills, MCP-related tooling, and runtime toggles
- Desktop configuration tooling built with React, TypeScript, Rust, and Tauri

## Project Origin

This repository is not the original `lovcode` project and is not an official upstream continuation.

- Upstream project: [markshawn2020/lovcode](https://github.com/markshawn2020/lovcode)
- Upstream license: Apache-2.0
- Attribution details: [UPSTREAM_ATTRIBUTION.md](./UPSTREAM_ATTRIBUTION.md)
- Redistribution notice: [NOTICE](./NOTICE)

If you fork or redistribute this repository, keep the Apache-2.0 license text and the required attribution notices intact.

## Installation

### From Release

Download the latest build from:

- [GitHub Releases](https://github.com/Sivan757/claude-code-impact/releases)

### From Source

```bash
git clone --recursive https://github.com/Sivan757/claude-code-impact.git
cd claude-code-impact
pnpm install
pnpm tauri dev
```

## Development

### Requirements

- Node.js 20+
- pnpm 10+
- Rust stable
- Tauri system dependencies for your OS

### Local Run

```bash
pnpm install
pnpm tauri dev
```

### Validation

```bash
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Release

### Snapshot Builds

Every push to `main` triggers a prerelease snapshot workflow.

### Versioned Releases

Push a semantic version tag such as `v0.1.7`. The release workflow will:

- build cross-platform artifacts
- extract the matching changelog section from `CHANGELOG.md`
- publish a GitHub Release automatically

## Governance

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Support guide: [SUPPORT.md](./SUPPORT.md)
- Open source preparation checklist: [OPEN_SOURCE_CHECKLIST.md](./OPEN_SOURCE_CHECKLIST.md)

## Legal Notes

- This repository contains original work plus derivative work based on `lovcode`.
- Apache-2.0 allows modification and redistribution, but requires preservation of license and notice obligations.
- Apache-2.0 does not grant trademark rights to the original project's names, logos, or branding.
- Before redistributing binaries, review third-party dependency and asset provenance.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Desktop Shell | Tauri 2 |
| Backend | Rust |
| State | Jotai, TanStack Query |
| Search | Tantivy |

## License

Licensed under the Apache License, Version 2.0.

See:

- [LICENSE](./LICENSE)
- [NOTICE](./NOTICE)
