# After Effects köprüsü — hatasız çalıştırma için tek giriş noktası.
# Kullanım:
#   powershell -File video-calisma\after-effects\ae.ps1 -Betik <betik.jsx>                 # AE'yi gerekirse açar, betiği çalıştırır, log'u bekler
#   powershell -File video-calisma\after-effects\ae.ps1 -Render <proje.aep> -Comp <ad> -Cikti <cikti.mp4>
# Kurallar (öğrenilenler): yollar ASCII olmalı (C:\inza-ae); betik log'a "kuruldu"/"HATA" yazmalı; MP4 doğrudan değil Lossless AVI → ffmpeg.
param([string]$Betik, [string]$Render, [string]$Comp, [string]$Cikti, [int]$Bekle = 180)
$AE = "C:\Program Files\Adobe\Adobe After Effects 2023\Support Files"
$KOK = "C:\inza-ae"
New-Item -ItemType Directory -Force "$KOK\medya", "$KOK\cikti", "$KOK\betik", "$KOK\log" | Out-Null

function AE-Hazir {
    # AE açık değilse aç; eklentiler yüklenene kadar (basit betik cevap verene kadar) bekle
    if (-not (Get-Process AfterFX -ErrorAction SilentlyContinue)) {
        Write-Host "After Effects açılıyor..."
        Start-Process "$AE\AfterFX.exe"
    }
    $test = "$KOK\betik\_ping.jsx"; $cevap = "$KOK\log\_ping.txt"
    Remove-Item $cevap -ErrorAction SilentlyContinue
    'var f=new File("C:/inza-ae/log/_ping.txt");f.open("w");f.write("hazir "+app.version);f.close();' | Set-Content -Encoding utf8 $test
    for ($i = 0; $i -lt 60; $i++) {
        Start-Process "$AE\AfterFX.exe" -ArgumentList "-r", $test -WindowStyle Hidden
        Start-Sleep 5
        if (Test-Path $cevap) { Write-Host (Get-Content $cevap); return }
    }
    throw "After Effects cevap vermedi (açılışta bir pencere/uyarı açık olabilir)"
}

if ($Betik) {
    AE-Hazir
    $log = "$KOK\log\" + [IO.Path]::GetFileNameWithoutExtension($Betik) + ".txt"
    Remove-Item $log -ErrorAction SilentlyContinue
    Start-Process "$AE\AfterFX.exe" -ArgumentList "-r", (Resolve-Path $Betik)
    for ($i = 0; $i -lt $Bekle / 3; $i++) {
        Start-Sleep 3
        if ((Test-Path $log) -and (Select-String -Path $log -Pattern "kuruldu|HATA" -Quiet)) { Get-Content $log; break }
    }
    if (-not (Test-Path $log)) { Write-Host "UYARI: log oluşmadı — AE'de hata penceresi açık olabilir, ekran görüntüsü al" }
}

if ($Render) {
    $avi = [IO.Path]::ChangeExtension($Cikti, ".avi")
    & "$AE\aerender.exe" -project $Render -comp $Comp -OMtemplate "Lossless" -output $avi | Select-String "ERROR|Total Time"
    ffmpeg -v error -y -i $avi -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k $Cikti
    if (Test-Path $Cikti) { Remove-Item $avi; Write-Host "render: $Cikti" } else { Write-Host "UYARI: mp4 oluşmadı, AVI duruyor: $avi" }
}
