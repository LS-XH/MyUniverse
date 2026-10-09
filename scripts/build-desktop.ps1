$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskPreviousTarget = $env:CARGO_TARGET_DIR
Push-Location -LiteralPath $taskProjectRoot
try {
    # Build separately so a running release executable cannot interrupt compilation.
    $env:CARGO_TARGET_DIR = Join-Path $taskProjectRoot 'src-tauri/target-next'
    & npm run tauri build -- --no-bundle
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    $taskBuiltExe = Join-Path $env:CARGO_TARGET_DIR 'release/my-universe.exe'
    $taskReleaseDirectory = Join-Path $taskProjectRoot 'src-tauri/target/release'
    $taskReleaseExe = Join-Path $taskReleaseDirectory 'my-universe.exe'
    New-Item -ItemType Directory -Path $taskReleaseDirectory -Force | Out-Null
    try { Copy-Item -LiteralPath $taskBuiltExe -Destination $taskReleaseExe -Force }
    catch {
        $taskInstaller = Join-Path $PSScriptRoot 'install-desktop.ps1'
        Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-File',('"' + $taskInstaller + '"')) -WindowStyle Hidden
        Write-Output "Built: $taskBuiltExe. Automatic replacement queued until the current application releases the file."
        return
    }
    $taskShortcutShell = New-Object -ComObject WScript.Shell
    $taskShortcut = $taskShortcutShell.CreateShortcut((Join-Path $taskProjectRoot 'my-universe.exe - 快捷方式.lnk'))
    $taskShortcut.TargetPath = $taskReleaseExe
    $taskShortcut.WorkingDirectory = $taskReleaseDirectory
    $taskShortcut.Description = 'MyUniverse'
    $taskShortcut.Save()
    Write-Output "Updated: $taskReleaseExe"
    Write-Output 'Updated project-root shortcut.'
}
finally {
    $env:CARGO_TARGET_DIR = $taskPreviousTarget
    Pop-Location
}
