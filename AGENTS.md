# Project working notes

## Scope and entry points

- This workspace contains 构形 CAD, a desktop conversational Harness development app with a limited persistent FreeCAD adapter, plus the preserved web/CadQuery prototype.
- `desktop/` is the default entry: root `start.cmd` and `npm start` launch Electron. `start-web.cmd` / `npm run start:web` retain `cad-studio/` at 127.0.0.1:3090. Neither integrates SolidWorks/Fusion.
- `start-harness.cmd` and `npm run harness` retain access to the original DSH web app.
- Read root `README.md`, then `docs/README.md` for the documentation index. Product direction belongs in `docs/product.md`, staged work and acceptance in `docs/roadmap.md`, implementation in `docs/architecture.md`, and evidence in `docs/validation.md`.

## Product direction

- Help ordinary users describe ideas in everyday language and progress to physical objects that can be fabricated and assembled.
- The desktop product has a full Harness workspace and a compact floating chat window for use alongside CAD. They share conversation, draft, files, CAD context and task state. See `docs/desktop-harness.md` for focus, selection, pause/cancel and user/agent coordination requirements.
- FreeCAD 1.1.4 is the first CAD. `desktop/design.mjs` validates data-only parametric multi-body recipes; `desktop/freecad/features.py` builds native Sketch/Pad/Pocket features. Supports rectangles/circles/polygons, arithmetic dimension references, XYZ placement, parameter updates, undo/redo, save and open FCStd. Legacy four-hole plates remain supported. Unknown documents are read-only; no arbitrary model-authored code, single-face editing, feature insertion/deletion or assembly solver. See docs/native-designs.md.
- Full/compact layouts share one window and Session. DSH proposes plans via a per-data-directory gouxing-desktop-<hash> profile; confirmation alone triggers native writes. Signature checks protect manual native edits, including across save/reopen. Evidence: 21 ordinary tests, native old-plate 9 groups, multi-body 20 groups, reopen 27 groups, 4 standalone model turns and 2 Electron-parent model turns (overlapping, not additive capabilities). UI selection and parameter planning passed; complete small-window visuals, focus, multi-screen and packaged installation remain incomplete. Preserve earlier research/freecad-native evidence.
- DSH must run in standalone Node, never Electron's run-as-node mode: its native require-builtin addon fails there. scripts/start-desktop.mjs passes GOUXING_NODE_EXE; cad-studio/node-runtime.mjs verifies/resolves it and strips ELECTRON_RUN_AS_NODE. Desktop model changes need the explicit Electron regression (desktop/test/run-electron-harness.mjs); ordinary Node-only model tests cannot validate the desktop launch path. New example creation accepts empty or default-valued overrides; existing-model updates still require a real delta.
- After the native CAD loop and desktop interaction, pursue a printable, assemblable electronics enclosure with requirements, supports/connections, per-part files, parts list, assembly instructions, physical prototype and feedback-driven revision.
- Keep planned desktop/CAD capabilities distinct from prototype evidence. Static multi-solid geometry and successful exports alone do not prove native CAD integration, manufacturability or assembly.

## Keep it simple

- Keep single-user local operation as the baseline. Electron and the limited FreeCAD macro adapter are now implemented; extend verified capabilities rather than adding unrelated cloud hosting, accounts or frameworks.
- Research sources and downloads belong under `research/`; they are reference material, not application dependencies.
- Distinguish tested behavior from repository claims when reporting research results. Do not resume software evaluation just to tidy this project.

## Preserve user data

- Preserve `cad-studio/.data/`, which stores designs, chats and revisions.
- Preserve `desktop/.data/`, which stores the desktop conversation, drafts, attachments, settings and bridge journals. Neither private data tree is published. Closing the assistant must not kill FreeCAD or discard its unsaved work.
- Credentials are managed by DSH. Do not print them, embed them in frontend code, or copy them into repository documentation or tests.
- Preserve the user's DSH web profile. Use a separate profile for experimental integrations.
- Avoid moving directories that existing profiles reference, particularly `vendor/` and installed plugin checkouts.

## Repository updates

- The user requested publishing this project and keeping it updated at https://github.com/satoko5793/dsh-cad.
- After completing requested project changes, update the relevant documentation and selected demonstration results, then commit and push to this repository. Report the commit and any push failure honestly. Never force-push or overwrite remote changes.
- `npm run samples:export` exports only the four explicitly selected sample projects in `samples/projects.json`. Do not publish the entire private `.data/` directory or DSH credentials. Newly created user projects require explicit selection before export.

## Verification

- Root `npm test` runs desktop Session tests and the application tests in `cad-studio/test/`. `npm run test:desktop` runs desktop unit tests only. Explicit native integration: set FREECAD_EXE and run `node desktop/test/native-check.mjs` (opens an isolated FreeCAD test instance). Do not run native GUI or paid model tests for documentation-only updates.
- Root `npm run status` checks the existing application without opening a browser or creating a project.
- For documentation-only changes, verify paths and commands instead of rerunning CAD generation or paid model requests.
- Keep detailed project documentation under `docs/`. Preserve sample and research evidence paths, and link to their indexes rather than duplicating their assets.
