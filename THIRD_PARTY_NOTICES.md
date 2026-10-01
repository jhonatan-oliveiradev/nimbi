# Third-Party Notices

## Coucou

Nimbi adapts selected Windows shell architecture patterns from the open-source
Coucou project:

- Repository: https://github.com/Louis-CFM/coucou
- Copyright (c) 2026 Louis Raillé
- Source-code license: MIT

The adapted ideas are limited to platform/windowing architecture such as a
transparent top-edge Tauri window, non-activating/tool-window behavior,
monitor/DPI-aware placement, wake-strip optimization, cursor hit testing, and
click-through behavior.

Nimbi does **not** include or adapt Coucou/Mochi protected brand or character
assets, character appearance, expressions, animation choreography, icons,
sounds, screenshots, GIFs, videos, or other media.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bible Strong Avatar Lab / Cloudee

Nimbi uses an exported **Cloudee** procedural avatar definition created with
Bible Strong Avatar Lab and renders it with the project's published React
runtime:

- Project: Bible Strong Avatar Lab
- Repository: https://github.com/smontlouis/bible-strong-avatar-lab
- Author: Stéphane Montlouis-Calixte
- Export used by Nimbi: Cloudee `.avatar.json` definition
- Runtime package: `@bible-strong/avatar-react@0.1.0`
- Runtime dependency: `@bible-strong/avatar-core@0.1.0`
- Declared source/runtime license: GNU Affero General Public License v3.0 only
  (AGPL-3.0-only)

Nimbi does not embed or rebrand the Avatar Lab Studio. The exported avatar is
kept as a versioned product asset, while Nimbi owns the behavior arbitration,
RunOptic integration, placement, presence, island shell, and interaction
lifecycle around it.

The installed Bible Strong runtime packages include their license materials.
The upstream repository and its LICENSE file are the authoritative source for
the applicable license terms.
