# Contributing to Siftory

Thanks for helping make evidence-first search easier to inspect and keep. Siftory is early-stage, so small, focused contributions and concrete issue reports are especially useful.

## Before you start

- Read the [README](README.md), [product requirements](docs/01-PRD.md), and [domain model](docs/04-DOMAIN-MODEL.md).
- Check whether a change belongs to the current Quick vertical slice or to the planned Compare, Research, or Knowledge roadmap.
- Do not silently weaken the Claim → Evidence → Source traceability model. Product or data-model changes should update the corresponding documentation.

## Local setup

```bash
npm ci
npm run check
```

Use Replay for ordinary development; it is deterministic and does not require external keys. Live testing is optional and requires your own provider credentials. Follow the setup guidance in [README.md](README.md) and never share or commit a real key.

## Pull request expectations

Please keep a pull request focused and include:

1. A clear problem statement and the user-visible outcome.
2. Tests or an explanation of why automated coverage is not applicable.
3. Documentation updates when behavior, setup, safety boundaries, or scope changes.
4. Screenshots or a short recording for visible UI changes when practical.
5. A successful `npm run check` before requesting review.

## Safety rules

- Never commit `.env`, `.env.local`, databases, runtime directories, generated installers, or API keys.
- Never place provider credentials in `NEXT_PUBLIC_*` variables, client code, screenshots, logs, prompts, or fixtures.
- Do not make Live requests run automatically in the normal test suite; external-provider tests must remain explicit opt-in.
- Preserve the distinction between Replay and Live. Replay data must never be represented as live web results.

## Scope and design principles

Siftory is built around a small set of product rules:

- **Evidence first:** important claims must trace to inspectable evidence.
- **Contextual trust:** confidence describes a claim–evidence relationship, not a permanent score for a website.
- **Search becomes knowledge:** saved results remain structured, reopenable Search Notes.
- **Default simple, advanced transparent:** the normal path should be calm; underlying evidence and reasoning rules should be inspectable on demand.

For security-sensitive desktop or credential changes, also read [SECURITY.md](SECURITY.md) and [the desktop credential-boundary ADR](docs/10-DESKTOP-SETTINGS-SECURITY.md).

## Reporting issues

When opening an issue, include the runtime mode (Replay or Live), operating system, app/source version, expected behavior, actual behavior, and safe reproduction steps. Remove API keys, provider responses that may contain sensitive material, personal notes, and local paths before posting.

## License

By contributing, you agree that your contributions are licensed under the repository’s [MIT License](LICENSE).
