# Database Schema Files

## Essential Files

### ✅ FINAL_SCHEMA_FIX.sql (MAIN SCHEMA)
**Primary database schema file - use this for all setups**
- Complete unified schema with all tables
- Automatic user profile creation triggers
- Proper RLS policies
- Authentication system
- All required tables: users, dentist_profile, services, appointments, payments

### Additional Files
- `create_payment_trigger.sql` - Payment status trigger
- `google-calendar-integration.sql` - Google Calendar setup
- `DATABASE_SETUP.md` - Complete setup guide with environment configuration

## Setup Instructions

1. **New Installation**: Run `FINAL_SCHEMA_FIX.sql` in Supabase SQL Editor
2. **Existing Database**: Run `FINAL_SCHEMA_FIX.sql` (safely handles existing data)
3. **Configuration**: Follow `DATABASE_SETUP.md` for environment setup
4. **Optional**: Run additional SQL files for specific features

## What FINAL_SCHEMA_FIX.sql includes:
- Complete database schema
- User authentication system
- Role-based access control (RLS)
- Automatic triggers for user profiles
- Sample services data
- All necessary indexes and constraints
