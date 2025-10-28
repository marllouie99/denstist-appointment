import express from 'express';
import { supabase } from '../services/supabase.js';
import { createPayment, executePayment, getPaymentDetails } from '../services/paypal.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notifyPaymentConfirmed } from '../services/notifications.js';
import { paymentSyncService } from '../services/paymentSync.js';
import { paymentStatusMonitor } from '../services/paymentStatusMonitor.js';

const router = express.Router();

// Test endpoint to debug appointment payment status update
router.post('/test-appointment-update', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [PAYMENTS] Test appointment update endpoint hit');
    console.log('🧪 [PAYMENTS] User:', req.user);
    console.log('🧪 [PAYMENTS] Request body:', req.body);
    
    const { appointment_id } = req.body;
    
    if (!appointment_id) {
      return res.status(400).json({ error: 'appointment_id is required' });
    }
    
    console.log('🧪 [PAYMENTS] Attempting to update appointment payment status...');
    console.log('🧪 [PAYMENTS] Appointment ID:', appointment_id);
    
    // Try to update appointment payment status
    const { data: appointmentUpdate, error: appointmentError } = await supabase
      .from('appointments')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id)
      .select();

    if (appointmentError) {
      console.error('❌ [PAYMENTS] Test appointment update error:', appointmentError);
      return res.status(400).json({ 
        error: 'Failed to update appointment', 
        details: appointmentError 
      });
    }

    console.log('✅ [PAYMENTS] Test appointment update successful:', appointmentUpdate);
    
    // Verify the update
    const { data: verifyAppointment, error: verifyError } = await supabase
      .from('appointments')
      .select('id, payment_status, updated_at')
      .eq('id', appointment_id)
      .single();
      
    if (verifyError) {
      console.error('❌ [PAYMENTS] Test verification error:', verifyError);
    } else {
      console.log('🔍 [PAYMENTS] Test verification result:', verifyAppointment);
    }
    
    res.json({
      message: 'Test appointment update completed',
      update_result: appointmentUpdate,
      verification: verifyAppointment,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [PAYMENTS] Test appointment update error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Debug endpoint to check appointment eligibility for payment
router.get('/debug/:appointmentId', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    console.log('Debug payment eligibility for appointment:', appointmentId);
    console.log('User:', req.user.id, req.user.role);

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        service:services(id, name, price),
        patient:users!appointments_patient_id_fkey(id, full_name, email)
      `)
      .eq('id', appointmentId)
      .single();

    const response = {
      appointment_found: !!appointment,
      appointment_error: appointmentError,
      user_id: req.user.id,
      user_role: req.user.role
    };

    if (appointment) {
      response.appointment_details = {
        id: appointment.id,
        status: appointment.status,
        payment_status: appointment.payment_status,
        patient_id: appointment.patient_id,
        service: appointment.service,
        belongs_to_user: appointment.patient_id === req.user.id
      };

      response.payment_eligible = 
        appointment.status === 'approved' && 
        appointment.payment_status !== 'paid' &&
        appointment.patient_id === req.user.id;

      response.eligibility_checks = {
        is_approved: appointment.status === 'approved',
        not_already_paid: appointment.payment_status !== 'paid',
        belongs_to_user: appointment.patient_id === req.user.id
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create payment for appointment
router.post('/create', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const { appointment_id } = req.body;
    console.log('Creating payment for appointment:', appointment_id);
    console.log('User:', req.user.id, req.user.role);

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        service:services(id, name, price),
        patient:users!appointments_patient_id_fkey(id, full_name, email)
      `)
      .eq('id', appointment_id)
      .eq('patient_id', req.user.id)
      .single();

    if (appointmentError || !appointment) {
      console.log('Appointment error:', appointmentError);
      console.log('Appointment found:', !!appointment);
      return res.status(404).json({ error: 'Appointment not found' });
    }

    console.log('Appointment status:', appointment.status);
    console.log('Payment status:', appointment.payment_status);

    // Check if appointment is approved
    if (appointment.status !== 'approved') {
      return res.status(400).json({ error: 'Appointment must be approved before payment' });
    }

    // Check if already paid
    if (appointment.payment_status === 'paid') {
      return res.status(400).json({ error: 'Appointment already paid' });
    }

    // Create PayPal payment
    const paymentData = {
      appointment_id: appointment.id,
      service_name: appointment.service.name,
      amount: appointment.service.price
    };

    console.log('Creating PayPal payment with data:', paymentData);
    const payment = await createPayment(paymentData);
    console.log('PayPal payment created:', payment.id);

    // Store payment in database
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        appointment_id: appointment.id,
        amount: appointment.service.price,
        status: 'pending',
        paypal_payment_id: payment.id
      }])
      .select()
      .single();

    if (paymentError) {
      console.log('Payment record error:', paymentError);
      return res.status(400).json({ error: paymentError.message });
    }

    // Find approval URL
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');

    res.json({
      message: 'Payment created successfully',
      payment_id: payment.id,
      approval_url: approvalUrl.href,
      payment_record: paymentRecord
    });
  } catch (error) {
    console.error('Create payment error:', error);
    if (error.response) {
      console.error('PayPal API error response:', error.response);
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Execute payment after PayPal approval
router.post('/execute', authenticateToken, async (req, res) => {
  console.log('🚀 [PAYMENT EXECUTE] ===== PAYMENT EXECUTION STARTED =====');
  console.log('🚀 [PAYMENT EXECUTE] Timestamp:', new Date().toISOString());
  console.log('🚀 [PAYMENT EXECUTE] Request body:', JSON.stringify(req.body, null, 2));
  console.log('🚀 [PAYMENT EXECUTE] User info:', req.user ? {
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  } : 'No user');

  const { paymentId, payerId, appointmentId } = req.body;
  
  console.log('🚀 [PAYMENT EXECUTE] Extracted parameters:', {
    paymentId,
    payerId,
    appointmentId
  });

  try {
    const { payment_id, payer_id } = req.body;

    // Get payment record
    console.log('🔍 [PAYMENT EXECUTE] Fetching payment record for PayPal ID:', payment_id);
    const { data: paymentRecord, error: recordError } = await supabase
      .from('payments')
      .select('*')
      .eq('paypal_payment_id', payment_id)
      .single();

    if (recordError || !paymentRecord) {
      console.error('❌ [PAYMENT EXECUTE] Payment record not found:', recordError);
      return res.status(404).json({ error: 'Payment record not found' });
    }
    
    console.log('✅ [PAYMENT EXECUTE] Payment record found:', {
      id: paymentRecord.id,
      appointment_id: paymentRecord.appointment_id,
      status: paymentRecord.status,
      amount: paymentRecord.amount
    });

    // Execute PayPal payment
    console.log('💳 [PAYMENT EXECUTE] Executing PayPal payment...');
    console.log('💳 [PAYMENT EXECUTE] PayPal Payment ID:', payment_id);
    console.log('💳 [PAYMENT EXECUTE] Payer ID:', payer_id);
    const executedPayment = await executePayment(payment_id, payer_id);
    console.log('✅ [PAYMENT EXECUTE] PayPal payment executed successfully!');
    console.log('✅ [PAYMENT EXECUTE] Executed payment details:', {
      id: executedPayment.id,
      state: executedPayment.state,
      transaction_id: executedPayment.transactions?.[0]?.related_resources?.[0]?.sale?.id
    });

    // Use enhanced payment sync service
    const transactionId = executedPayment.transactions?.[0]?.related_resources?.[0]?.sale?.id;
    console.log('🔄 [PAYMENT EXECUTE] Using enhanced payment sync service...');
    console.log('🔄 [PAYMENT EXECUTE] Sync parameters:', {
      paymentRecordId: paymentRecord.id,
      appointmentId: paymentRecord.appointment_id,
      transactionId: transactionId
    });
    
    let syncResult;
    try {
      syncResult = await paymentSyncService.syncPaymentStatus({
        paymentRecord,
        executedPayment,
        transactionId
      });
      console.log('🔄 [PAYMENT EXECUTE] Sync result:', syncResult);
    } catch (syncError) {
      console.error('❌ [PAYMENT EXECUTE] Payment sync service error:', syncError);
      console.error('❌ [PAYMENT EXECUTE] Sync error details:', {
        message: syncError.message,
        stack: syncError.stack,
        name: syncError.name
      });
      
      // Create a failed sync result to continue processing
      syncResult = {
        success: false,
        error: syncError.message,
        paymentUpdate: null,
        appointmentUpdate: null,
        verification: null
      };
    }

    if (!syncResult.success) {
      console.error('❌ [PAYMENT EXECUTE] Payment sync failed:', syncResult.error || syncResult.message);
      
      // Don't return 500 - payment was successful, just sync failed
      // Frontend can handle this and retry sync
      console.log('⚠️ [PAYMENT EXECUTE] Returning success with sync failure flag...');
      
      return res.json({
        message: 'Payment completed successfully but status sync pending',
        payment: syncResult.paymentUpdate?.data || paymentRecord,
        paypal_payment: executedPayment,
        sync_failed: true,
        sync_error: syncResult.message,
        appointment_id: paymentRecord.appointment_id,
        // Frontend can use these for retry
        appointmentUpdate: null,
        verifyAppointment: null
      });
    }

    console.log('✅ [PAYMENT EXECUTE] Payment sync completed successfully!');
    
    // Extract results for response
    const updatedPayment = syncResult.paymentUpdate?.data;
    const appointmentUpdate = syncResult.appointmentUpdate?.data;
    const verifyAppointment = syncResult.verification?.data;

    console.log('📤 [PAYMENT EXECUTE] Sending response to frontend...');
    const response = {
      message: 'Payment completed successfully',
      payment: updatedPayment,
      paypal_payment: executedPayment,
      // Frontend expects these exact property names
      appointmentUpdate: appointmentUpdate, // Array of updated appointments
      verifyAppointment: verifyAppointment, // Single appointment verification
      // Legacy structure for debugging
      appointment_update: {
        appointment_id: paymentRecord.appointment_id,
        updated: !!appointmentUpdate,
        verification: verifyAppointment
      }
    };
    
    console.log('📤 [PAYMENT EXECUTE] Response data:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ [PAYMENT EXECUTE] Execute payment error:', error);
    console.error('❌ [PAYMENT EXECUTE] Error stack:', error.stack);
    console.error('❌ [PAYMENT EXECUTE] Error message:', error.message);
    console.error('❌ [PAYMENT EXECUTE] Error name:', error.name);
    console.error('❌ [PAYMENT EXECUTE] Error code:', error.code);
    
    // Enhanced error analysis
    if (error.message?.includes('PayPal')) {
      console.error('🔍 [PAYMENT EXECUTE] PayPal API Error detected');
      console.error('🔍 [PAYMENT EXECUTE] PayPal Error Details:', {
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
    } else if (error.message?.includes('Supabase') || error.code) {
      console.error('🔍 [PAYMENT EXECUTE] Database Error detected');
      console.error('🔍 [PAYMENT EXECUTE] Database Error Details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      });
    } else if (error.message?.includes('sync')) {
      console.error('🔍 [PAYMENT EXECUTE] Payment Sync Error detected');
    }
    
    console.error('❌ [PAYMENT EXECUTE] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check appointment payment status sync
router.get('/debug-appointment/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    console.log(`🔍 [DEBUG] Checking appointment ${appointmentId} payment status sync...`);
    
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, payment_status, updated_at, status')
      .eq('id', appointmentId)
      .single();
      
    // Get payment details
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, status, completed_at, paypal_payment_id, paypal_transaction_id, created_at, updated_at')
      .eq('appointment_id', appointmentId);
      
    const debugInfo = {
      appointment_id: appointmentId,
      appointment: appointment || null,
      appointment_error: appointmentError || null,
      payments: payments || [],
      payments_error: paymentsError || null,
      sync_status: null,
      issue_detected: false
    };
    
    if (appointment && payments && payments.length > 0) {
      const completedPayment = payments.find(p => p.status === 'completed');
      if (completedPayment && appointment.payment_status === 'unpaid') {
        debugInfo.sync_status = 'MISMATCH_DETECTED';
        debugInfo.issue_detected = true;
        debugInfo.issue_description = 'Payment is completed but appointment shows unpaid';
      } else if (completedPayment && appointment.payment_status === 'paid') {
        debugInfo.sync_status = 'CORRECTLY_SYNCED';
      } else if (!completedPayment && appointment.payment_status === 'unpaid') {
        debugInfo.sync_status = 'CORRECTLY_UNPAID';
      } else {
        debugInfo.sync_status = 'OTHER_STATE';
      }
    }
    
    console.log(`🔍 [DEBUG] Appointment ${appointmentId} debug info:`, debugInfo);
    res.json(debugInfo);
    
  } catch (error) {
    console.error(`❌ [DEBUG] Error debugging appointment:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Simple update to paid endpoint
router.post('/update-to-paid/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    console.log(`💰 [UPDATE TO PAID] Request to update appointment ${appointmentId} to paid`);
    
    // Direct update to paid status
    const { data: updatedAppointment, error: updateError } = await supabase
      .from('appointments')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .single();
    
    if (updateError) {
      console.error(`❌ [UPDATE TO PAID] Error updating appointment ${appointmentId}:`, updateError);
      return res.status(500).json({ 
        error: 'Failed to update payment status',
        details: updateError.message 
      });
    }
    
    if (!updatedAppointment) {
      console.error(`❌ [UPDATE TO PAID] No appointment found with ID ${appointmentId}`);
      return res.status(404).json({ 
        error: 'Appointment not found' 
      });
    }
    
    console.log(`✅ [UPDATE TO PAID] Successfully updated appointment ${appointmentId} to paid:`, updatedAppointment);
    
    res.json({
      message: 'Payment status updated to paid successfully',
      appointment: updatedAppointment,
      previous_status: 'unpaid',
      new_status: 'paid'
    });
    
  } catch (error) {
    console.error(`❌ [UPDATE TO PAID] Unexpected error:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Force update appointment payment status
router.post('/force-update-appointment/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    console.log(`🔧 [FORCE UPDATE] Force update requested for appointment ${appointmentId}`);
    
    // Direct SQL update with multiple approaches
    const approaches = [
      // Approach 1: Standard update
      () => supabase
        .from('appointments')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .select(),
      
      // Approach 2: Update with integer conversion
      () => supabase
        .from('appointments')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', parseInt(appointmentId))
        .select(),
        
      // Approach 3: Update with string conversion
      () => supabase
        .from('appointments')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', String(appointmentId))
        .select()
    ];
    
    let success = false;
    let result = null;
    
    for (let i = 0; i < approaches.length; i++) {
      console.log(`🔧 [FORCE UPDATE] Trying approach ${i + 1}...`);
      try {
        const { data, error } = await approaches[i]();
        if (!error && data && data.length > 0) {
          console.log(`✅ [FORCE UPDATE] Approach ${i + 1} succeeded:`, data);
          success = true;
          result = data;
          break;
        } else {
          console.log(`❌ [FORCE UPDATE] Approach ${i + 1} failed:`, error || 'No rows updated');
        }
      } catch (err) {
        console.log(`❌ [FORCE UPDATE] Approach ${i + 1} exception:`, err.message);
      }
    }
    
    if (success) {
      res.json({
        message: 'Appointment payment status force updated successfully',
        appointment: result[0],
        method: 'force_update'
      });
    } else {
      res.status(500).json({
        error: 'All update approaches failed',
        appointment_id: appointmentId
      });
    }
    
  } catch (error) {
    console.error(`❌ [FORCE UPDATE] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced manual fix endpoint using payment sync service
router.patch('/fix-appointment/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    console.log(`🔧 [FIX] Enhanced manual fix requested for appointment ${appointmentId}`);
    
    // Use the enhanced payment sync service for manual sync
    const syncResult = await paymentSyncService.manualSync(appointmentId);
    
    console.log(`🔧 [FIX] Manual sync result:`, syncResult);
    
    if (!syncResult.success) {
      return res.status(400).json({
        error: syncResult.message || 'Manual sync failed',
        details: syncResult.error,
        appointment_id: appointmentId
      });
    }
    
    res.json({
      message: syncResult.message,
      appointment: syncResult.verification?.data,
      payment: syncResult.payment,
      sync_details: {
        appointment_update: syncResult.appointmentUpdate,
        verification: syncResult.verification
      }
    });
    
  } catch (error) {
    console.error(`❌ [FIX] Error in enhanced manual fix:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Privacy-aware data masking function
const maskSensitivePaymentData = (payment, userRole, userId) => {
  console.log('🔒 [PRIVACY] Masking sensitive data for user role:', userRole);
  
  if (!payment) return null;
  
  const maskedPayment = { ...payment };
  
  // Always mask full PayPal IDs for security
  if (maskedPayment.paypal_payment_id) {
    maskedPayment.paypal_payment_id = maskedPayment.paypal_payment_id.substring(0, 8) + '***';
  }
  if (maskedPayment.paypal_transaction_id) {
    maskedPayment.paypal_transaction_id = maskedPayment.paypal_transaction_id.substring(0, 8) + '***';
  }
  
  // Role-based privacy protection
  if (userRole === 'patient') {
    // Patients can see their own full payment details
    if (maskedPayment.appointment?.patient_id !== userId) {
      console.log('🚨 [PRIVACY] Blocking access to other patient\'s payment data');
      return null; // Block access to other patients' data
    }
  } else if (userRole === 'dentist') {
    // Dentists can see payments for their appointments but with patient privacy
    if (maskedPayment.appointment?.dentist_id !== userId) {
      console.log('🚨 [PRIVACY] Blocking access to other dentist\'s payment data');
      return null; // Block access to other dentists' data
    }
    // Mask patient personal details for dentist view
    if (maskedPayment.appointment?.patient) {
      maskedPayment.appointment.patient.full_name = 'Patient ***';
    }
  } else if (userRole === 'admin') {
    // Admins can see aggregated data but with privacy protection
    // Keep data as-is but log admin access
    console.log('🔍 [ADMIN ACCESS] Admin viewing payment data:', {
      admin_id: userId,
      payment_id: maskedPayment.id,
      timestamp: new Date().toISOString()
    });
  }
  
  return maskedPayment;
};

// Enhanced privacy-aware payment history endpoint
router.get('/history', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [PAYMENTS] GET /history - Privacy-aware request:', {
      user: req.user ? {
        id: req.user.id,
        email: req.user.email ? req.user.email.substring(0, 3) + '***' : 'No email', // Mask email in logs
        role: req.user.role
      } : 'No user',
      ip_address: req.ip || req.connection?.remoteAddress || 'Unknown',
      user_agent: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 50) + '...' : 'Unknown',
      timestamp: new Date().toISOString()
    });

    // Enhanced privacy check - ensure user is authenticated
    if (!req.user || !req.user.id) {
      console.log('🚨 [PRIVACY] Unauthorized payment history access attempt');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Role-based access control
    if (!['patient', 'dentist', 'admin'].includes(req.user.role)) {
      console.log('🚨 [PRIVACY] Invalid role attempting payment history access:', req.user.role);
      return res.status(403).json({ error: 'Access denied - invalid role' });
    }

    // Handle test user with privacy-aware mock data
    if (req.user.id === '00000000-0000-0000-0000-000000000001') {
      console.log('🧪 [PAYMENTS] Test user detected - returning privacy-aware mock payments');
      const mockPayments = [
        {
          id: 1,
          appointment_id: 34,
          amount: 100,
          status: 'completed',
          paypal_payment_id: 'PAY-TEST***', // Pre-masked
          paypal_transaction_id: 'TXN-TEST***', // Pre-masked
          created_at: '2025-10-05T19:00:00Z',
          completed_at: new Date().toISOString(),
          appointment: {
            id: 34,
            appointment_time: '2025-10-06T10:00:00Z',
            status: 'approved',
            patient_id: req.user.id, // Ensure ownership
            service: { name: 'General Checkup' },
            dentist: { full_name: 'Dr. Test' },
            patient: { full_name: 'Test User' }
          }
        }
      ];
      
      console.log('🧪 [PAYMENTS] Returning mock payments with privacy protection:', mockPayments.length);
      return res.json({ payments: mockPayments });
    }

    // Build privacy-aware query based on user role
    let query = supabase
      .from('payments')
      .select(`
        id,
        appointment_id,
        amount,
        status,
        paypal_payment_id,
        paypal_transaction_id,
        created_at,
        completed_at,
        updated_at,
        appointment:appointments(
          id,
          appointment_time,
          status,
          patient_id,
          dentist_id,
          service:services(id, name, price),
          dentist:users!appointments_dentist_id_fkey(id, full_name),
          patient:users!appointments_patient_id_fkey(id, full_name)
        )
      `);

    // Strict role-based filtering with privacy protection
    if (req.user.role === 'patient') {
      console.log('🔍 [PAYMENTS] Patient access - filtering by patient_id:', req.user.id);
      // Use a subquery to ensure we only get payments for appointments belonging to this patient
      const { data: userAppointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', req.user.id);
      
      if (appointmentError) {
        console.error('❌ [PAYMENTS] Error fetching user appointments:', appointmentError);
        return res.status(500).json({ error: 'Failed to verify appointment access' });
      }
      
      const appointmentIds = userAppointments.map(apt => apt.id);
      console.log('🔍 [PAYMENTS] Patient has', appointmentIds.length, 'appointments');
      
      if (appointmentIds.length === 0) {
        console.log('🔍 [PAYMENTS] Patient has no appointments, returning empty result');
        return res.json({ payments: [] });
      }
      
      query = query.in('appointment_id', appointmentIds);
      
    } else if (req.user.role === 'dentist') {
      console.log('🔍 [PAYMENTS] Dentist access - filtering by dentist_id:', req.user.id);
      // Similar approach for dentists
      const { data: dentistAppointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('dentist_id', req.user.id);
      
      if (appointmentError) {
        console.error('❌ [PAYMENTS] Error fetching dentist appointments:', appointmentError);
        return res.status(500).json({ error: 'Failed to verify appointment access' });
      }
      
      const appointmentIds = dentistAppointments.map(apt => apt.id);
      console.log('🔍 [PAYMENTS] Dentist has', appointmentIds.length, 'appointments');
      
      if (appointmentIds.length === 0) {
        console.log('🔍 [PAYMENTS] Dentist has no appointments, returning empty result');
        return res.json({ payments: [] });
      }
      
      query = query.in('appointment_id', appointmentIds);
      
    } else if (req.user.role === 'admin') {
      console.log('🔍 [PAYMENTS] Admin access - full access with audit logging');
      // Admins get full access but with audit trail
      console.log('🔍 [ADMIN AUDIT] Payment history accessed by admin:', {
        admin_id: req.user.id,
        admin_email: req.user.email ? req.user.email.substring(0, 3) + '***' : 'No email',
        timestamp: new Date().toISOString(),
        ip_address: req.ip || 'Unknown'
      });
    }

    console.log('📡 [PAYMENTS] Executing privacy-aware Supabase query...');
    const { data: payments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [PAYMENTS] Supabase query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        user_role: req.user.role,
        timestamp: new Date().toISOString()
      });
      return res.status(400).json({ error: 'Failed to fetch payment history' });
    }

    console.log('✅ [PAYMENTS] Query successful, found', payments?.length || 0, 'payments');
    
    // Apply privacy masking to all payments
    const maskedPayments = payments
      .map(payment => maskSensitivePaymentData(payment, req.user.role, req.user.id))
      .filter(payment => payment !== null); // Remove blocked payments

    console.log('🔒 [PRIVACY] Applied privacy masking, returning', maskedPayments.length, 'payments');
    console.log('🔍 [PAYMENTS] Privacy-masked payment preview:', maskedPayments.map(p => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      appointment_id: p.appointment_id,
      created_at: p.created_at,
      has_sensitive_data_masked: !!(p.paypal_payment_id?.includes('***'))
    })));

    res.json({ 
      payments: maskedPayments,
      privacy_notice: 'Sensitive payment data has been masked for privacy protection',
      total_count: maskedPayments.length
    });
    
  } catch (error) {
    console.error('❌ [PAYMENTS] Get payment history error:', {
      message: error.message,
      stack: error.stack,
      user_id: req.user?.id || 'Unknown',
      user_role: req.user?.role || 'Unknown',
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced privacy-aware payment details endpoint
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const paymentId = req.params.id;
    
    console.log('🔍 [PAYMENT DETAILS] Privacy-aware request for payment:', {
      payment_id: paymentId,
      user: req.user ? {
        id: req.user.id,
        email: req.user.email ? req.user.email.substring(0, 3) + '***' : 'No email',
        role: req.user.role
      } : 'No user',
      ip_address: req.ip || req.connection?.remoteAddress || 'Unknown',
      timestamp: new Date().toISOString()
    });

    // Enhanced privacy check - ensure user is authenticated
    if (!req.user || !req.user.id) {
      console.log('🚨 [PRIVACY] Unauthorized payment details access attempt for payment:', paymentId);
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate payment ID format
    if (!paymentId || isNaN(paymentId)) {
      console.log('🚨 [PRIVACY] Invalid payment ID format:', paymentId);
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    console.log('📡 [PAYMENT DETAILS] Fetching payment with privacy controls...');
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        id,
        appointment_id,
        amount,
        status,
        paypal_payment_id,
        paypal_transaction_id,
        created_at,
        completed_at,
        updated_at,
        appointment:appointments(
          id,
          appointment_time,
          status,
          patient_id,
          dentist_id,
          service:services(id, name, price),
          dentist:users!appointments_dentist_id_fkey(id, full_name),
          patient:users!appointments_patient_id_fkey(id, full_name)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      console.log('❌ [PAYMENT DETAILS] Payment not found:', {
        payment_id: paymentId,
        error: error?.message,
        user_id: req.user.id
      });
      return res.status(404).json({ error: 'Payment not found' });
    }

    console.log('✅ [PAYMENT DETAILS] Payment found, checking access permissions...');

    // Enhanced access control with detailed logging
    let accessGranted = false;
    let accessReason = '';

    if (req.user.role === 'patient') {
      if (payment.appointment?.patient_id === req.user.id) {
        accessGranted = true;
        accessReason = 'Patient accessing own payment';
      } else {
        console.log('🚨 [PRIVACY] Patient attempting to access another patient\'s payment:', {
          requesting_patient: req.user.id,
          payment_belongs_to: payment.appointment?.patient_id,
          payment_id: paymentId
        });
        accessReason = 'Patient accessing other patient\'s payment - BLOCKED';
      }
    } else if (req.user.role === 'dentist') {
      if (payment.appointment?.dentist_id === req.user.id) {
        accessGranted = true;
        accessReason = 'Dentist accessing payment for their appointment';
      } else {
        console.log('🚨 [PRIVACY] Dentist attempting to access another dentist\'s payment:', {
          requesting_dentist: req.user.id,
          payment_belongs_to: payment.appointment?.dentist_id,
          payment_id: paymentId
        });
        accessReason = 'Dentist accessing other dentist\'s payment - BLOCKED';
      }
    } else if (req.user.role === 'admin') {
      accessGranted = true;
      accessReason = 'Admin access with audit trail';
      console.log('🔍 [ADMIN AUDIT] Admin accessing payment details:', {
        admin_id: req.user.id,
        payment_id: paymentId,
        patient_id: payment.appointment?.patient_id,
        dentist_id: payment.appointment?.dentist_id,
        timestamp: new Date().toISOString()
      });
    } else {
      accessReason = 'Invalid role - BLOCKED';
    }

    console.log('🔒 [ACCESS CONTROL] Payment access decision:', {
      payment_id: paymentId,
      user_id: req.user.id,
      user_role: req.user.role,
      access_granted: accessGranted,
      reason: accessReason
    });

    if (!accessGranted) {
      return res.status(403).json({ error: 'Access denied - insufficient permissions' });
    }

    // Apply privacy masking
    const maskedPayment = maskSensitivePaymentData(payment, req.user.role, req.user.id);

    if (!maskedPayment) {
      console.log('🚨 [PRIVACY] Payment blocked by privacy masking function');
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('✅ [PAYMENT DETAILS] Returning privacy-protected payment details');
    res.json({ 
      payment: maskedPayment,
      privacy_notice: 'Sensitive payment data has been masked for privacy protection',
      access_reason: accessReason
    });

  } catch (error) {
    console.error('❌ [PAYMENT DETAILS] Get payment error:', {
      message: error.message,
      stack: error.stack,
      payment_id: req.params.id,
      user_id: req.user?.id || 'Unknown',
      user_role: req.user?.role || 'Unknown',
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PayPal webhook (for payment notifications)
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    
    // Verify webhook signature (implement based on PayPal documentation)
    // For now, we'll process the event directly
    
    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const saleId = event.resource.id;
      const paymentId = event.resource.parent_payment;
      
      // Update payment status
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          paypal_transaction_id: saleId
        })
        .eq('paypal_payment_id', paymentId);

      if (error) {
        console.error('Webhook payment update error:', error);
      }
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Payment Status Monitor Control Endpoints

// Start payment status monitoring
router.post('/monitor/start', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('📊 [PAYMENT MONITOR] Start monitoring requested by admin');
    
    await paymentStatusMonitor.startMonitoring();
    const status = await paymentStatusMonitor.getMonitoringStatus();
    
    res.json({
      message: 'Payment status monitoring started',
      status
    });
    
  } catch (error) {
    console.error('❌ [PAYMENT MONITOR] Error starting monitor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop payment status monitoring
router.post('/monitor/stop', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('📊 [PAYMENT MONITOR] Stop monitoring requested by admin');
    
    paymentStatusMonitor.stopMonitoring();
    const status = await paymentStatusMonitor.getMonitoringStatus();
    
    res.json({
      message: 'Payment status monitoring stopped',
      status
    });
    
  } catch (error) {
    console.error('❌ [PAYMENT MONITOR] Error stopping monitor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get monitoring status
router.get('/monitor/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const status = await paymentStatusMonitor.getMonitoringStatus();
    
    res.json({
      message: 'Payment monitoring status retrieved',
      status
    });
    
  } catch (error) {
    console.error('❌ [PAYMENT MONITOR] Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync check for all appointments
router.post('/monitor/check-all', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('🔍 [PAYMENT MONITOR] Manual sync check requested by admin');
    
    await paymentStatusMonitor.checkForSyncIssues();
    const status = await paymentStatusMonitor.getMonitoringStatus();
    
    res.json({
      message: 'Manual sync check completed',
      status
    });
    
  } catch (error) {
    console.error('❌ [PAYMENT MONITOR] Error in manual check:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
