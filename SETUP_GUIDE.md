# ManyPost Setup Guide

... (Prerequisites & Steps 1-6 bleiben unverändert) ...

## Step 7: Test the Setup

### Test Authentication

1. Sign up for a new account at `/signup`
2. Verify you're redirected to the dashboard
3. Check that an API key was automatically generated

### Test API (Via Proxy)

Du kannst die API nun über deine eigene Domain testen:

```bash
# Hol dir deinen API-Key aus dem Dashboard, dann:
curl -X GET https://deine-domain.com/api/v1/integrations \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Troubleshooting

### API Not Working
- Überprüfe, ob die Datei `public/_redirects` korrekt hochgeladen wurde.
- Cloudflare Pages benötigt ca. 1-2 Minuten, um Redirect-Änderungen zu aktivieren.
- Stelle sicher, dass der `Authorization` Header das Format `Bearer KEY` hat.

... (Rest bleibt unverändert) ...