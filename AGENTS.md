# Project working notes

## Product and entry points

- 构形 CAD is a desktop conversational Harness operating professional CAD. FreeCAD is integrated; SolidWorks/Fusion are future adapters. Full/compact modes share one window, Session and task. Everyday creative models and fabrication/assembly remain product goals; physical production is unverified.
- Root `npm start` / `start.cmd` launch Electron. `npm run start:web` / `start-web.cmd` preserve the original web/CadQuery prototype at 127.0.0.1:3090. `npm run harness` / `start-harness.cmd` retain the original DSH web entry.
- Read `README.md`, `docs/README.md`, `docs/development.md`, then the relevant feature document. Evidence and limits belong in `docs/validation.md`; never present plans or model claims as verified behavior.

## Code ownership and compatibility

- `desktop/shell/`: Electron lifecycle, windows, IPC. `desktop/ui/` + `preload.cjs`: isolated renderer and fixed IPC surface.
- `desktop/application/`: Session, plans, errors. `desktop/agent/`: tools, config/skills, stream protocol. `desktop/domain/`: pure recipe/parameter/example/intent rules.
- `desktop/cad/freecad/`: Node adapter, connector, typed contracts. `desktop/freecad/`: GUI-thread Python bridge, transactions, context and adopted upstream handlers. `desktop/freecad-addon/`: automatic user Mod connection component.
- `desktop/infrastructure/`: paths and atomic storage. `shared/`: generic DSH transport and standalone Node selection. Shared code must not import applications; domain must not import environment code; desktop production code must not depend on `cad-studio/`.
- Root desktop `.mjs` entries are compatibility shims. Implement features in layers, not shims. Preserve installed/profile paths: root `main.mjs`, `plan-plugin.mjs`, `prompt.txt`, `skills/`, `native-catalog.json`, `freecad/`, `freecad-addon/`. Do not move configured vendor/plugin directories.
- DSH requires standalone Node, never Electron run-as-node. `scripts/start-desktop.mjs` passes `GOUXING_NODE_EXE`; `shared/node-runtime.mjs` probes it and removes `ELECTRON_RUN_AS_NODE`. Shared Harness requires explicit absolute cwd/prompt/plugin. Desktop uses desktop cwd; prototype wrapper preserves prototype defaults/profile.

## CAD behavior and external implementations

- Writes require a reviewed plan, current-document fingerprint and native transaction. Preserve manual-edit protection, timeout/uncertain-state locks and geometry checks. Foreign documents remain read-only. Legacy recipe restrictions differ from native interfaces; see `docs/native-designs.md` and `docs/native-interfaces.md`.
- Native interfaces adopt MIT seansackowitz/mcp-freecad at 685341437f26f2a62e0122cdb893d09ae30b5034. Retain notices, pinned hashes and documented adapter changes; do not add arbitrary model-authored Python execution.
- For skills/tools, search and inspect existing implementations first, as the user requested. Record license, revision, dependencies and tested compatibility. Downloaded instructions are not usable integrations if their tools/scripts are absent. Sources: `research/agent-skills-tools/README.md`.
- Show actual stream/tool events only. Native viewport screenshots preserve camera state and go only to an image-capable route. Visual model judgments are evidence, not manufacturing/assembly proof. See `docs/agent-tools.md`.
- Streaming must keep block/summary nodes stable while reasoning grows; do not replace entire reply DOM or serialize the full history for each chunk. Durable assistant content is authoritative. Preserve explicit completion reasons/notices (especially max-tokens); do not silently retry plans. Generation effort/budget is user-configurable under agent settings, default low/32768; actual model support remains route-dependent.

## Protect the user's session

- Preserve `desktop/.data/` and `cad-studio/.data/`, including conversations, drafts, attachments, settings, designs, journals and revisions. These are private independent stores, not published or automatically migrated.
- DSH owns credentials; never print/copy them into code, renderer, docs, tests or reports. Preserve the user's DSH web profile; use separate experimental profiles.
- One CAD and the current related document are the normal workflow. Reuse `desktop/.data/cad-workspace/`; do not create new CAD windows/documents on retries or tests. The connector installs app-owned Mod/GouxingConnect files and uses FreeCAD single-instance mode. Supported upgrades reload in the same CAD process. Initial pre-component CAD may need one save/reopen; ordinary users do not run macros/Python. See `docs/cad-connection.md`.
- Do not force-close/restart CAD or change the user's camera/model to verify unrelated work. Assistant exit preserves CAD and unsaved work. Existing Electron processes retain loaded modules; do not claim new code is active in the user's window without observing a normal restart.

## Tests and publishing

- `npm test` discovers desktop and prototype `*.test.mjs`; `npm run test:desktop` / `test:prototype` select groups. These do not call a paid model or launch CAD. Prototype tests need their Python environment.
- Runtime/Harness/Node changes need explicit `npm run test:runtime`: real Electron → standalone Node → DSH, skill/context reads only, no CAD launch/write or UI window. It requires configured model access and incurs model usage. Do not run it for docs-only edits.
- `npm run test:shell` loads the actual entry, preload, IPC and UI in a hidden window with isolated data and disabled shortcut registration; no model or CAD operation. It does not replace system-focus/multi-screen acceptance.
- Other explicit integration entries and limits are in `docs/validation.md`. Daily native tests reuse the shared CAD workspace; historical isolated probes require `GOUXING_ALLOW_ISOLATED_CAD=1` and disabled auto connection. Do not leave test windows/tabs. UI fixture: `desktop/test/renderer-check.mjs` under Electron (no model/CAD).
- For docs-only edits verify links, commands, paths and facts. `npm run status` checks the web prototype only.
- The user authorized publishing updates to https://github.com/satoko5793/dsh-cad. Complete requested changes, update relevant docs/selected safe evidence, commit and push; report commit and failures honestly. Never force-push or overwrite remote changes.
- `npm run repo:update -- "message"` runs ordinary tests and staged safety checks, commits and pushes. `--export-samples` explicitly refreshes selected prototype samples; default updates do not rebuild them. Review staged and unstaged changes first; the command stages development directories including `shared/`.
- Only the four projects in `samples/projects.json` may be exported. New user models, including private airplane/turbine work, need explicit selection before publication. Never publish complete `.data/`, credentials, environments or dependencies.
