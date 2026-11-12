# Project working notes

## Scope and entry points

- This workspace contains 构形 CAD, a local conversational CAD application built on DeepSeek Harness.
- The primary application is `cad-studio/`. Root `start.cmd` and `npm start` launch it at 127.0.0.1:3090.
- `start-harness.cmd` and `npm run harness` retain access to the original DSH web app.
- Read root `README.md` for current scope, then `cad-studio/README.md` for implementation details.

## Keep it simple

- Default to the existing single-user local architecture. Do not add cloud hosting, accounts, third-party integrations, or new frameworks without a task requiring them.
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
