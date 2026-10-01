# Nimbi Foundation Verification Checklist

Use this checklist before marking the first Windows vertical slice ready for merge.

## Character and island

- [ ] The visible character is the original Nimbi cloud: minimal, soft, two eyes, no default mouth, arms, or legs.
- [ ] No Coucou/Mochi protected character, icon, sound, animation, screenshot, GIF, video, or media asset is present.
- [ ] `THIRD_PARTY_NOTICES.md` is present.
- [ ] Idle island is approximately 140–170 × 34–42 logical px.
- [ ] Expansion reads as a top-center Dynamic Island rather than a modal or dashboard.
- [ ] Browser preview renders idle, thinking, working, needs-input, complete, error, and offline.
- [ ] Reduced-motion mode preserves semantic state while removing continuous movement.

## RunOptic

- [ ] With RunOptic stopped, Nimbi becomes quietly offline without stale agent/provider/model/project labels.
- [ ] Starting RunOptic while Nimbi remains open restores connected state without restarting Nimbi.
- [ ] A real active agent session drives working/thinking.
- [ ] A real working → done transition produces one short complete reaction.
- [ ] Known provider/model/project labels may appear; unknown labels remain absent.
- [ ] The React frontend never calls the RunOptic HTTP endpoint directly.

## Windows shell

- [ ] Window is centered at the top of the primary monitor.
- [ ] Window stays out of Alt-Tab/task switching.
- [ ] Passive Nimbi does not steal focus.
- [ ] Pointer events outside the visible island pass through to the application underneath.
- [ ] Hidden mode shrinks the native host to the wake strip.
- [ ] Monitor/DPI changes cause the shell to recenter.
- [ ] Expanding/collapsing the DOM island does not resize the native host every animation frame.

## Automated verification

- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- [ ] Windows CI native Tauri build/link check
