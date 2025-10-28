import { api } from '../lib/api';

/**
 * Enhanced Payment Status Monitor for Frontend
 * Handles payment status synchronization and monitoring
 */

export class PaymentStatusMonitor {
  constructor() {
    this.isMonitoring = false;
    this.checkInterval = 10000; // Check every 10 seconds
    this.intervalId = null;
  }

  /**
   * Start monitoring payment status for a specific appointment
   * @param {number} appointmentId - The appointment ID to monitor
   * @param {function} onStatusChange - Callback when status changes
   */
  startMonitoring(appointmentId, onStatusChange) {
    if (this.isMonitoring) {
      console.log('🔍 [FRONTEND MONITOR] Already monitoring');
      return;
    }

    console.log(`🔍 [FRONTEND MONITOR] Starting payment status monitoring for appointment ${appointmentId}`);
    this.isMonitoring = true;

    this.intervalId = setInterval(async () => {
      try {
        const response = await api.get(`/appointments/${appointmentId}`);
        const appointment = response.data.appointment;
        
        if (appointment && appointment.payment_status === 'paid') {
          console.log('✅ [FRONTEND MONITOR] Payment status updated to paid!');
          this.stopMonitoring();
          if (onStatusChange) {
            onStatusChange(appointment);
          }
        }
      } catch (error) {
        console.error('❌ [FRONTEND MONITOR] Error checking payment status:', error);
      }
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('🔍 [FRONTEND MONITOR] Stopped monitoring');
  }

  /**
   * Manual fix for payment status sync issues
   * @param {number} appointmentId - The appointment ID to fix
   */
  async manualFix(appointmentId) {
    try {
      console.log(`🔧 [FRONTEND MONITOR] Requesting manual fix for appointment ${appointmentId}`);
      
      const response = await api.patch(`/payments/fix-appointment/${appointmentId}`);
      
      console.log('✅ [FRONTEND MONITOR] Manual fix successful:', response.data);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ [FRONTEND MONITOR] Manual fix failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Check if payment and appointment status are synced
   * @param {number} appointmentId - The appointment ID to check
   */
  async checkSyncStatus(appointmentId) {
    try {
      console.log(`🔍 [FRONTEND MONITOR] Checking sync status for appointment ${appointmentId}`);
      
      const response = await api.get(`/payments/debug-appointment/${appointmentId}`);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ [FRONTEND MONITOR] Error checking sync status:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Enhanced payment execution with automatic retry and monitoring
   * @param {Object} paymentData - Payment execution data
   */
  async executePaymentWithMonitoring(paymentData) {
    try {
      console.log('💳 [FRONTEND MONITOR] Executing payment with enhanced monitoring...');
      
      // Execute the payment
      const response = await api.post('/payments/execute', paymentData);
      
      console.log('✅ [FRONTEND MONITOR] Payment execution response:', response.data);
      
      // Check for sync failure flag from backend
      if (response.data.sync_failed) {
        console.warn('⚠️ [FRONTEND MONITOR] Payment succeeded but sync failed:', response.data.sync_error);
        
        // Store appointment ID for retry
        if (response.data.appointment_id) {
          sessionStorage.setItem('pendingPaymentSync', response.data.appointment_id);
        }
        
        return {
          success: true,
          data: response.data,
          synced: false,
          needsManualFix: true,
          syncError: response.data.sync_error
        };
      }
      
      // Check if appointment was properly updated
      const appointmentUpdate = response.data.appointmentUpdate;
      const verification = response.data.verifyAppointment;
      
      console.log('🔍 [FRONTEND MONITOR] Checking sync status:', {
        hasVerification: !!verification,
        verificationData: verification,
        paymentStatus: verification?.payment_status
      });
      
      if (verification && verification.payment_status === 'paid') {
        console.log('✅ [FRONTEND MONITOR] Payment status properly synced');
        return {
          success: true,
          data: response.data,
          synced: true
        };
      } else {
        console.warn('⚠️ [FRONTEND MONITOR] Payment executed but sync may have failed');
        console.warn('🔍 [FRONTEND MONITOR] Verification details:', {
          verification: verification,
          appointmentUpdate: appointmentUpdate,
          fullResponse: response.data
        });
        
        // Store appointment ID for potential retry
        const appointmentId = response.data.payment?.appointment_id || 
                             response.data.appointment_update?.appointment_id ||
                             response.data.appointmentUpdate?.[0]?.id;
        
        if (appointmentId) {
          sessionStorage.setItem('pendingPaymentSync', appointmentId);
          console.log('💾 [FRONTEND MONITOR] Stored appointment ID for retry:', appointmentId);
        }
        
        // Payment succeeded even if sync failed - return success
        return {
          success: true,
          data: response.data,
          synced: false,
          needsManualFix: true,
          message: 'Payment completed successfully, but status sync may need manual verification'
        };
      }
      
    } catch (error) {
      console.error('❌ [FRONTEND MONITOR] Payment execution failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Check for pending payment syncs and attempt to fix them
   */
  async checkPendingSyncs() {
    const pendingAppointmentId = sessionStorage.getItem('pendingPaymentSync');
    
    if (pendingAppointmentId) {
      console.log('🔄 [FRONTEND MONITOR] Found pending payment sync, attempting fix...');
      
      const fixResult = await this.manualFix(pendingAppointmentId);
      
      if (fixResult.success) {
        console.log('✅ [FRONTEND MONITOR] Pending sync fixed successfully');
        sessionStorage.removeItem('pendingPaymentSync');
        return true;
      } else {
        console.error('❌ [FRONTEND MONITOR] Failed to fix pending sync');
        return false;
      }
    }
    
    return null; // No pending syncs
  }
}

// Export singleton instance
export const paymentStatusMonitor = new PaymentStatusMonitor();

// Utility functions for easy use
export const monitorPaymentStatus = (appointmentId, onStatusChange) => {
  paymentStatusMonitor.startMonitoring(appointmentId, onStatusChange);
};

export const stopPaymentMonitoring = () => {
  paymentStatusMonitor.stopMonitoring();
};

export const fixPaymentStatus = async (appointmentId) => {
  return await paymentStatusMonitor.manualFix(appointmentId);
};

export const executePaymentWithMonitoring = async (paymentData) => {
  return await paymentStatusMonitor.executePaymentWithMonitoring(paymentData);
};
