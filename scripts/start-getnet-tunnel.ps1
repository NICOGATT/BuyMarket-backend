param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflared) {
  throw "cloudflared no esta instalado. Descargalo desde https://developers.cloudflare.com/tunnel/downloads/ y agregalo al PATH."
}

Write-Output "Publicando $BaseUrl mediante un Quick Tunnel temporal."
Write-Output "Registra la URL https://....trycloudflare.com/payments/getnet/webhook en Getnet Homologacion."
Write-Output "La URL cambiara cuando cierres y vuelvas a iniciar este proceso."

& cloudflared tunnel --url $BaseUrl
