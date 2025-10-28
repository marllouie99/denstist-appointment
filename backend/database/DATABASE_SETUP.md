# 🗄️ Database Setup Guide

## Quick Setup

### 1. Run Main Schema
Execute `FINAL_SCHEMA_FIX.sql` in your Supabase SQL Editor. This file contains:
- Complete database schema (users, appointments, payments, etc.)
- Authentication triggers
- Row Level Security (RLS) policies
- Sample services data

### 2. Optional Features
- **Payment Triggers**: Run `create_payment_trigger.sql`
- **Google Calendar**: Run `google-calendar-integration.sql`

## Environment Variables

Create `.env` file in backend directory:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Secret
JWT_SECRET=your_jwt_secret

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## Database Schema

### Core Tables
- **users**: User accounts (patients, dentists, admin)
- **dentist_profile**: Dentist-specific information
- **services**: Available dental services
- **appointments**: Appointment bookings
- **payments**: Payment records

### Security Features
- Row Level Security (RLS) enabled
- Role-based access control
- Automatic user profile creation
- Privacy protection for earnings data

## Troubleshooting

### Common Issues
1. **Authentication errors**: Check JWT_SECRET and Supabase keys
2. **RLS policy errors**: Ensure policies are properly created
3. **Payment issues**: Verify PayPal configuration

### Support
- Check server logs for detailed error messages
- Verify environment variables are set correctly
- Ensure database schema is properly applied
