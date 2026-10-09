$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskBuiltPath = Join-Path $taskProjectRoot 'src-tauri/target-next/release/my-universe.exe'
$taskInstallDirectory = Join-Path $taskProjectRoot 'src-tauri/target/release'
$taskInstallPath = Join-Path $taskInstallDirectory 'my-universe.exe'
$taskStatusPath = Join-Path $taskProjectRoot '.desktop-update-status.json'
$taskDeadline = (Get-Date).AddHours(2)
@{status='pending';source=$taskBuiltPath;target=$taskInstallPath} | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding UTF8
while ((Get-Date) -lt $taskDeadline) {
    try {
        Copy-Item -LiteralPath $taskBuiltPath -Destination $taskInstallPath -Force
        $taskShell = New-Object -ComObject WScript.Shell
        $taskShortcut = $taskShell.CreateShortcut((Join-Path $taskProjectRoot 'my-universe.exe - 快捷方式.lnk'))
        $taskShortcut.TargetPath = $taskInstallPath
        $taskShortcut.WorkingDirectory = $taskInstallDirectory
        $taskShortcut.Description = 'MyUniverse'
        $taskShortcut.Save()
        @{status='installed';updatedAt=(Get-Date).ToString('o');sha256=(Get-FileHash -LiteralPath $taskInstallPath).Hash} | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding UTF8
        exit 0
    } catch { Start-Sleep -Seconds 5 }
}
@{status='timeout';source=$taskBuiltPath;target=$taskInstallPath} | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding UTF8
