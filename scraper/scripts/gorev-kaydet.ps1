# Bekçiyi Windows oturumu açılınca başlatan Görev Zamanlayıcı kaydı (yönetici yetkisi gerekmez).
# Kaldırmak için:  Unregister-ScheduledTask -TaskName 'EmlakScraperBekci' -Confirm:$false
$bekci = Join-Path $PSScriptRoot 'bekci.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$bekci`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# Görev kendisi de çökerse 1 dk arayla 3 kez yeniden denenir; süre sınırı yok.
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'EmlakScraperBekci' -Action $action -Trigger $trigger -Settings $settings `
    -Description 'emlak-platform scraper worker + WhatsApp köprüsü bekçisi' -Force | Out-Null
Write-Host "Kaydedildi. Hemen başlatmak için: Start-ScheduledTask -TaskName 'EmlakScraperBekci'"
