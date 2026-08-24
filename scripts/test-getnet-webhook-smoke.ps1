param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Username = $env:GETNET_WEBHOOK_USERNAME,
  [string]$Password = $env:GETNET_WEBHOOK_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $Username -or -not $Password) {
  throw "Defini GETNET_WEBHOOK_USERNAME y GETNET_WEBHOOK_PASSWORD en la terminal o pasalos como parametros."
}

$endpoint = "$($BaseUrl.TrimEnd('/'))/payments/getnet/webhook"
$validStatus = & curl.exe --silent --output NUL --write-out "%{http_code}" `
  --user "${Username}:${Password}" `
  --header "Content-Type: application/json" `
  --data "{}" `
  $endpoint

if ($LASTEXITCODE -ne 0 -or $validStatus -ne "204") {
  throw "El webhook autenticado devolvio HTTP $validStatus; se esperaba 204."
}

$invalidStatus = & curl.exe --silent --output NUL --write-out "%{http_code}" `
  --user "${Username}:invalid-local-password" `
  --header "Content-Type: application/json" `
  --data "{}" `
  $endpoint

if ($LASTEXITCODE -ne 0 -or $invalidStatus -ne "401") {
  throw "El webhook con credenciales invalidas devolvio HTTP $invalidStatus; se esperaba 401."
}

Write-Output "Getnet webhook smoke OK: autenticado=204, credenciales_invalidas=401"
