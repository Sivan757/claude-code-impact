<h1 align="center">
  Claude Code Impact
</h1>

<p align="center">
  <strong>Desktop companion for AI coding tools</strong><br>
  <sub>macOS | Windows | Linux</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Apache_2.0-green" alt="License">
</p>

---

<p align="center">
  <a href="#features">Features</a> |
  <a href="#oh-my-claude-code-impact">oh-my-claude-code-impact</a> |
  <a href="#installation">Installation</a> |
  <a href="#development">Development</a> |
  <a href="#build--release">Build & Release</a> |
  <a href="#usage">Usage</a> |
  <a href="#tech-stack">Tech Stack</a> |
  <a href="#license">License</a>
</p>

---

## Features

- Skills, hooks, sub-agents
- Plugin Marketplace for community templates
- Session prompt preview

## Installation

### From Release

Download the latest release for your platform from
[Releases](https://github.com/Sivan757/claude-code-impact/releases).

### From Source

```bash
# Clone the repository (with submodules)
git clone --recursive https://github.com/Sivan757/claude-code-impact.git
cd claude-code-impact

# Install dependencies
pnpm install

# Run development
pnpm tauri dev

# Build for distribution
pnpm tauri build
```

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build & Release

### Snapshot builds (push to main)

- Every push to `main` builds cross-platform snapshots.
- Artifacts are uploaded to the GitHub Actions run (no changelog, no Release).

### Releases (tag or manual)

- Create a versioned tag (for example: `v0.1.0`) and push it.
- The Release workflow builds bundles, extracts the matching changelog section
  from `CHANGELOG.md`, and publishes a GitHub Release.

```bash
# Example
pnpm changeset
pnpm release
git push origin main

git tag v0.1.0
git push origin v0.1.0
```

## Usage

1. Launch Claude Code Impact
2. Select Projects to browse chat history from Claude Code sessions
3. Use Configuration to manage commands, MCP servers, skills, and hooks
4. Visit Marketplace to discover community templates

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Rust, Tauri 2 |
| UI Components | shadcn/ui |
| State | Jotai |
| Search | Tantivy (full-text search) |

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=sivan757/claude-code-impact&type=Date)](https://star-history.com/#Sivan757/claude-code-impact&Date)

## License

Apache-2.0
