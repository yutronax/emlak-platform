# Scraper bekçisi: worker (orchestrator.py) ve WhatsApp köprüsünü (bridge.js) çalışır tutar.
# Biri kapanırsa artan beklemeyle (5 sn -> en fazla 5 dk) yeniden başlatır.
# Loglar: %LOCALAPPDATA%\emlak-platform\logs (her süreç için ayrı, 5 MB üstü bir kez döndürülür).
# Elle çalıştırma:  powershell -ExecutionPolicy Bypass -File scraper\scripts\bekci.ps1
# Oturum açılışında otomatik başlatma: scraper\scripts\gorev-kaydet.ps1

$ErrorActionPreference = 'Stop'
$scraper = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $scraper
$logDir = Join-Path $env:LOCALAPPDATA 'emlak-platform\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

$python = @('.venv-verify', '.venv') |
    ForEach-Object { Join-Path $scraper "$_\Scripts\python.exe" } |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $python) { throw "Python sanal ortamı bulunamadı (scraper\.venv-verify veya scraper\.venv)." }
$node = (Get-Command node -ErrorAction Stop).Source

$services = @(
    @{ Name = 'worker'; Exe = $python; Dir = $scraper
       Args = @('-m', 'dotenv', '-f', '.env', 'run', '--', $python, 'orchestrator.py') },
    @{ Name = 'bridge'; Exe = $node; Dir = $root
       Args = @('--env-file=scraper/.env', 'scraper/sidecar/bridge.js') }
)
foreach ($s in $services) { $s.Proc = $null; $s.Delay = 5; $s.NextStart = [DateTime]::MinValue; $s.StartedAt = $null }

function Write-Log($msg) {
    $line = "{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $msg
    Add-Content -Path (Join-Path $logDir 'bekci.log') -Value $line -Encoding utf8
}

function Rotate($path) {
    if ((Test-Path $path) -and (Get-Item $path).Length -gt 5MB) { Move-Item -Force $path "$path.1" }
}

function Start-Service2($s) {
    $out = Join-Path $logDir "$($s.Name).log"; $err = Join-Path $logDir "$($s.Name).err.log"
    Rotate $out; Rotate $err
    $s.Proc = Start-Process -FilePath $s.Exe -ArgumentList $s.Args -WorkingDirectory $s.Dir `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    $null = $s.Proc.Handle  # tutamaç alınmazsa ExitCode kapanıştan sonra boş döner
    $s.StartedAt = Get-Date
    Write-Log "$($s.Name) başlatıldı (pid $($s.Proc.Id))"
}

Write-Log "bekçi başladı"
try {
    while ($true) {
        foreach ($s in $services) {
            if ($s.Proc -and -not $s.Proc.HasExited) {
                # 10 dk kesintisiz çalıştıysa bekleme süresi sıfırlanır.
                if (((Get-Date) - $s.StartedAt).TotalMinutes -ge 10) { $s.Delay = 5 }
                continue
            }
            if ($s.Proc) {
                Write-Log "$($s.Name) kapandı (çıkış kodu $($s.Proc.ExitCode)); $($s.Delay) sn sonra yeniden başlatılacak"
                $s.NextStart = (Get-Date).AddSeconds($s.Delay)
                $s.Delay = [Math]::Min($s.Delay * 2, 300)
                $s.Proc = $null
            }
            if ((Get-Date) -ge $s.NextStart) {
                try { Start-Service2 $s } catch { Write-Log "$($s.Name) başlatılamadı: $($_.Exception.Message)"; $s.NextStart = (Get-Date).AddSeconds(60) }
            }
        }
        Start-Sleep -Seconds 5
    }
} finally {
    foreach ($s in $services) { if ($s.Proc -and -not $s.Proc.HasExited) { Stop-Process -Id $s.Proc.Id -Force } }
    Write-Log "bekçi durdu"
}
