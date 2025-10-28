import nodemailer from 'nodemailer';
import { supabase } from './supabase.js';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Email templates
const emailTemplates = {
  appointmentBooked: (patientName, dentistName, appointmentTime, serviceName) => ({
    subject: 'Appointment Booking Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Booking Confirmation</h2>
        <p>Dear ${patientName},</p>
        <p>Your appointment has been successfully booked and is pending approval.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Dentist:</strong> ${dentistName}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
          <p><strong>Status:</strong> Pending Approval</p>
        </div>
        <p>You will receive another email once your appointment is approved by the dentist.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  appointmentApproved: (patientName, dentistName, appointmentTime, serviceName, paymentUrl) => ({
    subject: 'Appointment Approved - Payment Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Appointment Approved!</h2>
        <p>Dear ${patientName},</p>
        <p>Great news! Your appointment has been approved by ${dentistName}.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Dentist:</strong> ${dentistName}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        </div>
        <p>Please complete your payment to confirm your appointment:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${paymentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Complete Payment</a>
        </div>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  appointmentRejected: (patientName, dentistName, appointmentTime, reason) => ({
    subject: 'Appointment Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Appointment Update</h2>
        <p>Dear ${patientName},</p>
        <p>We regret to inform you that your appointment with ${dentistName} scheduled for ${new Date(appointmentTime).toLocaleString()} has been declined.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>Please feel free to book another appointment at a different time or with another dentist.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/patient/book-appointment" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Book New Appointment</a>
        </div>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  paymentConfirmed: (patientName, dentistName, appointmentTime, serviceName, amount) => ({
    subject: 'Payment Confirmed - Appointment Scheduled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Payment Confirmed!</h2>
        <p>Dear ${patientName},</p>
        <p>Your payment has been successfully processed and your appointment is now confirmed.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Dentist:</strong> ${dentistName}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
          <p><strong>Amount Paid:</strong> ₱${amount}</p>
        </div>
        <p>Please arrive 15 minutes before your scheduled appointment time.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  appointmentReminder: (patientName, dentistName, appointmentTime, serviceName) => ({
    subject: 'Appointment Reminder - Tomorrow',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Reminder</h2>
        <p>Dear ${patientName},</p>
        <p>This is a friendly reminder about your upcoming appointment tomorrow.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Dentist:</strong> ${dentistName}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        </div>
        <p>Please arrive 15 minutes before your scheduled appointment time.</p>
        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  // NEW: Dentist notification templates
  newBookingRequest: (dentistName, patientName, appointmentTime, serviceName, patientEmail) => ({
    subject: 'New Appointment Request - Action Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">New Appointment Request</h2>
        <p>Dear Dr. ${dentistName},</p>
        <p>You have received a new appointment request that requires your approval.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Email:</strong> ${patientEmail}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Requested Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
          <p><strong>Status:</strong> Pending Your Approval</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dentist/dashboard" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Review & Approve</a>
        </div>
        <p>Please log in to your dashboard to review and respond to this appointment request.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  paymentReceived: (dentistName, patientName, appointmentTime, serviceName, amount) => ({
    subject: 'Payment Received - Appointment Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Payment Received</h2>
        <p>Dear Dr. ${dentistName},</p>
        <p>Great news! Payment has been received for the following appointment:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
          <p><strong>Amount Received:</strong> ₱${amount}</p>
          <p><strong>Status:</strong> Confirmed & Paid</p>
        </div>
        <p>The appointment is now confirmed and has been added to your calendar.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  }),

  dentistAppointmentReminder: (dentistName, patientName, appointmentTime, serviceName, patientEmail) => ({
    subject: 'Appointment Tomorrow - Patient Reminder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Reminder</h2>
        <p>Dear Dr. ${dentistName},</p>
        <p>This is a reminder about your appointment tomorrow:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Email:</strong> ${patientEmail}</p>
          <p><strong>Service:</strong> ${serviceName}</p>
          <p><strong>Date & Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        </div>
        <p>The patient has been sent a reminder email as well.</p>
        <p>Best regards,<br>Dental Care Team</p>
      </div>
    `
  })
};

// Send email notification
export const sendEmail = async (to, template, data) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Email credentials not configured, skipping email send');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    const { subject, html } = emailTemplates[template](...data);

    const mailOptions = {
      from: `"Dental Care System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

// Notification functions for different events
export const notifyAppointmentBooked = async (appointmentId) => {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(full_name, email),
        dentist:users!appointments_dentist_id_fkey(full_name, email),
        service:services(name)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointment) {
      // Notify patient
      await sendEmail(
        appointment.patient.email,
        'appointmentBooked',
        [
          appointment.patient.full_name,
          appointment.dentist.full_name,
          appointment.appointment_time,
          appointment.service.name
        ]
      );

      // Notify dentist about new appointment request
      await sendEmail(
        appointment.dentist.email,
        'newBookingRequest',
        [
          appointment.dentist.full_name,
          appointment.patient.full_name,
          appointment.appointment_time,
          appointment.service.name,
          appointment.patient.email
        ]
      );
    }
  } catch (error) {
    console.error('Error sending appointment booked notification:', error);
  }
};

export const notifyAppointmentApproved = async (appointmentId) => {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(full_name, email),
        dentist:users!appointments_dentist_id_fkey(full_name, email),
        service:services(name, price)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointment) {
      const paymentUrl = `${process.env.FRONTEND_URL}/patient/payment?appointment=${appointmentId}`;
      
      await sendEmail(
        appointment.patient.email,
        'appointmentApproved',
        [
          appointment.patient.full_name,
          appointment.dentist.full_name,
          appointment.appointment_time,
          appointment.service.name,
          paymentUrl
        ]
      );
    }
  } catch (error) {
    console.error('Error sending appointment approved notification:', error);
  }
};

export const notifyAppointmentRejected = async (appointmentId, reason) => {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(full_name, email),
        dentist:users!appointments_dentist_id_fkey(full_name, email)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointment) {
      await sendEmail(
        appointment.patient.email,
        'appointmentRejected',
        [
          appointment.patient.full_name,
          appointment.dentist.full_name,
          appointment.appointment_time,
          reason
        ]
      );
    }
  } catch (error) {
    console.error('Error sending appointment rejected notification:', error);
  }
};

export const notifyPaymentConfirmed = async (appointmentId, amount) => {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(full_name, email),
        dentist:users!appointments_dentist_id_fkey(full_name, email),
        service:services(name)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointment) {
      // Notify patient
      await sendEmail(
        appointment.patient.email,
        'paymentConfirmed',
        [
          appointment.patient.full_name,
          appointment.dentist.full_name,
          appointment.appointment_time,
          appointment.service.name,
          amount
        ]
      );

      // Notify dentist about payment received
      await sendEmail(
        appointment.dentist.email,
        'paymentReceived',
        [
          appointment.dentist.full_name,
          appointment.patient.full_name,
          appointment.appointment_time,
          appointment.service.name,
          amount
        ]
      );
    }
  } catch (error) {
    console.error('Error sending payment confirmed notification:', error);
  }
};

// Function to send appointment reminders (to be called by a cron job)
export const sendAppointmentReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(full_name, email),
        dentist:users!appointments_dentist_id_fkey(full_name, email),
        service:services(name)
      `)
      .eq('status', 'approved')
      .eq('payment_status', 'paid')
      .gte('appointment_time', tomorrow.toISOString())
      .lt('appointment_time', dayAfter.toISOString());

    if (appointments) {
      for (const appointment of appointments) {
        // Send reminder to patient
        await sendEmail(
          appointment.patient.email,
          'appointmentReminder',
          [
            appointment.patient.full_name,
            appointment.dentist.full_name,
            appointment.appointment_time,
            appointment.service.name
          ]
        );

        // Send reminder to dentist
        await sendEmail(
          appointment.dentist.email,
          'dentistAppointmentReminder',
          [
            appointment.dentist.full_name,
            appointment.patient.full_name,
            appointment.appointment_time,
            appointment.service.name,
            appointment.patient.email
          ]
        );
      }
    }

    console.log(`Sent ${appointments?.length || 0} appointment reminders`);
  } catch (error) {
    console.error('Error sending appointment reminders:', error);
  }
};
