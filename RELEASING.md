# Releasing Ugmuls 5.5e Automation

Prepared release: **v0.7.4**. Changes are in `CHANGELOG.md` and `RELEASE-NOTES-0.7.4.md`.

The notes and assets are prepared for v0.7.4. Merge and publish when ready.
Compatibility: Foundry VTT 14 and D&D5e 6.0.6. All 56 local regression test files pass.

Tests and build tooling are local-only and ignored by Git. Restore your local
tooling before running the commands below if those folders are absent.

1. Run available local regression checks (`node tests/<name>.test.mjs`), then `./tools/build-release.ps1`. Local tests/tools are ignored and excluded from the ZIP.
2. Commit release changes on the development branch, merge into main, and push main.
3. Create a GitHub release from main with the exact tag **v0.7.4** (lowercase v).
4. Use the title **Ugmuls 5.5e Automation v0.7.4** and the contents of
   `RELEASE-NOTES-0.7.4.md` as the release description.
5. Attach **both** `dist/module.json` and `dist/ugmuls-5-5e-automation.zip`.
   The generated dist folder is intentionally ignored by Git; upload assets manually.
6. Publish the release, then test installation/update in a separate Foundry data directory.
7. If listed in Foundry's package directory, register the new release there.

Stable installer manifest:
https://github.com/Ugmul-dnd/ugmuls-5-5e-automation/releases/latest/download/module.json

The release tag, ZIP filename, and manifest download URL must match exactly,
including capitalization. GitHub's automatic source archives are not the module ZIP.

For future releases, update `module.json` version and its pinned download URL,
update tested compatibility and notes, run tests, and rebuild the matching assets.
