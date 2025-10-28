import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentsAPI, api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Calendar, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { executePaymentWithMonitoring, monitorPaymentStatus, stopPaymentMonitoring } from '../../utils/paymentMonitor';
import { formatPHPCurrencyCompact } from '../../utils/currency';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get auth context properly
  const { user, token, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [authStabilized, setAuthStabilized] = useState(false);

  // Wait for auth to stabilize
  useEffect(() => {
    console.log('PaymentSuccess - Auth stabilization check:', {
      user: user ? { id: user.id, email: user.email } : null,
      token: localStorage.getItem('access_token') ? 'Present' : 'Missing',
      authLoading,
      authStabilized
    });

    if (!authLoading) {
      const hasToken = localStorage.getItem('access_token');
      const hasUser = localStorage.getItem('user');
      
      if (hasToken && user) {
        console.log('PaymentSuccess - Auth stabilized with user');
        setAuthStabilized(true);
      } else if (hasToken && hasUser && !user) {
        console.log('PaymentSuccess - Waiting for user to be restored...');
        // Give AuthContext more time to restore user
        setTimeout(() => {
          if (!user) {
            console.log('PaymentSuccess - Auth stabilized without user (will redirect to login)');
            setAuthStabilized(true);
          }
        }, 2000);
      } else {
        console.log('PaymentSuccess - Auth stabilized (no credentials)');
        setAuthStabilized(true);
      }
    }
  }, [user, token, authLoading]);

  // Handle pending payment updates when user becomes available
  useEffect(() => {
    const handlePendingUpdate = async () => {
      const pendingAppointmentId = sessionStorage.getItem('pendingPaymentUpdate');
      if (pendingAppointmentId && user && !authLoading) {
        console.log('🔄 PaymentSuccess - === PENDING UPDATE ATTEMPT START ===');
        console.log('🔄 PaymentSuccess - Processing pending payment update for appointment:', pendingAppointmentId);
        console.log('🔄 PaymentSuccess - Current user details:', {
          id: user.id,
          email: user.email,
          role: user.role
        });
        console.log('🔄 PaymentSuccess - Auth token present:', localStorage.getItem('access_token') ? 'Yes' : 'No');
        const currentToken = localStorage.getItem('access_token');
        console.log('🔄 PaymentSuccess - API request details:', {
          method: 'PATCH',
          url: `/appointments/fix-payment-status/${pendingAppointmentId}`,
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('🔄 PaymentSuccess - Token details:', {
          tokenExists: !!currentToken,
          tokenStart: currentToken ? currentToken.substring(0, 20) + '...' : 'null',
          tokenType: typeof currentToken
        });
        
        try {
          const updateResponse = await api.patch(`/appointments/fix-payment-status/${pendingAppointmentId}`);
          console.log('✅ PaymentSuccess - Pending appointment status updated successfully!');
          console.log('✅ PaymentSuccess - Update response:', updateResponse.data);
          console.log('✅ PaymentSuccess - Response status:', updateResponse.status);
          
          // Clear the pending update
          sessionStorage.removeItem('pendingPaymentUpdate');
          toast.success('Payment status updated successfully!');
          console.log('🔄 PaymentSuccess - === PENDING UPDATE ATTEMPT SUCCESS ===');
        } catch (updateError) {
          console.error('❌ PaymentSuccess - === PENDING UPDATE ATTEMPT FAILED ===');
          console.error('❌ PaymentSuccess - Failed to update pending appointment status');
          console.error('❌ PaymentSuccess - Error details:', {
            message: updateError.message,
            status: updateError.response?.status,
            statusText: updateError.response?.statusText,
            data: updateError.response?.data,
            headers: updateError.response?.headers
          });
          
          if (updateError.response?.status === 400) {
            console.error('❌ PaymentSuccess - 400 Bad Request - Possible causes:');
            console.error('   - Invalid payment_status value');
            console.error('   - Missing required fields');
            console.error('   - Appointment not found');
            console.error('   - User not authorized for this appointment');
          } else if (updateError.response?.status === 401) {
            console.error('❌ PaymentSuccess - 401 Unauthorized - Token invalid or expired');
          } else if (updateError.response?.status === 403) {
            console.error('❌ PaymentSuccess - 403 Forbidden - User lacks permission');
          } else if (updateError.response?.status === 404) {
            console.error('❌ PaymentSuccess - 404 Not Found - Appointment or endpoint not found');
          }
          
          console.log('🔄 PaymentSuccess - Storing failed update for background monitor...');
          sessionStorage.setItem('failedPaymentUpdate', pendingAppointmentId);
        }
      }
    };

    handlePendingUpdate();
  }, [user, authLoading]);

  useEffect(() => {
    console.log('PaymentSuccess - Payment execution check:', {
      authStabilized,
      hasExecuted
    });

    // Only proceed when auth is stabilized
    if (!authStabilized) {
      console.log('PaymentSuccess - Waiting for auth to stabilize...');
      return;
    }

    // Prevent multiple executions
    if (hasExecuted) {
      console.log('PaymentSuccess - Payment already executed, skipping...');
      return;
    }

    const paymentId = searchParams.get('paymentId');
    const payerId = searchParams.get('PayerID');

    if (!paymentId || !payerId) {
      console.error('PaymentSuccess - Missing payment parameters');
      toast.error('Invalid payment parameters');
      navigate('/patient/dashboard');
      return;
    }

    console.log('PaymentSuccess - Payment parameters:', { paymentId, payerId });
    executePayment(paymentId, payerId);
  }, [authStabilized, hasExecuted, searchParams, navigate]);

  const executePayment = async (paymentId, payerId) => {
    console.log('PaymentSuccess - executePayment started:', { paymentId, payerId });
    setHasExecuted(true);

    try {
      console.log('PaymentSuccess - Making enhanced API call to execute payment...');
      
      // Double-check auth before API call
      const currentToken = localStorage.getItem('access_token');
      if (!currentToken) {
        console.error('PaymentSuccess - No token found before API call');
        toast.error('Authentication required. Please sign in.');
        setTimeout(() => {
          navigate('/login');
        }, 0);
        return;
      }

      // Use enhanced payment execution with monitoring
      const result = await executePaymentWithMonitoring({
        payment_id: paymentId,
        payer_id: payerId
      });

      console.log('✅ [PAYMENT SUCCESS] Enhanced payment execution result:', result);
      console.log('🔍 [PAYMENT SUCCESS] Result details:', {
        success: result.success,
        synced: result.synced,
        needsManualFix: result.needsManualFix,
        error: result.error,
        message: result.message
      });

      if (!result.success) {
        console.error('❌ [PAYMENT SUCCESS] Payment execution failed:', result.error);
        throw new Error(result.error || 'Payment execution failed');
      }

      const response = result.data;
      setPaymentDetails(response);

      // Check if payment was properly synced
      if (result.synced) {
        console.log('✅ [PAYMENT SUCCESS] Payment and appointment status properly synchronized!');
        toast.success('Payment completed and status updated successfully!');
      } else {
        console.warn('⚠️ [PAYMENT SUCCESS] Payment completed but sync may have failed');
        toast.success('Payment completed! Status update in progress...');
        
        // Start monitoring for status change if sync failed
        const appointmentId = response.payment?.appointment_id;
        if (appointmentId && result.needsManualFix) {
          console.log('🔍 [PAYMENT SUCCESS] Starting payment status monitoring...');
          monitorPaymentStatus(appointmentId, (updatedAppointment) => {
            console.log('✅ [PAYMENT SUCCESS] Payment status updated via monitoring!');
            toast.success('Payment status synchronized successfully!');
          });
        }
      }

      // Store appointment ID for redirect
      if (response.payment?.appointment_id) {
        sessionStorage.setItem('completedPaymentAppointmentId', response.payment.appointment_id);
        console.log('💾 [PAYMENT SUCCESS] Stored appointment ID in session:', response.payment.appointment_id);
      }
      
      console.log('🔄 [PAYMENT SUCCESS] Payment processing completed');

      // Redirect to dashboard after showing success message
      setTimeout(() => {
        stopPaymentMonitoring(); // Stop monitoring before redirect
        const appointmentId = response.payment?.appointment_id;
        const redirectUrl = appointmentId 
          ? `/patient/dashboard?payment=success&appointmentId=${appointmentId}`
          : '/patient/dashboard?payment=success';
        navigate(redirectUrl);
      }, 3000);

    } catch (error) {
      console.error('PaymentSuccess - Error executing payment:', error);
      toast.error('Payment execution failed. Please try again.');
      
      // Redirect to dashboard on error
      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  // Check if payment was already processed in this session
  const paymentProcessed = sessionStorage.getItem('paymentProcessed');
  const currentPaymentId = searchParams.get('paymentId');
  
  if (paymentProcessed === currentPaymentId) {
    console.log('PaymentSuccess - Payment already processed, redirecting to dashboard');
    setTimeout(() => {
      navigate('/patient/dashboard');
    }, 1000);
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Already Processed</h1>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (loading || !authStabilized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {!authStabilized ? 'Verifying authentication...' : 'Processing your payment...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your payment has been processed successfully. You will be redirected to your dashboard shortly.
          </p>
          
          {paymentDetails && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID:</span>
                  <span className="font-medium">{paymentDetails.payment?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">{formatPHPCurrencyCompact(paymentDetails.payment?.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">Completed</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-sm text-gray-500">
            <p>Your appointment status will be updated automatically.</p>
            <p>Redirecting in a few seconds...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
