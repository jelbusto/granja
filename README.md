# Granjas Leche

Sistema de gestión de granjas lecheras — Next.js 14 · TypeScript · Tailwind · Supabase · next-intl

## Setup

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Edita `.env.local` con tus credenciales de Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_DEFAULT_LOCALE=es
```

### 3. Arrancar en desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/
  app/[locale]/          # Rutas con soporte multilingüe (es/en/pt)
    dashboard/
    clinicas/
    auth/
  components/
    ui/                  # Componentes genéricos (Button, Input…)
    clinicas/
    dashboard/
  lib/
    supabase/            # client.ts · server.ts · middleware.ts
    i18n/                # routing.ts · request.ts
  types/                 # Tipos TypeScript del dominio
locales/
  es/common.json
  en/common.json
  pt/common.json
```

## Idiomas soportados
- `es` — Español (por defecto)
- `en` — English
- `pt` — Português

---

## Sincronización meteorológica

El sistema descarga automáticamente datos diarios de las estaciones AEMET de Girona y los almacena en `daily_weather_readings`.

### Variables de entorno necesarias

```
AEMET_API_KEY=<tu-api-key-aemet>
SYNC_SECRET=<secreto-para-proteger-el-endpoint>
```

#### Obtener la API key de AEMET (gratuita)
1. Regístrate en https://opendata.aemet.es/centrodedescargas/altaUsuario
2. Recibirás el API key por correo electrónico
3. Añádelo a `.env.local` como `AEMET_API_KEY`

### Gestión de estaciones

Las estaciones se gestionan en la tabla `weather_stations` de Supabase:

| Columna  | Descripción                                 |
|----------|---------------------------------------------|
| `code`   | Indicativo AEMET (ej: `"0370E"` = Girona)   |
| `name`   | Nombre descriptivo                          |
| `active` | `true` para incluirla en la sincronización  |

Estaciones de Girona habituales: `0370E` (Girona aeropuerto), `0367` (Olot), `0390E` (Blanes).

### Ejecutar el job manualmente

```bash
# Sincronización diaria (datos de ayer)
npx tsx src/scripts/run-sync-weather.ts

# Backfill histórico desde 2026-01-01
npx tsx src/scripts/run-sync-weather.ts --backfill
```

### Trigger via API

```bash
curl -X POST http://localhost:3000/api/sync-weather \
  -H "Authorization: Bearer $SYNC_SECRET"

# Backfill completo
curl -X POST "http://localhost:3000/api/sync-weather?backfill=true" \
  -H "Authorization: Bearer $SYNC_SECRET"

# Rango personalizado
curl -X POST "http://localhost:3000/api/sync-weather?from=2026-01-01&to=2026-03-31" \
  -H "Authorization: Bearer $SYNC_SECRET"
```

### Cron automático

**Vercel** — configurado en `vercel.json` a las 07:00 UTC (08:00 hora española en invierno).  
El cron de Vercel llama a `GET /api/sync-weather`. Para autenticarlo, crea en Vercel la variable de entorno `SYNC_SECRET` con el mismo valor que `CRON_SECRET` de Vercel, o usa el header que Vercel añade automáticamente configurando `SYNC_SECRET=${CRON_SECRET}`.

**GitHub Actions** (alternativa):

```yaml
# .github/workflows/sync-weather.yml
name: Sync Weather
on:
  schedule:
    - cron: "0 7 * * *"   # 07:00 UTC = 08:00 hora española (invierno)
  workflow_dispatch:       # permite ejecución manual

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -s -X POST "${{ secrets.APP_URL }}/api/sync-weather" \
            -H "Authorization: Bearer ${{ secrets.SYNC_SECRET }}" | jq .
```

Secrets necesarios en GitHub: `APP_URL` (URL de tu app en Vercel) y `SYNC_SECRET`.
