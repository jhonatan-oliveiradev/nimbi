# Nimbi Placement & Presence v1 Verification Checklist

Use this checklist before merging `feat/placement-presence-v1`.

## Browser preview

- [ ] Open `/dev/island-preview.html` and confirm Nimbi starts docked at top center.
- [ ] Drag using the cloud itself; dragging elsewhere on the island does not relocate it.
- [ ] Releasing within 56 logical px of top/bottom docks horizontally.
- [ ] Releasing within 56 logical px of left/right docks vertically.
- [ ] Left/right layouts reflow text and actions; nothing is visually rotated.
- [ ] Releasing away from all edge zones leaves Nimbi floating.
- [ ] Dock hints appear only while dragging.
- [ ] Floating expansion selects an onscreen direction with the most safe space.
- [ ] Keyboard state fixtures 1–7 still work.
- [ ] Reduced-motion keeps placement fully functional.

## Presence

- [ ] Click Nimbi to expand, then adjust Presence from 20–100%.
- [ ] Idle uses the configured passive opacity.
- [ ] Working never falls below 65%.
- [ ] Error never falls below 90%.
- [ ] Needs-input is always 100%.
- [ ] Hovering or dragging temporarily raises the character to 100%.
- [ ] Text/action surfaces remain fully opaque when the character is subtle.
- [ ] Reset position returns Nimbi to top-center default.

## Windows shell / persistence

- [ ] Placement persists in `%APPDATA%\nimbi\preferences.json`.
- [ ] Presence persists across restart.
- [ ] Corrupt or unsupported preferences restore safe defaults.
- [ ] A missing saved monitor restores on the primary monitor.
- [ ] Work-area placement avoids the Windows taskbar.
- [ ] DPI/resolution changes clamp Nimbi fully onscreen.
- [ ] Dragging across monitors chooses the monitor under the cursor.
- [ ] The hidden wake strip follows the saved edge and rotates for side docks.
- [ ] Passive/expanded windows keep click-through outside the visible island.
- [ ] Passive Nimbi does not steal focus.

## RunOptic regression

- [ ] Offline/idle/thinking/working/needs-input/complete/error still map correctly.
- [ ] Placement changes do not duplicate provider collectors or expose raw telemetry.
- [ ] Unknown attribution still stays absent rather than becoming placeholder data.

## Automated gate

- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=moderate`
- [ ] `cargo test --locked --manifest-path src-tauri/Cargo.toml`
- [ ] `cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings`
- [ ] Windows native Tauri build/link succeeds and uploads `nimbi.exe`.
