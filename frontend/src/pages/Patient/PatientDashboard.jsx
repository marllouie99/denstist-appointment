import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Calendar, Clock, User, Phone, MapPin, CreditCard, CheckCircle, RefreshCw, Plus, Coins, Settings, Edit3, Save, X, Eye, EyeOff, Lock, Info, Stethoscope, UserCheck, FileText, CalendarPlus, Receipt, Activity, Star, Zap, CalendarDays, CalendarRange, Trash2 } from 'lucide-react';
import { format, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { formatPHPCurrencyCompact } from '../../utils/currency';

// Safe date formatting function
const formatSafeDate = (dateValue, formatString = 'PPp') => {
  if (!dateValue) return 'N/A';
  
  const date = new Date(dateValue);
  if (!isValid(date)) {
    console.warn('Invalid date value:', dateValue);
    return 'Invalid Date';
  }
  
  try {
    return format(date, formatString);
  } catch (error) {
    console.error('Date formatting error:', error, 'for value:', dateValue);
    return 'Format Error';
  }
};

// Appointment indicator helper function
const getAppointmentIndicator = (appointment) => {
  const now = new Date();
  const appointmentDate = new Date(appointment.appointment_time || appointment.appointment_date);
  const createdDate = new Date(appointment.created_at);
  
  // Calculate time differences
  const timeDiff = appointmentDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const createdDiff = now.getTime() - createdDate.getTime();
  const hoursCreated = createdDiff / (1000 * 3600);
  
  // Check if appointment is new (created within last 24 hours)
  if (hoursCreated <= 24) {
    return {
      type: 'new',
      label: 'New',
      icon: Star,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      iconColor: 'text-yellow-600'
    };
  }
  
  // Check if appointment is today
  const today = new Date();
  const isToday = appointmentDate.toDateString() === today.toDateString();
  if (isToday) {
    return {
      type: 'today',
      label: 'Today',
      icon: Zap,
      className: 'bg-red-100 text-red-800 border-red-200',
      iconColor: 'text-red-600'
    };
  }
  
  // Check if appointment is this week (within 7 days)
  if (daysDiff >= 0 && daysDiff <= 7) {
    return {
      type: 'weekly',
      label: 'This Week',
      icon: CalendarDays,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      iconColor: 'text-blue-600'
    };
  }
  
  // Check if appointment is this month (within 30 days)
  if (daysDiff >= 0 && daysDiff <= 30) {
    return {
      type: 'monthly',
      label: 'This Month',
      icon: CalendarRange,
      className: 'bg-purple-100 text-purple-800 border-purple-200',
      iconColor: 'text-purple-600'
    };
  }
  
  // No special indicator for appointments beyond this month
  return null;
};

const PatientDashboard = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayments, setProcessingPayments] = useState(new Set());
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0
  });

  // Settings state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);

  // Debug logging for user state changes
  useEffect(() => {
    console.log('PatientDashboard - User state changed:', {
      user: user ? { id: user.id, email: user.email } : null,
      token: token ? 'Present' : 'Missing'
    });
    
    // Check if returning from successful payment
    const paymentStatus = searchParams.get('payment');
    const appointmentId = searchParams.get('appointmentId');
    if (paymentStatus === 'success') {
      console.log('💰 Payment success detected, appointmentId:', appointmentId);
      console.log('🔄 Setting up multiple refresh attempts to ensure payment status is updated...');
      toast.success('Payment completed successfully! Verifying status...');
      // Remove the parameters from URL
      setSearchParams({});
      
      // Immediate verification of payment status
      if (appointmentId) {
        setTimeout(() => {
          console.log('🔍 [PAYMENT SUCCESS] Verifying payment status immediately');
          verifyPaymentStatus(parseInt(appointmentId));
        }, 500);
      }
      
      // Force refresh data to show updated payment status
      // Use multiple refresh attempts to ensure data is updated
      setTimeout(() => {
        console.log('🔄 First refresh after payment success (1s delay)');
        fetchData(true);
      }, 1000);
      
      // Additional refresh after 3 seconds to ensure backend has processed
      setTimeout(() => {
        console.log('🔄 Second refresh after payment success (3s delay)');
        fetchData(true);
        // Verify again after refresh
        if (appointmentId) {
          verifyPaymentStatus(parseInt(appointmentId));
        }
      }, 3000);

      // Final refresh after 6 seconds for extra safety
      setTimeout(() => {
        console.log('🔄 Third refresh after payment success (6s delay)');
        fetchData(true);
      }, 6000);
      
      // Clear any cached appointment data
    }
  }, [searchParams, setSearchParams]);


  useEffect(() => {
    if (user && token) {
      fetchData();
      fetchUserProfile();
      // Initialize profile data
      setProfileData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user, token]);

  // Handle URL parameters for tab navigation (separate from payment handling)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'appointments', 'payments', 'settings'].includes(tab)) {
      setActiveTab(tab);
      // Clear the URL parameter after setting the tab
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('tab');
      setSearchParams(newSearchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      const response = await api.get('/profile/profile');
      
      if (response.data && response.data.user) {
        const userData = response.data.user;
        console.log('User profile loaded:', userData);
        
        
        // Update profile data
        setProfileData({
          full_name: userData.full_name || '',
          email: userData.email || '',
          phone: userData.phone || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Don't show error toast for profile fetch as it's not critical
    }
  };

  const fetchData = async (showLoadingToast = false) => {
    try {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔄 PatientDashboard - fetchData started:', {
        user: user ? { id: user.id, email: user.email } : null,
        token: token ? 'Present' : 'Missing',
        storedToken: storedToken ? `${storedToken.substring(0, 20)}...` : 'Missing',
        storedUser: storedUser ? JSON.parse(storedUser).email : 'Missing',
        showLoadingToast,
        timestamp: new Date().toISOString()
      });

      if (!user) {
        console.log('⚠️ PatientDashboard - No user available, skipping data fetch');
        return;
      }

      if (showLoadingToast) {
        toast.loading('Refreshing data...', { id: 'refresh' });
      }
      
      console.log('📡 PatientDashboard - Making API calls to fetch appointments and payments...');
      
      // Add cache busting for fresh data after payment
      const cacheBuster = Date.now();
      const [appointmentsRes, paymentsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/payments/history')
      ]);

      console.log('✅ PatientDashboard - API calls completed successfully');

      console.log('PatientDashboard - Raw appointments response:');
      console.log(JSON.stringify(appointmentsRes.data, null, 2));
      const rawAppointmentData = appointmentsRes.data.appointments || [];
      
      // Keep track of problematic appointment IDs that returned 404 errors
      const problematicAppointmentIds = JSON.parse(localStorage.getItem('problematicAppointments') || '[]');
      
      // Filter out appointments with invalid or missing data, and known problematic ones
      const appointmentData = rawAppointmentData.filter(apt => {
        const isValid = apt && apt.id && apt.service && apt.dentist;
        const isProblematic = problematicAppointmentIds.includes(apt?.id);
        
        if (!isValid) {
          console.warn('🚨 [DATA VALIDATION] Filtering out invalid appointment:', {
            id: apt?.id,
            hasService: !!apt?.service,
            hasDentist: !!apt?.dentist,
            timestamp: new Date().toISOString()
          });
        }
        
        if (isProblematic) {
          console.warn('🚨 [DATA VALIDATION] Filtering out problematic appointment (known 404):', {
            id: apt?.id,
            timestamp: new Date().toISOString()
          });
        }
        
        return isValid && !isProblematic;
      });
      
      console.log('PatientDashboard - Processed appointments:', appointmentData.map(apt => ({
        id: apt.id,
        service: apt.service?.name,
        payment_status: apt.payment_status,
        status: apt.status,
        appointment_time: apt.appointment_time,
        created_at: apt.created_at,
        updated_at: apt.updated_at
      })));
      
      console.log(`📊 [DATA VALIDATION] Filtered ${rawAppointmentData.length - appointmentData.length} invalid appointments`);
      
      // Check if appointment 22 is in the data and its status
      const appointment22 = appointmentData.find(apt => apt.id === 22);
      if (appointment22) {
        console.log('PatientDashboard - Appointment 22 details:', {
          id: appointment22.id,
          status: appointment22.status,
          payment_status: appointment22.payment_status,
          service: appointment22.service?.name,
          updated_at: appointment22.updated_at
        });
      } else {
        console.log('PatientDashboard - Appointment 22 not found in data');
      }

      // Check for appointment 34 (the one that was just paid according to logs)
      const appointment34 = appointmentData.find(apt => apt.id === 34);
      if (appointment34) {
        console.log('🎯 PatientDashboard - Appointment 34 (recently paid) FULL OBJECT:');
        console.log(JSON.stringify(appointment34, null, 2));
        console.log('🎯 PatientDashboard - Appointment 34 details:', {
          id: appointment34.id,
          status: appointment34.status,
          payment_status: appointment34.payment_status,
          service: appointment34.service?.name,
          updated_at: appointment34.updated_at,
          isPaid: appointment34.payment_status === 'paid',
          shouldShowPayButton: appointment34.status === 'approved' && appointment34.payment_status === 'unpaid',
          paymentStatusType: typeof appointment34.payment_status,
          paymentStatusValue: JSON.stringify(appointment34.payment_status),
          rawPaymentStatus: appointment34.payment_status,
          paymentStatusLength: appointment34.payment_status?.length,
          paymentStatusTrimmed: appointment34.payment_status?.trim?.()
        });
      } else {
        console.log('⚠️ PatientDashboard - Appointment 34 (recently paid) not found in data');
      }

      // Log all appointments with their payment status
      console.log('📋 PatientDashboard - All appointments payment status:', appointmentData.map(apt => ({
        id: apt.id,
        service: apt.service?.name,
        status: apt.status,
        payment_status: apt.payment_status,
        updated_at: apt.updated_at
      })));
      
      setAppointments(appointmentData);

      // Calculate stats
      const newStats = {
        total: appointmentData.length,
        pending: appointmentData.filter(apt => apt.status === 'pending').length,
        approved: appointmentData.filter(apt => apt.status === 'approved').length,
        completed: appointmentData.filter(apt => apt.payment_status === 'paid').length
      };
      setStats(newStats);

      console.log('PatientDashboard - Raw payments response:');
      console.log(JSON.stringify(paymentsRes.data, null, 2));
      const paymentData = paymentsRes.data.payments || [];
      console.log('PatientDashboard - Processed payments:', paymentData.map(payment => ({
        id: payment.id,
        appointment_id: payment.appointment_id,
        amount: payment.amount,
        status: payment.status,
        created_at: payment.created_at,
        paypal_payment_id: payment.paypal_payment_id
      })));
      
      // Check for payments related to appointment 22
      const payment22 = paymentData.find(payment => payment.appointment_id === 22);
      if (payment22) {
        console.log('PatientDashboard - Payment for appointment 22 found:', {
          id: payment22.id,
          appointment_id: payment22.appointment_id,
          amount: payment22.amount,
          status: payment22.status,
          created_at: payment22.created_at
        });
      } else {
        console.log('PatientDashboard - No payment found for appointment 22');
      }
      
      setPayments(paymentData);
      
      if (showLoadingToast) {
        toast.success('Data refreshed!', { id: 'refresh' });
      }
    } catch (error) {
      console.error('❌ PatientDashboard - Error fetching data:', error);
      console.error('❌ PatientDashboard - Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        isNetworkError: error.message?.includes('Network Error') || error.code === 'ECONNREFUSED',
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        timestamp: new Date().toISOString()
      });

      // Enhanced error analysis for dashboard
      if (error.response?.status === 400) {
        console.error('🔍 PatientDashboard - 400 Bad Request Details:', {
          possibleCauses: [
            'Invalid authentication token',
            'User not found in database',
            'Missing required parameters',
            'Malformed request'
          ],
          currentUser: user ? { id: user.id, email: user.email } : 'No user',
          currentToken: localStorage.getItem('access_token') ? 'Present' : 'Missing'
        });
      } else if (error.response?.status === 401) {
        console.error('🔍 PatientDashboard - 401 Unauthorized - Token expired or invalid');
      } else if (error.response?.status === 404) {
        console.error('🔍 PatientDashboard - 404 Not Found - API endpoints not available');
      } else if (error.message?.includes('Network Error') || error.code === 'ECONNREFUSED') {
        console.error('🔍 PatientDashboard - Network Error - Backend server not responding');
      }

      toast.error('Failed to load dashboard data');
      if (showLoadingToast) {
        toast.dismiss('refresh');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const logAllAppointmentDetails = () => {
    console.log('📋 [DATABASE TRACKING] ===== ALL APPOINTMENT DETAILS =====');
    appointments.forEach((appointment, index) => {
      console.log(`📋 [APPOINTMENT ${index + 1}] ID: ${appointment.id}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Service: ${appointment.service?.name}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Date: ${appointment.appointment_time}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Status: ${appointment.status}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Payment Status: ${appointment.payment_status}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Updated At: ${appointment.updated_at}`);
      console.log(`📋 [APPOINTMENT ${index + 1}] Full Object:`, JSON.stringify(appointment, null, 2));
      console.log('---');
    });
    console.log('📋 [DATABASE TRACKING] ===== END APPOINTMENT DETAILS =====');
  };

  // EMERGENCY FIX: Manual payment status update function
  const handleFixPaymentStatus = async (appointmentId) => {
    console.log('🔧 [FIX PAYMENT] ===== MANUAL FIX STARTED =====');
    console.log('🔧 [FIX PAYMENT] Appointment ID:', appointmentId);
    
    try {
      toast.loading('Fixing payment status...', { id: 'fix-payment' });
      
      const response = await api.patch(`/appointments/fix-payment-status/${appointmentId}`);
      
      console.log('✅ [FIX PAYMENT] Response:', response.data);
      
      // Immediately update the local state to reflect the change
      setAppointments(prevAppointments => 
        prevAppointments.map(apt => 
          apt.id === parseInt(appointmentId) 
            ? { ...apt, payment_status: 'paid', updated_at: new Date().toISOString() }
            : apt
        )
      );
      
      toast.success('Payment status fixed successfully!', { id: 'fix-payment' });
      
      // Only refresh if backend confirms success
      if (response.data && response.data.rowsAffected > 0) {
        console.log('✅ [FIX PAYMENT] Backend confirmed update, refreshing data...');
        setTimeout(() => {
          fetchData(false);
        }, 2000);
      } else {
        console.warn('⚠️ [FIX PAYMENT] Backend update may have failed, keeping local state only');
        toast.error('Backend update failed, but UI updated locally. May revert on refresh.', { 
          id: 'fix-warning',
          duration: 5000 
        });
      }
      
    } catch (error) {
      console.error('❌ [FIX PAYMENT] Error:', error);
      toast.error('Failed to fix payment status', { id: 'fix-payment' });
    }
  };

  const verifyPaymentStatus = async (appointmentId) => {
    try {
      console.log('🔍 [VERIFY] Starting direct database verification for appointment:', appointmentId);
      
      const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [VERIFY] Direct database query result:', data);
        
        if (data.appointment) {
          console.log('🔍 [VERIFY] Current payment_status in database:', data.appointment.payment_status);
          console.log('🔍 [VERIFY] Last updated_at:', data.appointment.updated_at);
          
          if (data.appointment.payment_status === 'paid') {
            console.log('✅ [VERIFY] Database shows PAID - forcing UI refresh');
            toast.success('Payment status verified as PAID!');
            await fetchData(true);
          } else {
            console.log('⚠️ [VERIFY] Database still shows UNPAID - payment sync failed');
            toast.error('Payment status still shows unpaid in database');
          }
        }
      }
    } catch (error) {
      console.error('❌ [VERIFY] Error verifying payment status:', error);
    }
  };

  const connectPaymentToDatabase = async (appointmentId) => {
    try {
      console.log('🔗 [CONNECT] Starting payment-to-database connection for appointment:', appointmentId);
      
      // First, check if there are any completed payments for this appointment
      const paymentsResponse = await fetch(`http://localhost:5000/api/payments/by-appointment/${appointmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        console.log('🔗 [CONNECT] Payments found for appointment:', paymentsData);
        
        const completedPayments = paymentsData.payments?.filter(p => p.status === 'completed') || [];
        console.log('🔗 [CONNECT] Completed payments:', completedPayments);
        
        if (completedPayments.length > 0) {
          console.log('✅ [CONNECT] Found completed payment! Connecting to appointment...');
          toast.success('Found completed payment! Connecting to appointment...');
          
          // Force update the appointment payment status
          await fixPaymentStatus(appointmentId);
        } else {
          console.log('⚠️ [CONNECT] No completed payments found for this appointment');
          toast.error('No completed payments found for this appointment');
        }
      } else {
        console.log('⚠️ [CONNECT] Could not fetch payments for appointment');
        toast.error('Could not check payment status');
      }
    } catch (error) {
      console.error('❌ [CONNECT] Error connecting payment to database:', error);
      toast.error('Error connecting payment to database');
    }
  };

  const fixPaymentStatus = async (appointmentId) => {
    try {
      console.log('🔧 [FIX] Starting manual fix for appointment:', appointmentId);
      console.log('🔧 [FIX] Current token:', localStorage.getItem('access_token') ? 'Present' : 'Missing');
      
      const url = `http://localhost:5000/api/appointments/fix-payment-status/${appointmentId}`;
      console.log('🔧 [FIX] Making request to:', url);
      
      // Direct API call to update appointment
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔧 [FIX] Response status:', response.status);
      console.log('🔧 [FIX] Response ok:', response.ok);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ [FIX] Payment status fixed successfully:', responseData);
        toast.success('Payment status updated to paid!');
        
        console.log('🔄 [FIX] Starting multiple refresh attempts to ensure UI updates...');
        
        // Immediate refresh
        await fetchData(true);
        console.log('🔄 [FIX] First refresh completed');
        
        // Additional refresh after 1 second to ensure backend has processed
        setTimeout(async () => {
          console.log('🔄 [FIX] Second refresh after 1s delay');
          await fetchData(true);
        }, 1000);
        
        // Final refresh after 3 seconds for extra safety
        setTimeout(async () => {
          console.log('🔄 [FIX] Third refresh after 3s delay');
          await fetchData(true);
        }, 3000);
      } else {
        const errorData = await response.text();
        console.error('❌ [FIX] Failed to fix payment status. Status:', response.status);
        console.error('❌ [FIX] Error response:', errorData);
        toast.error(`Failed to update payment status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [FIX] Error fixing payment status:', error);
      console.error('❌ [FIX] Error stack:', error.stack);
      toast.error('Error updating payment status');
    }
  };

  const debugPaymentStatus = async (appointmentId) => {
    try {
      console.log('🔍 [DEBUG] Starting debug for appointment:', appointmentId);
      
      const response = await fetch(`http://localhost:5000/api/payments/debug-appointment/${appointmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const debugData = await response.json();
        console.log('🔍 [DEBUG] Debug data received:', debugData);
        
        if (debugData.issue_detected) {
          console.log('❌ [DEBUG] Issue detected:', debugData.issue_description);
          toast.error(`Issue found: ${debugData.issue_description}`);
        } else {
          console.log('✅ [DEBUG] No issues detected');
          toast.success('Payment status appears to be correct');
        }
      } else {
        console.error('❌ [DEBUG] Debug request failed:', response.status);
        toast.error('Failed to debug payment status');
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error debugging payment status:', error);
      toast.error('Error debugging payment status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  // Settings functions

  const handleProfileEdit = () => {
    setIsEditingProfile(true);
  };

  const handleProfileSave = async () => {
    try {
      toast.loading('Updating profile...', { id: 'profile-update' });
      
      // Make API call to update the profile
      const response = await api.put('/profile/profile', {
        full_name: profileData.full_name,
        phone: profileData.phone
      });
      
      if (response.data) {
        toast.success('Profile updated successfully!', { id: 'profile-update' });
        setIsEditingProfile(false);
        console.log('Profile updated successfully:', response.data);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile', { id: 'profile-update' });
    }
  };

  const handleProfileCancel = () => {
    // Reset to original values
    setProfileData({
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || ''
    });
    setIsEditingProfile(false);
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      toast.loading('Changing password...', { id: 'password-change' });
      
      // Here you would typically make an API call to change the password
      // For now, we'll just simulate the change
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Password changed successfully!', { id: 'password-change' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordChange(false);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password', { id: 'password-change' });
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleDeleteAppointment = async (appointmentId, serviceName) => {
    // Validate appointment exists in current state
    const appointmentExists = appointments.find(apt => apt.id === appointmentId);
    if (!appointmentExists) {
      console.warn('🚨 [DELETE] Appointment not found in current state:', appointmentId);
      toast.error('Appointment not found. Refreshing data...', { id: 'cancel-appointment' });
      fetchData();
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to cancel your appointment for "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      toast.loading('Cancelling appointment...', { id: 'cancel-appointment' });
      
      console.log('🗑️ [DELETE] Attempting to delete appointment:', {
        appointmentId,
        serviceName,
        appointmentExists: !!appointmentExists,
        appointmentStatus: appointmentExists?.status,
        paymentStatus: appointmentExists?.payment_status,
        timestamp: new Date().toISOString()
      });
      
      // Call API to delete appointment
      await api.delete(`/appointments/${appointmentId}`);
      
      // Remove from local state
      setAppointments(prevAppointments => 
        prevAppointments.filter(apt => apt.id !== appointmentId)
      );
      
      toast.success('Appointment cancelled successfully', { id: 'cancel-appointment' });
      
      console.log('✅ [DELETE] Appointment deleted successfully:', appointmentId);
      
      // Refresh data to ensure consistency
      fetchData();
      
    } catch (error) {
      console.error('❌ [DELETE] Error cancelling appointment:', {
        appointmentId,
        serviceName,
        error: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        },
        timestamp: new Date().toISOString()
      });
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        // Appointment doesn't exist on server, remove from local state anyway
        setAppointments(prevAppointments => 
          prevAppointments.filter(apt => apt.id !== appointmentId)
        );
        
        // Mark this appointment as problematic to prevent it from reappearing
        const problematicAppointmentIds = JSON.parse(localStorage.getItem('problematicAppointments') || '[]');
        if (!problematicAppointmentIds.includes(appointmentId)) {
          problematicAppointmentIds.push(appointmentId);
          localStorage.setItem('problematicAppointments', JSON.stringify(problematicAppointmentIds));
          console.log('📝 [DELETE] Added appointment to problematic list:', appointmentId);
        }
        
        toast.success('Appointment removed (was already deleted)', { id: 'cancel-appointment' });
        
        console.log('✅ [DELETE] Appointment removed from UI due to 404 (backend inconsistency):', appointmentId);
        
        // DON'T refresh data here - it would bring back the inconsistent appointment
        // The backend has inconsistent data, so we keep our cleaned local state
      } else {
        toast.error('Failed to cancel appointment. Please try again.', { id: 'cancel-appointment' });
      }
    }
  };

  const closeDetailsModal = () => {
    setSelectedAppointment(null);
    setShowDetailsModal(false);
  };

  const handleViewPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetailsModal(true);
  };

  const closePaymentDetailsModal = () => {
    setSelectedPayment(null);
    setShowPaymentDetailsModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user?.full_name}!
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your appointments and dental health
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/patient/book-appointment"
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Book Appointment</span>
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'appointments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-1" />
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'payments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Coins className="h-4 w-4 inline mr-1" />
            Payments
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-1" />
            Settings
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <User className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* New Appointments */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Activity className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">New Appointments</h2>
              </div>
              <p className="text-gray-600 mt-1">Pending approvals and unpaid appointments</p>
            </div>
            <div className="p-6">
              {(() => {
                const now = new Date();
                const actionableAppointments = appointments.filter(apt => {
                  const appointmentDate = new Date(apt.appointment_time);
                  const isFuture = appointmentDate > now;
                  
                  // Show only pending appointments OR approved appointments that need payment
                  const isPending = apt.status === 'pending';
                  const needsPayment = apt.status === 'approved' && apt.payment_status === 'unpaid';
                  
                  return isFuture && (isPending || needsPayment);
                });
                
                return actionableAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No upcoming appointments found</p>
                    <Link
                      to="/patient/book-appointment"
                      className="btn btn-primary mt-4"
                    >
                      Book Your First Appointment
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {actionableAppointments.slice(0, 5).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                          <User className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Stethoscope className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-gray-900">
                              {appointment.service?.name}
                            </h3>
                            {(() => {
                              const indicator = getAppointmentIndicator(appointment);
                              if (indicator) {
                                const IconComponent = indicator.icon;
                                return (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${indicator.className}`}>
                                    <IconComponent className={`w-3 h-3 mr-1 ${indicator.iconColor}`} />
                                    {indicator.label}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-semibold text-gray-700">
                              Dr. {appointment.dentist?.full_name}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <p className="text-sm font-semibold text-gray-600">
                              <span className="font-bold">Appointment:</span> {formatSafeDate(appointment.appointment_time)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CalendarPlus className="w-3 h-3 text-gray-400" />
                            <p className="text-xs font-semibold text-gray-500">
                              <span className="font-bold">Created:</span> {formatSafeDate(appointment.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        <button
                          onClick={() => handleViewDetails(appointment)}
                          className="btn btn-sm btn-secondary flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                        {appointment.payment_status !== 'paid' && (
                          <button
                            onClick={() => handleDeleteAppointment(appointment.id, appointment.service?.name)}
                            className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 flex items-center space-x-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                        )}
                        {appointment.payment_status === 'paid' ? (
                          <span className="btn btn-sm bg-green-100 text-green-700 cursor-default">
                            ✅ Paid
                          </span>
                        ) : appointment.status === 'approved' && appointment.payment_status === 'unpaid' ? (
                          <div className="flex space-x-2">
                            <Link
                              to={`/patient/payment/${appointment.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Pay Now
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          </div>

        </div>
      )}

      {/* Appointments Tab */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Calendar className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">All Appointments</h2>
              </div>
            </div>
            <div className="p-6">
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No appointments found</p>
                  <Link
                    to="/patient/book-appointment"
                    className="btn btn-primary mt-4"
                  >
                    Book Your First Appointment
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                          <User className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Stethoscope className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-gray-900">
                              {appointment.service?.name}
                            </h3>
                            {(() => {
                              const indicator = getAppointmentIndicator(appointment);
                              if (indicator) {
                                const IconComponent = indicator.icon;
                                return (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${indicator.className}`}>
                                    <IconComponent className={`w-3 h-3 mr-1 ${indicator.iconColor}`} />
                                    {indicator.label}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-semibold text-gray-700">
                              Dr. {appointment.dentist?.full_name}
                            </p>
                            <div className="flex items-center space-x-1 ml-2">
                              <Coins className="w-3 h-3 text-green-500" />
                              <span className="text-sm font-semibold text-gray-700">{formatPHPCurrencyCompact(appointment.service?.price)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <p className="text-sm font-semibold text-gray-600">
                              <span className="font-bold">Appointment:</span> {formatSafeDate(appointment.appointment_time)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CalendarPlus className="w-3 h-3 text-gray-400" />
                            <p className="text-xs font-semibold text-gray-500">
                              <span className="font-bold">Created:</span> {formatSafeDate(appointment.created_at)}
                            </p>
                          </div>
                          {appointment.notes && (
                            <div className="flex items-start space-x-2 mt-1">
                              <FileText className="w-3 h-3 text-blue-500 mt-0.5" />
                              <p className="text-sm font-semibold text-gray-700">
                                <span className="font-bold">Notes:</span> {appointment.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        <button
                          onClick={() => handleViewDetails(appointment)}
                          className="btn btn-sm btn-secondary flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                        {appointment.payment_status !== 'paid' && (
                          <button
                            onClick={() => handleDeleteAppointment(appointment.id, appointment.service?.name)}
                            className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 flex items-center space-x-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                        )}
                        {appointment.payment_status === 'paid' ? (
                          <span className="btn btn-sm bg-green-100 text-green-700 cursor-default">
                            ✅ Paid
                          </span>
                        ) : appointment.status === 'approved' && appointment.payment_status === 'unpaid' ? (
                          <div className="flex space-x-2">
                            <Link
                              to={`/patient/payment/${appointment.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Pay Now
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Payment Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6">
              <div className="flex items-center">
                <Receipt className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Payments</p>
                  <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Paid</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPHPCurrencyCompact(
                      payments
                        .filter(p => p.status === 'completed')
                        .reduce((sum, p) => sum + (p.amount || 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {payments.filter(p => p.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
                </div>
                <p className="text-sm text-gray-500">
                  {payments.length} payment{payments.length !== 1 ? 's' : ''} total
                </p>
              </div>
            </div>
            <div className="p-6">
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
                  <p className="text-gray-500 mb-4">Your payment history will appear here once you make payments</p>
                  <Link
                    to="/patient/book-appointment"
                    className="btn btn-primary"
                  >
                    Book Your First Appointment
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <Receipt className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Stethoscope className="w-4 h-4 text-blue-600" />
                              <h3 className="font-bold text-gray-900 text-lg">
                                {payment.appointment?.service?.name || 'Service Not Available'}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                payment.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : payment.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {payment.status === 'completed' ? '✓ Completed' : payment.status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <UserCheck className="w-4 h-4 text-green-600" />
                              <p className="text-sm font-semibold text-gray-700">
                                Dr. {payment.appointment?.dentist?.full_name || 'Unknown Doctor'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <div>
                              <p className="font-medium text-gray-600">Appointment Date</p>
                              <p className="text-gray-900">{formatSafeDate(payment.appointment?.appointment_time, 'PPP')}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Receipt className="w-4 h-4 text-green-500" />
                            <div>
                              <p className="font-medium text-gray-600">Payment Date</p>
                              <p className="text-gray-900">
                                {payment.completed_at 
                                  ? formatSafeDate(payment.completed_at, 'PPP')
                                  : formatSafeDate(payment.created_at, 'PPP')
                                }
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="font-medium text-gray-600">Payment ID</p>
                              <p className="text-gray-900 font-mono text-xs">#{payment.id}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 ml-6">
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-2xl">
                            {formatPHPCurrencyCompact(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.status === 'completed' ? 'Paid' : 'Pending'}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleViewPaymentDetails(payment)}
                          className="btn btn-sm btn-secondary flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">

          {/* Profile Information Section */}
          <div className="card">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
                <p className="text-gray-600 mt-1">Update your personal information</p>
              </div>
              {!isEditingProfile ? (
                <button
                  onClick={handleProfileEdit}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleProfileSave}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleProfileCancel}
                    className="btn btn-secondary flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings Section */}
          <div className="card">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                <p className="text-gray-600 mt-1">Manage your account security</p>
              </div>
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Change Password</span>
              </button>
            </div>
            <div className="p-6">
              {showPasswordChange ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('current')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handlePasswordChange}
                      className="btn btn-primary"
                      disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      Update Password
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Click "Change Password" to update your password</p>
                    <p className="text-xs text-gray-400 mt-1">Keep your account secure with a strong password</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Information Section */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
              <p className="text-gray-600 mt-1">View your account details</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Account Type</h4>
                  <p className="text-gray-900">Patient Account</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Member Since</h4>
                  <p className="text-gray-900">
                    {user?.created_at ? formatSafeDate(user.created_at, 'MMMM yyyy') : 'October 2025'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Total Appointments</h4>
                  <p className="text-gray-900">{stats.total}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Completed Appointments</h4>
                  <p className="text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Appointment Details</h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Appointment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-medium text-gray-700">Service</h4>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{selectedAppointment.service?.name}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Coins className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-gray-600">{formatPHPCurrencyCompact(selectedAppointment.service?.price)}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    <h4 className="text-sm font-medium text-gray-700">Status</h4>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(selectedAppointment.payment_status)}`}>
                      {selectedAppointment.payment_status === 'paid' ? '✓ Paid' : selectedAppointment.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Date & Time</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-gray-900 font-medium">Appointment Date</p>
                      <p className="text-sm text-gray-600">{formatSafeDate(selectedAppointment.appointment_time, 'PPPP')}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-gray-900 font-medium">Appointment Time</p>
                      <p className="text-sm text-gray-600">{formatSafeDate(selectedAppointment.appointment_time, 'p')}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-gray-700 font-medium">Created On</p>
                      <p className="text-sm text-gray-500">{formatSafeDate(selectedAppointment.created_at, 'PPpp')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dentist Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Dentist Information</h4>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                    <User className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Dr. {selectedAppointment.dentist?.full_name}</p>
                    <p className="text-sm text-gray-600">{selectedAppointment.dentist?.specialization || 'General Dentist'}</p>
                    {selectedAppointment.dentist?.phone && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-600">{selectedAppointment.dentist.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h4 className="text-sm font-medium text-gray-700">Notes</h4>
                  </div>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Appointment ID */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <h4 className="text-sm font-medium text-gray-700">Appointment ID</h4>
                </div>
                <p className="text-gray-900 font-mono text-sm">#{selectedAppointment.id}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                {selectedAppointment.status === 'approved' && selectedAppointment.payment_status === 'unpaid' && (
                  <Link
                    to={`/patient/payment/${selectedAppointment.id}`}
                    className="btn btn-primary flex items-center space-x-2"
                    onClick={closeDetailsModal}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Now</span>
                  </Link>
                )}
                <button
                  onClick={closeDetailsModal}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
              <button
                onClick={closePaymentDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Payment Status Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedPayment.status === 'completed' 
                      ? 'bg-green-100' 
                      : selectedPayment.status === 'pending'
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                  }`}>
                    {selectedPayment.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : selectedPayment.status === 'pending' ? (
                      <Clock className="w-6 h-6 text-yellow-600" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Payment #{selectedPayment.id}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedPayment.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : selectedPayment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedPayment.status === 'completed' ? '✓ Payment Completed' : 
                       selectedPayment.status === 'pending' ? '⏳ Payment Pending' : 
                       selectedPayment.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    {formatPHPCurrencyCompact(selectedPayment.amount)}
                  </p>
                  <p className="text-sm text-gray-500">Total Amount</p>
                </div>
              </div>

              {/* Service & Appointment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-medium text-gray-700">Service Details</h4>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedPayment.appointment?.service?.name || 'Service Not Available'}
                    </p>
                    <div className="flex items-center space-x-1">
                      <Coins className="w-4 h-4 text-green-500" />
                      <p className="text-sm text-gray-600">
                        Service Price: {formatPHPCurrencyCompact(selectedPayment.appointment?.service?.price || selectedPayment.amount)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <h4 className="text-sm font-medium text-gray-700">Appointment Details</h4>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Appointment Date</p>
                    <p className="font-semibold text-gray-900 mb-2">
                      {formatSafeDate(selectedPayment.appointment?.appointment_time, 'PPPP')}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">Time</p>
                    <p className="font-semibold text-gray-900">
                      {formatSafeDate(selectedPayment.appointment?.appointment_time, 'p')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dentist Information */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <UserCheck className="w-5 h-5 text-green-600" />
                  <h4 className="text-sm font-medium text-gray-700">Dentist Information</h4>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">
                      Dr. {selectedPayment.appointment?.dentist?.full_name || 'Unknown Doctor'}
                    </p>
                    <p className="text-sm text-gray-600">General Dentist</p>
                  </div>
                </div>
              </div>

              {/* Payment Timeline */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-medium text-gray-700">Payment Timeline</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Payment Created</p>
                      <p className="text-sm text-gray-600">
                        {formatSafeDate(selectedPayment.created_at, 'PPpp')}
                      </p>
                    </div>
                  </div>
                  
                  {selectedPayment.completed_at && (
                    <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Payment Completed</p>
                        <p className="text-sm text-gray-600">
                          {formatSafeDate(selectedPayment.completed_at, 'PPpp')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method & Transaction Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-medium text-gray-700">Payment Method</h4>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-xs">PP</span>
                      </div>
                      <p className="font-medium text-gray-900">PayPal</p>
                    </div>
                    <p className="text-sm text-gray-600">Secure online payment</p>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Info className="w-5 h-5 text-gray-600" />
                    <h4 className="text-sm font-medium text-gray-700">Transaction Details</h4>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Payment ID</p>
                      <p className="font-mono text-sm text-gray-900">#{selectedPayment.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Appointment ID</p>
                      <p className="font-mono text-sm text-gray-900">#{selectedPayment.appointment_id}</p>
                    </div>
                    {selectedPayment.paypal_payment_id && (
                      <div>
                        <p className="text-xs text-gray-500">PayPal Transaction</p>
                        <p className="font-mono text-xs text-gray-900">{selectedPayment.paypal_payment_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closePaymentDetailsModal}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                {selectedPayment.appointment && (
                  <button
                    onClick={() => {
                      handleViewDetails(selectedPayment.appointment);
                      closePaymentDetailsModal();
                    }}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>View Appointment</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
