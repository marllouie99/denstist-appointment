import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { 
  Calendar, 
  Clock, 
  Users, 
  Activity, 
  TrendingUp, 
  Star, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Eye,
  CreditCard,
  FileText,
  Settings,
  Bell,
  Heart,
  Shield,
  Award,
  Zap
} from 'lucide-react';
import { format, isValid, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { formatPHPCurrencyCompact } from '../utils/currency';

const HomeDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    appointments: [],
    stats: {},
    recentActivity: [],
    loading: true
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      
      let data = {};
      
      if (user.role === 'patient') {
        // Load patient-specific data
        const [appointmentsRes, statsRes] = await Promise.all([
          api.get('/appointments'),
          api.get('/patient/stats')
        ]);
        
        data = {
          appointments: appointmentsRes.data || [],
          stats: statsRes.data || {},
          recentActivity: []
        };
      } else if (user.role === 'dentist') {
        // Load dentist-specific data
        const [appointmentsRes, statsRes] = await Promise.all([
          api.get('/dentist/appointments'),
          api.get('/dentist/stats')
        ]);
        
        data = {
          appointments: appointmentsRes.data || [],
          stats: statsRes.data || {},
          recentActivity: []
        };
      } else if (user.role === 'admin') {
        // Load admin-specific data
        const [statsRes] = await Promise.all([
          api.get('/admin/stats')
        ]);
        
        data = {
          appointments: [],
          stats: statsRes.data || {},
          recentActivity: []
        };
      }
      
      setDashboardData({ ...data, loading: false });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  const formatSafeDate = (dateValue, formatString = 'PPp') => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (!isValid(date)) return 'Invalid Date';
    try {
      return format(date, formatString);
    } catch (error) {
      return 'Format Error';
    }
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return dashboardData.appointments
      .filter(apt => new Date(apt.appointment_time || apt.appointment_date) > now)
      .sort((a, b) => new Date(a.appointment_time || a.appointment_date) - new Date(b.appointment_time || b.appointment_date))
      .slice(0, 3);
  };

  const getThisWeekAppointments = () => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    
    return dashboardData.appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_time || apt.appointment_date);
      return isWithinInterval(aptDate, { start: weekStart, end: weekEnd });
    });
  };

  if (dashboardData.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {user?.full_name || user?.email}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              {user?.role === 'patient' && "Manage your dental appointments and health records"}
              {user?.role === 'dentist' && "Manage your practice and patient appointments"}
              {user?.role === 'admin' && "Oversee the entire dental care platform"}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <span className="text-4xl">🦷</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific Dashboard Content */}
      {user?.role === 'patient' && <PatientDashboardContent 
        data={dashboardData} 
        upcomingAppointments={getUpcomingAppointments()}
        thisWeekAppointments={getThisWeekAppointments()}
        formatSafeDate={formatSafeDate}
      />}
      
      {user?.role === 'dentist' && <DentistDashboardContent 
        data={dashboardData} 
        upcomingAppointments={getUpcomingAppointments()}
        thisWeekAppointments={getThisWeekAppointments()}
        formatSafeDate={formatSafeDate}
      />}
      
      {user?.role === 'admin' && <AdminDashboardContent 
        data={dashboardData} 
        formatSafeDate={formatSafeDate}
      />}
    </div>
  );
};

