# ManyPost - Social Media Management Platform

A complete social media scheduling platform that allows users to schedule posts across multiple platforms. Currently supports YouTube with plans to add Instagram and TikTok.

## Features

### Core Functionality
- User authentication with email/password
- Dashboard with API key management
- Multi-platform social media account connections
- Video upload and management with previews
- Schedule posts with full customization
- Post history tracking
- Draft system for incomplete posts
- RESTful API for programmatic access

### YouTube Integration
- OAuth 2.0 authentication
- Support for regular videos and YouTube Shorts
- Customizable titles, descriptions, and tags
- Privacy settings (public, unlisted, private)
- Category selection
- Thumbnail support
- Made for Kids compliance
- Subscriber notifications

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS + Lucide Icons
- **Backend:** Supabase (Database + Auth + Edge Functions)
- **Storage:** Cloudflare R2 (for video files)
- **APIs:** YouTube Data API v3

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Google Cloud Console project with YouTube API enabled

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Database Setup

The database schema is automatically created via Supabase migrations. Tables include:
- `users_profile` - User profile information
- `api_keys` - API keys for programmatic access
- `integrations` - Connected social media accounts
- `videos` - Uploaded video library
- `scheduled_posts` - Posts scheduled for future publishing
- `post_history` - Record of all published posts
- `drafts` - Saved incomplete posts
- `webhooks` - Webhook configurations
- `webhook_logs` - Webhook delivery logs

## Usage

### Web Interface

1. **Sign Up/Login** - Create an account or sign in
2. **Connect YouTube** - Go to Integrations and connect your YouTube channel
3. **Upload Videos** - Upload videos to your library with preview generation
4. **Schedule Posts** - Create scheduled posts with full metadata
5. **Monitor Progress** - View scheduled posts and post history

### API Usage

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

Quick example:
```javascript
const response = await fetch('https://YOUR_SUPABASE_URL/functions/v1/api/schedule', {
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

## Architecture

### Frontend Pages
- `/login` - User authentication
- `/signup` - New user registration
- `/dashboard` - Overview and API key management
- `/integrations` - Manage connected accounts
- `/videos` - Video library management with previews
- `/schedule` - Create new scheduled post
- `/scheduled` - View pending scheduled posts
- `/history` - View published posts
- `/drafts` - Manage saved drafts

### Edge Functions
- `api` - RESTful API endpoints for external access
- `youtube-oauth` - YouTube OAuth flow handler
- `youtube-publisher` - Handles video publishing to YouTube
- `cron-publisher` - Cron job for automatic post publishing
- `generate-r2-signed-url` - Generates signed URLs for R2 uploads
- `delete-r2-video` - Deletes videos from Cloudflare R2 storage

## Deployment

### Frontend
The frontend can be deployed to any static hosting service:
```bash
npm run build
```

### Backend
Backend is hosted on Supabase with Edge Functions automatically deployed.

## Scheduled Publishing

Posts are automatically published via a cron job that runs every minute. The `cron-publisher` function checks for posts due within the next 5 minutes and triggers the publishing process.

To set up the cron job, use Supabase's pg_cron extension or an external cron service to call:
```
POST https://YOUR_SUPABASE_URL/functions/v1/cron-publisher
```

## Future Enhancements

### Phase 2
- Instagram integration
- TikTok integration
- Bulk scheduling
- Advanced analytics
- Content calendar view
- Team collaboration features

### Phase 3
- AI-powered content suggestions
- Multi-timezone support
- Post performance tracking
- A/B testing for titles/thumbnails
- Mobile app

## Security

- All API keys are hashed and stored securely
- OAuth tokens are encrypted at rest
- Row Level Security (RLS) enabled on all database tables
- HTTPS enforced for all communications
- API rate limiting to prevent abuse

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/manypost/issues)
- Documentation: See API_DOCUMENTATION.md
- Email: support@manypost.com

## Acknowledgments

- Built with Supabase
- Icons by Lucide
- UI inspiration from modern SaaS platforms