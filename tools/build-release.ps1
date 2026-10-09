$ErrorActionPreference = 'Stop'
$rsaRoot = Split-Path -Parent $PSScriptRoot
$rsaManifest = Get-Content -LiteralPath (Join-Path $rsaRoot 'module.json') -Raw | ConvertFrom-Json
$rsaExpectedDownload = "https://github.com/Ugmul-dnd/region-spell-automation/releases/download/v$($rsaManifest.version)/region-spell-automation.zip"
if ($rsaManifest.download -ne $rsaExpectedDownload) { throw 'Version and download URL do not match.' }
foreach ($rsaFile in @($rsaManifest.esmodules) + @($rsaManifest.styles)) {
    if (!(Test-Path -LiteralPath (Join-Path $rsaRoot $rsaFile))) { throw "Missing manifest file: $rsaFile" }
}
$rsaDist = Join-Path $rsaRoot 'dist'
New-Item -ItemType Directory -Path $rsaDist -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $rsaRoot 'module.json') -Destination (Join-Path $rsaDist 'module.json') -Force
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$rsaZipPath = Join-Path $rsaDist 'region-spell-automation.zip'
$rsaStream = [IO.File]::Open($rsaZipPath, [IO.FileMode]::Create)
$rsaArchive = [IO.Compression.ZipArchive]::new($rsaStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    $rsaFiles = @('module.json','README.md','STARTER-SPELLS.md','LICENSE') | ForEach-Object {Get-Item -LiteralPath (Join-Path $rsaRoot $_)}
    $rsaFiles += Get-ChildItem -LiteralPath (Join-Path $rsaRoot 'scripts'), (Join-Path $rsaRoot 'styles') -File -Recurse
    foreach ($rsaFile in $rsaFiles) {
        $rsaEntry = $rsaFile.FullName.Substring($rsaRoot.Length + 1).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($rsaArchive, $rsaFile.FullName, $rsaEntry) | Out-Null
    }
} finally { $rsaArchive.Dispose(); $rsaStream.Dispose() }
$rsaArchive = [IO.Compression.ZipFile]::OpenRead($rsaZipPath)
try {
    foreach ($rsaPath in @('module.json','LICENSE') + @($rsaManifest.esmodules) + @($rsaManifest.styles)) {
        if (!$rsaArchive.GetEntry($rsaPath)) {throw "ZIP is missing $rsaPath"}
    }
    $rsaReader = [IO.StreamReader]::new($rsaArchive.GetEntry('module.json').Open())
    try {$rsaArchivedManifest = $rsaReader.ReadToEnd()} finally {$rsaReader.Dispose()}
    if ($rsaArchivedManifest -ne [IO.File]::ReadAllText((Join-Path $rsaDist 'module.json'))) {throw 'ZIP manifest differs from release manifest.'}
} finally {$rsaArchive.Dispose()}
Write-Output "Built v$($rsaManifest.version): $rsaZipPath"
