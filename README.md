# Dentist Appointment System

A full-stack dentist appointment booking system with payment integration, Google Calendar sync, and admin dashboard.

## Features

- 🦷 Patient appointment booking
- 💳 PayPal payment integration
- 📅 Google Calendar synchronization
- 👨‍⚕️ Dentist dashboard with availability management
- 👨‍💼 Admin dashboard with analytics
- 📧 Email notifications
- 🔐 Secure authentication with Supabase

## Tech Stack

### Frontend
- React + Vite
- TailwindCSS
- React Router
- Axios
- Lucide Icons

### Backend
- Node.js + Express
- Supabase (PostgreSQL)
- PayPal REST SDK
- Google Calendar API
- JWT Authentication

## Project Structure

```
├── backend/          # Express API server
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   ├── middleware/   # Auth middleware
│   ├── jobs/         # Cron jobs
│   └── database/     # SQL schemas
└── frontend/         # React application
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── contexts/
    │   └── lib/
    └── public/
```

## Deployment

### Railway (Both Frontend & Backend)

This project is configured to deploy both frontend and backend on Railway as separate services.

#### Step 1: Create Railway Project
1. Go to [Railway](https://railway.app) and create a new project
2. Connect your GitHub repository `marllouie99/denstist-appointment`

#### Step 2: Deploy Backend Service
1. Click "New Service" → "GitHub Repo"
2. Select your repository
3. **Root Directory**: Set to `backend`
4. Railway will auto-detect `backend/railway.json` and `backend/nixpacks.toml`
5. Add environment variables:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.railway.app
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_client_secret
   PAYPAL_MODE=sandbox
   GOOGLE_CLIENT_ID=your_google_client_id (optional)
   GOOGLE_CLIENT_SECRET=your_google_client_secret (optional)
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/api/auth/google/callback (optional)
   ```
6. Generate domain and copy the URL

#### Step 3: Deploy Frontend Service
1. In the same Railway project, click "New Service" → "GitHub Repo"
2. Select your repository again
3. **Root Directory**: Set to `frontend`
4. Railway will auto-detect `frontend/railway.json` and `frontend/nixpacks.toml`
5. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.railway.app
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
6. Generate domain for the frontend

#### Step 4: Update CORS
After both services are deployed, update the backend CORS settings in `backend/server.js` to include your frontend Railway URL, then commit and push.

## Local Development

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

## Environment Variables

See `.env.example` files in both `backend` and `frontend` directories for required environment variables.

## Database Setup

1. Create a Supabase project
2. Run the SQL scripts in `backend/database/` in order:
   - `FINAL_SCHEMA_FIX.sql` - Main schema
   - `create_payment_trigger.sql` - Payment triggers
   - `google-calendar-integration.sql` - Calendar integration (optional)

## License

MIT
