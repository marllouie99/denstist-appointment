import { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, Coins, BarChart3, PieChart, Activity, UserCheck, Clock, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../lib/api';
import { formatPHPCurrency } from '../utils/currency';

const StatCard = ({ title, value, icon: Icon, change, changeType = 'positive' }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <p className={`text-sm ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
            {changeType === 'positive' ? '+' : ''}{change}
          </p>
        )}
      </div>
      <div className="p-3 bg-blue-100 rounded-full">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
    </div>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    {children}
  </div>
);

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAnalyticsDashboard();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error.response?.data?.error || error.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading analytics: {error}</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const { overview, monthlyData } = analytics || {};

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={overview?.totalUsers || 0}
          icon={Users}
        />
        <StatCard
          title="Active Users"
          value={overview?.activeUsers || 0}
          icon={UserCheck}
        />
        <StatCard
          title="Total Appointments"
          value={overview?.totalAppointments || 0}
          icon={Calendar}
        />
        <StatCard
          title="Total Revenue"
          value={formatPHPCurrency(overview?.totalRevenue || 0)}
          icon={Coins}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Patients"
          value={overview?.totalPatients || 0}
          icon={Users}
        />
        <StatCard
          title="Dentists"
          value={overview?.totalDentists || 0}
          icon={Activity}
        />
        <StatCard
          title="Pending Appointments"
          value={overview?.pendingAppointments || 0}
          icon={Clock}
        />
        <StatCard
          title="Completed Payments"
          value={overview?.completedPayments || 0}
          icon={CreditCard}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Users Chart */}
        <ChartCard title="Monthly User Growth">
          <div className="space-y-3">
            {monthlyData?.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{month.month}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">{month.users} users</span>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((month.users / Math.max(...(monthlyData?.map(m => m.users) || [1]))) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Monthly Appointments Chart */}
        <ChartCard title="Monthly Appointments">
          <div className="space-y-3">
            {monthlyData?.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{month.month}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">{month.appointments} appointments</span>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((month.appointments / Math.max(...(monthlyData?.map(m => m.appointments) || [1]))) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Monthly Revenue Chart */}
        <ChartCard title="Monthly Revenue">
          <div className="space-y-3">
            {monthlyData?.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{month.month}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm font-medium">${(month.revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((month.revenue / Math.max(...(monthlyData?.map(m => m.revenue) || [1]))) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">System Health</h3>
          <p className="text-blue-100">
            {overview?.activeUsers || 0} active users out of {overview?.totalUsers || 0} total
          </p>
          <div className="mt-3 bg-blue-400 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full"
              style={{ 
                width: `${overview?.totalUsers ? (overview.activeUsers / overview.totalUsers) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Appointment Status</h3>
          <p className="text-green-100">
            {overview?.approvedAppointments || 0} approved out of {overview?.totalAppointments || 0} total
          </p>
          <div className="mt-3 bg-green-400 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full"
              style={{ 
                width: `${overview?.totalAppointments ? (overview.approvedAppointments / overview.totalAppointments) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Revenue Growth</h3>
          <p className="text-purple-100">
            ${(overview?.totalRevenue || 0).toLocaleString()} total revenue
          </p>
          <p className="text-sm text-purple-200 mt-1">
            {overview?.completedPayments || 0} completed payments
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
