<#
.SYNOPSIS
  Reenvia un payload de webhook de Getnet al backend local para probar idempotencia.

.DESCRIPTION
  Paso 7 del plan UAT: reintentar el mismo evento y confirmar que la orden no
  cambia, que no se duplican saldos ni notificaciones.
  El payload se lee de un archivo JSON (nunca incrustes credenciales ahi).

.EXAMPLE
  .\scripts\replay-getnet-webhook.ps1 -PayloadFile .\webhook-aprobado.json
#>
param(
  [Parameter(Mandatory = $true)][string]$PayloadFile,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Username = $env:GETNET_WEBHOOK_USERNAME,
  [string]$Password = $env:GETNET_WEBHOOK_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PayloadFile)) {
  throw "No existe el archivo de payload: $PayloadFile"
}

$endpoint = "$($BaseUrl.TrimEnd('/'))/payments/getnet/webhook"
$headers = @()

if ($env:GETNET_WEBHOOK_AUTH_MODE -ne "none") {
  if (-not $Username -or -not $Password) {
    throw "Defini GETNET_WEBHOOK_USERNAME y GETNET_WEBHOOK_PASSWORD o usa GETNET_WEBHOOK_AUTH_MODE=none en local."
  }
  $headers += "--user", "${Username}:${Password}"
}

$status = & curl.exe --silent --output NUL --write-out "%{http_code}" `
  @headers `
  --header "Content-Type: application/json" `
  --data "@$PayloadFile" `
  $endpoint

if ($LASTEXITCODE -ne 0 -or $status -ne "200") {
  throw "El replay devolvio HTTP $status; se esperaba 200."
}

Write-Output "Replay OK: HTTP 200. Verifica en la base que orden, wallets y notificaciones no hayan cambiado."
