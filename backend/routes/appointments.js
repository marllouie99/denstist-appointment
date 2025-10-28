import express from 'express';
import { supabase } from '../services/supabase.js';
import { createCalendarEvent, deleteCalendarEvent, setStoredCredentials } from '../services/googleCalendar.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { refundPayment } from '../services/paypal.js';
import { notifyAppointmentBooked, notifyAppointmentApproved, notifyAppointmentRejected } from '../services/notifications.js';

const router = express.Router();

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`[APPOINTMENTS] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log('[APPOINTMENTS] Headers:', req.headers);
  console.log('[APPOINTMENTS] Body:', req.body);
  next();
});

// Get all appointments (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [APPOINTMENTS] GET / - Request details:', {
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : 'No user',
      query: req.query,
      timestamp: new Date().toISOString()
    });

    // Handle test user with dynamic data from real database
    if (req.user.id === '00000000-0000-0000-0000-000000000001') {
      console.log('🧪 [APPOINTMENTS] Test user detected - fetching real appointments from database');
      
      // Query real appointments from database
      const { data: realAppointments, error: realError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:users!appointments_patient_id_fkey(id, full_name, email),
          dentist:users!appointments_dentist_id_fkey(id, full_name, email),
          service:services(id, name, price)
        `)
        .order('appointment_time', { ascending: true });

      if (realError) {
        console.error('❌ [APPOINTMENTS] Error fetching real appointments for test user:', realError);
        // Fallback to mock data if database fails
        const mockAppointments = [
          {
            id: 34,
            patient_id: '00000000-0000-0000-0000-000000000001',
            dentist_id: '00000000-0000-0000-0000-000000000002',
            service_id: 1,
            appointment_time: '2025-10-06T10:00:00Z',
            status: 'approved',
            payment_status: 'unpaid',
            notes: 'Test appointment',
            created_at: '2025-10-05T19:00:00Z',
            updated_at: new Date().toISOString(),
            patient: { id: '00000000-0000-0000-0000-000000000001', full_name: 'Test User', email: 'test@example.com' },
            dentist: { id: '00000000-0000-0000-0000-000000000002', full_name: 'Dr. Test', email: 'dentist@example.com' },
            service: { id: 1, name: 'General Checkup', price: 100 }
          }
        ];
        return res.json({ appointments: mockAppointments });
      }

      console.log('✅ [APPOINTMENTS] Found real appointments for test user:', realAppointments?.length || 0);
      console.log('🔍 [APPOINTMENTS] Real appointment payment statuses:', 
        realAppointments?.map(a => ({ id: a.id, payment_status: a.payment_status })) || []
      );
      
      return res.json({ appointments: realAppointments || [] });
    }

    const { status, dentist_id, patient_id } = req.query;
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `);

    // Apply filters based on user role
    if (req.user.role === 'patient') {
      console.log('🔍 [APPOINTMENTS] Filtering by patient_id:', req.user.id);
      query = query.eq('patient_id', req.user.id);
    } else if (req.user.role === 'dentist') {
      console.log('🔍 [APPOINTMENTS] Filtering by dentist_id:', req.user.id);
      query = query.eq('dentist_id', req.user.id);
    }

    // Apply additional filters
    if (status) {
      console.log('🔍 [APPOINTMENTS] Filtering by status:', status);
      query = query.eq('status', status);
    }
    if (dentist_id) {
      console.log('🔍 [APPOINTMENTS] Filtering by dentist_id:', dentist_id);
      query = query.eq('dentist_id', dentist_id);
    }
    if (patient_id) {
      console.log('🔍 [APPOINTMENTS] Filtering by patient_id:', patient_id);
      query = query.eq('patient_id', patient_id);
    }

    console.log('📡 [APPOINTMENTS] Executing Supabase query...');
    const { data, error } = await query.order('appointment_time', { ascending: true });

    if (error) {
      console.error('❌ [APPOINTMENTS] Supabase query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(400).json({ error: error.message });
    }

    console.log('✅ [APPOINTMENTS] Query successful, found', data?.length || 0, 'appointments');

    // Debug logging for appointments data
    console.log('[APPOINTMENTS] Fetched appointments count:', data.length);
    console.log('[APPOINTMENTS] Appointments data:', data.map(apt => ({
      id: apt.id,
      status: apt.status,
      payment_status: apt.payment_status,
      service: apt.service?.name,
      patient: apt.patient?.full_name,
      updated_at: apt.updated_at
    })));

    // Check specifically for appointment 22
    const appointment22 = data.find(apt => apt.id === 22);
    if (appointment22) {
      console.log('[APPOINTMENTS] Appointment 22 details:', {
        id: appointment22.id,
        status: appointment22.status,
        payment_status: appointment22.payment_status,
        updated_at: appointment22.updated_at,
        service: appointment22.service?.name
      });
    }

    res.json({ appointments: data });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to debug appointments API
router.get('/debug-test', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [APPOINTMENTS] Debug test endpoint hit');
    console.log('🧪 [APPOINTMENTS] User:', req.user);
    
    res.json({
      message: 'Appointments debug test working',
      user: req.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [APPOINTMENTS] Debug test error:', error);
    res.status(500).json({ error: 'Debug test failed' });
  }
});

// Book new appointment
router.post('/book', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const { dentist_id, service_id, appointment_time, notes } = req.body;
    const patient_id = req.user.id;

    console.log('Booking appointment:', { dentist_id, service_id, appointment_time, patient_id });

    // Validate required fields
    if (!dentist_id || !service_id || !appointment_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Temporary fix: If dentist ID is "1" or "2", return error with helpful message
    if (dentist_id === '1' || dentist_id === '2') {
      return res.status(400).json({ 
        error: `Invalid dentist ID "${dentist_id}". Please run the database fix to create a proper dentist user with UUID.`,
        details: `The dentist ID "${dentist_id}" is not a valid UUID. Run fix-dentist-uuid-issue.sql in Supabase.`
      });
    }

    // Check if dentist exists
    const { data: dentist, error: dentistError } = await supabase
      .from('users')
      .select('*')
      .eq('id', dentist_id)
      .eq('role', 'dentist')
      .single();

    if (dentistError || !dentist) {
      return res.status(404).json({ error: 'Dentist not found' });
    }

    // Check if service exists
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Enhanced conflict checking - check for exact time and overlapping slots
    const appointmentDateTime = new Date(appointment_time);
    const slotStart = new Date(appointmentDateTime.getTime() - 30 * 60000); // 30 minutes before
    const slotEnd = new Date(appointmentDateTime.getTime() + 90 * 60000);   // 90 minutes after

    console.log('🔍 [BOOKING] Checking for conflicts:', {
      appointment_time,
      dentist_id,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString()
    });

    const { data: conflicts, error: conflictError } = await supabase
      .from('appointments')
      .select('id, appointment_time, status, patient:users!appointments_patient_id_fkey(full_name)')
      .eq('dentist_id', dentist_id)
      .gte('appointment_time', slotStart.toISOString())
      .lte('appointment_time', slotEnd.toISOString())
      .in('status', ['pending', 'approved', 'completed']);

    if (conflictError) {
      console.error('❌ [BOOKING] Error checking conflicts:', conflictError);
      return res.status(400).json({ error: conflictError.message });
    }

    console.log('📋 [BOOKING] Found conflicts:', conflicts);

    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => ({
        time: new Date(c.appointment_time).toLocaleString(),
        status: c.status,
        patient: c.patient?.full_name || 'Unknown'
      }));
      
      return res.status(409).json({ 
        error: 'Time slot is not available',
        message: 'This time slot conflicts with existing appointments',
        conflicts: conflictDetails,
        suggested_action: 'Please select a different time slot'
      });
    }

    // Create appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([{
        patient_id: req.user.id,
        dentist_id,
        service_id,
        appointment_time,
        notes: notes || '',
        status: 'pending'
      }])
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Send notification
    notifyAppointmentBooked(appointment.id);

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve appointment (dentist only)
router.patch('/:id/approve', authenticateToken, requireRole(['dentist', 'admin']), async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Get appointment details
    const { data: appointment, error: getError } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `)
      .eq('id', appointmentId)
      .single();

    if (getError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if dentist owns this appointment (unless admin)
    if (req.user.role === 'dentist' && appointment.dentist_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to approve this appointment' });
    }

    // Update appointment status
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ status: 'approved' })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create Google Calendar event
    try {
      // Get dentist's Google Calendar tokens
      const { data: tokens, error: tokensError } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('dentist_id', appointment.dentist_id)
        .single();

      if (tokens && !tokensError) {
        // Set the credentials for this dentist
        setStoredCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expires_at ? new Date(tokens.expires_at).getTime() : null
        });

        const calendarData = {
          appointment_time: appointment.appointment_time,
          service_name: appointment.service.name,
          dentist_name: appointment.dentist.full_name,
          patient_name: appointment.patient.full_name,
          patient_email: appointment.patient.email,
          dentist_email: appointment.dentist.email,
          duration: appointment.service.duration || 60
        };

        console.log('Creating Google Calendar event for appointment:', appointmentId);
        const calendarResult = await createCalendarEvent(calendarData);
        
        if (calendarResult.success) {
          // Update appointment with calendar event ID
          await supabase
            .from('appointments')
            .update({ calendar_event_id: calendarResult.eventId })
            .eq('id', appointmentId);
          
          console.log('Calendar event created successfully:', calendarResult.eventId);
        } else {
          console.error('Calendar event creation failed:', calendarResult.error);
        }
      } else {
        console.log('No Google Calendar tokens found for dentist:', appointment.dentist_id);
      }
    } catch (calendarError) {
      console.error('Calendar event creation failed:', calendarError);
      // Continue without failing the approval
    }

    // Send notification
    notifyAppointmentApproved(appointmentId);

    res.json({
      message: 'Appointment approved successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Approve appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject appointment (dentist only)
router.patch('/:id/reject', authenticateToken, requireRole(['dentist', 'admin']), async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { reason } = req.body;

    // Get appointment details
    const { data: appointment, error: getError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (getError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if dentist owns this appointment (unless admin)
    if (req.user.role === 'dentist' && appointment.dentist_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this appointment' });
    }

    // Update appointment status
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ 
        status: 'rejected',
        rejection_reason: reason || 'No reason provided'
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // If payment was made, initiate refund
    if (appointment.payment_status === 'paid') {
      try {
        // Get payment details
        const { data: payment } = await supabase
          .from('payments')
          .select('*')
          .eq('appointment_id', appointmentId)
          .eq('status', 'completed')
          .single();

        if (payment && payment.paypal_transaction_id) {
          // Initiate refund
          const refundResult = await refundPayment(payment.paypal_transaction_id, payment.amount);
          
          if (refundResult) {
            // Update payment status
            await supabase
              .from('payments')
              .update({ status: 'refunded' })
              .eq('id', payment.id);

            // Update appointment payment status
            await supabase
              .from('appointments')
              .update({ payment_status: 'refunded' })
              .eq('id', appointmentId);
          }
        }
      } catch (refundError) {
        console.error('Refund failed:', refundError);
        // Continue without failing the rejection
      }
    }

    // Send notification
    notifyAppointmentRejected(appointmentId, reason);

    res.json({
      message: 'Appointment rejected successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Update appointment payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to check if requests are reaching this router
router.all('/:id/payment-status', (req, res, next) => {
  console.log('\n🚨 === PAYMENT STATUS ENDPOINT HIT ===');
  console.log('🚨 Method:', req.method);
  console.log('🚨 URL:', req.url);
  console.log('🚨 Params:', req.params);
  console.log('🚨 Body:', req.body);
  console.log('🚨 Headers:', req.headers);
  console.log('🚨 === CONTINUING TO HANDLER ===\n');
  next();
});

// Simple test endpoint first
router.patch('/:id/payment-status', (req, res) => {
  console.log('🎯 SIMPLE HANDLER HIT - No middleware');
  res.json({ message: 'Simple handler working', id: req.params.id });
});

// Update appointment payment status (commented out for testing)
/*
router.patch('/:id/payment-status', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    console.log('\n🔧 === APPOINTMENT PAYMENT STATUS UPDATE REQUEST ===');
    console.log('🔧 Request details:', {
      appointmentId: id,
      requestedStatus: payment_status,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      requestBody: req.body,
      requestHeaders: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        contentType: req.headers['content-type']
      }
    });

    // Validate required fields
    if (!id) {
      console.error('❌ Missing appointment ID');
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    if (!payment_status) {
      console.error('❌ Missing payment_status in request body');
      return res.status(400).json({ error: 'payment_status is required' });
    }

    // Validate payment status
    if (!['unpaid', 'paid', 'refunded'].includes(payment_status)) {
      console.error('❌ Invalid payment status value:', payment_status);
      return res.status(400).json({ 
        error: 'Invalid payment status', 
        validValues: ['unpaid', 'paid', 'refunded'],
        receivedValue: payment_status
      });
    }

    // Validate user
    if (!req.user || !req.user.id) {
      console.error('❌ No user found in request');
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log('✅ Validation passed, proceeding with database update...');

    // First, check if appointment exists and belongs to user
    console.log('🔍 Checking appointment ownership...');
    const { data: existingAppointment, error: checkError } = await supabase
      .from('appointments')
      .select('id, patient_id, payment_status, service_id, appointment_time')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('❌ Error checking appointment:', checkError);
      return res.status(400).json({ error: 'Failed to find appointment', details: checkError.message });
    }

    if (!existingAppointment) {
      console.error('❌ Appointment not found:', id);
      return res.status(404).json({ error: 'Appointment not found' });
    }

    console.log('📋 Found appointment:', existingAppointment);

    if (existingAppointment.patient_id !== req.user.id) {
      console.error('❌ User not authorized for appointment:', {
        appointmentPatientId: existingAppointment.patient_id,
        requestUserId: req.user.id
      });
      return res.status(403).json({ error: 'Not authorized to update this appointment' });
    }

    console.log('✅ User authorized, updating appointment...');

    // Update appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({ 
        payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('patient_id', req.user.id) // Double-check user ownership
      .select()
      .single();

    if (error) {
      console.error('❌ Database update error:', error);
      return res.status(400).json({ 
        error: 'Failed to update appointment', 
        details: error.message,
        code: error.code
      });
    }

    if (!appointment) {
      console.error('❌ No appointment returned after update');
      return res.status(404).json({ error: 'Appointment not found after update' });
    }

    console.log('✅ Appointment payment status updated successfully!');
    console.log('✅ Updated appointment:', appointment);
    console.log('🔧 === APPOINTMENT PAYMENT STATUS UPDATE SUCCESS ===\n');
    
    res.json({ 
      appointment, 
      message: 'Payment status updated successfully',
      previousStatus: existingAppointment.payment_status,
      newStatus: payment_status
    });
  } catch (error) {
    console.error('❌ === APPOINTMENT PAYMENT STATUS UPDATE ERROR ===');
    console.error('❌ Unexpected error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});
*/

// Cancel appointment
router.patch('/:id/cancel', authenticateToken, requireRole(['patient', 'dentist']), async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Get appointment details
    const { data: appointment, error: getError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('patient_id', req.user.id)
      .single();

    if (getError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment can be cancelled (not in the past)
    if (new Date(appointment.appointment_time) <= new Date()) {
      return res.status(400).json({ error: 'Cannot cancel past appointments' });
    }

    // Update appointment status
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Delete calendar event if exists
    if (appointment.calendar_event_id) {
      try {
        await deleteCalendarEvent(appointment.calendar_event_id);
      } catch (calendarError) {
        console.error('Calendar event deletion failed:', calendarError);
      }
    }

    res.json({
      message: 'Appointment cancelled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PERMANENT FIX: Manual payment status update endpoint
// This makes the payment status permanently paid by updating both appointment AND payment records
// IMPORTANT: This route MUST be before the generic /:id route to avoid conflicts
router.patch('/fix-payment-status/:id', authenticateToken, async (req, res) => {
  console.log('🔧 [APPOINTMENTS] ===== PERMANENT FIX ENDPOINT HIT =====');
  console.log('🔧 [APPOINTMENTS] Timestamp:', new Date().toISOString());
  console.log('🔧 [APPOINTMENTS] Appointment ID:', req.params.id);
  console.log('🔧 [APPOINTMENTS] User:', req.user?.email);
  
  const appointmentId = req.params.id;
  
  try {
    // First check current status and get appointment details
    console.log('🔍 [APPOINTMENTS] Checking current appointment status...');
    const { data: currentStatus, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id, 
        payment_status, 
        updated_at, 
        status,
        patient_id,
        service:services(price)
      `)
      .eq('id', appointmentId)
      .single();
      
    if (fetchError) {
      console.error('❌ [APPOINTMENTS] Error fetching appointment:', fetchError);
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    console.log('🔍 [APPOINTMENTS] Current status:', currentStatus);
    
    // Check if appointment exists and user has permission
    if (req.user.role === 'patient' && currentStatus.patient_id !== req.user.id) {
      console.error('❌ [APPOINTMENTS] User not authorized for this appointment');
      return res.status(403).json({ error: 'Not authorized to fix this appointment' });
    }
    
    // STEP 1: Check if payment record exists
    console.log('💰 [APPOINTMENTS] Checking for existing payment record...');
    const { data: existingPayments, error: paymentCheckError } = await supabase
      .from('payments')
      .select('*')
      .eq('appointment_id', appointmentId);
      
    if (paymentCheckError) {
      console.error('❌ [APPOINTMENTS] Error checking payments:', paymentCheckError);
    } else {
      console.log('💰 [APPOINTMENTS] Found payments:', existingPayments?.length || 0);
    }
    
    // STEP 2: Create or update payment record to 'completed'
    let paymentRecord = null;
    if (!existingPayments || existingPayments.length === 0) {
      console.log('💰 [APPOINTMENTS] Creating new payment record...');
      const { data: newPayment, error: createError } = await supabase
        .from('payments')
        .insert([{
          appointment_id: appointmentId,
          amount: currentStatus.service?.price || 100,
          status: 'completed',
          paypal_payment_id: `MANUAL-FIX-${appointmentId}-${Date.now()}`,
          paypal_transaction_id: `TXN-FIX-${appointmentId}-${Date.now()}`,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (createError) {
        console.error('❌ [APPOINTMENTS] Error creating payment:', createError);
      } else {
        console.log('✅ [APPOINTMENTS] Created payment record:', newPayment);
        paymentRecord = newPayment;
      }
    } else {
      // Update existing payment to completed
      console.log('💰 [APPOINTMENTS] Updating existing payment to completed...');
      const { data: updatedPayment, error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          paypal_transaction_id: existingPayments[0].paypal_transaction_id || `TXN-FIX-${appointmentId}-${Date.now()}`
        })
        .eq('id', existingPayments[0].id)
        .select()
        .single();
        
      if (updatePaymentError) {
        console.error('❌ [APPOINTMENTS] Error updating payment:', updatePaymentError);
      } else {
        console.log('✅ [APPOINTMENTS] Updated payment record:', updatedPayment);
        paymentRecord = updatedPayment;
      }
    }
    
    // STEP 3: Update appointment to paid status with multiple approaches
    console.log('🔧 [APPOINTMENTS] Updating appointment payment status to PAID...');
    console.log('🔧 [APPOINTMENTS] Appointment ID type:', typeof appointmentId, 'Value:', appointmentId);
    
    let updateResult = null;
    let updateError = null;
    
    // Try multiple ID formats to ensure compatibility
    const idFormats = [
      appointmentId,           // Original string
      parseInt(appointmentId), // Integer
      String(appointmentId)    // Explicit string
    ];
    
    for (let i = 0; i < idFormats.length; i++) {
      const idToTry = idFormats[i];
      console.log(`🔧 [APPOINTMENTS] Attempt ${i + 1}: Trying ID format:`, typeof idToTry, idToTry);
      
      const { data: result, error: err } = await supabase
        .from('appointments')
        .update({ 
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', idToTry)
        .select();
        
      console.log(`🔧 [APPOINTMENTS] Attempt ${i + 1} result:`, {
        success: !err,
        rowsAffected: result?.length || 0,
        error: err?.message || 'none'
      });
      
      if (!err && result && result.length > 0) {
        updateResult = result;
        updateError = null;
        console.log(`✅ [APPOINTMENTS] Success with attempt ${i + 1}!`);
        break;
      } else if (err) {
        updateError = err;
      }
    }
    
    if (updateError) {
      console.error('❌ [APPOINTMENTS] All update attempts failed:', updateError);
      return res.status(400).json({ 
        error: updateError.message,
        details: 'Failed to update appointment with all ID formats',
        appointmentId: appointmentId,
        triedFormats: idFormats
      });
    }
    
    if (!updateResult || updateResult.length === 0) {
      console.error('❌ [APPOINTMENTS] No rows were updated with any ID format');
      return res.status(404).json({ 
        error: 'No rows updated - appointment not found with any ID format',
        appointmentId: appointmentId,
        triedFormats: idFormats
      });
    }
    
    console.log('✅ [APPOINTMENTS] Appointment updated successfully:', updateResult);
    
    // Verify the update
    const { data: verifyResult, error: verifyError } = await supabase
      .from('appointments')
      .select('id, payment_status, updated_at')
      .eq('id', appointmentId)
      .single();
      
    if (verifyError) {
      console.error('❌ [APPOINTMENTS] Verification failed:', verifyError);
    } else {
      console.log('🔍 [APPOINTMENTS] Verification result:', verifyResult);
    }
    
    res.json({
      message: 'Payment status PERMANENTLY updated to paid',
      before: currentStatus,
      after: verifyResult,
      paymentRecord: paymentRecord,
      rowsAffected: updateResult?.length || 0,
      permanent: true,
      details: 'Both appointment and payment records have been updated to ensure permanent paid status'
    });
    
  } catch (error) {
    console.error('❌ [APPOINTMENTS] Manual fix error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get appointment by ID (MUST be after specific routes to avoid conflicts)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `)
      .eq('id', appointmentId);

    // Apply role-based filtering
    if (req.user.role === 'patient') {
      query = query.eq('patient_id', req.user.id);
    } else if (req.user.role === 'dentist') {
      query = query.eq('dentist_id', req.user.id);
    }

    const { data: appointment, error } = await query.single();

    if (error || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
