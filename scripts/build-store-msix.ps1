param(
  [Parameter(Mandatory = $true)]
  [string]$PackageIdentityName,

  [Parameter(Mandatory = $true)]
  [string]$Publisher,

  [Parameter(Mandatory = $true)]
  [string]$PublisherDisplayName,

  [string]$Version = "0.1.0.0",

  [string]$OutputPath = "artifacts\store\Nimbi.msix"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriRoot = Join-Path $repoRoot "src-tauri"
$exePath = Join-Path $tauriRoot "target\release\nimbi.exe"
$templatePath = Join-Path $tauriRoot "store\AppxManifest.template.xml"
$stage = Join-Path $repoRoot "artifacts\store\stage"
$outputFull = Join-Path $repoRoot $OutputPath

if (-not (Test-Path $exePath)) {
  throw "Release executable not found at $exePath. Run npm run tauri:build -- --no-bundle first."
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
  throw "MSIX version must have four numeric components, for example 0.1.0.0."
}

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stage "Assets") | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $outputFull -Parent) | Out-Null

Copy-Item $exePath (Join-Path $stage "nimbi.exe")

$manifest = Get-Content $templatePath -Raw
$manifest = $manifest.Replace("__PACKAGE_IDENTITY_NAME__", $PackageIdentityName)
$manifest = $manifest.Replace("__PUBLISHER__", $Publisher)
$manifest = $manifest.Replace("__PUBLISHER_DISPLAY_NAME__", $PublisherDisplayName)
$manifest = $manifest.Replace("__VERSION__", $Version)
Set-Content -Path (Join-Path $stage "AppxManifest.xml") -Value $manifest -Encoding UTF8

Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
if ($null -eq $icon) {
  throw "Unable to extract application icon from $exePath."
}
$source = $icon.ToBitmap()

function Write-PngAsset {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [int]$Width,
    [Parameter(Mandatory = $true)]
    [int]$Height
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  $scale = [Math]::Min($Width / $source.Width, $Height / $source.Height)
  $drawWidth = [int]($source.Width * $scale)
  $drawHeight = [int]($source.Height * $scale)
  $x = [int](($Width - $drawWidth) / 2)
  $y = [int](($Height - $drawHeight) / 2)

  $graphics.DrawImage($source, $x, $y, $drawWidth, $drawHeight)
  $assetPath = Join-Path $stage "Assets\$Name"
  $bitmap.Save($assetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-PngAsset -Name "StoreLogo.png" -Width 50 -Height 50
Write-PngAsset -Name "Square44x44Logo.png" -Width 44 -Height 44
Write-PngAsset -Name "Square150x150Logo.png" -Width 150 -Height 150
Write-PngAsset -Name "Wide310x150Logo.png" -Width 310 -Height 150
Write-PngAsset -Name "Square310x310Logo.png" -Width 310 -Height 310

$source.Dispose()
$icon.Dispose()

$makeAppx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Filter makeappx.exe -Recurse -ErrorAction Stop |
  Where-Object { $_.FullName -match '\\x64\\makeappx\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1

if ($null -eq $makeAppx) {
  throw "makeappx.exe was not found in the Windows SDK."
}

Remove-Item $outputFull -Force -ErrorAction SilentlyContinue
& $makeAppx.FullName pack /d $stage /p $outputFull /o
if ($LASTEXITCODE -ne 0) {
  throw "MakeAppx failed with exit code $LASTEXITCODE."
}

Write-Host "Created unsigned Store package: $outputFull"
