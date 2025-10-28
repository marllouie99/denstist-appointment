import { useState, useEffect, useMemo, useRef } from 'react';
import { adminAPI } from '../../lib/api';
import { format } from 'date-fns';
import { Users, Calendar, CreditCard, TrendingUp, Eye, Edit, Edit3, Trash2, Plus, X, Check, XCircle, Clock, AlertCircle, CheckCircle, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, UserCheck, UserX, Activity, DollarSign, Settings, FileText, Mail, Phone, MapPin, Building, User, Stethoscope, CalendarPlus, CalendarX, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPHPCurrency, formatPHPCurrencyCompact } from '../../utils/currency';
import RevenueManagement from '../../components/RevenueManagement';
import AdminLeaveManagement from '../../components/AdminLeaveManagement';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    users: { total: 0, patients: 0, dentists: 0 },
    appointments: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
    revenue: { total: 0, transactions: 0 }
  });
  const [loading, setLoading] = useState(true);

  // Service Management State
  const [services, setServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    category: ''
  });

  // User Management State
  const [allUsers, setAllUsers] = useState([]);
  
  // Patient Management State
  const [patientPage, setPatientPage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientsPerPage] = useState(10);
  const [pendingPatientUpdates, setPendingPatientUpdates] = useState(new Set());
  
  // Dentist Management State
  const [dentistPage, setDentistPage] = useState(1);
  const [dentistSearch, setDentistSearch] = useState('');
  const [dentistsPerPage] = useState(10);
  const [pendingDentistUpdates, setPendingDentistUpdates] = useState(new Set());

  // Appointment Management State
  const [allAppointments, setAllAppointments] = useState([]);
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [appointmentsPerPage] = useState(10);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isLoadingRef = useRef(false);

  // Patient/Dentist Detail Modal States
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showDentistModal, setShowDentistModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDentist, setSelectedDentist] = useState(null);

  // Payment Records State
  const [allPayments, setAllPayments] = useState([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentsPerPage] = useState(10);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [pendingPaymentUpdates, setPendingPaymentUpdates] = useState(new Set());

  // Dentist Services Records State
  const [dentistServicesRecords, setDentistServicesRecords] = useState([]);
  const [servicesRecordLoading, setServicesRecordLoading] = useState(false);
  const [selectedDentistForServices, setSelectedDentistForServices] = useState(null);
  const [showDentistServicesModal, setShowDentistServicesModal] = useState(false);

  // Memoized filtered data to prevent excessive re-renders
  const filteredPatients = useMemo(() => {
    const allPatients = allUsers.filter(u => u.role === 'patient');
    return allPatients.filter(patient => {
      return patient.full_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
             patient.email?.toLowerCase().includes(patientSearch.toLowerCase());
    });
  }, [allUsers, patientSearch]);

  const filteredDentists = useMemo(() => {
    const allDentists = allUsers.filter(u => u.role === 'dentist');
    return allDentists.filter(dentist => {
      return dentist.full_name?.toLowerCase().includes(dentistSearch.toLowerCase()) ||
             dentist.email?.toLowerCase().includes(dentistSearch.toLowerCase());
    });
  }, [allUsers, dentistSearch]);

  const filteredPayments = useMemo(() => {
    return allPayments.filter(payment => {
      const matchesSearch = payment.patient_name?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                           payment.service_name?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
                           payment.payment_method?.toLowerCase().includes(paymentSearch.toLowerCase());
      const matchesFilter = paymentFilter === 'all' || payment.status === paymentFilter;
      return matchesSearch && matchesFilter;
    });
  }, [allPayments, paymentSearch, paymentFilter]);

  useEffect(() => {
    if (!isInitialized) {
      console.log('🚀 AdminDashboard - Initial data fetch');
      setIsInitialized(true);
      fetchDashboardData();
    }
  }, [isInitialized]);

  // Fetch dentist services records when dentist services tab is active
  useEffect(() => {
    if (activeTab === 'dentist-services') {
      fetchDentistServicesRecords();
    }
  }, [activeTab, allAppointments, services]);

  const fetchDashboardData = async () => {
    // Prevent duplicate API calls
    if (isLoadingRef.current) {
      console.log('⚠️ AdminDashboard - Already loading, skipping duplicate call');
      return;
    }
    
    isLoadingRef.current = true;
    
    console.log('🔄 AdminDashboard - fetchDashboardData started:', {
      timestamp: new Date().toISOString(),
      currentLoading: loading
    });

    try {
      console.log('📡 AdminDashboard - Making parallel API calls...');
      const [statsRes, usersRes, appointmentsRes, servicesRes, paymentsRes] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getUsers(),
        adminAPI.getAppointments(),
        adminAPI.getServices(),
        adminAPI.getPayments()
      ]);

      console.log('✅ AdminDashboard - All API calls successful:', {
        statsData: statsRes?.data,
        usersCount: usersRes?.data?.users?.length,
        appointmentsCount: appointmentsRes?.data?.appointments?.length,
        servicesCount: servicesRes?.data?.services?.length,
        timestamp: new Date().toISOString()
      });

      // Detailed analysis of users data for patient debugging
      const usersData = usersRes?.data?.users || [];
      const patients = usersData.filter(u => u.role === 'patient');
      const dentists = usersData.filter(u => u.role === 'dentist');
      const admins = usersData.filter(u => u.role === 'admin');

      console.log('👥 [FRONTEND] Detailed user data analysis:', {
        totalUsers: usersData.length,
        userBreakdown: {
          patients: patients.length,
          dentists: dentists.length,
          admins: admins.length,
          others: usersData.length - patients.length - dentists.length - admins.length
        },
        patientAnalysis: {
          totalPatients: patients.length,
          activePatients: patients.filter(p => p.is_active).length,
          inactivePatients: patients.filter(p => !p.is_active).length,
          patientsWithNames: patients.filter(p => p.full_name && p.full_name.trim()).length,
          patientsWithEmails: patients.filter(p => p.email && p.email.trim()).length,
          patientSample: patients.slice(0, 3).map(p => ({
            id: p.id,
            full_name: p.full_name || 'NO_NAME',
            email: p.email || 'NO_EMAIL',
            role: p.role,
            is_active: p.is_active,
            created_at: p.created_at,
            phone: p.phone || 'NO_PHONE'
          }))
        },
        rawUsersDataSample: usersData.slice(0, 2).map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          is_active: u.is_active,
          created_at: u.created_at
        }))
      });

      // Check if patients will be visible in the UI
      console.log('🔍 [FRONTEND] Patient visibility check:', {
        willPatientsShow: patients.length > 0,
        currentPatientSearch: patientSearch,
        currentDentistSearch: dentistSearch,
        filteredPatientsCount: patients.filter(patient => {
          return patient.full_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
                 patient.email?.toLowerCase().includes(patientSearch.toLowerCase());
        }).length,
        filteredDentistsCount: dentists.filter(dentist => {
          return dentist.full_name?.toLowerCase().includes(dentistSearch.toLowerCase()) ||
                 dentist.email?.toLowerCase().includes(dentistSearch.toLowerCase());
        }).length,
        searchLogic: {
          patientSearchTerm: patientSearch,
          dentistSearchTerm: dentistSearch,
          patientSearchIsEmpty: !patientSearch || patientSearch.trim() === '',
          dentistSearchIsEmpty: !dentistSearch || dentistSearch.trim() === ''
        }
      });

      setStats(statsRes.data.stats);
      setAllUsers(usersRes.data.users);
      setAllAppointments(appointmentsRes.data.appointments);
      setServices(servicesRes.data.services || []);
      setAllPayments(paymentsRes.data.payments || []);

      console.log('✅ AdminDashboard - State updated successfully, final state preview:', {
        statsSet: !!statsRes.data.stats,
        allUsersLength: usersRes.data.users?.length || 0,
        allAppointmentsLength: appointmentsRes.data.appointments?.length || 0,
        servicesLength: servicesRes.data.services?.length || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ AdminDashboard - Error fetching dashboard data:', {
        error: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            method: error.config?.method,
            url: error.config?.url
          }
        },
        timestamp: new Date().toISOString()
      });
      toast.error('Failed to load dashboard data');
    } finally {
      console.log('🏁 AdminDashboard - fetchDashboardData completed, setting loading to false');
      setLoading(false);
      isLoadingRef.current = false; // Reset loading ref
    }
  };

  // Fetch dentist services records
  const fetchDentistServicesRecords = async () => {
    setServicesRecordLoading(true);
    try {
      console.log('📊 AdminDashboard - Fetching dentist services records');
      
      // Get all dentists
      const dentists = allUsers.filter(user => user.role === 'dentist');
      
      // Debug: Log appointment statuses to understand completion logic
      console.log('🔍 [DEBUG] Appointment statuses analysis:', {
        totalAppointments: allAppointments.length,
        statusBreakdown: allAppointments.reduce((acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {}),
        sampleAppointments: allAppointments.slice(0, 3).map(apt => ({
          id: apt.id,
          status: apt.status,
          payment_status: apt.payment_status,
          dentist_id: apt.dentist_id,
          service_id: apt.service_id
        }))
      });
      
      // Process each dentist's service records
      const dentistRecords = dentists.map(dentist => {
        // Get appointments for this dentist
        const dentistAppointments = allAppointments.filter(apt => apt.dentist_id === dentist.id);
        
        console.log(`🔍 [DEBUG] Dentist ${dentist.full_name} appointments:`, {
          total: dentistAppointments.length,
          statuses: dentistAppointments.reduce((acc, apt) => {
            acc[apt.status] = (acc[apt.status] || 0) + 1;
            return acc;
          }, {}),
          paymentStatuses: dentistAppointments.reduce((acc, apt) => {
            acc[apt.payment_status || 'no_payment_status'] = (acc[apt.payment_status || 'no_payment_status'] || 0) + 1;
            return acc;
          }, {})
        });
        
        // Get unique services this dentist has provided
        const providedServices = [];
        const serviceStats = {};
        
        dentistAppointments.forEach(appointment => {
          const service = services.find(s => s.id === appointment.service_id);
          if (service) {
            const serviceKey = service.id;
            if (!serviceStats[serviceKey]) {
              serviceStats[serviceKey] = {
                service,
                count: 0,
                totalRevenue: 0,
                completedCount: 0,
                pendingCount: 0,
                lastPerformed: null
              };
              providedServices.push(service);
            }
            
            serviceStats[serviceKey].count++;
            
            // Check if appointment is completed - consider both appointment status and payment status
            const isCompleted = appointment.status === 'completed' || 
                               appointment.status === 'approved' && appointment.payment_status === 'paid' ||
                               appointment.payment_status === 'completed';
            
            if (isCompleted) {
              serviceStats[serviceKey].completedCount++;
              // Only count revenue for completed appointments
              serviceStats[serviceKey].totalRevenue += parseFloat(service.price || 0);
            } else if (appointment.status === 'pending' || appointment.status === 'approved') {
              serviceStats[serviceKey].pendingCount++;
            }
            
            // Update last performed date
            const appointmentDate = new Date(appointment.appointment_time || appointment.appointment_date || appointment.created_at);
            if (!serviceStats[serviceKey].lastPerformed || appointmentDate > new Date(serviceStats[serviceKey].lastPerformed)) {
              serviceStats[serviceKey].lastPerformed = appointmentDate;
            }
          }
        });
        
        // Calculate totals - consider multiple completion criteria
        const totalAppointments = dentistAppointments.length;
        const completedAppointments = dentistAppointments.filter(apt => {
          return apt.status === 'completed' || 
                 (apt.status === 'approved' && apt.payment_status === 'paid') ||
                 apt.payment_status === 'completed';
        }).length;
        
        // Calculate total revenue from completed appointments only
        const totalRevenue = Object.values(serviceStats).reduce((sum, stat) => sum + stat.totalRevenue, 0);
        const uniqueServices = providedServices.length;
        
        const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments * 100).toFixed(1) : 0;
        
        console.log(`📊 [DEBUG] Dentist ${dentist.full_name} calculated stats:`, {
          totalAppointments,
          completedAppointments,
          completionRate,
          totalRevenue,
          uniqueServices
        });
        
        return {
          dentist,
          serviceStats,
          providedServices,
          totalAppointments,
          completedAppointments,
          totalRevenue,
          uniqueServices,
          completionRate
        };
      });
      
      // Sort by total appointments (most active first)
      dentistRecords.sort((a, b) => b.totalAppointments - a.totalAppointments);
      
      setDentistServicesRecords(dentistRecords);
      console.log('✅ AdminDashboard - Dentist services records fetched:', {
        dentistCount: dentistRecords.length,
        totalRecords: dentistRecords.reduce((sum, dr) => sum + dr.totalAppointments, 0),
        totalCompleted: dentistRecords.reduce((sum, dr) => sum + dr.completedAppointments, 0)
      });
      
    } catch (error) {
      console.error('❌ AdminDashboard - Error fetching dentist services records:', error);
      toast.error('Failed to load dentist services records');
    } finally {
      setServicesRecordLoading(false);
    }
  };

  // Patient Management Functions
  const handleViewPatientDetails = (patient) => {
    console.log('👁️ [PATIENT MANAGEMENT] View patient details:', {
      patientId: patient.id,
      patientName: patient.full_name,
      timestamp: new Date().toISOString()
    });
    setSelectedPatient(patient);
    setShowPatientModal(true);
  };

  const handlePatientStatusToggle = async (patientId, currentStatus) => {
    console.log('🔄 [PATIENT MANAGEMENT] Toggle patient status:', {
      patientId,
      currentStatus,
      newStatus: !currentStatus,
      timestamp: new Date().toISOString()
    });

    try {
      // Add to pending updates
      setPendingPatientUpdates(prev => new Set([...prev, patientId]));

      // Make API call to update patient status
      await adminAPI.updateUserStatus(patientId, { is_active: !currentStatus });
      
      // Update local state
      setAllUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === patientId 
            ? { ...user, is_active: !currentStatus }
            : user
        )
      );

      toast.success(`Patient ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      
      console.log('✅ [PATIENT MANAGEMENT] Patient status updated successfully:', {
        patientId,
        newStatus: !currentStatus
      });

    } catch (error) {
      console.error('❌ [PATIENT MANAGEMENT] Error updating patient status:', error);
      toast.error('Failed to update patient status');
    } finally {
      // Remove from pending updates
      setPendingPatientUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(patientId);
        return newSet;
      });
    }
  };

  const handlePatientDelete = async (patientId, patientName) => {
    console.log('🗑️ [PATIENT MANAGEMENT] Delete patient:', {
      patientId,
      patientName,
      timestamp: new Date().toISOString()
    });

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete patient "${patientName}"? This action cannot be undone.`)) {
      console.log('🚫 [PATIENT MANAGEMENT] Patient deletion cancelled by user');
      return;
    }

    try {
      // Add to pending updates to prevent duplicate requests
      setPendingPatientUpdates(prev => new Set([...prev, patientId]));

      // Make API call to delete patient
      await adminAPI.deleteUser(patientId);
      
      // Remove from local state immediately for better UX
      setAllUsers(prevUsers => 
        prevUsers.filter(user => user.id !== patientId)
      );

      toast.success(`Patient "${patientName}" deleted successfully`);
      
      console.log('✅ [PATIENT MANAGEMENT] Patient deleted successfully:', {
        patientId,
        patientName
      });

    } catch (error) {
      console.error('❌ [PATIENT MANAGEMENT] Error deleting patient:', error);
      toast.error('Failed to delete patient');
    } finally {
      // Remove from pending updates
      setPendingPatientUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(patientId);
        return newSet;
      });
    }
  };

  // Dentist Management Functions
  const handleViewDentistDetails = (dentist) => {
    console.log('👁️ [DENTIST MANAGEMENT] View dentist details:', {
      dentistId: dentist.id,
      dentistName: dentist.full_name,
      timestamp: new Date().toISOString()
    });
    setSelectedDentist(dentist);
    setShowDentistModal(true);
  };

  const handleDentistDelete = async (dentistId, dentistName) => {
    console.log('🗑️ [DENTIST MANAGEMENT] Delete dentist:', {
      dentistId,
      dentistName,
      timestamp: new Date().toISOString()
    });

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete dentist "Dr. ${dentistName}"? This action cannot be undone and will also delete all associated appointments and data.`)) {
      console.log('🚫 [DENTIST MANAGEMENT] Dentist deletion cancelled by user');
      return;
    }

    try {
      // Add to pending updates to prevent duplicate requests
      setPendingDentistUpdates(prev => new Set([...prev, dentistId]));

      // Make API call to delete dentist
      await adminAPI.deleteUser(dentistId);
      
      // Remove from local state immediately for better UX
      setAllUsers(prevUsers => 
        prevUsers.filter(user => user.id !== dentistId)
      );

      toast.success(`Dentist "Dr. ${dentistName}" deleted successfully`);
      
      console.log('✅ [DENTIST MANAGEMENT] Dentist deleted successfully:', {
        dentistId,
        dentistName
      });

    } catch (error) {
      console.error('❌ [DENTIST MANAGEMENT] Error deleting dentist:', error);
      toast.error('Failed to delete dentist');
    } finally {
      // Remove from pending updates
      setPendingDentistUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(dentistId);
        return newSet;
      });
    }
  };

  const handleDentistStatusToggle = async (dentistId, currentStatus) => {
    console.log('🔄 [DENTIST MANAGEMENT] Toggle dentist status:', {
      dentistId,
      currentStatus,
      newStatus: !currentStatus,
      timestamp: new Date().toISOString()
    });

    try {
      // Add to pending updates
      setPendingDentistUpdates(prev => new Set([...prev, dentistId]));

      // Make API call to update dentist status
      await adminAPI.updateUserStatus(dentistId, { is_active: !currentStatus });
      
      // Update local state
      setAllUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === dentistId 
            ? { ...user, is_active: !currentStatus }
            : user
        )
      );

      toast.success(`Dentist ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      
      console.log('✅ [DENTIST MANAGEMENT] Dentist status updated successfully:', {
        dentistId,
        newStatus: !currentStatus
      });

    } catch (error) {
      console.error('❌ [DENTIST MANAGEMENT] Error updating dentist status:', error);
      toast.error('Failed to update dentist status');
    } finally {
      // Remove from pending updates
      setPendingDentistUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(dentistId);
        return newSet;
      });
    }
  };

  // Payment Management Functions
  const handleViewPaymentDetails = (payment) => {
    console.log('👁️ [PAYMENT MANAGEMENT] View payment details:', {
      paymentId: payment.id,
      amount: payment.amount,
      timestamp: new Date().toISOString()
    });
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const handlePaymentStatusUpdate = async (paymentId, newStatus) => {
    console.log('🔄 [PAYMENT MANAGEMENT] Update payment status:', {
      paymentId,
      newStatus,
      timestamp: new Date().toISOString()
    });

    try {
      // Add to pending updates
      setPendingPaymentUpdates(prev => new Set([...prev, paymentId]));

      // Make API call to update payment status
      await adminAPI.updatePaymentStatus(paymentId, { status: newStatus });
      
      // Update local state
      setAllPayments(prevPayments => 
        prevPayments.map(payment => 
          payment.id === paymentId 
            ? { ...payment, status: newStatus }
            : payment
        )
      );

      toast.success(`Payment ${newStatus} successfully`);
      
      console.log('✅ [PAYMENT MANAGEMENT] Payment status updated successfully:', {
        paymentId,
        newStatus
      });

    } catch (error) {
      console.error('❌ [PAYMENT MANAGEMENT] Error updating payment status:', error);
      toast.error('Failed to update payment status');
    } finally {
      // Remove from pending updates
      setPendingPaymentUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
    }
  };

  // Service Management Functions
  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await adminAPI.updateService(editingService.id, serviceForm);
        toast.success('Service updated successfully');
      } else {
        await adminAPI.createService(serviceForm);
        toast.success('Service created successfully');
      }
      setShowServiceModal(false);
      setEditingService(null);
      setServiceForm({ name: '', description: '', price: '', duration: '', category: '' });
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    }
  };

  const handleServiceEdit = (service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration: service.duration.toString(),
      category: service.category || ''
    });
    setShowServiceModal(true);
  };

  const handleServiceDelete = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await adminAPI.deleteService(serviceId);
        toast.success('Service deleted successfully');
        fetchDashboardData();
      } catch (error) {
        console.error('Error deleting service:', error);
        toast.error('Failed to delete service');
      }
    }
  };

  // Appointment Management Functions
  const handleAppointmentStatusChange = async (appointmentId, newStatus, reason = null) => {
    try {
      const payload = { status: newStatus };
      if (reason) {
        payload.reason = reason;
      }
      await adminAPI.overrideAppointment(appointmentId, payload);
      toast.success(`Appointment ${newStatus} successfully`);
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment');
    }
  };

  const handleAppointmentReject = async (appointmentId) => {
    const reason = prompt('Please provide a reason for rejecting this appointment:');
    if (reason === null) {
      // User cancelled
      return;
    }
    if (reason.trim() === '') {
      toast.error('Please provide a reason for rejection');
      return;
    }
    await handleAppointmentStatusChange(appointmentId, 'rejected', reason.trim());
  };

  const handleUserStatusToggle = async (userId, currentStatus, userType = 'user') => {
    console.log('🔄 AdminDashboard - handleUserStatusToggle called:', {
      userId,
      currentStatus,
      newStatus: !currentStatus,
      userType,
      timestamp: new Date().toISOString()
    });

    // Get the appropriate pending updates set
    const pendingUpdates = userType === 'patient' ? pendingPatientUpdates : pendingDentistUpdates;
    const setPendingUpdates = userType === 'patient' ? setPendingPatientUpdates : setPendingDentistUpdates;

    // Prevent multiple simultaneous requests for the same user
    if (pendingUpdates.has(userId)) {
      console.warn('⚠️ AdminDashboard - Request already pending for user:', userId);
      toast.warning('Please wait, user update is already in progress');
      return;
    }

    // Add user to pending updates
    setPendingUpdates(prev => new Set([...prev, userId]));

    try {
      const payload = { is_active: !currentStatus };
      console.log('📤 AdminDashboard - Sending updateUserStatus request:', {
        userId,
        payload,
        endpoint: `/admin/users/${userId}/status`,
        method: 'PATCH',
        pendingCount: pendingUserUpdates.size + 1
      });

      const response = await adminAPI.updateUserStatus(userId, payload);
      
      console.log('✅ AdminDashboard - User status updated successfully:', {
        userId,
        oldStatus: currentStatus,
        newStatus: !currentStatus,
        response: response?.data,
        timestamp: new Date().toISOString()
      });

      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      
      // Wait a bit before fetching to avoid race conditions
      setTimeout(() => {
        fetchDashboardData();
      }, 100);
      
    } catch (error) {
      console.error('❌ AdminDashboard - Error updating user status:', {
        userId,
        currentStatus,
        attemptedNewStatus: !currentStatus,
        pendingCount: pendingUserUpdates.size,
        error: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            method: error.config?.method,
            url: error.config?.url,
            data: error.config?.data
          }
        },
        timestamp: new Date().toISOString()
      });
      
      // Additional debugging for 400 errors
      if (error.response?.status === 400) {
        console.error('🔍 AdminDashboard - 400 Bad Request Details:', {
          requestPayload: { is_active: !currentStatus },
          userId,
          userIdType: typeof userId,
          currentStatusType: typeof currentStatus,
          errorData: error.response?.data,
          pendingUpdates: Array.from(pendingUserUpdates),
          possibleIssues: [
            'Invalid userId format',
            'Missing or invalid is_active field',
            'User not found',
            'Permission denied',
            'Database constraint violation',
            'Race condition with multiple requests',
            'Request collision or timeout'
          ]
        });
      }
      
      toast.error('Failed to update user status');
    } finally {
      // Always remove user from pending updates
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        console.log('🧹 AdminDashboard - Removed user from pending updates:', {
          userId,
          userType,
          remainingPending: newSet.size
        });
        return newSet;
      });
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

  const getRoleColor = (role) => {
    switch (role) {
      case 'patient':
        return 'bg-blue-100 text-blue-800';
      case 'dentist':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          System overview and management controls
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-1" />
            Services
          </button>
          <button
            onClick={() => setActiveTab('patients')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'patients'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            Patients
          </button>
          <button
            onClick={() => setActiveTab('dentists')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'dentists'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            Dentists
          </button>
          <button
            onClick={() => setActiveTab('dentist-services')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'dentist-services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Activity className="h-4 w-4 inline mr-1" />
            Dentist Services
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
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
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="h-4 w-4 inline mr-1" />
            Payment Records
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'revenue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="h-4 w-4 inline mr-1" />
            Revenue Management
          </button>
          <button
            onClick={() => setActiveTab('leave-management')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'leave-management'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CalendarX className="h-4 w-4 inline mr-1" />
            Leave Management
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Users Stats */}
            <div className="card p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.users.total}</p>
                  <p className="text-xs text-gray-500">
                    {stats.users.patients} patients, {stats.users.dentists} dentists
                  </p>
                </div>
              </div>
            </div>

            {/* Appointments Stats */}
            <div className="card p-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.appointments.total}</p>
                  <p className="text-xs text-gray-500">
                    {stats.appointments.pending} pending
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue Stats */}
            <div className="card p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPHPCurrency(stats.revenue.total)}</p>
                  <p className="text-xs text-gray-500">
                    {stats.revenue.transactions} transactions
                  </p>
                </div>
              </div>
            </div>

            {/* Growth Stats */}
            <div className="card p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.appointments.total > 0 
                      ? Math.round((stats.appointments.approved / stats.appointments.total) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.appointments.approved} approved
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Status Breakdown */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Appointment Status Overview
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.appointments.pending}</p>
                  <p className="text-sm text-yellow-700">Pending</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.appointments.approved}</p>
                  <p className="text-sm text-green-700">Approved</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.appointments.rejected}</p>
                  <p className="text-sm text-red-700">Rejected</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{stats.appointments.cancelled}</p>
                  <p className="text-sm text-gray-700">Cancelled</p>
                </div>
              </div>
            </div>
          </div>


        </div>
      )}

      {/* Services Management Tab */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Service Management</h2>
            <button
              onClick={() => {
                setEditingService(null);
                setServiceForm({ name: '', description: '', price: '', duration: '', category: '' });
                setShowServiceModal(true);
              }}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service</span>
            </button>
          </div>

          <div className="card">
            <div className="p-6">
              {services.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Services Found</h3>
                  <p className="text-gray-600 mb-4">Get started by adding your first dental service.</p>
                  <button
                    onClick={() => setShowServiceModal(true)}
                    className="btn btn-primary"
                  >
                    Add First Service
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {services.map((service) => (
                        <tr key={service.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{service.name}</div>
                              <div className="text-sm text-gray-500">{service.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {service.category || 'General'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatPHPCurrencyCompact(service.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {service.duration} min
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleServiceEdit(service)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleServiceDelete(service.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patients Management Tab */}
      {activeTab === 'patients' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Patient Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {allUsers.filter(u => u.role === 'patient').length} patients
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={(e) => {
                    console.log('🔍 [PATIENT MANAGEMENT] Search input changed:', {
                      searchTerm: e.target.value,
                      timestamp: new Date().toISOString()
                    });
                    setPatientSearch(e.target.value);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Removed excessive logging for better performance
                      const paginatedPatients = filteredPatients.slice((patientPage - 1) * patientsPerPage, patientPage * patientsPerPage);
                      
                      if (paginatedPatients.length === 0) {
                        return (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <Users className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                  No patients found
                                </h3>
                                <p className="text-gray-600">
                                  {patientSearch ? `No patients match "${patientSearch}"` : 'No patients have registered yet.'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      return paginatedPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50 bg-blue-50/30">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
                                <Users className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {patient.full_name || 'No name provided'}
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Patient
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">{patient.email || 'No email provided'}</div>
                                {patient.phone && (
                                  <div className="text-xs text-gray-400">{patient.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              patient
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              patient.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {patient.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {patient.created_at ? format(new Date(patient.created_at), 'MMM d, yyyy') : 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleViewPatientDetails(patient)}
                                className="p-2 rounded-full text-blue-600 hover:bg-blue-100"
                                title="View Patient Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePatientStatusToggle(patient.id, patient.is_active)}
                                className={`p-2 rounded-full ${
                                  patient.is_active 
                                    ? 'text-red-600 hover:bg-red-100' 
                                    : 'text-green-600 hover:bg-green-100'
                                } ${pendingPatientUpdates.has(patient.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={patient.is_active ? 'Deactivate Patient' : 'Activate Patient'}
                                disabled={pendingPatientUpdates.has(patient.id)}
                              >
                                {pendingPatientUpdates.has(patient.id) ? (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                ) : patient.is_active ? (
                                  <UserX className="w-4 h-4" />
                                ) : (
                                  <UserCheck className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handlePatientDelete(patient.id, patient.full_name)}
                                className={`p-2 rounded-full text-red-600 hover:bg-red-100 ${
                                  pendingPatientUpdates.has(patient.id) ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                title="Delete Patient"
                                disabled={pendingPatientUpdates.has(patient.id)}
                              >
                                {pendingPatientUpdates.has(patient.id) ? (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Patient Pagination Controls */}
              {(() => {
                const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);
                
                if (totalPages <= 1) return null;
                
                return (
                  <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-700">
                      <span>
                        Showing {((patientPage - 1) * patientsPerPage) + 1} to {Math.min(patientPage * patientsPerPage, filteredPatients.length)} of {filteredPatients.length} patients
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          console.log('📄 [PATIENT MANAGEMENT] Previous page:', {
                            currentPage: patientPage,
                            newPage: patientPage - 1,
                            totalPages
                          });
                          setPatientPage(patientPage - 1);
                        }}
                        disabled={patientPage === 1}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <div className="flex space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => {
                              console.log('📄 [PATIENT MANAGEMENT] Go to page:', {
                                currentPage: patientPage,
                                newPage: page,
                                totalPages
                              });
                              setPatientPage(page);
                            }}
                            className={`px-3 py-2 rounded-md text-sm font-medium ${
                              page === patientPage
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          console.log('📄 [PATIENT MANAGEMENT] Next page:', {
                            currentPage: patientPage,
                            newPage: patientPage + 1,
                            totalPages
                          });
                          setPatientPage(patientPage + 1);
                        }}
                        disabled={patientPage === totalPages}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Dentists Management Tab */}
      {activeTab === 'dentists' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dentist Management</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {allUsers.filter(u => u.role === 'dentist').length} dentists
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search dentists..."
                  value={dentistSearch}
                  onChange={(e) => {
                    console.log('🔍 [DENTIST MANAGEMENT] Search input changed:', {
                      searchTerm: e.target.value,
                      timestamp: new Date().toISOString()
                    });
                    setDentistSearch(e.target.value);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dentist
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Specialization
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Removed excessive logging for better performance
                      const paginatedDentists = filteredDentists.slice((dentistPage - 1) * dentistsPerPage, dentistPage * dentistsPerPage);
                      
                      if (paginatedDentists.length === 0) {
                        return (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <Users className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                  No dentists found
                                </h3>
                                <p className="text-gray-600">
                                  {dentistSearch ? `No dentists match "${dentistSearch}"` : 'No dentists have been added yet.'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      return paginatedDentists.map((dentist) => (
                        <tr key={dentist.id} className="hover:bg-gray-50 bg-purple-50/30">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100">
                                <Users className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  Dr. {dentist.full_name || 'No name provided'}
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Dentist
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">{dentist.email || 'No email provided'}</div>
                                {dentist.phone && (
                                  <div className="text-xs text-gray-400">{dentist.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              {dentist.dentist_profile?.specialization || 'General Dentistry'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              dentist.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {dentist.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dentist.created_at ? format(new Date(dentist.created_at), 'MMM d, yyyy') : 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleViewDentistDetails(dentist)}
                                className="p-2 rounded-full text-purple-600 hover:bg-purple-100"
                                title="View Dentist Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDentistStatusToggle(dentist.id, dentist.is_active)}
                                className={`p-2 rounded-full ${
                                  dentist.is_active 
                                    ? 'text-red-600 hover:bg-red-100' 
                                    : 'text-green-600 hover:bg-green-100'
                                } ${pendingDentistUpdates.has(dentist.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={dentist.is_active ? 'Deactivate Dentist' : 'Activate Dentist'}
                                disabled={pendingDentistUpdates.has(dentist.id)}
                              >
                                {pendingDentistUpdates.has(dentist.id) ? (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                ) : dentist.is_active ? (
                                  <UserX className="w-4 h-4" />
                                ) : (
                                  <UserCheck className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDentistDelete(dentist.id, dentist.full_name)}
                                className={`p-2 rounded-full text-red-600 hover:bg-red-100 ${
                                  pendingDentistUpdates.has(dentist.id) ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                title="Delete Dentist"
                                disabled={pendingDentistUpdates.has(dentist.id)}
                              >
                                {pendingDentistUpdates.has(dentist.id) ? (
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Dentist Pagination Controls */}
              {(() => {
                const totalPages = Math.ceil(filteredDentists.length / dentistsPerPage);
                
                if (totalPages <= 1) return null;
                
                return (
                  <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-700">
                      <span>
                        Showing {((dentistPage - 1) * dentistsPerPage) + 1} to {Math.min(dentistPage * dentistsPerPage, filteredDentists.length)} of {filteredDentists.length} dentists
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          console.log('📄 [DENTIST MANAGEMENT] Previous page:', {
                            currentPage: dentistPage,
                            newPage: dentistPage - 1,
                            totalPages
                          });
                          setDentistPage(dentistPage - 1);
                        }}
                        disabled={dentistPage === 1}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <div className="flex space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => {
                              console.log('📄 [DENTIST MANAGEMENT] Go to page:', {
                                currentPage: dentistPage,
                                newPage: page,
                                totalPages
                              });
                              setDentistPage(page);
                            }}
                            className={`px-3 py-2 rounded-md text-sm font-medium ${
                              page === dentistPage
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          console.log('📄 [DENTIST MANAGEMENT] Next page:', {
                            currentPage: dentistPage,
                            newPage: dentistPage + 1,
                            totalPages
                          });
                          setDentistPage(dentistPage + 1);
                        }}
                        disabled={dentistPage === totalPages}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Dentist Services Tab */}
      {activeTab === 'dentist-services' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dentist Service Records</h2>
              <p className="text-sm text-gray-600 mt-1">
                Individual service performance and statistics for each dentist
              </p>
            </div>
            <button
              onClick={fetchDentistServicesRecords}
              disabled={servicesRecordLoading}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${servicesRecordLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="card">
            {servicesRecordLoading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading dentist service records...</p>
              </div>
            ) : dentistServicesRecords.length === 0 ? (
              <div className="p-8 text-center">
                <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-bold">No service records available</p>
                <p className="text-sm text-gray-500 mt-2">No appointments or services found for dentists</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dentist
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Appointments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unique Services
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completion Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dentistServicesRecords.map((record, index) => (
                      <tr key={record.dentist.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <Stethoscope className="w-5 h-5 text-purple-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                Dr. {record.dentist.full_name || 'No Name'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.dentist.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.totalAppointments}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.completedAppointments} completed
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Settings className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {record.uniqueServices}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(100, record.completionRate)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {record.completionRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-green-600">
                            {formatPHPCurrency(record.totalRevenue)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedDentistForServices(record);
                              setShowDentistServicesModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appointments Management Tab */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Appointment Management</h2>
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search appointments..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={appointmentFilter}
                onChange={(e) => setAppointmentFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dentist
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allAppointments
                      .filter(appointment => {
                        const matchesSearch = appointment.patient?.full_name.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
                                            appointment.dentist?.full_name.toLowerCase().includes(appointmentSearch.toLowerCase());
                        const matchesFilter = appointmentFilter === 'all' || appointment.status === appointmentFilter;
                        return matchesSearch && matchesFilter;
                      })
                      .slice((appointmentPage - 1) * appointmentsPerPage, appointmentPage * appointmentsPerPage)
                      .map((appointment) => (
                        <tr key={appointment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {appointment.patient?.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {appointment.patient?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              Dr. {appointment.dentist?.full_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{appointment.service?.name}</div>
                            <div className="text-sm text-gray-500">{formatPHPCurrencyCompact(appointment.service?.price)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(appointment.appointment_time), 'MMM d, yyyy')}
                            <br />
                            {format(new Date(appointment.appointment_time), 'h:mm a')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              {appointment.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleAppointmentStatusChange(appointment.id, 'approved')}
                                    className="text-green-600 hover:text-green-900 p-1"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleAppointmentReject(appointment.id)}
                                    className="text-red-600 hover:text-red-900 p-1"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowAppointmentModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Records Management Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Payment Records</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {allPayments.length} payment records
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={paymentSearch}
                  onChange={(e) => {
                    console.log('🔍 [PAYMENT MANAGEMENT] Search input changed:', {
                      searchTerm: e.target.value,
                      timestamp: new Date().toISOString()
                    });
                    setPaymentSearch(e.target.value);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Removed excessive logging for better performance
                      
                      const paginatedPayments = filteredPayments.slice((paymentPage - 1) * paymentsPerPage, paymentPage * paymentsPerPage);
                      
                      if (paginatedPayments.length === 0) {
                        return (
                          <tr>
                            <td colSpan="7" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <TrendingUp className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                  No payments found
                                </h3>
                                <p className="text-gray-600">
                                  {paymentSearch || paymentFilter !== 'all' 
                                    ? `No payments match your search criteria` 
                                    : 'No payment records available yet.'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      return paginatedPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                                <Users className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {payment.patient_name || 'Unknown Patient'}
                                </div>
                                <div className="text-sm text-gray-500">{payment.patient_email || 'No email'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{payment.service_name || 'Unknown Service'}</div>
                            <div className="text-sm text-gray-500">{payment.appointment_date ? format(new Date(payment.appointment_date), 'MMM d, yyyy') : 'No date'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{formatPHPCurrencyCompact(payment.amount || 0)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {payment.payment_method || 'Online'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                              payment.status === 'refunded' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {payment.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.created_at ? format(new Date(payment.created_at), 'MMM d, yyyy h:mm a') : 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleViewPaymentDetails(payment)}
                                className="p-2 rounded-full text-green-600 hover:bg-green-100"
                                title="View Payment Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {payment.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handlePaymentStatusUpdate(payment.id, 'completed')}
                                    className={`p-2 rounded-full text-green-600 hover:bg-green-100 ${
                                      pendingPaymentUpdates.has(payment.id) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title="Mark as Completed"
                                    disabled={pendingPaymentUpdates.has(payment.id)}
                                  >
                                    {pendingPaymentUpdates.has(payment.id) ? (
                                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    ) : (
                                      <CheckCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handlePaymentStatusUpdate(payment.id, 'failed')}
                                    className={`p-2 rounded-full text-red-600 hover:bg-red-100 ${
                                      pendingPaymentUpdates.has(payment.id) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title="Mark as Failed"
                                    disabled={pendingPaymentUpdates.has(payment.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {payment.status === 'completed' && (
                                <button
                                  onClick={() => handlePaymentStatusUpdate(payment.id, 'refunded')}
                                  className={`p-2 rounded-full text-purple-600 hover:bg-purple-100 ${
                                    pendingPaymentUpdates.has(payment.id) ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  title="Process Refund"
                                  disabled={pendingPaymentUpdates.has(payment.id)}
                                >
                                  {pendingPaymentUpdates.has(payment.id) ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                  ) : (
                                    <AlertCircle className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Payment Pagination Controls */}
              {(() => {
                const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
                
                if (totalPages <= 1) return null;
                
                return (
                  <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-700">
                      <span>
                        Showing {((paymentPage - 1) * paymentsPerPage) + 1} to {Math.min(paymentPage * paymentsPerPage, filteredPayments.length)} of {filteredPayments.length} payments
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          console.log('📄 [PAYMENT MANAGEMENT] Previous page:', {
                            currentPage: paymentPage,
                            newPage: paymentPage - 1,
                            totalPages
                          });
                          setPaymentPage(paymentPage - 1);
                        }}
                        disabled={paymentPage === 1}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <div className="flex space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => {
                              console.log('📄 [PAYMENT MANAGEMENT] Go to page:', {
                                currentPage: paymentPage,
                                newPage: page,
                                totalPages
                              });
                              setPaymentPage(page);
                            }}
                            className={`px-3 py-2 rounded-md text-sm font-medium ${
                              page === paymentPage
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          console.log('📄 [PAYMENT MANAGEMENT] Next page:', {
                            currentPage: paymentPage,
                            newPage: paymentPage + 1,
                            totalPages
                          });
                          setPaymentPage(paymentPage + 1);
                        }}
                        disabled={paymentPage === totalPages}
                        className="p-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h3>
              <form onSubmit={handleServiceSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Teeth Cleaning"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Brief description of the service"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Category</option>
                    <option value="General">General Dentistry</option>
                    <option value="Cosmetic">Cosmetic Dentistry</option>
                    <option value="Orthodontics">Orthodontics</option>
                    <option value="Surgery">Oral Surgery</option>
                    <option value="Pediatric">Pediatric Dentistry</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (PHP)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      required
                      min="15"
                      step="15"
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="60"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowServiceModal(false);
                      setEditingService(null);
                      setServiceForm({ name: '', description: '', price: '', duration: '', category: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    {editingService ? 'Update' : 'Create'} Service
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {showAppointmentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Appointment Details
                </h3>
                <button
                  onClick={() => {
                    setShowAppointmentModal(false);
                    setSelectedAppointment(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Patient</label>
                  <p className="text-sm text-gray-900">{selectedAppointment.patient?.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedAppointment.patient?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dentist</label>
                  <p className="text-sm text-gray-900">Dr. {selectedAppointment.dentist?.full_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Service</label>
                  <p className="text-sm text-gray-900">{selectedAppointment.service?.name}</p>
                  <p className="text-sm text-gray-500">{formatPHPCurrencyCompact(selectedAppointment.service?.price)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(selectedAppointment.appointment_time), 'PPPP')}
                  </p>
                  <p className="text-sm text-gray-900">
                    {format(new Date(selectedAppointment.appointment_time), 'p')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedAppointment.status)}`}>
                    {selectedAppointment.status}
                  </span>
                </div>
                {selectedAppointment.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <p className="text-sm text-gray-900">{selectedAppointment.notes}</p>
                  </div>
                )}
                {selectedAppointment.status === 'rejected' && selectedAppointment.rejection_reason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{selectedAppointment.rejection_reason}</p>
                  </div>
                )}
                {selectedAppointment.admin_override && selectedAppointment.admin_override_reason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin Override Reason</label>
                    <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">{selectedAppointment.admin_override_reason}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                  {selectedAppointment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          handleAppointmentStatusChange(selectedAppointment.id, 'approved');
                          setShowAppointmentModal(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          await handleAppointmentReject(selectedAppointment.id);
                          setShowAppointmentModal(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Details Modal */}
      {showPatientModal && selectedPatient && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Patient Details
                </h3>
                <button
                  onClick={() => {
                    setShowPatientModal(false);
                    setSelectedPatient(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-100">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">
                      {selectedPatient.full_name || 'No name provided'}
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      Patient
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900">{selectedPatient.email || 'No email provided'}</p>
                  </div>
                  
                  {selectedPatient.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-sm text-gray-900">{selectedPatient.phone}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedPatient.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedPatient.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Joined</label>
                    <p className="text-sm text-gray-900">
                      {selectedPatient.created_at ? format(new Date(selectedPatient.created_at), 'MMMM d, yyyy') : 'Unknown'}
                    </p>
                  </div>
                  
                  {selectedPatient.updated_at && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedPatient.updated_at), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 flex space-x-3">
                  <button
                    onClick={() => {
                      handlePatientDelete(selectedPatient.id, selectedPatient.full_name);
                      setShowPatientModal(false);
                      setSelectedPatient(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 ${
                      pendingPatientUpdates.has(selectedPatient.id) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={pendingPatientUpdates.has(selectedPatient.id)}
                  >
                    {pendingPatientUpdates.has(selectedPatient.id) ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Deleting...
                      </div>
                    ) : (
                      'Delete Patient'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowPatientModal(false);
                      setSelectedPatient(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dentist Details Modal */}
      {showDentistModal && selectedDentist && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Dentist Details
                </h3>
                <button
                  onClick={() => {
                    setShowDentistModal(false);
                    setSelectedDentist(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-100">
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">
                      Dr. {selectedDentist.full_name || 'No name provided'}
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      Dentist
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900">{selectedDentist.email || 'No email provided'}</p>
                  </div>
                  
                  {selectedDentist.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-sm text-gray-900">{selectedDentist.phone}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Specialization</label>
                    <p className="text-sm text-gray-900">
                      {selectedDentist.dentist_profile?.specialization || 'General Dentistry'}
                    </p>
                  </div>
                  
                  {selectedDentist.dentist_profile?.qualifications && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Qualifications</label>
                      <p className="text-sm text-gray-900">{selectedDentist.dentist_profile.qualifications}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedDentist.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedDentist.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Joined</label>
                    <p className="text-sm text-gray-900">
                      {selectedDentist.created_at ? format(new Date(selectedDentist.created_at), 'MMMM d, yyyy') : 'Unknown'}
                    </p>
                  </div>
                  
                  {selectedDentist.updated_at && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedDentist.updated_at), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 flex space-x-3">
                  <button
                    onClick={() => handleDentistStatusToggle(selectedDentist.id, selectedDentist.is_active)}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                      selectedDentist.is_active
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } ${pendingDentistUpdates.has(selectedDentist.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={pendingDentistUpdates.has(selectedDentist.id)}
                  >
                    {pendingDentistUpdates.has(selectedDentist.id) ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </div>
                    ) : selectedDentist.is_active ? (
                      'Deactivate Dentist'
                    ) : (
                      'Activate Dentist'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowDentistModal(false);
                      setSelectedDentist(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Payment Details
                </h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPayment(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-100">
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">
                      {formatPHPCurrencyCompact(selectedPayment.amount || 0)}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedPayment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      selectedPayment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedPayment.status === 'failed' ? 'bg-red-100 text-red-800' :
                      selectedPayment.status === 'refunded' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedPayment.status || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Patient</label>
                    <p className="text-sm text-gray-900">{selectedPayment.patient_name || 'Unknown Patient'}</p>
                    {selectedPayment.patient_email && (
                      <p className="text-xs text-gray-500">{selectedPayment.patient_email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Service</label>
                    <p className="text-sm text-gray-900">{selectedPayment.service_name || 'Unknown Service'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Method</label>
                    <p className="text-sm text-gray-900">{selectedPayment.payment_method || 'Online'}</p>
                  </div>
                  
                  {selectedPayment.transaction_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Transaction ID</label>
                      <p className="text-sm text-gray-900 font-mono">{selectedPayment.transaction_id}</p>
                    </div>
                  )}
                  
                  {selectedPayment.appointment_date && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Appointment Date</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedPayment.appointment_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Date</label>
                    <p className="text-sm text-gray-900">
                      {selectedPayment.created_at ? format(new Date(selectedPayment.created_at), 'MMMM d, yyyy h:mm a') : 'Unknown'}
                    </p>
                  </div>
                  
                  {selectedPayment.updated_at && selectedPayment.updated_at !== selectedPayment.created_at && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedPayment.updated_at), 'MMMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  )}
                  
                  {selectedPayment.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notes</label>
                      <p className="text-sm text-gray-900">{selectedPayment.notes}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 flex space-x-3">
                  {selectedPayment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          handlePaymentStatusUpdate(selectedPayment.id, 'completed');
                          setShowPaymentModal(false);
                          setSelectedPayment(null);
                        }}
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 ${
                          pendingPaymentUpdates.has(selectedPayment.id) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={pendingPaymentUpdates.has(selectedPayment.id)}
                      >
                        {pendingPaymentUpdates.has(selectedPayment.id) ? (
                          <div className="flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Processing...
                          </div>
                        ) : (
                          'Mark as Completed'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          handlePaymentStatusUpdate(selectedPayment.id, 'failed');
                          setShowPaymentModal(false);
                          setSelectedPayment(null);
                        }}
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 ${
                          pendingPaymentUpdates.has(selectedPayment.id) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={pendingPaymentUpdates.has(selectedPayment.id)}
                      >
                        Mark as Failed
                      </button>
                    </>
                  )}
                  
                  {selectedPayment.status === 'completed' && (
                    <button
                      onClick={() => {
                        handlePaymentStatusUpdate(selectedPayment.id, 'refunded');
                        setShowPaymentModal(false);
                        setSelectedPayment(null);
                      }}
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 ${
                        pendingPaymentUpdates.has(selectedPayment.id) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={pendingPaymentUpdates.has(selectedPayment.id)}
                    >
                      {pendingPaymentUpdates.has(selectedPayment.id) ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        'Process Refund'
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedPayment(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Management Tab */}
      {activeTab === 'revenue' && (
        <RevenueManagement />
      )}

      {/* Leave Management Tab */}
      {activeTab === 'leave-management' && (
        <AdminLeaveManagement />
      )}

      {/* Dentist Services Details Modal */}
      {showDentistServicesModal && selectedDentistForServices && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-12 w-12">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Dr. {selectedDentistForServices.dentist.full_name || 'No Name'} - Service Records
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedDentistForServices.dentist.email} • Detailed service performance and history
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDentistServicesModal(false);
                    setSelectedDentistForServices(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Calendar className="w-8 h-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-700">Total Appointments</p>
                      <p className="text-xl font-bold text-blue-900">
                        {selectedDentistForServices.totalAppointments}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-700">Completed</p>
                      <p className="text-xl font-bold text-green-900">
                        {selectedDentistForServices.completedAppointments}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Settings className="w-8 h-8 text-purple-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-700">Unique Services</p>
                      <p className="text-xl font-bold text-purple-900">
                        {selectedDentistForServices.uniqueServices}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <DollarSign className="w-8 h-8 text-yellow-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-700">Total Revenue</p>
                      <p className="text-xl font-bold text-yellow-900">
                        {formatPHPCurrency(selectedDentistForServices.totalRevenue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-gray-600" />
                    Service Performance Breakdown
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Detailed statistics for each service provided by this dentist
                  </p>
                </div>
                
                {Object.keys(selectedDentistForServices.serviceStats).length === 0 ? (
                  <div className="p-8 text-center">
                    <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No services provided yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      This dentist hasn't completed any appointments yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Service
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Completed
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pending
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Performed
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.values(selectedDentistForServices.serviceStats).map((stat, index) => (
                          <tr key={stat.service.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Stethoscope className="w-4 h-4 text-gray-400 mr-3" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {stat.service.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {stat.service.category || 'General'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {stat.count}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                {stat.completedCount}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                {stat.pendingCount}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-green-600">
                                {formatPHPCurrency(stat.totalRevenue)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {stat.lastPerformed ? format(new Date(stat.lastPerformed), 'MMM dd, yyyy') : 'Never'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDentistServicesModal(false);
                    setSelectedDentistForServices(null);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
