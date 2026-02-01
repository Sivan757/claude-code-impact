<p align="center">
  <img src="docs/images/cover.png" alt="Claude Code Impact Cover" width="100%">
</p>

<h1 align="center">
  <img src="assets/logo.svg" width="32" height="32" alt="Logo" align="top">
  Claude Code Impact
</h1>

<p align="center">
  <strong>Desktop companion for AI coding tools</strong><br>
  <sub>macOS • Windows • Linux</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Apache_2.0-green" alt="License">
</p>

---

<p align="center">
  <a href="#features">Features</a> •
  <a href="#oh-my-claudecodeimpact">oh-my-claudecodeimpact</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#license">License</a>
</p>

---

![Gallery](docs/assets/gallery.png)

## Features

- **Chat History Viewer** — Browse and search conversation history across all projects with full-text search
- **Commands Manager** — View and manage slash commands (`~/.claude/commands/`)
- **MCP Servers** — Configure and monitor MCP server integrations
- **Skills** — Manage reusable skill templates
- **Hooks** — Configure automation triggers
- **Sub-Agents** — Manage AI agents with custom models
- **Output Styles** — Customize response formatting
- **Marketplace** — Browse and install community templates
- **Customizable Statusbar** — Personalize your statusbar display with scripts
- **Session Prompt Preview** — Hover to preview prompts in session list

## oh-my-claudecodeimpact

Community configuration framework for Claude Code Impact, inspired by oh-my-zsh.

```bash
curl -fsSL https://raw.githubusercontent.com/MarkShawn2020/oh-my-claudecodeimpact/main/install.sh | bash
```

Share and discover statusbar themes, keybindings, and more at [oh-my-claudecodeimpact](https://github.com/MarkShawn2020/oh-my-claudecodeimpact).

## Installation

### From Release

Download the latest release for your platform from [Releases](https://github.com/markshawn2020/claudecodeimpact/releases).

### From Source

```bash
# Clone the repository (with submodules)
git clone --recursive https://github.com/markshawn2020/claudecodeimpact.git
cd claudecodeimpact

# Install dependencies
pnpm install

# Run development
pnpm tauri dev

# Build for distribution
pnpm tauri build
```

## Usage

1. Launch Claude Code Impact
2. Select **Projects** to browse chat history from Claude Code sessions
3. Use the **Configuration** section to manage commands, MCP servers, skills, and hooks
4. Visit **Marketplace** to discover community templates

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Rust, Tauri 2 |
| UI Components | shadcn/ui |
| State | Jotai |
| Search | Tantivy (full-text search) |

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=sivan757/claudecodeimpact&type=Date)](https://star-history.com/#markshawn2020/claudecodeimpact&Date)

## License

Apache-2.0
