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

### Railway (Backend)

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Add the following environment variables:
   - `PORT` (Railway provides this automatically)
   - `NODE_ENV=production`
   - `FRONTEND_URL` (your frontend URL)
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_MODE`
   - `GOOGLE_CLIENT_ID` (optional)
   - `GOOGLE_CLIENT_SECRET` (optional)
   - `GOOGLE_REDIRECT_URI` (optional)

### Vercel/Netlify (Frontend)

1. Build command: `cd frontend && npm install && npm run build`
2. Output directory: `frontend/dist`
3. Add environment variables:
   - `VITE_API_URL` (your Railway backend URL)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

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
