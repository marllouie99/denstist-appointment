import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { paymentsAPI } from '../../lib/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

// Safe date formatting function for privacy-aware display
const formatSafeDate = (dateValue, formatString = 'PPp') => {
  console.log('🔒 [PAYMENT HISTORY] Formatting date with privacy protection:', {
    dateValue,
    formatString,
    timestamp: new Date().toISOString()
  });
  
  if (!dateValue) return 'N/A';
  
  const date = new Date(dateValue);
  if (!isValid(date)) {
    console.warn('⚠️ [PAYMENT HISTORY] Invalid date value:', dateValue);
    return 'Invalid Date';
  }
  
  try {
    return format(date, formatString);
  } catch (error) {
    console.error('❌ [PAYMENT HISTORY] Date formatting error:', error, 'for value:', dateValue);
    return 'Format Error';
  }
};

// Privacy-aware data display function
const maskSensitiveDisplayData = (data, fieldType) => {
  console.log('🔒 [PAYMENT HISTORY] Masking sensitive display data for field:', fieldType);
  
  if (!data) return 'N/A';
  
  switch (fieldType) {
    case 'transaction_id':
      // Show only first 8 characters for transaction IDs
      return data.length > 8 ? data.substring(0, 8) + '***' : data;
    case 'payment_id':
      // Show only first 8 characters for payment IDs
      return data.length > 8 ? data.substring(0, 8) + '***' : data;
    case 'email':
      // Mask email addresses
      const emailParts = data.split('@');
      if (emailParts.length === 2) {
        return emailParts[0].substring(0, 3) + '***@' + emailParts[1];
      }
      return data.substring(0, 3) + '***';
    default:
      return data;
  }
};

const PaymentHistory = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      console.log('📊 [PAYMENT HISTORY] Fetching privacy-aware payment history:', {
        user: user ? {
          id: user.id,
          role: user.role,
          email: user.email ? user.email.substring(0, 3) + '***' : 'No email'
        } : 'No user',
        timestamp: new Date().toISOString()
      });
      
      // Privacy check before making request
      if (!user || !user.id) {
        console.error('🚨 [PAYMENT HISTORY] No authenticated user found');
        toast.error('Please log in to view payment history');
        return;
      }

      if (user.role !== 'patient') {
        console.warn('⚠️ [PAYMENT HISTORY] Non-patient user accessing payment history:', user.role);
      }
      
      console.log('📡 [PAYMENT HISTORY] Making API request to backend...');
      const response = await paymentsAPI.getHistory();
      
      console.log('✅ [PAYMENT HISTORY] Privacy-aware response received:', {
        payments_count: response.data.payments?.length || 0,
        has_privacy_notice: !!response.data.privacy_notice,
        total_count: response.data.total_count,
        privacy_notice: response.data.privacy_notice
      });
      
      const paymentData = response.data.payments || [];
      
      // Log privacy protection status
      console.log('🔒 [PAYMENT HISTORY] Privacy protection analysis:', {
        total_payments: paymentData.length,
        masked_payments: paymentData.filter(p => 
          p.paypal_payment_id?.includes('***') || 
          p.paypal_transaction_id?.includes('***')
        ).length,
        privacy_protected: paymentData.every(p => 
          !p.paypal_payment_id || p.paypal_payment_id.includes('***')
        )
      });

      // Additional client-side privacy validation
      const privacyValidatedPayments = paymentData.map(payment => {
        // Ensure all sensitive data is properly masked
        const validatedPayment = { ...payment };
        
        if (validatedPayment.paypal_payment_id && !validatedPayment.paypal_payment_id.includes('***')) {
          console.warn('⚠️ [PAYMENT HISTORY] Unmasked PayPal payment ID detected, applying client-side masking');
          validatedPayment.paypal_payment_id = maskSensitiveDisplayData(validatedPayment.paypal_payment_id, 'payment_id');
        }
        
        if (validatedPayment.paypal_transaction_id && !validatedPayment.paypal_transaction_id.includes('***')) {
          console.warn('⚠️ [PAYMENT HISTORY] Unmasked PayPal transaction ID detected, applying client-side masking');
          validatedPayment.paypal_transaction_id = maskSensitiveDisplayData(validatedPayment.paypal_transaction_id, 'transaction_id');
        }
        
        return validatedPayment;
      });
      
      setPayments(privacyValidatedPayments);
      setFilteredPayments(privacyValidatedPayments);
      
      // Show privacy notice if provided by backend
      if (response.data.privacy_notice) {
        console.log('🔒 [PAYMENT HISTORY] Privacy notice from backend:', response.data.privacy_notice);
      }
      
    } catch (error) {
      console.error('❌ [PAYMENT HISTORY] Error fetching payments:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        user_id: user?.id || 'Unknown',
        timestamp: new Date().toISOString()
      });
      
      if (error.response?.status === 401) {
        toast.error('Please log in to view payment history');
      } else if (error.response?.status === 403) {
        toast.error('Access denied - insufficient permissions');
      } else {
        toast.error('Failed to load payment history');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort payments
  useEffect(() => {
    let filtered = [...payments];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at);
        case 'date-asc':
          return new Date(a.completed_at || a.created_at) - new Date(b.completed_at || b.created_at);
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });
    
    setFilteredPayments(filtered);
  }, [payments, statusFilter, sortBy]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/patient/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                  ← Back to Dashboard
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Welcome, {user?.full_name}</span>
                <Link to="/patient/dashboard" className="text-blue-600 hover:text-blue-800">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading payment history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/patient/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.full_name}</span>
              <Link to="/patient/dashboard" className="text-blue-600 hover:text-blue-800">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <strong>Privacy Protected:</strong> Sensitive payment information (transaction IDs, payment IDs) has been masked for your security.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={fetchPaymentHistory}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Refresh
                </button>
              </div>

              {/* Filter and Sort Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                  >
                    <option value="date-desc">Date (Newest First)</option>
                    <option value="date-asc">Date (Oldest First)</option>
                    <option value="amount-desc">Amount (High to Low)</option>
                    <option value="amount-asc">Amount (Low to High)</option>
                  </select>
                </div>
                
                <div className="text-sm text-gray-600">
                  Showing {filteredPayments.length} of {payments.length} payments
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">💳</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No payment history</h3>
                  <p className="text-gray-600">You haven't made any payments yet.</p>
                  <Link
                    to="/patient/dashboard"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Book an Appointment
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {payment.appointment?.service?.name || 'Dental Service'}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Dr. {payment.appointment?.dentist?.full_name || 'Dentist'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {payment.appointment?.appointment_time 
                                  ? formatSafeDate(payment.appointment.appointment_time, 'PPp')
                                  : 'Date not available'
                                }
                              </p>
                              {payment.paypal_transaction_id && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Transaction ID: {maskSensitiveDisplayData(payment.paypal_transaction_id, 'transaction_id')}
                                </p>
                              )}
                              {payment.paypal_payment_id && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Payment ID: {maskSensitiveDisplayData(payment.paypal_payment_id, 'payment_id')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {payment.completed_at 
                                ? formatSafeDate(payment.completed_at, 'MMM d, yyyy')
                                : formatSafeDate(payment.created_at, 'MMM d, yyyy')
                              }
                            </div>
                          </div>
                          
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status === 'completed' ? '✓ Completed' : payment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;
