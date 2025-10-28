import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Clock, 
  BarChart3, 
  PieChart, 
  RefreshCw,
  Download,
  Filter,
  Eye,
  CreditCard,
  CheckCircle,
  AlertCircle,
  XCircle,
  Users,
  Stethoscope,
  Award,
  Target
} from 'lucide-react';
import { adminAPI } from '../lib/api';
import { formatPHPCurrency, formatPHPCurrencyCompact } from '../utils/currency';
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, endOfDay, endOfMonth, endOfYear } from 'date-fns';
import toast from 'react-hot-toast';

const RevenueManagement = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [viewMode, setViewMode] = useState('overall'); // 'overall' or 'dentist'
  const [selectedDentist, setSelectedDentist] = useState(null);
  const [revenueData, setRevenueData] = useState({
    today: { total: 0, transactions: 0, payments: [] },
    weekly: { total: 0, transactions: 0, payments: [] },
    monthly: { total: 0, transactions: 0, payments: [] },
    yearly: { total: 0, transactions: 0, payments: [] },
    overall: { total: 0, transactions: 0, payments: [] }
  });
  const [dentistRevenueData, setDentistRevenueData] = useState({
    today: { dentists: [], summary: {} },
    this_month: { dentists: [], summary: {} },
    this_year: { dentists: [], summary: {} },
    all: { dentists: [], summary: {} }
  });
  const [paymentMethods, setPaymentMethods] = useState({});
  const [revenueByService, setRevenueByService] = useState([]);

  useEffect(() => {
    fetchRevenueData();
    fetchDentistRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      
      // Fetch all payments data
      const paymentsResponse = await adminAPI.getPayments();
      const allPayments = paymentsResponse.data.payments || [];
      
      // Filter completed payments only
      const completedPayments = allPayments.filter(payment => 
        payment.status === 'completed' || payment.status === 'paid'
      );

      // Calculate date ranges
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      // Filter payments by time periods
      const todayPayments = completedPayments.filter(payment => 
        new Date(payment.created_at) >= todayStart
      );

      const weeklyPayments = completedPayments.filter(payment => 
        new Date(payment.created_at) >= weekStart
      );

      const monthlyPayments = completedPayments.filter(payment => 
        new Date(payment.created_at) >= monthStart
      );

      const yearlyPayments = completedPayments.filter(payment => 
        new Date(payment.created_at) >= yearStart
      );

      // Calculate totals
      const calculateTotal = (payments) => 
        payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

      // Update revenue data
      setRevenueData({
        today: {
          total: calculateTotal(todayPayments),
          transactions: todayPayments.length,
          payments: todayPayments
        },
        weekly: {
          total: calculateTotal(weeklyPayments),
          transactions: weeklyPayments.length,
          payments: weeklyPayments
        },
        monthly: {
          total: calculateTotal(monthlyPayments),
          transactions: monthlyPayments.length,
          payments: monthlyPayments
        },
        yearly: {
          total: calculateTotal(yearlyPayments),
          transactions: yearlyPayments.length,
          payments: yearlyPayments
        },
        overall: {
          total: calculateTotal(completedPayments),
          transactions: completedPayments.length,
          payments: completedPayments
        }
      });

      // Calculate payment methods breakdown
      const methodsBreakdown = completedPayments.reduce((acc, payment) => {
        const method = payment.payment_method || 'Unknown';
        acc[method] = (acc[method] || 0) + parseFloat(payment.amount || 0);
        return acc;
      }, {});
      setPaymentMethods(methodsBreakdown);

      // Calculate revenue by service
      const serviceBreakdown = completedPayments.reduce((acc, payment) => {
        const service = payment.service_name || 'Unknown Service';
        const existing = acc.find(item => item.service === service);
        if (existing) {
          existing.revenue += parseFloat(payment.amount || 0);
          existing.count += 1;
        } else {
          acc.push({
            service,
            revenue: parseFloat(payment.amount || 0),
            count: 1
          });
        }
        return acc;
      }, []);
      
      setRevenueByService(serviceBreakdown.sort((a, b) => b.revenue - a.revenue));

    } catch (error) {
      console.error('Error fetching revenue data:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDentistRevenueData = async () => {
    try {
      const periods = ['today', 'this_month', 'this_year', 'all'];
      
      const responses = await Promise.all(
        periods.map(period => adminAPI.getDentistRevenue({ period }))
      );

      const newDentistData = {};
      periods.forEach((period, index) => {
        newDentistData[period] = {
          dentists: responses[index].data.dentists || [],
          summary: responses[index].data.summary || {}
        };
      });

      setDentistRevenueData(newDentistData);
      
      console.log('✅ Dentist revenue data fetched:', newDentistData);
    } catch (error) {
      console.error('Error fetching dentist revenue data:', error);
      toast.error('Failed to load dentist revenue data');
    }
  };


  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRevenueData(), fetchDentistRevenueData()]);
    setRefreshing(false);
    toast.success('Revenue data refreshed');
  };

  const currentData = revenueData[selectedPeriod];
  const currentDentistData = dentistRevenueData[selectedPeriod === 'monthly' ? 'this_month' : selectedPeriod === 'yearly' ? 'this_year' : selectedPeriod] || { dentists: [], summary: {} };

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-l-blue-500">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`h-4 w-4 mr-1 ${trend.positive ? '' : 'rotate-180'}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`p-3 bg-${color}-100 rounded-full`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const PeriodButton = ({ period, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(period)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revenue Management</h2>
          <p className="text-gray-600 mt-1">Track and analyze payment revenue across different time periods</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* View Mode Selection */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode('overall')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'overall'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overall Revenue
          </button>
          <button
            onClick={() => setViewMode('dentist')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'dentist'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Stethoscope className="h-4 w-4 inline mr-2" />
            Individual Dentist Revenue
          </button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="flex flex-wrap gap-3">
        <PeriodButton
          period="today"
          label="Today"
          isActive={selectedPeriod === 'today'}
          onClick={setSelectedPeriod}
        />
        <PeriodButton
          period="weekly"
          label="This Week"
          isActive={selectedPeriod === 'weekly'}
          onClick={setSelectedPeriod}
        />
        <PeriodButton
          period="monthly"
          label="This Month"
          isActive={selectedPeriod === 'monthly'}
          onClick={setSelectedPeriod}
        />
        <PeriodButton
          period="yearly"
          label="This Year"
          isActive={selectedPeriod === 'yearly'}
          onClick={setSelectedPeriod}
        />
      </div>

      {/* Revenue Overview Cards */}
      {viewMode === 'overall' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={`Revenue (${selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'weekly' ? 'This Week' : selectedPeriod === 'monthly' ? 'This Month' : selectedPeriod === 'yearly' ? 'This Year' : 'All Time'})`}
            value={formatPHPCurrency(currentData.total)}
            subtitle={`${currentData.transactions} transactions`}
            icon={DollarSign}
            color="green"
          />
          
          <StatCard
            title="Total Transactions"
            value={currentData.transactions.toLocaleString()}
            subtitle={`Average: ${formatPHPCurrency(currentData.transactions > 0 ? currentData.total / currentData.transactions : 0)}`}
            icon={CreditCard}
            color="blue"
          />
          
          <StatCard
            title="Payment Methods"
            value={Object.keys(paymentMethods).length}
            subtitle=" Paypal methods used "
            icon={PieChart}
            color="purple"
          />
          
          <StatCard
            title="Top Service Revenue"
            value={revenueByService.length > 0 ? formatPHPCurrencyCompact(revenueByService[0].revenue) : formatPHPCurrency(0)}
            subtitle={revenueByService.length > 0 ? revenueByService[0].service : 'No services'}
            icon={BarChart3}
            color="orange"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={`Total Revenue (${selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'monthly' ? 'This Month' : selectedPeriod === 'yearly' ? 'This Year' : 'All Time'})`}
            value={formatPHPCurrency(currentDentistData.summary.total_revenue || 0)}
            subtitle={`${currentDentistData.summary.total_transactions || 0} transactions`}
            icon={DollarSign}
            color="green"
          />
          
          <StatCard
            title="Active Dentists"
            value={currentDentistData.dentists.length.toLocaleString()}
            subtitle={`Avg: ${formatPHPCurrency(currentDentistData.summary.average_revenue_per_dentist || 0)}`}
            icon={Users}
            color="blue"
          />
          
          <StatCard
            title="Top Performer"
            value={currentDentistData.dentists.length > 0 ? formatPHPCurrencyCompact(currentDentistData.dentists[0].total_revenue) : formatPHPCurrency(0)}
            subtitle={currentDentistData.dentists.length > 0 ? `Dr. ${currentDentistData.dentists[0].dentist_name}` : 'No data'}
            icon={Award}
            color="purple"
          />
          
          <StatCard
            title="Total Patients Served"
            value={currentDentistData.dentists.reduce((sum, d) => sum + (d.unique_patients || 0), 0).toLocaleString()}
            subtitle="Unique patients"
            icon={Target}
            color="orange"
          />
        </div>
      )}

      {/* Individual Dentist Revenue Display */}
      {viewMode === 'dentist' && (
        <div className="space-y-6">

          {/* Individual Dentist Revenue Cards */}
          <div className="space-y-6">
            {dentistRevenueData.all.dentists.length > 0 ? (
              dentistRevenueData.all.dentists.map((dentist, index) => {
                // Get revenue data for this dentist across all periods
                const todayRevenue = dentistRevenueData.today.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_revenue || 0;
                const monthRevenue = dentistRevenueData.this_month.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_revenue || 0;
                const yearRevenue = dentistRevenueData.this_year.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_revenue || 0;
                const allTimeRevenue = dentist.total_revenue || 0;
                
                const todayTransactions = dentistRevenueData.today.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_transactions || 0;
                const monthTransactions = dentistRevenueData.this_month.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_transactions || 0;
                const yearTransactions = dentistRevenueData.this_year.dentists.find(d => d.dentist_id === dentist.dentist_id)?.total_transactions || 0;
                const allTimeTransactions = dentist.total_transactions || 0;
                
                return (
                  <div key={dentist.dentist_id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Dentist Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-700'
                          }`}>
                            {dentist.dentist_name?.charAt(0) || 'D'}
                          </div>
                          <div className="ml-4">
                            <h3 className="text-xl font-bold text-white">Dr. {dentist.dentist_name}</h3>
                            <p className="text-blue-100">{dentist.dentist_email}</p>
                          </div>
                        </div>
                        {index === 0 && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-400 text-yellow-900">
                            🏆 Top Performer
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Revenue Breakdown */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Today's Personal Earnings */}
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-600">Today's Earnings</p>
                              <p className="text-2xl font-bold text-green-900">{formatPHPCurrency(todayRevenue)}</p>
                              <p className="text-xs text-green-600">{todayTransactions} personal transactions</p>
                              {todayRevenue > 0 && (
                                <p className="text-xs text-green-500 mt-1">✓ Active today</p>
                              )}
                            </div>
                            <DollarSign className="h-8 w-8 text-green-500" />
                          </div>
                        </div>

                        {/* This Month's Personal Earnings */}
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-600">This Month's Earnings</p>
                              <p className="text-2xl font-bold text-blue-900">{formatPHPCurrency(monthRevenue)}</p>
                              <p className="text-xs text-blue-600">{monthTransactions} personal transactions</p>
                              <p className="text-xs text-blue-500 mt-1">
                                Avg/day: {formatPHPCurrency(monthRevenue / new Date().getDate())}
                              </p>
                            </div>
                            <Calendar className="h-8 w-8 text-blue-500" />
                          </div>
                        </div>

                        {/* This Year's Personal Earnings */}
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-purple-600">This Year's Earnings</p>
                              <p className="text-2xl font-bold text-purple-900">{formatPHPCurrency(yearRevenue)}</p>
                              <p className="text-xs text-purple-600">{yearTransactions} personal transactions</p>
                              <p className="text-xs text-purple-500 mt-1">
                                Monthly avg: {formatPHPCurrency(yearRevenue / (new Date().getMonth() + 1))}
                              </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                          </div>
                        </div>


                      </div>

                      {/* Personal Performance Stats */}
                      <div className="mt-6 bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Personal Performance Metrics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-sm text-gray-500">Personal Patients</p>
                            <p className="text-lg font-semibold text-gray-900">{dentist.unique_patients || 0}</p>
                            <p className="text-xs text-gray-400">Unique patients served</p>
                          </div>
                          <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-sm text-gray-500">Personal Avg/Transaction</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {formatPHPCurrency(allTimeTransactions > 0 ? allTimeRevenue / allTimeTransactions : 0)}
                            </p>
                            <p className="text-xs text-gray-400">Revenue efficiency</p>
                          </div>
                          <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-sm text-gray-500">Personal Services</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {Object.keys(dentist.services || {}).length}
                            </p>
                            <p className="text-xs text-gray-400">Services offered</p>
                          </div>
                        </div>
                      </div>

                      {/* Top Services */}
                      {dentist.services && Object.keys(dentist.services).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Top Services</h4>
                          <div className="space-y-2">
                            {Object.entries(dentist.services)
                              .sort((a, b) => b[1].revenue - a[1].revenue)
                              .slice(0, 3)
                              .map(([serviceName, serviceData]) => (
                                <div key={serviceName} className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600">{serviceName}</span>
                                  <div className="text-right">
                                    <span className="font-medium text-gray-900">{formatPHPCurrency(serviceData.revenue)}</span>
                                    <span className="text-gray-500 ml-2">({serviceData.count} times)</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No dentist revenue data found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts and Analytics */}
      {viewMode === 'overall' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(paymentMethods).map(([method, amount]) => {
              const percentage = revenueData.overall.total > 0 ? (amount / revenueData.overall.total) * 100 : 0;
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">{method}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatPHPCurrency(amount)}</p>
                    <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Service */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Service</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {revenueByService.slice(0, 8).map((service, index) => {
              const maxRevenue = revenueByService[0]?.revenue || 1;
              const percentage = (service.revenue / maxRevenue) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 truncate">{service.service}</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatPHPCurrency(service.revenue)}</p>
                      <p className="text-xs text-gray-500">{service.count} transactions</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Recent Transactions */}
      {viewMode === 'overall' && (
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Transactions ({selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'weekly' ? 'This Week' : selectedPeriod === 'monthly' ? 'This Month' : selectedPeriod === 'yearly' ? 'This Year' : 'All Time'})
            </h3>
            <span className="text-sm text-gray-500">
              {currentData.payments.length} transactions
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.payments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.patient_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.service_name || 'Unknown Service'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.payment_method || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatPHPCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payment.status === 'completed' || payment.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {payment.status === 'completed' || payment.status === 'paid' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : payment.status === 'pending' ? (
                        <Clock className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {currentData.payments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions found for this period</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Today's Revenue</p>
              <p className="text-2xl font-bold">{formatPHPCurrencyCompact(revenueData.today.total)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">{viewMode === 'dentist' ? 'Monthly Revenue' : 'Weekly Revenue'}</p>
              <p className="text-2xl font-bold">{formatPHPCurrencyCompact(viewMode === 'dentist' ? revenueData.monthly.total : revenueData.weekly.total)}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">{viewMode === 'dentist' ? 'Yearly Revenue' : 'Monthly Revenue'}</p>
              <p className="text-2xl font-bold">{formatPHPCurrencyCompact(viewMode === 'dentist' ? revenueData.yearly.total : revenueData.monthly.total)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold">{formatPHPCurrencyCompact(revenueData.overall.total)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-200" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueManagement;
