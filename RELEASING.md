# Releasing Region Spell Automation

Current release preparation: **v0.5.7**.
Tested on Foundry VTT v14 build 369 and D&D5e 6.0.6.

1. Run `./tests/run-tests.ps1` and `./tools/build-release.ps1`.
2. Commit release changes on the development branch, merge into main, and push main.
3. Create a GitHub release from main with the exact tag **v0.5.7** (lowercase v).
4. Use the title **Region Spell Automation v0.5.7** and paste the contents of
   `RELEASE-NOTES-0.5.7.md` as the release description.
5. Attach **both** `dist/module.json` and `dist/region-spell-automation.zip`.
   The generated dist folder is intentionally ignored by Git; upload assets manually.
6. Publish the release, then test installation/update in a separate Foundry data directory.
7. If listed in Foundry's package directory, register the new release there.

Stable installer manifest:
https://github.com/Ugmul-dnd/region-spell-automation/releases/latest/download/module.json

The release tag, ZIP filename, and manifest download URL must match exactly,
including capitalization. GitHub's automatic source archives are not the module ZIP.

For future releases, update `module.json` version and its pinned download URL,
update tested compatibility and notes, run tests, and rebuild the matching assets.
