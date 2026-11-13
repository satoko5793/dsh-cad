# Project working notes

## Scope and entry points

- This workspace contains 构形 CAD. The target product is a desktop conversational Harness that operates professional CAD software; the current runnable implementation is a web/CadQuery prototype built on DeepSeek Harness.
- The current prototype is `cad-studio/`. Root `start.cmd` and `npm start` launch it at 127.0.0.1:3090; this does not launch the target desktop product or connect to SolidWorks/Fusion.
- `start-harness.cmd` and `npm run harness` retain access to the original DSH web app.
- Read root `README.md`, then `docs/README.md` for the documentation index. Product direction belongs in `docs/product.md`, staged work and acceptance in `docs/roadmap.md`, implementation in `docs/architecture.md`, and evidence in `docs/validation.md`.

## Product direction

- Help ordinary users describe ideas in everyday language and progress to physical objects that can be fabricated and assembled.
- The desktop product has a full Harness workspace and a compact floating chat window for use alongside CAD. They share conversation, draft, files, CAD context and task state. See `docs/desktop-harness.md` for focus, selection, pause/cancel and user/agent coordination requirements.
- First select one CAD and version, then validate reading the active document/selection, creating and editing native features, saving/reopening native files, and undo/recovery. SolidWorks and Fusion are candidates, not implemented integrations. The first CAD and desktop framework remain undecided.
- After the native CAD loop and desktop interaction, pursue a printable, assemblable electronics enclosure with requirements, supports/connections, per-part files, parts list, assembly instructions, physical prototype and feedback-driven revision.
- Keep planned desktop/CAD capabilities distinct from prototype evidence. Static multi-solid geometry and successful exports alone do not prove native CAD integration, manufacturability or assembly.

## Keep it simple

- Keep single-user local operation as the baseline. Professional CAD integration and a desktop shell are the agreed direction; this change records specifications only. Framework selection and integration implementation are future tasks. Do not add unrelated cloud hosting, accounts or frameworks.
- Research sources and downloads belong under `research/`; they are reference material, not application dependencies.
- Distinguish tested behavior from repository claims when reporting research results. Do not resume software evaluation just to tidy this project.

## Preserve user data

- Preserve `cad-studio/.data/`, which stores designs, chats and revisions.
- Credentials are managed by DSH. Do not print them, embed them in frontend code, or copy them into repository documentation or tests.
- Preserve the user's DSH web profile. Use a separate profile for experimental integrations.
- Avoid moving directories that existing profiles reference, particularly `vendor/` and installed plugin checkouts.

## Repository updates

- The user requested publishing this project and keeping it updated at https://github.com/satoko5793/dsh-cad.
- After completing requested project changes, update the relevant documentation and selected demonstration results, then commit and push to this repository. Report the commit and any push failure honestly. Never force-push or overwrite remote changes.
- `npm run samples:export` exports only the four explicitly selected sample projects in `samples/projects.json`. Do not publish the entire private `.data/` directory or DSH credentials. Newly created user projects require explicit selection before export.

## Verification

- Root `npm test` runs the application tests in `cad-studio/test/`, including non-destructive previews and parameter validation.
- Root `npm run status` checks the existing application without opening a browser or creating a project.
- For documentation-only changes, verify paths and commands instead of rerunning CAD generation or paid model requests.
- Keep detailed project documentation under `docs/`. Preserve sample and research evidence paths, and link to their indexes rather than duplicating their assets.
