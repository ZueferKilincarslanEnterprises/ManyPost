# ManyPost - Social Media Management Platform

... (Features & Tech Stack bleiben unverändert) ...

## API Usage

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference. Die API ist über `/api/v1` (Proxy zu Supabase) erreichbar.

Quick example:
```javascript
const response = await fetch('/api/v1/schedule', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    integration_id: 'uuid',
    video_id: 'uuid',
    scheduled_time: '2024-01-21T15:00:00Z',
    title: 'My Video',
    privacy_status: 'public',
  }),
});
```

... (Rest bleibt unverändert) ...