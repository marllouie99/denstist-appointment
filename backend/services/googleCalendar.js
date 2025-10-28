import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Function to set credentials from stored tokens
export const setStoredCredentials = (tokens) => {
  oauth2Client.setCredentials(tokens);
};

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

export const createCalendarEvent = async (appointmentData) => {
  try {
    const startTime = new Date(appointmentData.appointment_time);
    const duration = appointmentData.duration || 60; // Default 60 minutes
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const event = {
      summary: `Dental Appointment - ${appointmentData.service_name}`,
      description: `Appointment with Dr. ${appointmentData.dentist_name} for ${appointmentData.patient_name}\n\nService: ${appointmentData.service_name}\nDuration: ${duration} minutes`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: [
        { email: appointmentData.patient_email },
        { email: appointmentData.dentist_email }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
      colorId: '9', // Blue color for dental appointments
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const deleteCalendarEvent = async (eventId) => {
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return { success: false, error: error.message };
  }
};

export const getAuthUrl = (state = null) => {
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const authUrlOptions = {
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force consent to get refresh token
  };
  
  if (state) {
    authUrlOptions.state = state;
  }
  
  return oauth2Client.generateAuthUrl(authUrlOptions);
};

export const getTokenFromCode = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return { success: true, tokens };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
