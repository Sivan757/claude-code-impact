# Contributing

Thanks for contributing to `Claude Code Impact`.

This project is a derivative of `lovcode`, so contributions must preserve upstream license and attribution obligations while keeping the codebase maintainable for long-term independent development.

## Before You Start

- Read the project overview in [README.md](./README.md)
- Read attribution notes in [UPSTREAM_ATTRIBUTION.md](./UPSTREAM_ATTRIBUTION.md)
- Check the release notes in [CHANGELOG.md](./CHANGELOG.md)

## Development Setup

```bash
pnpm install
pnpm tauri dev
```

## Validation

Run these before opening a pull request:

```bash
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

If your change touches only documentation, explain that in the PR and note which validation steps were skipped.

## Contribution Rules

- Keep architecture modular and readable
- Avoid mixing unrelated changes into a single PR
- Preserve or improve error handling
- Keep Apache-2.0 headers, notices, and attribution intact where applicable
- Do not introduce closed-source assets or code without a clear redistribution right
- Do not commit secrets, tokens, or internal-only data

## Pull Request Expectations

Each PR should explain:

- what changed
- why it changed
- any compatibility or migration impact
- how it was verified

For UI changes, include screenshots when practical.

## Licensing

By submitting a contribution, you agree that your contribution may be distributed under the repository's Apache-2.0 license unless explicitly stated otherwise in advance.
