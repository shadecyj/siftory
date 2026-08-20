# Security Policy

## Scope

Siftory can use user-owned search and model provider credentials for opt-in Live search. Protecting those credentials is a release requirement: a key must never become part of source control, a public installer, browser storage, Search Notes, evidence snapshots, screenshots, terminal recordings, or application logs.

This document covers the current V0.1 local runtime and Windows desktop distribution. Siftory does not provide cloud credential sync, shared team secrets, or remote multi-user key management.

## Supported versions

| Version | Security updates |
| --- | --- |
| `0.1.x` | Current development line |

## Configuration boundaries

### Source-run Web mode

- Put server-side provider configuration in a local, untracked `.env.local` file.
- `/settings` is a read-only status workspace in this mode. It must not provide a browser API Key input or store credentials in `localStorage`, cookies, URLs, React props, or public HTTP responses.
- Never expose a credential through `NEXT_PUBLIC_*` or another browser-readable environment variable.
- The setup template shown in Settings contains variable names only. Do not paste real values into issues, PRs, comments, screenshots, or logs.

### Windows desktop mode

- Use the desktop application's native **Settings / Credentials** panel for the Save → Test → Apply flow.
- Windows Credential Manager protects the local credential boundary. The main Siftory workspace receives redacted status only; it cannot read a saved key back.
- The installer contains no provider keys. Release assets, bundled resources, PGlite data, runtime logs, Search Notes, and `/api/settings/runtime-status` must not contain plaintext credentials.
- A connection test is an explicit user action. It may contact a third-party provider and consume quota or incur charges.

## Before committing or publishing

Run this checklist before any GitHub push, Release upload, demo recording, or portfolio handoff:

1. Confirm `.env`, `.env.local`, and provider-specific credential files are ignored and not staged.
2. Search the changed files, generated artifacts, release notes, screenshots, and terminal captures for real API keys, bearer tokens, passwords, and private URLs.
3. Keep `.env.example` limited to variable names and safe placeholder values; never copy a personal key into it.
4. Confirm `NEXT_PUBLIC_*` contains no secret, and that no URL, client-side storage item, or API response carries a credential.
5. Build the desktop installer from a clean configuration, run `npm run security:scan:release`, and verify `dist/desktop/` contains no key material before publishing a checksum. The scanner reports only file names and indicator categories, never matched values.
6. Treat provider test output as sensitive operational data: do not publish raw request bodies, prompts, headers, or environment dumps.

## If a credential is exposed

1. Revoke or rotate the key immediately in the relevant provider console.
2. Remove the secret from the exposed environment and stop affected Live runtime processes.
3. If it reached Git history, invalidate the key first, then follow the repository owner's incident process before rewriting history or publishing a replacement release.
4. Review logs, release assets, screenshots, copied notes, and cached CI artifacts for the same value or derivative.
5. Record the affected scope and remediation without reposting the secret.

## Reporting a vulnerability

Do not open a public issue for a suspected credential leak, local privilege boundary flaw, or other security-sensitive report. Use the repository's private GitHub security advisory channel when it is enabled, or contact the repository maintainer through GitHub with a concise reproduction that excludes real credentials.

Please include the affected version, platform, impact, safe reproduction steps, and whether any secret or user data may have been exposed. Do not include live API keys, account information, or raw production data in the report.
