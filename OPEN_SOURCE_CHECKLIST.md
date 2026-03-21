# Open Source Checklist

Use this checklist before announcing the repository publicly or distributing binaries broadly.

## License And Attribution

- [x] Root license file exists
- [x] NOTICE file exists
- [x] Repository states it is derived from `lovcode`
- [x] Upstream repository and license are linked
- [ ] Modified inherited files carry prominent modification notices where needed
- [ ] Binary distributions include license and notice materials

## Branding And Naming

- [x] Repository uses its own product name
- [ ] Remaining upstream logos, product names, or screenshots are reviewed for trademark risk
- [ ] Public-facing metadata does not imply official affiliation with upstream

## Secrets And Privacy

- [ ] No secrets, tokens, or private keys are committed
- [ ] No personal conversation data or sensitive logs are committed
- [ ] No internal-only screenshots or customer data remain in docs or assets
- [ ] Local automation/memory files are excluded from public distribution as needed

## Third-Party Software

- [ ] Third-party dependency licenses are reviewed for source redistribution
- [ ] Third-party dependency licenses are reviewed for binary redistribution
- [ ] Non-code assets such as fonts, icons, and images have clear redistribution rights
- [ ] Marketplace/template/sample content provenance is documented

## Repository Governance

- [x] README explains project purpose and origin
- [x] CONTRIBUTING guide exists
- [x] SECURITY policy exists
- [x] SUPPORT guide exists
- [ ] Issue templates or discussion policy are added if needed

## Release Readiness

- [x] Changelog-driven release workflow is documented
- [ ] Release notes are reviewed for accidental disclosure
- [ ] Packaged artifacts are checked for embedded secrets or internal paths
- [ ] Final public announcement avoids unsupported legal or compatibility claims
