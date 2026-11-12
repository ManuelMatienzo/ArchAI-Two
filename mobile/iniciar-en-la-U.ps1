# Script de inicio - ArchAI Mobile para la U (sin WiFi)
# Ejecuta este archivo en PowerShell desde la carpeta mobile

$ErrorActionPreference = 'Stop'
$mobileDir = $PSScriptRoot
$backendDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'

Write-Host "================================================"
Write-Host "ARCHAI MOBILE - Inicio para la U"
Write-Host "================================================"
Write-Host ""

# 1. Detectar IP local
Write-Host "Detectando tu IP local..."
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
if (-not $ip) {
    $ip = "10.83.171.106"
}
Write-Host "Tu IP local es: $ip" -ForegroundColor Green

$backendUrl = "http://$ip:8000/api/v1"
$expoUrl = "exp://$ip:8081"

# 2. Verificar backend
Write-Host ""
Write-Host "Verificando backend Spring Boot..."
try {
    $status = (Invoke-WebRequest -Uri "http://localhost:8000/api/v1/auth/status" -UseBasicParsing -TimeoutSec 5).StatusCode
    if ($status -eq 200) {
        Write-Host "Backend ya esta corriendo en puerto 8000" -ForegroundColor Green
    }
} catch {
    Write-Host "Backend no esta corriendo. Inicialo manualmente:" -ForegroundColor Red
    Write-Host "  cd $backendDir"
    Write-Host "  .\mvnw.cmd spring-boot:run"
}

# 3. Guardar configuracion
Write-Host ""
Write-Host "Guardando configuracion para el móvil..."
$config = @{
    ip = $ip
    backendUrl = $backendUrl
    expoUrl = $expoUrl
    fecha = Get-Date
} | ConvertTo-Json -Depth 3
$config | Set-Content "$mobileDir\config-movil.json"
Write-Host "Configuracion guardada en config-movil.json" -ForegroundColor Green

# 4. Mostrar instrucciones
Write-Host ""
Write-Host "================================================"
Write-Host "INSTRUCCIONES PARA TU CELULAR"
Write-Host "================================================"
Write-Host ""
Write-Host "1. Abre el navegador de tu celular y entra a:"
Write-Host "   http://$ip:8000/api/v1/auth/status"
Write-Host "   (Si carga, tu celular puede alcanzar tu PC)"
Write-Host ""
Write-Host "2. En la app ArchAI Mobile, configura el backend:"
Write-Host "   $backendUrl"
Write-Host ""
Write-Host "3. Para conectar con Expo, usa:"
Write-Host "   $expoUrl"
Write-Host ""
Write-Host "4. O escanea el QR code que mostrara Expo abajo"
Write-Host ""
Write-Host "ADVERTENCIA: Si tu celular no puede alcanzar la PC,"
Write-Host "Comprueba que la red sea privada y permita el acceso al puerto del backend."
Write-Host ""
Write-Host "================================================"
Write-Host ""

# 5. Iniciar Expo con tunel
Write-Host "Iniciando Expo con tunel (--tunnel)..."
Write-Host "Esto creara una URL publica que tu celular puede alcanzar."
Write-Host ""
Write-Host "Espera 10-15 segundos y busca la URL del tunel."
Write-Host "Cuando Expo muestre el QR code, escanelo con tu celular."
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar este script..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Iniciar Expo en background
Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'npx expo start --tunnel' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
