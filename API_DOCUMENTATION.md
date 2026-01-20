# ManyPost API Documentation

## Authentication

All API requests require authentication using your API key. Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

You can find your API key in the Dashboard after signing up.

## Base URL

```
https://bskuwtrrykvnptfivlrl.supabase.co/functions/v1
```

## Endpoints

### 1. List Integrations

Get all connected social media accounts.

**Endpoint:** `GET /api/integrations`

**Response:**
```json
{
  "integrations": [
    {
      "id": "uuid",
      "platform": "youtube",
      "channel_name": "My Channel",
      "channel_id": "UC...",
      "is_active": true,
      "connected_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

### 2. List Videos

Get all uploaded videos.

**Endpoint:** `GET /api/videos`

**Response:**
```json
{
  "videos": [
    {
      "id": "uuid",
      "file_name": "my-video.mp4",
      "file_size": 1024000,
      "duration": 120,
      "thumbnail_url": "https://...",
      "upload_status": "completed",
      "uploaded_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

### 3. List Scheduled Posts

Get all pending scheduled posts.

**Endpoint:** `GET /api/scheduled`

**Response:**
```json
{
  "scheduled_posts": [
    {
      "id": "uuid",
      "title": "My Video Title",
      "scheduled_time": "2024-01-21T15:00:00Z",
      "status": "pending",
      "platform": "youtube",
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

### 4. Schedule a Post

Create a new scheduled post.

**Endpoint:** `POST /api/schedule`

**Request Body:**
```json
{
  "integration_id": "uuid",
  "video_id": "uuid",
  "scheduled_time": "2024-01-21T15:00:00Z",
  "title": "My Video Title",
  "description": "Video description",
  "tags": ["tag1", "tag2"],
  "category": "28",
  "privacy_status": "public",
  "video_type": "normal",
  "made_for_kids": false,
  "notify_subscribers": true
}
```

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "uuid",
    "title": "My Video Title",
    "scheduled_time": "2024-01-21T15:00:00Z",
    "status": "pending"
  }
}
```

## YouTube Categories

- 1: Film & Animation
- 2: Autos & Vehicles
- 10: Music
- 15: Pets & Animals
- 17: Sports
- 19: Travel & Events
- 20: Gaming
- 22: People & Blogs
- 23: Comedy
- 24: Entertainment
- 25: News & Politics
- 26: Howto & Style
- 27: Education
- 28: Science & Technology

## Video Types

- `normal`: Regular YouTube video
- `short`: YouTube Short (vertical video < 60 seconds)

## Privacy Status Options

- `public`: Visible to everyone
- `unlisted`: Only people with the link can view
- `private`: Only you can view

## Error Responses

All errors return a JSON object with an `error` field:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- 400: Bad Request
- 401: Unauthorized (invalid API key)
- 404: Not Found
- 500: Internal Server Error

## Rate Limits

API requests are rate-limited to prevent abuse. If you exceed the rate limit, you'll receive a 429 status code.

## Example Usage

### cURL Example

```bash
curl -X POST https://bskuwtrrykvnptfivlrl.supabase.co/functions/v1/api/schedule \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "YOUR_INTEGRATION_ID",
    "video_id": "YOUR_VIDEO_ID",
    "scheduled_time": "2024-01-21T15:00:00Z",
    "title": "My Awesome Video",
    "description": "Check out this video!",
    "tags": ["tech", "tutorial"],
    "category": "28",
    "privacy_status": "public",
    "video_type": "normal",
    "made_for_kids": false,
    "notify_subscribers": true
  }'
```

### JavaScript Example

```javascript
const apiKey = 'YOUR_API_KEY';
const baseUrl = 'https://bskuwtrrykvnptfivlrl.supabase.co/functions/v1';

// Schedule a post
const response = await fetch(`${baseUrl}/api/schedule`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    integration_id: 'YOUR_INTEGRATION_ID',
    video_id: 'YOUR_VIDEO_ID',
    scheduled_time: '2024-01-21T15:00:00Z',
    title: 'My Awesome Video',
    description: 'Check out this video!',
    tags: ['tech', 'tutorial'],
    category: '28',
    privacy_status: 'public',
    video_type: 'normal',
    made_for_kids: false,
    notify_subscribers: true,
  }),
});

const data = await response.json();
console.log(data);
```

### Python Example

```python
import requests
import json

api_key = 'YOUR_API_KEY'
base_url = 'https://bskuwtrrykvnptfivlrl.supabase.co/functions/v1'

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

payload = {
    'integration_id': 'YOUR_INTEGRATION_ID',
    'video_id': 'YOUR_VIDEO_ID',
    'scheduled_time': '2024-01-21T15:00:00Z',
    'title': 'My Awesome Video',
    'description': 'Check out this video!',
    'tags': ['tech', 'tutorial'],
    'category': '28',
    'privacy_status': 'public',
    'video_type': 'normal',
    'made_for_kids': False,
    'notify_subscribers': True
}

response = requests.post(f'{base_url}/api/schedule',
                        headers=headers,
                        json=payload)

print(response.json())
```
