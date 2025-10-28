import { supabase, supabaseAdmin } from './supabase.js';
import { notifyPaymentConfirmed } from './notifications.js';

/**
 * Enhanced Payment Synchronization Service
 * Ensures appointment payment status is updated when PayPal payments succeed
 */

export class PaymentSyncService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Main method to sync payment status with appointment
   * @param {Object} paymentData - Payment execution data
   * @returns {Object} Sync result with status and details
   */
  async syncPaymentStatus(paymentData) {
    const { paymentRecord, executedPayment, transactionId } = paymentData;
    
    console.log('🔄 [PAYMENT SYNC] ===== STARTING PAYMENT SYNC =====');
    console.log('🔄 [PAYMENT SYNC] Payment Record ID:', paymentRecord?.id);
    console.log('🔄 [PAYMENT SYNC] Appointment ID:', paymentRecord?.appointment_id);
    console.log('🔄 [PAYMENT SYNC] Transaction ID:', transactionId);

    // Validate required parameters
    if (!paymentRecord) {
      throw new Error('Payment record is required for sync');
    }
    if (!paymentRecord.id) {
      throw new Error('Payment record ID is required for sync');
    }
    if (!paymentRecord.appointment_id) {
      throw new Error('Appointment ID is required for sync');
    }

    try {
      // Step 1: Update payment record to completed
      const paymentUpdateResult = await this.updatePaymentRecord(paymentRecord, transactionId);
      
      // Step 2: Update appointment payment status with retry mechanism
      const appointmentUpdateResult = await this.updateAppointmentWithRetry(paymentRecord.appointment_id);
      
      // Step 3: Verify the sync was successful
      const verificationResult = await this.verifySync(paymentRecord.appointment_id);
      
      // Step 4: Send notification if successful
      if (verificationResult.success) {
        await this.sendPaymentNotification(paymentRecord.appointment_id, paymentRecord.amount);
      }

      return {
        success: verificationResult.success,
        paymentUpdate: paymentUpdateResult,
        appointmentUpdate: appointmentUpdateResult,
        verification: verificationResult,
        message: verificationResult.success 
          ? 'Payment status synchronized successfully'
          : 'Payment sync failed - manual intervention required'
      };

    } catch (error) {
      console.error('❌ [PAYMENT SYNC] Critical error during sync:', error);
      return {
        success: false,
        error: error.message,
        message: 'Payment sync failed due to system error'
      };
    }
  }

  /**
   * Update payment record to completed status
   */
  async updatePaymentRecord(paymentRecord, transactionId) {
    console.log('💳 [PAYMENT SYNC] Updating payment record...');
    console.log('💳 [PAYMENT SYNC] Payment record ID:', paymentRecord.id);
    console.log('💳 [PAYMENT SYNC] Transaction ID:', transactionId);
    
    if (!supabaseAdmin) {
      throw new Error('SupabaseAdmin client is not available - check SUPABASE_SERVICE_ROLE_KEY');
    }
    
    try {
      const { data: updatedPayment, error: updateError } = await supabaseAdmin
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
        console.error('❌ [PAYMENT SYNC] Payment record update failed:', updateError);
        throw new Error(`Payment record update failed: ${updateError.message}`);
      }

      console.log('✅ [PAYMENT SYNC] Payment record updated successfully');
      return { success: true, data: updatedPayment };

    } catch (error) {
      console.error('❌ [PAYMENT SYNC] Payment record update error:', error);
      throw error;
    }
  }

  /**
   * Update appointment payment status with retry mechanism
   */
  async updateAppointmentWithRetry(appointmentId) {
    console.log('🏥 [PAYMENT SYNC] Starting appointment update with retry...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🏥 [PAYMENT SYNC] Attempt ${attempt}/${this.maxRetries} to update appointment ${appointmentId}`);
      
      try {
        const result = await this.updateAppointmentStatus(appointmentId);
        
        if (result.success) {
          console.log(`✅ [PAYMENT SYNC] Appointment updated successfully on attempt ${attempt}`);
          return result;
        }
        
        console.warn(`⚠️ [PAYMENT SYNC] Attempt ${attempt} failed, retrying...`);
        
        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
        
      } catch (error) {
        console.error(`❌ [PAYMENT SYNC] Attempt ${attempt} error:`, error);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.delay(this.retryDelay * attempt);
      }
    }
    
    throw new Error(`Failed to update appointment after ${this.maxRetries} attempts`);
  }

  /**
   * Update appointment payment status using multiple approaches
   */
  async updateAppointmentStatus(appointmentId) {
    const updateMethods = [
      // Method 1: Standard update
      () => this.standardUpdate(appointmentId),
      // Method 2: Update with explicit type conversion
      () => this.typedUpdate(appointmentId),
      // Method 3: Raw SQL update
      () => this.rawSqlUpdate(appointmentId)
    ];

    for (let i = 0; i < updateMethods.length; i++) {
      console.log(`🔧 [PAYMENT SYNC] Trying update method ${i + 1}...`);
      
      try {
        const result = await updateMethods[i]();
        
        if (result.success && result.data && result.data.length > 0) {
          console.log(`✅ [PAYMENT SYNC] Update method ${i + 1} succeeded`);
          return result;
        }
        
        console.log(`⚠️ [PAYMENT SYNC] Update method ${i + 1} returned no rows`);
        
      } catch (error) {
        console.error(`❌ [PAYMENT SYNC] Update method ${i + 1} failed:`, error);
      }
    }
    
    return { success: false, error: 'All update methods failed' };
  }

  /**
   * Standard appointment update
   */
  async standardUpdate(appointmentId) {
    console.log('🔧 [PAYMENT SYNC] Standard update method');
    
    if (!supabaseAdmin) {
      throw new Error('SupabaseAdmin client is not available - check SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select();

    return {
      success: !error && data && data.length > 0,
      data,
      error,
      method: 'standard'
    };
  }

  /**
   * Typed appointment update (with explicit type conversion)
   */
  async typedUpdate(appointmentId) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(appointmentId))
      .select();

    return {
      success: !error && data && data.length > 0,
      data,
      error,
      method: 'typed'
    };
  }

  /**
   * Raw SQL update using RPC
   */
  async rawSqlUpdate(appointmentId) {
    try {
      // First try using RPC if function exists
      const { data, error } = await supabaseAdmin.rpc('update_appointment_payment_status', {
        appointment_id: appointmentId
      });

      if (!error) {
        return {
          success: true,
          data: [{ id: appointmentId, payment_status: 'paid' }],
          error: null,
          method: 'rpc'
        };
      }
    } catch (rpcError) {
      console.log('ℹ️ [PAYMENT SYNC] RPC method not available, using direct SQL...');
    }

    // Fallback to direct update
    return await this.standardUpdate(appointmentId);
  }

  /**
   * Verify that the sync was successful
   */
  async verifySync(appointmentId) {
    console.log('🔍 [PAYMENT SYNC] Verifying sync result...');
    console.log('🔍 [PAYMENT SYNC] Appointment ID:', appointmentId);
    console.log('🔍 [PAYMENT SYNC] SupabaseAdmin available:', !!supabaseAdmin);
    
    try {
      if (!supabaseAdmin) {
        throw new Error('SupabaseAdmin client is not available - check SUPABASE_SERVICE_ROLE_KEY');
      }
      
      const { data: appointment, error } = await supabaseAdmin
        .from('appointments')
        .select('id, payment_status, updated_at, status')
        .eq('id', appointmentId)
        .single();

      if (error) {
        console.error('❌ [PAYMENT SYNC] Verification query failed:', error);
        return { success: false, error: error.message };
      }

      const isSuccessful = appointment.payment_status === 'paid';
      
      console.log('🔍 [PAYMENT SYNC] Verification result:', {
        appointment_id: appointment.id,
        payment_status: appointment.payment_status,
        expected: 'paid',
        success: isSuccessful
      });

      return {
        success: isSuccessful,
        data: appointment,
        message: isSuccessful 
          ? 'Payment status successfully updated to paid'
          : `Payment status is still ${appointment.payment_status}, expected paid`
      };

    } catch (error) {
      console.error('❌ [PAYMENT SYNC] Verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentNotification(appointmentId, amount) {
    try {
      console.log('📧 [PAYMENT SYNC] Sending payment confirmation notification...');
      await notifyPaymentConfirmed(appointmentId, amount);
      console.log('✅ [PAYMENT SYNC] Notification sent successfully');
    } catch (error) {
      console.error('❌ [PAYMENT SYNC] Notification failed:', error);
      // Don't throw error for notification failure
    }
  }

  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual sync method for fixing existing payment issues
   */
  async manualSync(appointmentId) {
    console.log('🔧 [PAYMENT SYNC] Manual sync requested for appointment:', appointmentId);
    
    try {
      // Check if there's a completed payment for this appointment
      const { data: completedPayments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);

      if (paymentError) {
        throw new Error(`Payment query failed: ${paymentError.message}`);
      }

      if (!completedPayments || completedPayments.length === 0) {
        return {
          success: false,
          message: 'No completed payment found for this appointment'
        };
      }

      const completedPayment = completedPayments[0];
      console.log('🔧 [PAYMENT SYNC] Found completed payment:', completedPayment.id);

      // Update appointment status
      const appointmentUpdateResult = await this.updateAppointmentWithRetry(appointmentId);
      
      // Verify the sync
      const verificationResult = await this.verifySync(appointmentId);

      return {
        success: verificationResult.success,
        appointmentUpdate: appointmentUpdateResult,
        verification: verificationResult,
        payment: completedPayment,
        message: verificationResult.success 
          ? 'Manual sync completed successfully'
          : 'Manual sync failed - appointment status not updated'
      };

    } catch (error) {
      console.error('❌ [PAYMENT SYNC] Manual sync error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Manual sync failed due to system error'
      };
    }
  }
}

// Export singleton instance
export const paymentSyncService = new PaymentSyncService();
