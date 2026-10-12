$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'run-tests.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Module test suites failed.' }
