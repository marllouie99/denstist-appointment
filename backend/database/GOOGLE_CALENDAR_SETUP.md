# Google Calendar Integration Setup Guide

## Overview
This guide will help you set up Google Calendar integration for your dentist appointment system. Once configured, appointments will automatically be added to both the dentist's and patient's Google Calendars with reminders.

## Step 1: Google Cloud Console Setup

### 1.1 Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Dentist Appointment System")
4. Click "Create"

### 1.2 Enable Google Calendar API
1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields:
     - App name: "Dentist Appointment System"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `https://www.googleapis.com/auth/calendar`
   - Add test users (your email and any dentist emails)

4. Create OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "Dentist App Calendar Integration"
   - Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
   - For production, also add your production URL

5. Copy the **Client ID** and **Client Secret**

## Step 2: Update Environment Variables

Update your `backend/.env` file with the credentials:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

## Step 3: Database Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of database/google-calendar-integration.sql
```

## Step 4: Test the Integration

1. **Start your backend server**:
   ```bash
   cd backend
   npm start
   ```

2. **Start your frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test as a dentist**:
   - Login as a dentist user
   - Go to Dashboard → Settings tab
   - Click "Connect" under Google Calendar
   - Complete the OAuth flow
   - You should see "Connected" status

4. **Test appointment creation**:
   - Have a patient book an appointment
   - Approve the appointment as a dentist
   - Check that a calendar event was created in Google Calendar

## Step 5: Production Deployment

For production deployment:

1. **Update OAuth settings**:
   - Add your production domain to authorized redirect URIs
   - Update `GOOGLE_REDIRECT_URI` in production environment

2. **OAuth Consent Screen**:
   - Submit for verification if you need external users
   - Or keep as "Testing" for internal use only

## Features Included

✅ **Automatic Calendar Events**: When appointments are approved
✅ **Email Invitations**: Both dentist and patient receive calendar invites
✅ **Smart Reminders**: 24 hours and 30 minutes before appointments
✅ **Event Management**: Automatic deletion when appointments are cancelled
✅ **Secure Token Storage**: Refresh tokens stored securely in database
✅ **Connection Status**: Visual indicator in dentist dashboard

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch" error**:
   - Ensure the redirect URI in Google Console exactly matches your `.env` file
   - Check for trailing slashes or http vs https

2. **"access_denied" error**:
   - Make sure the dentist email is added as a test user in OAuth consent screen
   - Check that Google Calendar API is enabled

3. **Token expiry issues**:
   - The system automatically handles token refresh using stored refresh tokens
   - If issues persist, reconnect the calendar integration

4. **Calendar events not creating**:
   - Check backend logs for detailed error messages
   - Verify the dentist has connected their Google Calendar
   - Ensure appointment data includes all required fields

### Debug Mode:

To enable detailed logging, add this to your backend:

```javascript
// In googleCalendar.js
console.log('Creating calendar event:', appointmentData);
console.log('OAuth client credentials:', oauth2Client.credentials);
```

## Security Notes

- Refresh tokens are stored encrypted in the database
- Access tokens are automatically refreshed when expired
- Only dentists can connect their own calendars (RLS policies)
- Calendar access is limited to the specific scopes requested

## Support

If you encounter issues:
1. Check the backend console logs
2. Verify all environment variables are set correctly
3. Ensure database migrations have been run
4. Test with a fresh OAuth connection

---

**Next Steps**: Once Google Calendar is working, you can extend this to add more calendar providers (Outlook, Apple Calendar) or additional features like appointment reminders via SMS.
