#!/usr/bin/env pwsh
$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent

$exe=""
if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {
  # Fix case when both the Windows and Linux builds of Node
  # are installed in the same directory
  $exe=".exe"
}
$i18nShimPath=Join-Path $basedir "i18n-shim.mjs"
# Convert Windows path to file:// URL (required by node --import on Windows)
$i18nShim=[System.Uri]::new($i18nShimPath).AbsoluteUri
$cliEntry=Join-Path $basedir "node_modules/@minimax-ai/code/cli.js"
$ret=0
if (Test-Path "$basedir/node$exe") {
  # Support pipeline input
  if ($MyInvocation.ExpectingInput) {
    $input | & "$basedir/node$exe"  --import "$i18nShim" "$cliEntry" $args
  } else {
    & "$basedir/node$exe"  --import "$i18nShim" "$cliEntry" $args
  }
  $ret=$LASTEXITCODE
} else {
  # Support pipeline input
  if ($MyInvocation.ExpectingInput) {
    $input | & "node$exe"  --import "$i18nShim" "$cliEntry" $args
  } else {
    & "node$exe"  --import "$i18nShim" "$cliEntry" $args
  }
  $ret=$LASTEXITCODE
}
exit $ret