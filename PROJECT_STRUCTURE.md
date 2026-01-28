# ManyPost Project Structure

... (Frontend & Backend Structure bleiben unverändert) ...

## Routing & Proxy System

### Cloudflare Redirects
Die Datei `public/_redirects` konfiguriert Cloudflare Pages so, dass API-Anfragen an deine Domain intern an Supabase weitergeleitet werden.

- **Pfad:** `/api/v1/*` -> `https://bskuwtrrykvnptfivlrl.supabase.co/functions/v1/api/*`
- **Typ:** Transparent Proxy (Status 200)
- **Vorteil:** Keine CORS-Probleme und saubere Branding-URLs.

... (Rest bleibt unverändert) ...