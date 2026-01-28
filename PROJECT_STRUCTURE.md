# ManyPost Project Structure

## Frontend Structure

```
src/
├── components/
│   ├── Layout.tsx              # Main layout with sidebar navigation
│   └── ProtectedRoute.tsx      # Route wrapper for authentication
├── contexts/
│   └── AuthContext.tsx         # Authentication context provider
├── lib/
│   └── supabase.ts            # Supabase client configuration
├── pages/
│   ├── Dashboard.tsx          # Main dashboard with API key
│   ├── Drafts.tsx             # Manage saved drafts
│   ├── Integrations.tsx       # Connect social media accounts
│   ├── Login.tsx              # User login page
│   ├── PostHistory.tsx        # View published posts
│   ├── Schedule.tsx           # Create scheduled posts
│   ├── ScheduledPosts.tsx     # View pending scheduled posts
│   ├── Signup.tsx             # User registration
│   └── Videos.tsx             # Video library management with previews
├── types/
│   └── index.ts               # TypeScript type definitions
├── App.tsx                    # Main app with routing
├── index.css                  # Global styles
└── main.tsx                   # App entry point
```

## Backend Structure

```
supabase/
└── functions/
    ├── api/
    │   └── index.ts           # RESTful API endpoints
    ├── youtube-oauth/
    │   └── index.ts           # YouTube OAuth flow
    ├── youtube-publisher/
    │   └── index.ts           # Publish videos to YouTube
    ├── cron-publisher/
    │   └── index.ts           # Cron job for scheduled publishing
    ├── generate-r2-signed-url/
    │   └── index.ts           # Generate signed URLs for R2 uploads
    └── delete-r2-video/
        └── index.ts           # Delete videos from Cloudflare R2 storage
```

## Database Schema

### Core Tables
- **users_profile** - User profile information
- **api_keys** - API keys for programmatic access
- **integrations** - Connected social media accounts
- **videos** - Uploaded video library
- **scheduled_posts** - Posts scheduled for publishing
- **post_history** - Record of published posts
- **drafts** - Saved incomplete posts

### Webhook Tables
- **webhooks** - Webhook configurations
- **webhook_logs** - Webhook delivery logs

## Key Features by Component

### Authentication System
- Email/password authentication via Supabase Auth
- Protected routes
- Auto-generated API keys on signup
- Session management

### Dashboard
- Overview statistics
- API key display with copy functionality
- API key regeneration
- Quick stats (connected accounts, scheduled posts, posted videos)

### Integrations
- Platform selection modal
- YouTube OAuth connection
- Account disconnection
- Status indicators
- Coming soon badges for Instagram/TikTok

### Videos
- File upload interface with preview generation
- Video library grid view
- Thumbnail display
- File size and duration info
- Delete functionality with Cloudflare R2 cleanup
- Upload status tracking

### Schedule Post
- Account selector
- Video selector
- Date/time picker
- YouTube-specific fields:
  - Title (100 char limit)
  - Description
  - Tags
  - Category selector
  - Privacy status
  - Video type (Normal/Short)
  - Made for Kids checkbox
  - Notify subscribers option
- Save as draft functionality

### Scheduled Posts
- List view with filters
- Status badges (pending, processing, failed)
- Time until posting countdown
- Post Now button
- Cancel button
- Detailed post information

### Post History
- Published posts list
- Success/failure status
- Error messages
- Links to live posts
- Filter by status

### Drafts
- Draft cards with completion percentage
- Resume functionality
- Delete functionality
- Last updated timestamps

## API Endpoints

### GET /api/integrations
Returns list of connected accounts

### GET /api/videos
Returns list of uploaded videos

### GET /api/scheduled
Returns list of pending scheduled posts

### POST /api/schedule
Creates a new scheduled post

## Edge Functions

### api
RESTful API with API key authentication for external integrations

### youtube-oauth
Handles YouTube OAuth 2.0 flow:
- Initiates OAuth flow
- Handles callback
- Stores tokens securely
- Fetches channel information

### youtube-publisher
Publishes videos to YouTube:
- Refreshes expired tokens
- Uploads video via resumable upload
- Sets metadata
- Updates post status
- Creates history records

### cron-publisher
Automated scheduling system:
- Runs every minute
- Checks for due posts
- Triggers youtube-publisher
- Handles errors gracefully

### generate-r2-signed-url
Generates signed URLs for secure Cloudflare R2 uploads:
- Authenticates user
- Creates unique object keys
- Generates time-limited signed URLs

### delete-r2-video
Deletes videos from Cloudflare R2 storage:
- Authenticates with service key
- Removes objects from R2 bucket
- Used when deleting videos from the library

## Security Features

### Database Level
- Row Level Security (RLS) on all tables
- User-scoped data access
- Encrypted OAuth tokens
- Secure API key storage

### Application Level
- Protected routes
- JWT authentication
- API key validation
- CORS headers on all endpoints

### Best Practices
- No secrets in frontend
- Service role key only in backend
- Secure OAuth flow
- Rate limiting ready

## Data Flow

### Scheduling a Post
1. User selects account and video
2. Fills in post metadata
3. Frontend validates and submits
4. Supabase stores in scheduled_posts
5. Cron job picks up due posts
6. youtube-publisher handles upload
7. Result stored in post_history

### YouTube OAuth
1. User clicks "Add YouTube"
2. Frontend calls youtube-oauth function
3. User authorizes on Google
4. Callback receives tokens
5. Channel info fetched
6. Integration stored in database
7. User redirected back

### API Usage
1. External app gets API key from dashboard
2. Makes request with Authorization header
3. API function validates key
4. Updates last_used_at timestamp
5. Executes requested operation
6. Returns JSON response

## File Organization

### Component Principles
- Single responsibility per file
- Shared layouts extracted
- Reusable components in components/
- Page-specific logic in pages/
- Business logic in separate functions

### Type Safety
- All API responses typed
- Database schema types defined
- Props interfaces for components
- Strict TypeScript configuration

### Code Style
- Functional components with hooks
- Async/await for promises
- Error boundaries
- Loading states
- User feedback (alerts, toasts)

## Testing Strategy

### Manual Testing Checklist
- [ ] User can sign up
- [ ] User can log in
- [ ] API key is generated
- [ ] YouTube OAuth works
- [ ] Videos can be uploaded with previews
- [ ] Videos can be deleted from both Supabase and R2
- [ ] Posts can be scheduled
- [ ] Cron job processes posts
- [ ] Posts appear in history
- [ ] API endpoints work
- [ ] Error handling works

### Future Testing
- Unit tests for utilities
- Integration tests for API
- E2E tests for critical flows
- Load testing for cron job
- Security penetration testing

## Performance Considerations

### Database
- Indexes on frequently queried fields
- Efficient RLS policies
- Connection pooling

### Frontend
- Code splitting by route
- Lazy loading for images
- Optimized bundle size
- React.memo for expensive components

### Backend
- Efficient queries with select()
- Pagination for large lists
- Background processing for uploads
- Rate limiting

## Scalability

### Current Capacity
- Handles hundreds of users
- Thousands of scheduled posts
- Real-time updates via Supabase

### Future Scaling
- Add caching layer
- Implement queue system
- Distribute cron processing
- CDN for static assets
- Database read replicas

## Maintenance

### Regular Tasks
- Monitor error logs
- Review failed posts
- Update dependencies
- Backup database
- Rotate API keys if needed

### Monitoring Points
- Edge Function errors
- Database query performance
- API usage patterns
- Storage usage
- Authentication failures