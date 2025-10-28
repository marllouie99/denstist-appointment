import cron from 'node-cron';
import { sendAppointmentReminders } from '../services/notifications.js';
import { supabase } from '../services/supabase.js';

// Send appointment reminders daily at 9:00 AM
const scheduleAppointmentReminders = () => {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily appointment reminder job...');
    try {
      await sendAppointmentReminders();
      console.log('Appointment reminders sent successfully');
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // Adjust timezone as needed
  });

  console.log('Appointment reminder cron job scheduled for 9:00 AM daily');
};

// Clean up old audit logs (keep only last 90 days)
const scheduleAuditLogCleanup = () => {
  // Run every Sunday at 2:00 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('Running audit log cleanup job...');
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('Error cleaning up audit logs:', error);
      } else {
        console.log('Audit log cleanup completed successfully');
      }
    } catch (error) {
      console.error('Error in audit log cleanup job:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Audit log cleanup cron job scheduled for 2:00 AM every Sunday');
};

// Update appointment statuses (mark as completed if past appointment time)
const scheduleAppointmentStatusUpdate = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running appointment status update job...');
    try {
      const now = new Date().toISOString();

      // Mark appointments as completed if they are past their time and still approved
      const { data: updatedAppointments, error } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          updated_at: now
        })
        .eq('status', 'approved')
        .eq('payment_status', 'paid')
        .lt('appointment_time', now)
        .select();

      if (error) {
        console.error('Error updating appointment statuses:', error);
      } else {
        console.log(`Updated ${updatedAppointments?.length || 0} appointments to completed status`);
      }
    } catch (error) {
      console.error('Error in appointment status update job:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Appointment status update cron job scheduled to run every hour');
};

// Send payment reminders for approved but unpaid appointments
const schedulePaymentReminders = () => {
  // Run every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('Running payment reminder job...');
    try {
      // Get approved appointments that are unpaid and appointment is more than 24 hours away
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: unpaidAppointments } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:users!appointments_patient_id_fkey(full_name, email),
          dentist:users!appointments_dentist_id_fkey(full_name, email),
          service:services(name, price)
        `)
        .eq('status', 'approved')
        .eq('payment_status', 'unpaid')
        .gte('appointment_time', tomorrow.toISOString());

      if (unpaidAppointments && unpaidAppointments.length > 0) {
        // Here you could send payment reminder emails
        console.log(`Found ${unpaidAppointments.length} appointments needing payment reminders`);
        
        // TODO: Implement payment reminder email logic
        // for (const appointment of unpaidAppointments) {
        //   await sendPaymentReminder(appointment);
        // }
      }
    } catch (error) {
      console.error('Error in payment reminder job:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Payment reminder cron job scheduled for 10:00 AM daily');
};

// Initialize all cron jobs
export const initializeCronJobs = () => {
  console.log('Initializing cron jobs...');
  
  scheduleAppointmentReminders();
  scheduleAuditLogCleanup();
  scheduleAppointmentStatusUpdate();
  schedulePaymentReminders();
  
  console.log('All cron jobs initialized successfully');
};

// Manual trigger functions for testing
export const triggerAppointmentReminders = async () => {
  console.log('Manually triggering appointment reminders...');
  await sendAppointmentReminders();
};

export const triggerAuditLogCleanup = async () => {
  console.log('Manually triggering audit log cleanup...');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const { error } = await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    throw error;
  }
  
  console.log('Audit log cleanup completed');
};

export const triggerAppointmentStatusUpdate = async () => {
  console.log('Manually triggering appointment status update...');
  const now = new Date().toISOString();

  const { data: updatedAppointments, error } = await supabase
    .from('appointments')
    .update({ 
      status: 'completed',
      updated_at: now
    })
    .eq('status', 'approved')
    .eq('payment_status', 'paid')
    .lt('appointment_time', now)
    .select();

  if (error) {
    throw error;
  }
  
  console.log(`Updated ${updatedAppointments?.length || 0} appointments to completed status`);
  return updatedAppointments;
};
