# Script para abrir puertos de firewall y conectar ArchAI Mobile
# Ejecutar como ADMINISTRADOR en PowerShell

$ErrorActionPreference = 'Continue'

Write-Host "================================================"
Write-Host "ABRIENDO PUERTOS Y CONECTANDO ARCHAI MOBILE"
Write-Host "================================================"
Write-Host ""

# Detectar IP local
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "192.168.113.140" }

Write-Host "Tu IP local: $ip" -ForegroundColor Green
Write-Host ""

# 1. Abrir puerto 8000 (Backend Spring Boot)
Write-Host "Abriendo puerto 8000 en el firewall..."
New-NetFirewallRule -DisplayName "ArchAI Backend 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Profile Private -RemoteAddress LocalSubnet -Action Allow -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) { Write-Host "  Puerto 8000 abierto" -ForegroundColor Green } else { Write-Host "  No se pudo abrir el puerto 8000 (quizas ya estaba abierto)" -ForegroundColor Yellow }

# 2. Abrir puerto 8081 (Expo Metro)
Write-Host "Abriendo puerto 8081 en el firewall..."
New-NetFirewallRule -DisplayName "ArchAI Expo 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Profile Private -RemoteAddress LocalSubnet -Action Allow -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) { Write-Host "  Puerto 8081 abierto" -ForegroundColor Green } else { Write-Host "  No se pudo abrir el puerto 8081 (quizas ya estaba abierto)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "================================================"
Write-Host "URLS PARA TU CELULAR"
Write-Host "================================================"
Write-Host ""
Write-Host "Backend:   http://$ip:8000/api/v1/auth/status"
Write-Host "Expo:      exp://$ip:8081"
Write-Host ""
Write-Host "PASOS EN TU CELULAR:"
Write-Host "1. Abre el navegador y entra a: http://$ip:8000/api/v1/auth/status"
Write-Host "   (Si carga, tu celular puede alcanzar tu PC)"
Write-Host ""
Write-Host "2. En la app ArchAI Mobile, configura el backend como:"
Write-Host "   http://$ip:8000/api/v1"
Write-Host ""
Write-Host "3. Para conectar con Expo, usa:"
Write-Host "   exp://$ip:8081"
Write-Host ""
Write-Host "4. O escanea el QR code que mostrara Expo"
Write-Host ""
Write-Host "================================================"
Write-Host ""

# 3. Verificar si el backend responde desde localhost
Write-Host "Verificando backend localmente..."
try {
    $status = (Invoke-WebRequest -Uri "http://localhost:8000/api/v1/auth/status" -UseBasicParsing -TimeoutSec 5).StatusCode
    Write-Host "Backend responde en localhost: $status" -ForegroundColor Green
} catch {
    Write-Host "Backend no responde en localhost. Inicialo primero." -ForegroundColor Red
}

# 4. Iniciar Expo con tunel en background
Write-Host ""
Write-Host "Iniciando Expo con tunel..."
Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'npx expo start --tunnel' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

Write-Host "Espera 15 segundos y busca la URL del tunel en la ventana de Expo."
Write-Host ""
Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")