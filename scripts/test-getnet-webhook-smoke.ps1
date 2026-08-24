param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Username = $env:GETNET_WEBHOOK_USERNAME,
  [string]$Password = $env:GETNET_WEBHOOK_PASSWORD
)

$ErrorActionPreference = "Stop"

if ($env:GETNET_WEBHOOK_AUTH_MODE -eq "none") {
  # Modo sin autenticacion (solo UAT/local): el smoke valida que sin credenciales responde 200.
  $endpoint = "$($BaseUrl.TrimEnd('/'))/payments/getnet/webhook"
  $openStatus = & curl.exe --silent --output NUL --write-out "%{http_code}" `
    --header "Content-Type: application/json" `
    --data "{}" `
    $endpoint

  if ($LASTEXITCODE -ne 0 -or $openStatus -ne "200") {
    throw "El webhook en modo none devolvio HTTP $openStatus; se esperaba 200."
  }

  Write-Output "Getnet webhook smoke OK (AUTH_MODE=none): evento_vacio=200"
  exit 0
}

if (-not $Username -or -not $Password) {
  throw "Defini GETNET_WEBHOOK_USERNAME y GETNET_WEBHOOK_PASSWORD en la terminal o pasalos como parametros."
}

$endpoint = "$($BaseUrl.TrimEnd('/'))/payments/getnet/webhook"
$validStatus = & curl.exe --silent --output NUL --write-out "%{http_code}" `
  --user "${Username}:${Password}" `
  --header "Content-Type: application/json" `
  --data "{}" `
  $endpoint

if ($LASTEXITCODE -ne 0 -or $validStatus -ne "200") {
  throw "El webhook autenticado devolvio HTTP $validStatus; se esperaba 200."
}

$invalidStatus = & curl.exe --silent --output NUL --write-out "%{http_code}" `
  --user "${Username}:invalid-local-password" `
  --header "Content-Type: application/json" `
  --data "{}" `
  $endpoint

if ($LASTEXITCODE -ne 0 -or $invalidStatus -ne "401") {
  throw "El webhook con credenciales invalidas devolvio HTTP $invalidStatus; se esperaba 401."
}

Write-Output "Getnet webhook smoke OK: autenticado=200, credenciales_invalidas=401"
