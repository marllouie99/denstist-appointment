import express from 'express';
import { supabase } from '../services/supabase.js';
import { paymentSyncService } from '../services/paymentSync.js';

const router = express.Router();

/**
 * Payment Success Webhook Handler
 * Catches successful payments and updates appointment status
 */

// Middleware to log all webhook requests
router.use((req, res, next) => {
  console.log('🔔 [WEBHOOK] Payment webhook request received:', {
    method: req.method,
    path: req.path,
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  next();
});

// PayPal webhook endpoint
router.post('/paypal', async (req, res) => {
  try {
    console.log('💳 [WEBHOOK] PayPal webhook received:', req.body);
    
    const { event_type, resource } = req.body;
    
    // Handle payment completion events
    if (event_type === 'PAYMENT.SALE.COMPLETED' || event_type === 'CHECKOUT.ORDER.APPROVED') {
      console.log('✅ [WEBHOOK] Payment completion event detected');
      
      // Extract payment information
      const paymentId = resource.parent_payment || resource.id;
      const transactionId = resource.id;
      
      console.log('💳 [WEBHOOK] Payment details:', {
        paymentId,
        transactionId,
        amount: resource.amount,
        state: resource.state
      });
      
      // Find the payment record in our database
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('paypal_payment_id', paymentId)
        .single();
      
      if (paymentError || !paymentRecord) {
        console.error('❌ [WEBHOOK] Payment record not found:', paymentError);
        return res.status(404).json({ error: 'Payment record not found' });
      }
      
      console.log('📋 [WEBHOOK] Found payment record:', paymentRecord);
      
      // Update payment status to completed
      const { data: updatedPayment, error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          paypal_transaction_id: transactionId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ [WEBHOOK] Error updating payment:', updateError);
        return res.status(500).json({ error: 'Failed to update payment' });
      }
      
      console.log('✅ [WEBHOOK] Payment updated successfully:', updatedPayment);
      
      // Trigger appointment status sync
      console.log('🔄 [WEBHOOK] Triggering appointment status sync...');
      const syncResult = await paymentSyncService.syncPaymentStatus({
        paymentRecord: updatedPayment,
        executedPayment: { id: paymentId, state: 'approved' },
        transactionId
      });
      
      if (syncResult.success) {
        console.log('✅ [WEBHOOK] Appointment status synced successfully');
      } else {
        console.error('❌ [WEBHOOK] Appointment status sync failed:', syncResult.message);
      }
      
      return res.status(200).json({ 
        message: 'Webhook processed successfully',
        payment_updated: true,
        appointment_synced: syncResult.success
      });
    }
    
    // For other event types, just acknowledge
    console.log('📝 [WEBHOOK] Other event type received:', event_type);
    res.status(200).json({ message: 'Webhook received' });
    
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Manual payment sync endpoint
router.post('/sync-payment/:appointmentId', async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    console.log('🔄 [WEBHOOK] Manual payment sync requested for appointment:', appointmentId);
    
    // Use the payment sync service
    const syncResult = await paymentSyncService.manualSync(appointmentId);
    
    if (syncResult.success) {
      console.log('✅ [WEBHOOK] Manual sync successful');
      res.json({
        message: 'Payment status synced successfully',
        appointment: syncResult.verification?.data,
        sync_details: syncResult
      });
    } else {
      console.error('❌ [WEBHOOK] Manual sync failed:', syncResult.message);
      res.status(400).json({
        error: 'Payment sync failed',
        message: syncResult.message,
        details: syncResult.error
      });
    }
    
  } catch (error) {
    console.error('❌ [WEBHOOK] Error in manual sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check payment status endpoint
router.get('/check-payment/:appointmentId', async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    console.log('🔍 [WEBHOOK] Checking payment status for appointment:', appointmentId);
    
    // Get appointment and payment details
    const { data: appointment, error: aptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('*')
      .eq('appointment_id', appointmentId);
    
    if (payError) {
      return res.status(500).json({ error: 'Error fetching payments' });
    }
    
    const completedPayment = payments?.find(p => p.status === 'completed');
    const syncIssue = completedPayment && appointment.payment_status === 'unpaid';
    
    res.json({
      appointment: {
        id: appointment.id,
        payment_status: appointment.payment_status,
        status: appointment.status
      },
      payments: payments || [],
      completed_payment: completedPayment || null,
      sync_issue: syncIssue,
      needs_sync: syncIssue
    });
    
  } catch (error) {
    console.error('❌ [WEBHOOK] Error checking payment status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch sync all appointments with payment issues
router.post('/sync-all', async (req, res) => {
  try {
    console.log('🔄 [WEBHOOK] Batch sync requested for all payment issues');
    
    // Find all appointments with sync issues
    const { data: syncIssues, error: syncError } = await supabase
      .from('appointments')
      .select(`
        id,
        payment_status,
        payments!inner(
          id,
          status,
          completed_at
        )
      `)
      .eq('payment_status', 'unpaid')
      .eq('payments.status', 'completed');
    
    if (syncError) {
      return res.status(500).json({ error: 'Error finding sync issues' });
    }
    
    if (!syncIssues || syncIssues.length === 0) {
      return res.json({
        message: 'No sync issues found',
        fixed_count: 0,
        issues: []
      });
    }
    
    console.log(`🔄 [WEBHOOK] Found ${syncIssues.length} sync issues to fix`);
    
    const results = [];
    let fixedCount = 0;
    
    for (const issue of syncIssues) {
      try {
        const syncResult = await paymentSyncService.manualSync(issue.id);
        
        if (syncResult.success) {
          fixedCount++;
          results.push({
            appointment_id: issue.id,
            status: 'fixed',
            message: syncResult.message
          });
        } else {
          results.push({
            appointment_id: issue.id,
            status: 'failed',
            message: syncResult.message
          });
        }
        
        // Add delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({
          appointment_id: issue.id,
          status: 'error',
          message: error.message
        });
      }
    }
    
    console.log(`✅ [WEBHOOK] Batch sync completed: ${fixedCount}/${syncIssues.length} fixed`);
    
    res.json({
      message: `Batch sync completed: ${fixedCount}/${syncIssues.length} appointments fixed`,
      fixed_count: fixedCount,
      total_issues: syncIssues.length,
      results
    });
    
  } catch (error) {
    console.error('❌ [WEBHOOK] Error in batch sync:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
