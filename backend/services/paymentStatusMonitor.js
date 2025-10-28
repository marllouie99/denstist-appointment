import { supabase } from './supabase.js';
import { paymentSyncService } from './paymentSync.js';

/**
 * Real-time Payment Status Monitor
 * Monitors for payment status mismatches and automatically fixes them
 */

export class PaymentStatusMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 30000; // Check every 30 seconds
    this.intervalId = null;
    this.subscription = null;
  }

  /**
   * Start monitoring payment status synchronization
   */
  async startMonitoring() {
    if (this.isRunning) {
      console.log('📊 [PAYMENT MONITOR] Already running');
      return;
    }

    console.log('📊 [PAYMENT MONITOR] Starting payment status monitoring...');
    this.isRunning = true;

    // Set up real-time subscription for payment updates
    this.setupRealtimeSubscription();

    // Set up periodic check for missed sync issues
    this.setupPeriodicCheck();

    console.log('✅ [PAYMENT MONITOR] Payment status monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    console.log('📊 [PAYMENT MONITOR] Stopping payment status monitoring...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    console.log('✅ [PAYMENT MONITOR] Payment status monitoring stopped');
  }

  /**
   * Set up real-time subscription to payments table
   */
  setupRealtimeSubscription() {
    console.log('📡 [PAYMENT MONITOR] Setting up real-time subscription...');

    this.subscription = supabase
      .channel('payment-status-monitor')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: 'status=eq.completed'
        },
        async (payload) => {
          console.log('🔔 [PAYMENT MONITOR] Payment completed event received:', payload);
          await this.handlePaymentCompleted(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 [PAYMENT MONITOR] Subscription status:', status);
      });
  }

  /**
   * Set up periodic check for sync issues
   */
  setupPeriodicCheck() {
    console.log('⏰ [PAYMENT MONITOR] Setting up periodic sync check...');
    
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.checkForSyncIssues();
      }
    }, this.checkInterval);
  }

  /**
   * Handle payment completed event
   */
  async handlePaymentCompleted(paymentData) {
    try {
      console.log('🔔 [PAYMENT MONITOR] Processing completed payment:', paymentData.id);
      
      // Wait a moment for any ongoing sync processes to complete
      await this.delay(2000);
      
      // Check if appointment status is properly synced
      const syncCheck = await this.checkAppointmentSync(paymentData.appointment_id);
      
      if (!syncCheck.isSynced) {
        console.log('⚠️ [PAYMENT MONITOR] Sync issue detected, attempting auto-fix...');
        await this.autoFixSyncIssue(paymentData.appointment_id);
      } else {
        console.log('✅ [PAYMENT MONITOR] Payment and appointment are properly synced');
      }
      
    } catch (error) {
      console.error('❌ [PAYMENT MONITOR] Error handling payment completed event:', error);
    }
  }

  /**
   * Check for existing sync issues
   */
  async checkForSyncIssues() {
    try {
      console.log('🔍 [PAYMENT MONITOR] Checking for sync issues...');
      
      // Find appointments with completed payments but unpaid status
      const { data: syncIssues, error } = await supabase
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

      if (error) {
        console.error('❌ [PAYMENT MONITOR] Error checking sync issues:', error);
        return;
      }

      if (syncIssues && syncIssues.length > 0) {
        console.log(`⚠️ [PAYMENT MONITOR] Found ${syncIssues.length} sync issues`);
        
        for (const issue of syncIssues) {
          console.log(`🔧 [PAYMENT MONITOR] Auto-fixing appointment ${issue.id}`);
          await this.autoFixSyncIssue(issue.id);
          
          // Add delay between fixes to avoid overwhelming the system
          await this.delay(1000);
        }
      } else {
        console.log('✅ [PAYMENT MONITOR] No sync issues found');
      }
      
    } catch (error) {
      console.error('❌ [PAYMENT MONITOR] Error in periodic sync check:', error);
    }
  }

  /**
   * Check if appointment payment status is synced with payment status
   */
  async checkAppointmentSync(appointmentId) {
    try {
      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, payment_status')
        .eq('id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return { isSynced: false, error: 'Appointment not found' };
      }

      // Get completed payments for this appointment
      const { data: completedPayments, error: paymentError } = await supabase
        .from('payments')
        .select('id, status, completed_at')
        .eq('appointment_id', appointmentId)
        .eq('status', 'completed');

      if (paymentError) {
        return { isSynced: false, error: 'Error checking payments' };
      }

      const hasCompletedPayment = completedPayments && completedPayments.length > 0;
      const appointmentIsPaid = appointment.payment_status === 'paid';

      return {
        isSynced: hasCompletedPayment === appointmentIsPaid,
        appointment,
        completedPayments,
        issue: hasCompletedPayment && !appointmentIsPaid 
          ? 'Payment completed but appointment shows unpaid'
          : null
      };

    } catch (error) {
      console.error('❌ [PAYMENT MONITOR] Error checking appointment sync:', error);
      return { isSynced: false, error: error.message };
    }
  }

  /**
   * Automatically fix sync issue
   */
  async autoFixSyncIssue(appointmentId) {
    try {
      console.log(`🔧 [PAYMENT MONITOR] Auto-fixing sync issue for appointment ${appointmentId}`);
      
      const syncResult = await paymentSyncService.manualSync(appointmentId);
      
      if (syncResult.success) {
        console.log(`✅ [PAYMENT MONITOR] Auto-fix successful for appointment ${appointmentId}`);
        
        // Log the fix for audit purposes
        await this.logSyncFix(appointmentId, syncResult);
        
      } else {
        console.error(`❌ [PAYMENT MONITOR] Auto-fix failed for appointment ${appointmentId}:`, syncResult.message);
      }
      
      return syncResult;
      
    } catch (error) {
      console.error(`❌ [PAYMENT MONITOR] Error in auto-fix for appointment ${appointmentId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log sync fix for audit purposes
   */
  async logSyncFix(appointmentId, syncResult) {
    try {
      const logEntry = {
        appointment_id: appointmentId,
        fix_timestamp: new Date().toISOString(),
        fix_method: 'auto_monitor',
        success: syncResult.success,
        details: JSON.stringify({
          payment_id: syncResult.payment?.id,
          previous_status: 'unpaid',
          new_status: 'paid',
          verification: syncResult.verification
        })
      };

      console.log('📝 [PAYMENT MONITOR] Logging sync fix:', logEntry);
      
      // You could store this in a dedicated audit table if needed
      // For now, we'll just log it to console
      
    } catch (error) {
      console.error('❌ [PAYMENT MONITOR] Error logging sync fix:', error);
    }
  }

  /**
   * Get monitoring status and statistics
   */
  async getMonitoringStatus() {
    try {
      // Get current sync issues count
      const { data: syncIssues, error } = await supabase
        .from('appointments')
        .select(`
          id,
          payments!inner(status)
        `)
        .eq('payment_status', 'unpaid')
        .eq('payments.status', 'completed');

      const syncIssuesCount = syncIssues ? syncIssues.length : 0;

      return {
        isRunning: this.isRunning,
        checkInterval: this.checkInterval,
        currentSyncIssues: syncIssuesCount,
        lastCheck: new Date().toISOString(),
        subscriptionActive: !!this.subscription
      };

    } catch (error) {
      console.error('❌ [PAYMENT MONITOR] Error getting monitoring status:', error);
      return {
        isRunning: this.isRunning,
        error: error.message
      };
    }
  }

  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const paymentStatusMonitor = new PaymentStatusMonitor();
