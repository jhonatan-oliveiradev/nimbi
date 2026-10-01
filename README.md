# Nimbi

Nimbi is a Windows-first ambient AI companion that lives at the top edge of the desktop.

Its UI is intentionally small: a minimal cloud character inside a Dynamic-Island-style surface that expands only when the system has something useful to show.

## Product boundary

```text
RunOptic = observability / eyes
NX Agent / JARVIS = orchestration / brain
Nimbi = ambient interaction / face + hands
```

The foundation release reads normalized local telemetry from RunOptic. It does not collect provider credentials, prompts, responses, or raw provider payloads.

## Stack

- Tauri 2 / Rust
- React 19 / TypeScript
- Vite
- Motion
- SVG
- Windows WebView2

## Browser-first visual development

Most character and island work does not require launching an unsigned Windows executable.

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:5173/dev/island-preview.html
```

The preview uses the same React, SVG, state, and island components as the Tauri app. It provides fixtures for idle, thinking, working, needs-input, complete, error, and offline.

## Native development

RunOptic should be available on its normal loopback endpoint:

```text
http://127.0.0.1:48666/v1/telemetry/state
```

Start Nimbi with the normal Tauri CLI:

```powershell
npm install
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
- has no production approval/action channel yet.

## Third-party source

Nimbi uses original branding, character artwork, and motion. Some Windows shell architecture is adapted from the MIT-licensed Coucou project. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
