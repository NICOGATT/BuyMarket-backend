param(
  [int]$Port = 3000,
  [string]$Username = $env:GETNET_WEBHOOK_USERNAME,
  [string]$Password = $env:GETNET_WEBHOOK_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $Username -or -not $Password) {
  throw "Defini GETNET_WEBHOOK_USERNAME y GETNET_WEBHOOK_PASSWORD en esta terminal antes de iniciar el backend local."
}

$env:NODE_ENV = "development"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "55432"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:DB_DATABASE = "buymarket_webhook_test"
$env:PORT = "$Port"
$env:GETNET_WEBHOOK_USERNAME = $Username
$env:GETNET_WEBHOOK_PASSWORD = $Password
if ($env:GETNET_WEBHOOK_AUTH_MODE) {
  Write-Output "ADVERTENCIA: GETNET_WEBHOOK_AUTH_MODE=$($env:GETNET_WEBHOOK_AUTH_MODE) (solo valido en local/UAT)."
}

Write-Output "Iniciando BuyMarket en http://localhost:$Port contra buymarket_webhook_test."
Write-Output "La configuracion normal de base de datos queda reemplazada solo para este proceso."

npm run start:dev
