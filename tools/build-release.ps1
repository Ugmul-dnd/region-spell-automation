$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$rsaRoot = Split-Path -Parent $PSScriptRoot
$rsaManifest = Get-Content -LiteralPath (Join-Path $rsaRoot 'module.json') -Raw | ConvertFrom-Json
$rsaExpectedDownload = "https://github.com/Ugmul-dnd/region-spell-automation/releases/download/v$($rsaManifest.version)/region-spell-automation.zip"
if ($rsaManifest.download -ne $rsaExpectedDownload) { throw 'Manifest download URL does not match the version.' }
foreach ($rsaScript in $rsaManifest.esmodules) {
    if (-not (Test-Path -LiteralPath (Join-Path $rsaRoot $rsaScript) -PathType Leaf)) { throw "Missing module script: $rsaScript" }
}
$rsaFiles = @('module.json','README.md','STARTER-SPELLS.md','CHANGELOG.md','LICENSE')
$rsaFiles += @(Get-ChildItem -LiteralPath (Join-Path $rsaRoot 'scripts') -File -Recurse | ForEach-Object {
    $_.FullName.Substring($rsaRoot.Length + 1).Replace('\','/')
})
foreach ($rsaFile in $rsaFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $rsaRoot $rsaFile) -PathType Leaf)) { throw "Missing release file: $rsaFile" }
}
$rsaDist = Join-Path $rsaRoot 'dist'
New-Item -ItemType Directory -Path $rsaDist -Force | Out-Null
$rsaTemporaryZip = Join-Path $rsaDist ([guid]::NewGuid().ToString('N') + '.zip')
$rsaArchive = [System.IO.Compression.ZipFile]::Open($rsaTemporaryZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($rsaFile in $rsaFiles) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($rsaArchive,
            (Join-Path $rsaRoot $rsaFile), $rsaFile, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $rsaArchive.Dispose() }
$rsaArchive = [System.IO.Compression.ZipFile]::OpenRead($rsaTemporaryZip)
try {
    if ($rsaArchive.Entries.Count -ne $rsaFiles.Count) { throw 'Unexpected ZIP entry count.' }
    foreach ($rsaFile in $rsaFiles) {
        $rsaEntry = $rsaArchive.GetEntry($rsaFile)
        if (-not $rsaEntry) { throw "Missing ZIP entry: $rsaFile" }
        $rsaStream = $rsaEntry.Open()
        $rsaHasher = [System.Security.Cryptography.SHA256]::Create()
        try { $rsaHash = [BitConverter]::ToString($rsaHasher.ComputeHash($rsaStream)).Replace('-','') }
        finally { $rsaStream.Dispose(); $rsaHasher.Dispose() }
        if ($rsaHash -ne (Get-FileHash -LiteralPath (Join-Path $rsaRoot $rsaFile) -Algorithm SHA256).Hash) {
            throw "Archive differs from source: $rsaFile"
        }
    }
} finally { $rsaArchive.Dispose() }
$rsaZipPath = Join-Path $rsaDist 'region-spell-automation.zip'
Move-Item -LiteralPath $rsaTemporaryZip -Destination $rsaZipPath -Force
Copy-Item -LiteralPath (Join-Path $rsaRoot 'module.json') -Destination (Join-Path $rsaDist 'module.json') -Force
Write-Output "Verified release $($rsaManifest.version): $($rsaFiles.Count) files packaged."
Get-Item -LiteralPath $rsaZipPath | Select-Object FullName, Length
