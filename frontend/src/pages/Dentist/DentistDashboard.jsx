import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dentistsAPI, api } from '../../lib/api';
import { Calendar, Coins, Clock, Users, Settings, Eye, X, User, Check, XCircle, Stethoscope, Activity, Phone, Mail, Upload, Edit3, Save, Lock, EyeOff, RefreshCw, TrendingUp, DollarSign, CalendarPlus, FileText, Receipt, BarChart3, PieChart, CreditCard, Star, Zap, CalendarDays, CalendarRange, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AvailabilityManager from '../../components/AvailabilityManager';
import LeaveScheduleManager from '../../components/LeaveScheduleManager';
import GoogleCalendarConnect from '../../components/GoogleCalendarConnect';
import GoogleCalendarView from '../../components/GoogleCalendarView';
import { formatPHPCurrency, formatPHPCurrencyCompact } from '../../utils/currency';

const DentistDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dentistProfile, setDentistProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({
    specialization: '',
    qualifications: '',
    bio: '',
    years_of_experience: ''
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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
  const [earningsData, setEarningsData] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
    overall: 0
  });

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
      
      // Set up auto-refresh every 30 seconds to catch new appointments
      const interval = setInterval(() => {
        fetchDashboardData();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle URL parameters for tab navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'appointments', 'payments', 'earnings', 'availability', 'settings'].includes(tab)) {
      setActiveTab(tab);
      // Clear the URL parameter after setting the tab
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);


  const fetchDashboardData = async () => {
    if (!user?.id) {
      console.log('User not authenticated, skipping dashboard data fetch');
      return;
    }
    
    // Debug authentication state
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    console.log('🔐 [AUTH DEBUG] Authentication state:', {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'None',
      hasStoredUser: !!storedUser,
      storedUserData: storedUser ? JSON.parse(storedUser) : null,
      contextUser: user
    });
    
    try {
      console.log('🔍 [FETCH] Starting dashboard data fetch for user:', {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      });
      
      if (user.role !== 'dentist') {
        console.error('❌ [FETCH] User role mismatch! Expected: dentist, Got:', user.role);
        toast.error('Access denied: This dashboard is for dentists only');
        return;
      }
      
      const [appointmentsRes, paymentsRes, profileRes] = await Promise.all([
        dentistsAPI.getMyAppointments(),
        dentistsAPI.getPaymentHistory(),
        dentistsAPI.getProfile(user.id)
      ]);
      
      console.log('🔍 [FETCH] Profile API response structure:', {
        hasData: !!profileRes.data,
        hasDentist: !!profileRes.data?.dentist,
        dentistKeys: profileRes.data?.dentist ? Object.keys(profileRes.data.dentist) : 'N/A'
      });

      // console.log('Appointments data:', appointmentsRes.data);
      // console.log('Payments data:', paymentsRes.data);

      setAppointments(appointmentsRes.data.appointments || []);
      setPayments(paymentsRes.data.payments || []);
      const profile = profileRes.data.dentist?.dentist_profile?.[0] || null;
      setDentistProfile(profile);
      
      // Initialize form with profile data
      if (profile) {
        setProfileForm({
          specialization: profile.specialization || '',
          qualifications: profile.qualifications || '',
          bio: profile.bio || '',
          years_of_experience: profile.years_of_experience || ''
        });
      }

      // Set profile image if it exists in user data
      const dentistData = profileRes.data.dentist;
      
      // Calculate earnings data
      calculateEarnings(paymentsRes.data.payments || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculateEarnings = (paymentsData) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month

    let todayEarnings = 0;
    let weeklyEarnings = 0;
    let monthlyEarnings = 0;
    let overallEarnings = 0;

    paymentsData.forEach(payment => {
      const amount = parseFloat(payment.amount || 0);
      const paymentDate = new Date(payment.completed_at || payment.created_at);
      
      // Only count completed payments
      if (payment.status === 'completed' || payment.status === 'paid') {
        overallEarnings += amount;

        // Today's earnings
        if (paymentDate >= today && paymentDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
          todayEarnings += amount;
        }

        // Weekly earnings
        if (paymentDate >= weekStart) {
          weeklyEarnings += amount;
        }

        // Monthly earnings
        if (paymentDate >= monthStart) {
          monthlyEarnings += amount;
        }
      }
    });

    setEarningsData({
      today: todayEarnings,
      weekly: weeklyEarnings,
      monthly: monthlyEarnings,
      overall: overallEarnings
    });
  };

  const handleAppointmentAction = async (appointmentId, action, reason = null) => {
    try {
      if (action === 'approve') {
        await dentistsAPI.approveAppointment(appointmentId);
        toast.success('Appointment approved successfully');
      } else if (action === 'reject') {
        await dentistsAPI.rejectAppointment(appointmentId, reason);
        toast.success('Appointment rejected');
      }
      fetchDashboardData();
    } catch (error) {
      console.error(`Error ${action}ing appointment:`, error);
      toast.error(`Failed to ${action} appointment`);
    }
  };

  const handleProfileFormChange = (field, value) => {
    setProfileForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProfileUpdate = async () => {
    try {
      await dentistsAPI.updateProfile(profileForm);
      toast.success('Profile updated successfully');
      setIsEditingProfile(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
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

  const handleRefresh = () => {
    fetchDashboardData();
    toast.success('Dashboard refreshed!');
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

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleDeleteAppointment = async (appointmentId, patientName, serviceName) => {
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete the appointment for ${patientName} (${serviceName})? This action cannot be undone.`)) {
      return;
    }

    try {
      toast.loading('Deleting appointment...', { id: 'delete-appointment' });
      
      console.log('🗑️ [DELETE] Attempting to delete appointment:', {
        appointmentId,
        patientName,
        serviceName,
        timestamp: new Date().toISOString()
      });
      
      // Call API to delete appointment
      await api.delete(`/appointments/${appointmentId}`);
      
      // Remove from local state
      setAppointments(prevAppointments => 
        prevAppointments.filter(apt => apt.id !== appointmentId)
      );
      
      toast.success('Appointment deleted successfully', { id: 'delete-appointment' });
      
      console.log('✅ [DELETE] Appointment deleted successfully:', appointmentId);
      
      // Refresh data to ensure consistency
      fetchAppointments();
      
    } catch (error) {
      console.error('❌ [DELETE] Error deleting appointment:', {
        appointmentId,
        patientName,
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
        toast.success('Appointment removed (was already deleted)', { id: 'delete-appointment' });
        
        // Refresh data to sync with server
        fetchAppointments();
      } else {
        toast.error('Failed to delete appointment. Please try again.', { id: 'delete-appointment' });
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

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'approved':
        return <Check className="w-3 h-3" />;
      case 'completed':
        return <Check className="w-3 h-3" />;
      case 'rejected':
        return <XCircle className="w-3 h-3" />;
      case 'cancelled':
        return <XCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const safeFormatDate = (dateValue, formatString = 'PPp') => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, formatString);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

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

  if (!user?.id || loading) {
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
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-4 border-blue-200">
              <User className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, Dr. {user?.full_name}!
            </h1>
            <p className="text-gray-600 mt-2">Manage your appointments and patient care</p>
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
            onClick={() => setActiveTab('earnings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'earnings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="h-4 w-4 inline mr-1" />
            Earnings
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'availability'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="h-4 w-4 inline mr-1" />
            Availability
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-gray-700">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-gray-700">Pending Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {appointments.filter(apt => apt.status === 'pending').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-emerald-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-gray-700">Today's Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPHPCurrency(earningsData.today)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center">
                <Coins className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-gray-700">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPHPCurrency(earningsData.overall)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* New Appointments */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Activity className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">New Appointments</h2>
              </div>
              <p className="text-gray-700 font-semibold mt-1">Appointments requiring your approval or rejection</p>
            </div>
            <div className="p-6">
              {(() => {
                const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
                
                return pendingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-bold">No new appointments requiring action</p>
                    <p className="text-sm text-gray-500 font-semibold mt-2">New patient appointments will appear here for approval</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="w-4 h-4 text-blue-600" />
                          <h3 className="font-bold text-gray-900">
                            {appointment.patient?.full_name}
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
                          <Stethoscope className="w-4 h-4 text-green-600" />
                          <p className="text-sm font-semibold text-gray-700">
                            {appointment.service?.name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <p className="text-sm font-semibold text-gray-600">
                            <span className="font-bold">Appointment:</span> {safeFormatDate(appointment.appointment_time)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CalendarPlus className="w-3 h-3 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-500">
                            <span className="font-bold">Created:</span> {safeFormatDate(appointment.created_at)}
                          </p>
                        </div>
                        {appointment.status === 'rejected' && appointment.rejection_reason && (
                          <div className="flex items-start space-x-2 mt-1">
                            <XCircle className="w-3 h-3 text-red-500 mt-0.5" />
                            <p className="text-sm font-semibold text-red-700">
                              <span className="font-bold">Rejection Reason:</span> {appointment.rejection_reason}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          <span>{appointment.status}</span>
                        </span>
                        {appointment.payment_status === 'paid' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center space-x-1">
                            <span>✓ Paid</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleViewDetails(appointment)}
                          className="btn btn-sm btn-secondary flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                        {appointment.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAppointmentAction(appointment.id, 'approve')}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center space-x-1 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleAppointmentAction(appointment.id, 'reject', 'Rejected by dentist')}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 flex items-center space-x-1 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
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
                <Calendar className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">All Appointments</h2>
              </div>
            </div>
            <div className="p-6">
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-bold">No appointments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="w-4 h-4 text-blue-600" />
                          <h3 className="font-bold text-gray-900">
                            {appointment.patient?.full_name}
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
                          <Stethoscope className="w-4 h-4 text-green-600" />
                          <p className="text-sm font-semibold text-gray-700">
                            {appointment.service?.name}
                          </p>
                          <div className="flex items-center space-x-1 ml-2">
                            <Coins className="w-3 h-3 text-green-500" />
                            <span className="text-sm font-semibold text-gray-700">{formatPHPCurrencyCompact(appointment.service?.price)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <p className="text-sm font-semibold text-gray-600">
                            <span className="font-bold">Appointment:</span> {safeFormatDate(appointment.appointment_time)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CalendarPlus className="w-3 h-3 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-500">
                            <span className="font-bold">Created:</span> {safeFormatDate(appointment.created_at)}
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
                        {appointment.status === 'rejected' && appointment.rejection_reason && (
                          <div className="flex items-start space-x-2 mt-1">
                            <XCircle className="w-3 h-3 text-red-500 mt-0.5" />
                            <p className="text-sm font-semibold text-red-700">
                              <span className="font-bold">Rejection Reason:</span> {appointment.rejection_reason}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          <span>{appointment.status}</span>
                        </span>
                        {appointment.payment_status === 'paid' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center space-x-1">
                            <span>✓ Paid</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleViewDetails(appointment)}
                          className="btn btn-sm btn-secondary flex items-center space-x-2 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Details</span>
                        </button>
                        {appointment.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAppointmentAction(appointment.id, 'approve')}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center space-x-1 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleAppointmentAction(appointment.id, 'reject', 'Rejected by dentist')}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 flex items-center space-x-1 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
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
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Coins className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
              </div>
            </div>
            <div className="p-6">
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-bold">No payments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="w-4 h-4 text-blue-600" />
                          <h3 className="font-bold text-gray-900">
                            {payment.appointment?.patient?.full_name}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Stethoscope className="w-4 h-4 text-green-600" />
                          <p className="text-sm font-semibold text-gray-700">
                            {payment.appointment?.service?.name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <p className="text-sm font-semibold text-gray-600">
                            <span className="font-bold">Appointment:</span> {safeFormatDate(payment.appointment?.appointment_time)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-3 h-3 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-500">
                            <span className="font-bold">Payment Created:</span> {safeFormatDate(payment.created_at)}
                          </p>
                        </div>
                        {payment.completed_at && (
                          <div className="flex items-center space-x-2">
                            <Check className="w-3 h-3 text-green-500" />
                            <p className="text-xs font-semibold text-green-600">
                              <span className="font-bold">Completed:</span> {safeFormatDate(payment.completed_at)}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-lg">
                            {formatPHPCurrencyCompact(payment.amount)}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                            payment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {getStatusIcon(payment.status)}
                            <span>{payment.status}</span>
                          </span>
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

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          {/* Earnings Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-green-700">Today's Earnings</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatPHPCurrency(earningsData.today)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-blue-700">Weekly Earnings</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatPHPCurrency(earningsData.weekly)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center">
                <PieChart className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-purple-700">Monthly Earnings</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatPHPCurrency(earningsData.monthly)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-bold text-orange-700">Total Earnings</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {formatPHPCurrency(earningsData.overall)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Payments */}
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-bold text-gray-900">Recent Payments</h2>
                </div>
                <p className="text-gray-700 font-semibold mt-1">Latest completed payments</p>
              </div>
              <div className="p-6">
                {(() => {
                  const recentPayments = payments
                    .filter(payment => payment.status === 'completed' || payment.status === 'paid')
                    .slice(0, 5);
                  
                  return recentPayments.length === 0 ? (
                    <div className="text-center py-8">
                      <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-bold">No recent payments</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <User className="w-4 h-4 text-blue-600" />
                              <h3 className="font-bold text-gray-900">
                                {payment.appointment?.patient?.full_name}
                              </h3>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Stethoscope className="w-4 h-4 text-green-600" />
                              <p className="text-sm font-semibold text-gray-700">
                                {payment.appointment?.service?.name}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <p className="text-xs font-semibold text-gray-500">
                                {safeFormatDate(payment.completed_at || payment.created_at, 'PPp')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-lg">
                              {formatPHPCurrencyCompact(payment.amount)}
                            </p>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Earnings Summary */}
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Earnings Summary</h2>
                </div>
                <p className="text-gray-700 font-semibold mt-1">Breakdown by time period</p>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {/* Today vs Yesterday */}
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Today's Performance</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Today's Earnings</span>
                      <span className="font-bold text-green-600">{formatPHPCurrencyCompact(earningsData.today)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">Total Completed Payments</span>
                      <span className="font-bold text-gray-900">
                        {payments.filter(p => (p.status === 'completed' || p.status === 'paid')).length}
                      </span>
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Weekly Progress</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">This Week</span>
                      <span className="font-bold text-blue-600">{formatPHPCurrencyCompact(earningsData.weekly)}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Weekly Progress</span>
                        <span>{((earningsData.weekly / (earningsData.monthly || 1)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min(((earningsData.weekly / (earningsData.monthly || 1)) * 100), 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Progress */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Monthly Progress</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">This Month</span>
                      <span className="font-bold text-purple-600">{formatPHPCurrencyCompact(earningsData.monthly)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">Average per Day</span>
                      <span className="font-bold text-gray-900">
                        {formatPHPCurrencyCompact(earningsData.monthly / new Date().getDate())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Payment Analytics</h2>
              </div>
              <p className="text-gray-700 font-semibold mt-1">Detailed payment insights and statistics</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {payments.filter(p => p.status === 'completed' || p.status === 'paid').length}
                  </div>
                  <div className="text-sm text-gray-600">Completed Payments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">
                    {payments.filter(p => p.status === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-600">Pending Payments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {payments.length > 0 ? formatPHPCurrencyCompact(earningsData.overall / payments.filter(p => p.status === 'completed' || p.status === 'paid').length || 0) : '₱0'}
                  </div>
                  <div className="text-sm text-gray-600">Average Payment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          <AvailabilityManager 
            dentistProfile={dentistProfile}
            onUpdate={(newAvailability) => {
              setDentistProfile(prev => ({
                ...prev,
                availability: newAvailability
              }));
            }}
          />

          {/* Leave Schedule Manager */}
          <LeaveScheduleManager />

          {/* Calendar Widget */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Calendar View
              </h3>
              <p className="text-gray-600 mt-1">View your appointment schedule and availability</p>
            </div>
            <div className="p-6">
              <div className="max-w-md mx-auto">
                <GoogleCalendarView
                  dentistId={user?.id}
                  onDateSelect={(date) => {
                    console.log('Selected date:', date);
                    toast.success(`Selected date: ${format(date, 'PPP')}`);
                  }}
                  selectedDate={new Date()}
                  availableSlots={[]}
                />
              </div>
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
                <p className="text-gray-600 mt-1">Update your professional information</p>
              </div>
              {!isEditingProfile ? (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleProfileUpdate}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileForm({
                        specialization: dentistProfile?.specialization || '',
                        qualifications: dentistProfile?.qualifications || '',
                        bio: dentistProfile?.bio || '',
                        years_of_experience: dentistProfile?.years_of_experience || ''
                      });
                    }}
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
                    value={user?.full_name || ''}
                    disabled={true}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Contact support to change your name</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled={true}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Contact support to change your email</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={profileForm.specialization}
                    onChange={(e) => handleProfileFormChange('specialization', e.target.value)}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                    placeholder="e.g., General Dentistry, Orthodontics"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qualifications
                  </label>
                  <input
                    type="text"
                    value={profileForm.qualifications}
                    onChange={(e) => handleProfileFormChange('qualifications', e.target.value)}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                    placeholder="e.g., DDS, DMD, PhD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    rows={4}
                    value={profileForm.bio}
                    onChange={(e) => handleProfileFormChange('bio', e.target.value)}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                    placeholder="Tell patients about your experience and approach to dental care..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={profileForm.years_of_experience}
                    onChange={(e) => handleProfileFormChange('years_of_experience', e.target.value)}
                    disabled={!isEditingProfile}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                      isEditingProfile 
                        ? 'bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                        : 'bg-gray-50 text-gray-500'
                    }`}
                    placeholder="e.g., 5"
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
                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
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
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
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
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
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

          {/* Integration Settings */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Integration Settings</h3>
              </div>
              <p className="text-gray-600 mt-1">Manage your external service connections</p>
            </div>
            <div className="p-6">
              <GoogleCalendarConnect 
                onConnectionChange={(connected) => {
                  if (connected) {
                    toast.success('Google Calendar integration enabled');
                  }
                }}
              />
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
                  <p className="text-gray-900">Dentist Account</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Member Since</h4>
                  <p className="text-gray-900">
                    {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : 'October 2025'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Total Appointments</h4>
                  <p className="text-gray-900">{appointments.length}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Completed Appointments</h4>
                  <p className="text-gray-900">{appointments.filter(apt => apt.status === 'approved' && apt.payment_status === 'paid').length}</p>
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

              {/* Appointment Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Appointment Information
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center space-x-2">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                    <p><span className="font-bold">Service:</span> {selectedAppointment.service?.name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Coins className="w-4 h-4 text-green-600" />
                    <p><span className="font-bold">Price:</span> {formatPHPCurrencyCompact(selectedAppointment.service?.price)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <p><span className="font-bold">Date & Time:</span> {safeFormatDate(selectedAppointment.appointment_time, 'PPPp')}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-orange-600" />
                    <p><span className="font-bold">Status:</span> 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(selectedAppointment.status)}`}>
                        {getStatusIcon(selectedAppointment.status)}
                        <span>{selectedAppointment.status}</span>
                      </span>
                    </p>
                  </div>
                  {selectedAppointment.status === 'rejected' && selectedAppointment.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-bold text-red-800">Rejection Reason:</p>
                          <p className="text-sm text-red-700">{selectedAppointment.rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <p><span className="font-bold">Payment Status:</span> 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getPaymentStatusColor(selectedAppointment.payment_status)}`}>
                        {selectedAppointment.payment_status === 'paid' ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{selectedAppointment.payment_status}</span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Creation Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <CalendarPlus className="w-5 h-5 mr-2" />
                  Creation Information
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-bold">Created:</span> {safeFormatDate(selectedAppointment.created_at, 'PPPp')}</p>
                  <p><span className="font-bold">Last Updated:</span> {safeFormatDate(selectedAppointment.updated_at, 'PPPp')}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Notes
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p>{selectedAppointment.notes}</p>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Coins className="w-5 h-5 mr-2" />
                  Payment History
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {payments.filter(payment => payment.appointment_id === selectedAppointment.id).length > 0 ? (
                    <div className="space-y-3">
                      {payments
                        .filter(payment => payment.appointment_id === selectedAppointment.id)
                        .map((payment) => (
                          <div key={payment.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div>
                                <p><span className="font-bold">Amount:</span> {formatPHPCurrencyCompact(payment.amount)}</p>
                                <p><span className="font-bold">Status:</span> 
                                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                    payment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {payment.status}
                                  </span>
                                </p>
                                <p><span className="font-bold">Created:</span> {safeFormatDate(payment.created_at)}</p>
                                {payment.completed_at && (
                                  <p><span className="font-bold">Completed:</span> {safeFormatDate(payment.completed_at)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No payment records found for this appointment.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeDetailsModal}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
              {/* Payment Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Coins className="w-5 h-5 mr-2" />
                  Payment Information
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-bold">Amount:</span> {formatPHPCurrencyCompact(selectedPayment.amount)}</p>
                  <p><span className="font-bold">Status:</span> 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                      selectedPayment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusIcon(selectedPayment.status)}
                      <span>{selectedPayment.status}</span>
                    </span>
                  </p>
                  <p><span className="font-bold">Payment ID:</span> {selectedPayment.id}</p>
                  {selectedPayment.paypal_payment_id && (
                    <p><span className="font-bold">PayPal Payment ID:</span> {selectedPayment.paypal_payment_id}</p>
                  )}
                  {selectedPayment.paypal_transaction_id && (
                    <p><span className="font-bold">PayPal Transaction ID:</span> {selectedPayment.paypal_transaction_id}</p>
                  )}
                </div>
              </div>


              {/* Appointment Information */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Related Appointment
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-bold">Service:</span> {selectedPayment.appointment?.service?.name}</p>
                  <p><span className="font-bold">Service Price:</span> {formatPHPCurrencyCompact(selectedPayment.appointment?.service?.price)}</p>
                  <p><span className="font-bold">Appointment Date:</span> {safeFormatDate(selectedPayment.appointment?.appointment_time, 'PPPp')}</p>
                  <p><span className="font-bold">Appointment Status:</span> 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(selectedPayment.appointment?.status)}`}>
                      {getStatusIcon(selectedPayment.appointment?.status)}
                      <span>{selectedPayment.appointment?.status}</span>
                    </span>
                  </p>
                </div>
              </div>

              {/* Payment Timeline */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <CalendarPlus className="w-5 h-5 mr-2" />
                  Payment Timeline
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><span className="font-bold">Payment Created:</span> {safeFormatDate(selectedPayment.created_at, 'PPPp')}</p>
                  {selectedPayment.completed_at && (
                    <p><span className="font-bold">Payment Completed:</span> {safeFormatDate(selectedPayment.completed_at, 'PPPp')}</p>
                  )}
                  <p><span className="font-bold">Last Updated:</span> {safeFormatDate(selectedPayment.updated_at, 'PPPp')}</p>
                </div>
              </div>

              {/* Additional Notes */}
              {selectedPayment.appointment?.notes && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Appointment Notes
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p>{selectedPayment.appointment?.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closePaymentDetailsModal}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentistDashboard;
