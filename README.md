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
