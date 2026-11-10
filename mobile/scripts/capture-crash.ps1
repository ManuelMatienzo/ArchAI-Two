<#
.SYNOPSIS
    Captura el error real que cierra la app ArchAI Mobile en un teléfono Android.

.DESCRIPTION
    Se conecta al teléfono por ADB y guarda en `logs/` todo lo que Android registra
    mientras reproduces el fallo: excepciones de Java/Kotlin (AndroidRuntime),
    errores de JavaScript (ReactNativeJS), fallos nativos (SIGSEGV, libc) y
    mensajes de Expo.

    Uso típico:
        1. Activa "Depuración USB" en el teléfono y conéctalo por cable.
        2. Ejecuta:  powershell -ExecutionPolicy Bypass -File scripts/capture-crash.ps1
        3. En el teléfono abre la app y entra a la sala hasta que falle.
        4. Vuelve a esta ventana y pulsa Ctrl+C.
        5. El archivo `logs/crash-<fecha>.log` contiene la causa.

.PARAMETER Dump
    No se queda escuchando: vuelca lo que ya está en el búfer del teléfono.
    Útil justo después de que la app se haya cerrado.

.PARAMETER Tag
    Filtro adicional (por defecto se capturan todas las líneas relevantes).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/capture-crash.ps1
    powershell -ExecutionPolicy Bypass -File scripts/capture-crash.ps1 -Dump
#>
[CmdletBinding()]
param(
    [switch]$Dump,
    [string]$Tag = ''
)

$ErrorActionPreference = 'Stop'

function Find-Adb {
    $candidates = @()
    if ($env:ANDROID_HOME) { $candidates += (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') }
    if ($env:ANDROID_SDK_ROOT) { $candidates += (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe') }
    $candidates += (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')

    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$adb = Find-Adb
if (-not $adb) {
    Write-Host 'No se encontro adb.' -ForegroundColor Red
    Write-Host 'Instala las Android Platform Tools o define ANDROID_HOME.' -ForegroundColor Yellow
    exit 1
}

Write-Host "adb: $adb" -ForegroundColor DarkGray

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' }
if (-not $devices) {
    Write-Host ''
    Write-Host 'No hay ningun telefono autorizado conectado.' -ForegroundColor Yellow
    Write-Host 'Pasos para habilitarlo:' -ForegroundColor Yellow
    Write-Host '  1. Ajustes > Acerca del telefono > toca 7 veces "Numero de compilacion".'
    Write-Host '  2. Ajustes > Sistema > Opciones de desarrollador > activa "Depuracion USB".'
    Write-Host '  3. Conecta el cable USB y acepta el aviso "Permitir depuracion USB".'
    Write-Host '  4. Vuelve a ejecutar este script.'
    Write-Host ''
    Write-Host 'Alternativa sin cable: ejecuta la app y copia el texto rojo que aparece en la' -ForegroundColor Yellow
    Write-Host 'terminal donde corre "npm start" (Metro muestra el error de JavaScript ahi).'
    Write-Host ''
    & $adb devices -l
    exit 1
}

$logDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "crash-$stamp.log"

$pattern = 'AndroidRuntime|ReactNativeJS|FATAL EXCEPTION|SIGSEGV|SIGABRT|libc|ExpoModulesCore|ReactNative|Hermes|art\s|ActivityManager|com\.archai|expo\.modules|SoLoader|UnsatisfiedLinkError|OutOfMemoryError'
if ($Tag) { $pattern = "$pattern|$Tag" }

if ($Dump) {
    Write-Host "Volcando el bufer actual del telefono..." -ForegroundColor Cyan
    & $adb logcat -d -v time | Select-String -Pattern $pattern | ForEach-Object { $_.Line } |
        Set-Content -Path $logFile -Encoding UTF8
    Write-Host "Guardado en: $logFile" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Ultimas lineas relevantes:' -ForegroundColor Cyan
    Get-Content $logFile -Tail 40
    exit 0
}

Write-Host "Limpiando el bufer del telefono..." -ForegroundColor Cyan
& $adb logcat -c

Write-Host ''
Write-Host 'Grabando. Reproduce el fallo en el telefono y luego pulsa Ctrl+C.' -ForegroundColor Green
Write-Host "Archivo: $logFile" -ForegroundColor DarkGray
Write-Host ''

$process = Start-Process -FilePath $adb -ArgumentList @('logcat', '-v', 'time') `
    -RedirectStandardOutput $logFile -NoNewWindow -PassThru

try {
    Write-Host 'Esperando el fallo... (Ctrl+C para terminar)' -ForegroundColor DarkGray
    while (-not $process.HasExited) { Start-Sleep -Milliseconds 500 }
}
finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }

    $relevant = Select-String -Path $logFile -Pattern $pattern | ForEach-Object { $_.Line }
    $relevant | Set-Content -Path $logFile -Encoding UTF8

    Write-Host ''
    Write-Host "Captura guardada en: $logFile" -ForegroundColor Green

    $fatal = $relevant | Select-String -Pattern 'FATAL EXCEPTION|SIGSEGV|SIGABRT|OutOfMemoryError|ReactNativeJS.*(Error|error)'
    if ($fatal) {
        Write-Host ''
        Write-Host 'Causa probable:' -ForegroundColor Red
        $fatal | Select-Object -First 25 | ForEach-Object { Write-Host $_.Line }
    } else {
        Write-Host 'No se detecto una excepcion fatal en la captura.' -ForegroundColor Yellow
    }
}
