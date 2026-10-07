# Release checklist

## Current status

Version 0.5.6 is prepared locally on main, with release notes in CHANGELOG.md. Version 0.5.5 remains the previously published release until the new assets are uploaded. The module is licensed under MIT, copyright (c) 2026 Ugmul. Run tools/build-release.ps1 to build and verify the ZIP and separate manifest in dist/. Publishing remains manual.

## Enable Foundry manifest installation

1. Make the repository and release assets publicly accessible.
2. Confirm the distribution fields already configured in `module.json` match the first release:

```json
"url": "https://github.com/Ugmul-dnd/region-spell-automation",
"manifest": "https://github.com/Ugmul-dnd/region-spell-automation/releases/latest/download/module.json",
"download": "https://github.com/Ugmul-dnd/region-spell-automation/releases/download/v0.5.6/region-spell-automation.zip",
"bugs": "https://github.com/Ugmul-dnd/region-spell-automation/issues"
```

The v0.5.6 asset URLs become available after publishing the new release. Keep `manifest` stable for update checks and pin `download` to the specific version.

3. Create a ZIP with `module.json` and all files in `scripts/` at its root. Include `README.md`, `STARTER-SPELLS.md`, `CHANGELOG.md`, and `LICENSE`. Exclude `.git`, local configuration, and development-only files. The archived manifest must match the separately uploaded manifest.
4. Publish a regular GitHub release tagged `v0.5.6` with assets named exactly `module.json` and `region-spell-automation.zip`.
5. Test **Install Module → Manifest URL** using the stable URL. Use a separate Foundry test user-data directory to protect the development copy.
6. Test a later release through Foundry's update mechanism before claiming automatic updates work.

A GitHub Actions release workflow can automate validation, ZIP creation, and uploads. It is useful but not required. A Git tag or repository alone does not supply the named release assets.

## Searchable Foundry listing

Manifest installation can work before a listing exists. To appear in Foundry's searchable package installer, use the [Package Submission Form](https://foundryvtt.com/packages/submit). Foundry states that submitters must own an active Foundry VTT license. Follow current submission requirements and register subsequent versions with Foundry.

## Before public release

- Include the MIT `LICENSE` file in each release ZIP.
- Add a changelog beginning with documented changes, including the 0.5.5 end-turn skip. Avoid inventing prior release history.
- Record the actual Foundry and D&D5e builds tested.
- Test GM/player casting, two connected clients, simultaneous triggers, and concentration ending. The scripts do not explicitly select an authoritative client for cleanup or behavior attachment; confirm whether Foundry/system hook routing already guarantees one execution.
- Test all five events, Once Per Turn, target restoration, upcasting, and effect removal.
- Test referenced effects after copying spells between actors: Region Effects store UUIDs to configured source effects.
- Test concentration cleanup across scenes and multiple Regions linked to one item.
- Confirm a clean installation and every manifest script path in the ZIP.

## Subsequent releases

1. Update the manifest version, version-specific download URL, tested compatibility, and release notes.
2. Validate JSON and JavaScript syntax and run focused in-world checks.
3. Publish matching manifest and ZIP assets for the new tag.
4. Verify the stable manifest resolves to the intended release and Foundry detects the update.
5. Update the Foundry listing if registered.

## References

- [Foundry manifest documentation](https://foundryvtt.com/article/module-development/)
- [Foundry package management](https://foundryvtt.com/article/package-management/)
- [Foundry directory and submission requirements](https://foundryvtt.com/packages/)
