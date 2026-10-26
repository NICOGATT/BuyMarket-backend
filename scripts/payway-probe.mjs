// Diagnostico: prueba variantes de notifications_url contra el sandbox de Payway
// para ver cual acepta. Lee las claves de variables de entorno (no las imprime).
//
//   PAYWAY_PRIVATE_KEY=... PAYWAY_PUBLIC_KEY=... PAYWAY_SITE_ID=... node scripts/payway-probe.mjs
const { PAYWAY_PRIVATE_KEY, PAYWAY_PUBLIC_KEY, PAYWAY_SITE_ID } = process.env;
if (!PAYWAY_PRIVATE_KEY || !PAYWAY_PUBLIC_KEY || !PAYWAY_SITE_ID) {
  console.error('Faltan PAYWAY_PRIVATE_KEY, PAYWAY_PUBLIC_KEY o PAYWAY_SITE_ID');
  process.exit(1);
}

const API = 'https://developers.decidir.com/api/v1/checkout-payment-button/link';
const STAGING = 'https://buymarket-backend-staging.up.railway.app';
const ID = 'ca2562bb-b083-465d-b707-b90ae7096084';

const variants = {
  'A actual (railway + /payments/payway/webhook/<uuid>)': `${STAGING}/payments/payway/webhook/${ID}`,
  'B railway, ruta corta sin payway': `${STAGING}/payments/hook/${ID}`,
  'C railway, ruta con query': `${STAGING}/payments/payway/webhook?attempt=${ID}`,
  'D railway, solo raiz': `${STAGING}/`,
  'E otro dominio (vercel)': 'https://buy-market-c6l8w0xuc-nicodev1.vercel.app/api/payway',
  'F dominio neutro': 'https://example.com/webhook',
  'G sin notifications_url': undefined,
};

for (const [name, notificationsUrl] of Object.entries(variants)) {
  const body = {
    origin_platform: 'SDK-Node',
    payment_description: 'probe',
    currency: 'ARS',
    total_price: 100,
    site: PAYWAY_SITE_ID,
    success_url: 'https://www.buymarket.com.ar/checkout/success',
    cancel_url: 'https://www.buymarket.com.ar/checkout/failure',
    template_id: 1,
    installments: [1],
    plan_gobierno: false,
    public_apikey: PAYWAY_PUBLIC_KEY,
    auth_3ds: false,
  };
  if (notificationsUrl) body.notifications_url = notificationsUrl;

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: PAYWAY_PRIVATE_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = (await res.text())
    .replace(/"(apikey|public_apikey|private_apikey|token)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .slice(0, 250);
  console.log(`${name}\n  -> ${res.status} ${text}\n`);
}
