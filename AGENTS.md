# AGENTS.md

## Cursor Cloud specific instructions

This repository ("UsfmTools") is currently an empty project — initialized with only a `README.md`. There are no source files, dependencies, build systems, or services yet.

### Current State

- **No application to run** — the repo has no source code
- **No tests** — no test framework or test files exist
- **No linting** — no linter configuration exists
- **No dependencies** — no package manager lockfiles or dependency manifests

### When Code Is Added

Once source code is introduced, future agents should:

1. Check for a `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, or similar dependency manifest and install accordingly.
2. Look for lint/test/build scripts in the project configuration.
3. Update this file with relevant startup caveats and development notes.
