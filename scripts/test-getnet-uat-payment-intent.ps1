<#
.SYNOPSIS
  Smoke UAT de Getnet Web Checkout: OAuth + creacion de una intencion de pago.

.DESCRIPTION
  Paso 1 y 2 del plan de homologacion:
    1. OAuth client_credentials contra GETNET_API_URL.
    2. Creacion real de una intencion con una orden de prueba existente.
  El script imprime payment_intent_id y checkout_url para abrir el checkout.
  No acepta credenciales embebidas: se leen solo del entorno.

.EXAMPLE
  $env:GETNET_CLIENT_ID = "..."      # valor entregado por Getnet
  $env:GETNET_CLIENT_SECRET = "..."  # valor entregado por Getnet
  .\scripts\test-getnet-uat-payment-intent.ps1 -OrderId "uuid-de-orden" -AmountPesos 15000
#>
param(
  [Parameter(Mandatory = $true)][string]$OrderId,
  [Parameter(Mandatory = $true)][number]$AmountPesos,
  [string]$ApiUrl = $env:GETNET_API_URL,
  [string]$ClientId = $env:GETNET_CLIENT_ID,
  [string]$ClientSecret = $env:GETNET_CLIENT_SECRET,
  [string]$IntentPath = $(if ($env:GETNET_PAYMENT_INTENT_PATH) { $env:GETNET_PAYMENT_INTENT_PATH } else { "/digital-checkout/v1/payment-intent" }),
  [ValidateSet("cents", "pesos")]
  [string]$AmountUnit = $(if ($env:GETNET_AMOUNT_UNIT) { $env:GETNET_AMOUNT_UNIT } else { "cents" })
)

$ErrorActionPreference = "Stop"

if (-not $ApiUrl) { throw "Defini GETNET_API_URL (UAT: https://api.pre.globalgetnet.com)." }
if (-not $ClientId -or -not $ClientSecret) {
  throw "Defini GETNET_CLIENT_ID y GETNET_CLIENT_SECRET en la terminal. No los escribas nunca en scripts ni commits."
}

$amount = if ($AmountUnit -eq "cents") { [long]($AmountPesos * 100) } else { $AmountPesos }

# --- Paso 1: OAuth ---
$tokenResponse = & curl.exe --silent --show-error --fail-with-body `
  --header "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "grant_type=client_credentials" `
  --data-urlencode "client_id=$ClientId" `
  --data-urlencode "client_secret=$ClientSecret" `
  "$($ApiUrl.TrimEnd('/'))/authentication/oauth2/access_token" | ConvertFrom-Json

if (-not $tokenResponse.access_token) {
  throw "OAuth fallo: Getnet no devolvio access_token."
}
Write-Output "[1/2] OAuth OK (expires_in=$($tokenResponse.expires_in)s). Token no se muestra."

# --- Paso 2: Payment intent ---
$body = @{
  order_id = $OrderId
  customer = @{
    first_name = "Test"
    last_name  = "User"
    email      = "test@mail.com"
  }
  payment  = @{
    currency = "ARS"
    amount   = $amount
  }
} | ConvertTo-Json -Depth 5

$intentRaw = & curl.exe --silent --show-error --fail-with-body `
  --header "Content-Type: application/json" `
  --header "Accept: application/json" `
  --header "Authorization: Bearer $($tokenResponse.access_token)" `
  --data $body `
  "$($ApiUrl.TrimEnd('/'))$IntentPath"

$intent = $intentRaw | ConvertFrom-Json

if (-not $intent.payment_intent_id) {
  throw "Getnet no devolvio payment_intent_id. Respuesta: $intentRaw"
}

Write-Output "[2/2] Payment intent creado."
Write-Output "payment_intent_id: $($intent.payment_intent_id)"
if ($intent.checkout_url) {
  Write-Output "checkout_url: $($intent.checkout_url)"
  Write-Output "Paso 3: abri esa URL en el navegador y completa el pago con una tarjeta UAT."
} else {
  Write-Output "checkout_url no devuelta: si usas modalidad iframe, carga loader.init({ paymentIntentId: '$($intent.payment_intent_id)' })."
}
Write-Output "Paso 4: espera el webhook y verifica el estado de la orden, wallets y notificaciones en la base."