// Patient Dashboard Content
const PatientDashboardContent = ({ data, upcomingAppointments, thisWeekAppointments, formatSafeDate }) => (
  <>
    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Appointments</p>
            <p className="text-2xl font-bold text-gray-900">{data.appointments?.length || 0}</p>
          </div>
          <Calendar className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">This Week</p>
            <p className="text-2xl font-bold text-gray-900">{thisWeekAppointments?.length || 0}</p>
          </div>
          <Clock className="w-8 h-8 text-green-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-gray-900">
              {data.appointments?.filter(apt => apt.status === 'completed')?.length || 0}
            </p>
          </div>
          <CheckCircle className="w-8 h-8 text-purple-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Health Score</p>
            <p className="text-2xl font-bold text-gray-900">85%</p>
          </div>
          <Heart className="w-8 h-8 text-red-500" />
        </div>
      </div>
    </div>

    {/* Quick Actions */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/patient/book-appointment"
          className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Plus className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Book Appointment</p>
            <p className="text-sm text-gray-600">Schedule with your dentist</p>
          </div>
        </Link>
        
        <Link
          to="/patient/payment-history"
          className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
        >
          <CreditCard className="w-6 h-6 text-green-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Payment History</p>
            <p className="text-sm text-gray-600">View your payments</p>
          </div>
        </Link>
        
        <Link
          to="/patient/dashboard"
          className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
        >
          <FileText className="w-6 h-6 text-purple-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Full Dashboard</p>
            <p className="text-sm text-gray-600">Complete overview</p>
          </div>
        </Link>
      </div>
    </div>

    {/* Upcoming Appointments */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Upcoming Appointments</h2>
        <Link to="/patient/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          View All
        </Link>
      </div>
      
      {upcomingAppointments?.length > 0 ? (
        <div className="space-y-3">
          {upcomingAppointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{appointment.service}</p>
                  <p className="text-sm text-gray-600">
                    Dr. {appointment.dentist_name} • {formatSafeDate(appointment.appointment_time, 'PPp')}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {appointment.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No upcoming appointments</p>
          <Link
            to="/patient/book-appointment"
            className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4 mr-1" />
            Book your first appointment
          </Link>
        </div>
      )}
    </div>
  </>
);

// Dentist Dashboard Content
const DentistDashboardContent = ({ data, upcomingAppointments, thisWeekAppointments, formatSafeDate }) => (
  <>
    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Patients</p>
            <p className="text-2xl font-bold text-gray-900">{data.stats?.total_patients || 0}</p>
          </div>
          <Users className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">This Week</p>
            <p className="text-2xl font-bold text-gray-900">{thisWeekAppointments?.length || 0}</p>
          </div>
          <Calendar className="w-8 h-8 text-green-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatPHPCurrencyCompact(data.stats?.monthly_revenue || 0)}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Rating</p>
            <p className="text-2xl font-bold text-gray-900">4.8</p>
          </div>
          <Star className="w-8 h-8 text-yellow-500" />
        </div>
      </div>
    </div>

    {/* Quick Actions */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/dentist/dashboard"
          className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Activity className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">View Schedule</p>
            <p className="text-sm text-gray-600">Manage appointments</p>
          </div>
        </Link>
        
        <div className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors cursor-pointer">
          <Users className="w-6 h-6 text-green-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Patient Records</p>
            <p className="text-sm text-gray-600">View patient history</p>
          </div>
        </div>
        
        <div className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer">
          <Settings className="w-6 h-6 text-purple-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Practice Settings</p>
            <p className="text-sm text-gray-600">Configure your practice</p>
          </div>
        </div>
      </div>
    </div>

    {/* Today's Schedule */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Today's Schedule</h2>
        <Link to="/dentist/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          View Full Schedule
        </Link>
      </div>
      
      {upcomingAppointments?.length > 0 ? (
        <div className="space-y-3">
          {upcomingAppointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{appointment.patient_name}</p>
                  <p className="text-sm text-gray-600">
                    {appointment.service} • {formatSafeDate(appointment.appointment_time, 'p')}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {appointment.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No appointments scheduled for today</p>
        </div>
      )}
    </div>
  </>
);

// Admin Dashboard Content
const AdminDashboardContent = ({ data, formatSafeDate }) => (
  <>
    {/* Platform Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{data.stats?.total_users || 0}</p>
          </div>
          <Users className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Dentists</p>
            <p className="text-2xl font-bold text-gray-900">{data.stats?.active_dentists || 0}</p>
          </div>
          <Award className="w-8 h-8 text-green-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatPHPCurrencyCompact(data.stats?.total_revenue || 0)}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">System Health</p>
            <p className="text-2xl font-bold text-gray-900">98%</p>
          </div>
          <Shield className="w-8 h-8 text-green-500" />
        </div>
      </div>
    </div>

    {/* Admin Actions */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/dashboard"
          className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Activity className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">Full Dashboard</p>
            <p className="text-sm text-gray-600">Complete admin panel</p>
          </div>
        </Link>
        
        <div className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors cursor-pointer">
          <Users className="w-6 h-6 text-green-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">User Management</p>
            <p className="text-sm text-gray-600">Manage users & roles</p>
          </div>
        </div>
        
        <div className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer">
          <Settings className="w-6 h-6 text-purple-600 mr-3" />
          <div>
            <p className="font-medium text-gray-900">System Settings</p>
            <p className="text-sm text-gray-600">Platform configuration</p>
          </div>
        </div>
      </div>
    </div>

    {/* Recent Activity */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Platform Activity</h2>
      <div className="space-y-3">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <p className="text-sm text-gray-600">New dentist registered: Dr. Smith</p>
          <span className="text-xs text-gray-400 ml-auto">2 hours ago</span>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <p className="text-sm text-gray-600">System backup completed successfully</p>
          <span className="text-xs text-gray-400 ml-auto">4 hours ago</span>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <p className="text-sm text-gray-600">Monthly report generated</p>
          <span className="text-xs text-gray-400 ml-auto">1 day ago</span>
        </div>
      </div>
    </div>
  </>
);

export default HomeDashboard;
