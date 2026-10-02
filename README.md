# Nimbi

Nimbi is a Windows-first ambient AI companion that lives at the top edge of the desktop.

Its UI is intentionally small: a minimal cloud character inside a Dynamic-Island-style surface that expands only when the system has something useful to show.

## Product boundary

```text
RunOptic = observability / eyes
NX Agent / JARVIS = orchestration / brain
Nimbi = ambient interaction / face + hands
```

The foundation release reads normalized local telemetry from RunOptic. Attention & Actions v1 adds an optional loopback-only action channel to NX Agent/JARVIS, while keeping execution outside Nimbi. Nimbi does not persist provider credentials, prompt/response history, or raw provider payloads.

## Stack

- Tauri 2 / Rust
- React 19 / TypeScript
- Vite
- Motion
- Bible Strong procedural avatar runtime (Cloudee)
- SVG fallback
- Windows WebView2

## Browser-first visual development

Most character and island work does not require launching an unsigned Windows executable.

```powershell
npm ci
npm run dev
```

Then open:

```text
http://localhost:5173/dev/island-preview.html
```

The preview uses the same React, Cloudee runtime, behavior controller, placement state, action controller, and island components as the Tauri app. It provides semantic fixtures for idle, thinking, working, needs-input, complete, error, and offline, deterministic placement fixtures for every dock edge and floating corners, action success/error fixtures, and a reduced-motion toggle. Hover, click, compose, reply, retry, and drag exercise the production interaction behavior without requiring a live NX Agent endpoint.

### Placement & Presence

Nimbi is not restricted to the top-center position. In the preview, drag the cloud itself:

- top / bottom → horizontal island;
- left / right → vertical reflow;
- away from an edge → floating Nimbi.

Edge snapping uses a 56 px logical magnetic zone. Placement is normalized so it can survive resolution and DPI changes.

Click the island shell while idle to open the compact Presence controls. Click Cloudee itself to open the ambient action composer. Passive character opacity can be adjusted from 20–100%; important semantic states automatically raise their minimum visibility, and needs-input stays fully visible.

## Native development

RunOptic should be available on its normal loopback endpoint:

```text
http://127.0.0.1:48666/v1/telemetry/state
```

Start Nimbi with the normal Tauri CLI:

```powershell
npm ci
npm run tauri:dev
```

### Windows Application Control development constraint

On a Windows machine where Smart App Control / Application Control is enforcing, local native compilation may be blocked before Nimbi itself is produced.

We confirmed two distinct enforcement points on the target machine:

1. the native binding used by `@tauri-apps/cli` (`cli.win32-x64-msvc.node`);
2. fresh Cargo build-script executables under `src-tauri/target/debug/build/*/build-script-build.exe`.

Because Cargo must execute those transient unsigned build binaries, bypassing the Node Tauri CLI with `cargo run` does **not** solve the policy boundary.

Do not disable Smart App Control or Device Guard for Nimbi development.

Use this workflow instead:

```text
local machine
  └─ npm run dev
     └─ browser fixture / production React components

GitHub Actions (Windows)
  └─ frontend tests + build
  └─ Rust tests + clippy
  └─ native Tauri build
     └─ nimbi.exe artifact
```

The CI native build is the authoritative compile/link check until Nimbi has a trusted code-signing path or native testing is moved to a Windows development environment where Smart App Control is not enforcing.


For explicit local testing only, the RunOptic base URL can be overridden with `NIMBI_RUNOPTIC_BASE_URL`. Plain HTTP overrides are accepted only for loopback hosts.

### NX Agent action channel

Attention & Actions v1 keeps command execution in NX Agent/JARVIS. Nimbi only submits a normalized action request through the native Tauri layer.

The native client is configured with:

```text
NIMBI_NX_AGENT_BASE_URL
NIMBI_NX_AGENT_ACTION_PATH
```

Both values are required for the production action channel. The base URL must resolve to loopback HTTP(S): `127.0.0.1`, `localhost`, or `::1`. Nimbi does not guess a route when either value is missing; the action surface reports NX Agent as unavailable instead. The browser preview uses a dev-only fixture submitter and never changes the native endpoint.

Nimbi never needs provider API keys.

## Verification

Frontend:

```powershell
npm run test:run
npm run build
```

Rust:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Native link/build:

```powershell
npm run tauri:build -- --debug
```

Windows Application Control or Smart App Control may block newly built unsigned executables on some systems. Do not disable those protections for Nimbi development; use the browser preview for visual iteration and CI for native compile/link verification.

## Privacy

The current Nimbi foundation:
- communicates with RunOptic over loopback;
- consumes only `runoptic.telemetry.v1`;
- does not persist provider credentials;
- does not persist prompt/response bodies;
- does not execute shell commands from the frontend;
- can submit prompts/replies only to a configured loopback NX Agent action endpoint;
- never executes shell commands or provider actions directly;
- does not persist action prompt/response history.

## Third-party source

Nimbi uses original product branding, behavior, shell, and interaction design. Its primary cloud avatar is the exported Cloudee procedural avatar rendered with the Bible Strong avatar runtime; the previous original SVG cloud remains only as a safe runtime fallback. Some Windows shell architecture is adapted from the MIT-licensed Coucou project. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).