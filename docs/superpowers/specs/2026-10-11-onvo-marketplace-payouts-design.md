# Onvo Marketplace: cobro con split a comercios — Design

- Date: 2026-10-11
- Status: approved by owner, pending spec review
- Scope: ventas de productos de la app cliente (tarjeta/SINPE vía Onvo). Publicidad,
  recargas y pagos directos quedan 100% en la cuenta primaria (sin cambios).
- Sources: `docs.onvopay.com/payments/marketplaces.md` + API de cuentas conectadas.

## 1. Goal

Cada comercio recibe en su propio IBAN las ventas de la app cliente con split
automático de Onvo; Kiwi retiene su comisión sin tocar el dinero manualmente.
El KYC manual con flag de admin (`cardPaymentsEnabled`) se vuelve automático.

## 2. Non-goals

- No cambia el flujo de repartidores (retiros) ni el checkout actual como fallback.
- Sin tarifa semanal al inicio (`marketplaceWeeklyFeeEnabled: false`).
- Sin onboarding fuera de Onvo: el KYC lo aloja Onvo, Kiwi solo muestra el link.

## 3. Mecánica Onvo (verificada en docs)

- La cuenta primaria (Kiwi) crea cuentas conectadas: `POST /v1/connected-accounts`
  con `businessName` (1–50) + `marketplaceAppFee` (0–100, 2 decimales). Retorna
  `id`, `status: pending_onboarding` y `onboardingUrl` (sensible: no va a logs).
- El comercio completa el onboarding alojado (IBAN de liquidación). Link de 7 días,
  regenerable (`POST .../onboarding-link`); si ya completó, `409`.
- Cobro con `onBehalfOf: <connectedAccountId>` en intenciones y checkout sessions
  (clientes/métodos siguen en la primaria). Split ejemplo ₡10.000: −comisión Onvo
  −retención −comisión marketplace → neto al IBAN del comercio, fee a la primaria.
- Estados: `pending_onboarding` → `awaiting_approval` → `active`. Solo `active`
  puede cobrar.
- Test/live separados por llave; el modo no se cambia una vez creada la cuenta.

## 4. Cambios en Kiwi

- `MerchantProfile`: nuevos campos `onvoConnectedAccountId String?` y
  `onvoOnboardingStatus String?` (migración Prisma).
- Panel comercio: sección "Cobros con tarjeta" — crear cuenta (un tap) → mostrar
  link/botón de onboarding → estado (pendiente/activo, con reintento de link).
- Backend: servicio marketplace (crear, consultar estado, regenerar link) con la
  secret key primaria; checkout de pedidos crea la sesión con `onBehalfOf` del
  comercio cuando su cuenta está `active`; si no, comportamiento actual (flag).
- `cardPaymentsEnabled` pasa a derivarse de cuenta `active` (el flag manual queda
  como override de admin, no como vía principal).
- Vista de liquidaciones por comercio (lectura: intenciones por vendedor) para que
  cada comercio vea qué se le liquidó.

## 5. Errores y bordes

- Cuenta no `active` al cobrar → checkout sin `onBehalfOf` (falla cerrado, no plata perdida).
- Link expirado → regenerar desde el panel.
- `409 onboarding_already_completed` → marcar activa y seguir.
- Webhooks actuales sin cambio (la intención trae la cuenta marketplace).

## 6. Testing

- Modo `test`: cuenta conectada de prueba, onboarding de prueba, checkout con
  `onBehalfOf`, split verificado en dashboard test.
- Specs API del flujo (crear/estado/link + checkout con/sin `onBehalfOf`).
- `tsc` + suite API verde. Manual: un comercio de prueba end-to-end.

## 7. Rollout

1. Test mode completo. 2) Comisión y llaves live configuradas. 3) Piloto con 1
   comercio real (KyL Bowls). 4) Resto de comercios por onboarding.

## 8. Decisiones

- Comisión marketplace inicial propuesta: **5%** (ejemplo de Onvo) — confirmar.
- Tarifa semanal: apagada al inicio — confirmar.
- Piloto: KyL Bowls — confirmar.
