import { useState, useEffect } from 'react';
import { CalendarX, User, Calendar, Clock, Eye, Check, X, AlertCircle, CheckCircle, Search, Filter, Edit3, Trash2, Plus } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isWithinInterval } from 'date-fns';
import toast from 'react-hot-toast';
import { adminAPI } from '../lib/api';

const AdminLeaveManagement = () => {
  const [allLeaveSchedules, setAllLeaveSchedules] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDentist, setSelectedDentist] = useState('all');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch dentists first
      const dentistsResponse = await adminAPI.getUsers();
      const allUsers = dentistsResponse.data?.users || [];
      const dentistUsers = allUsers.filter(user => user.role === 'dentist');
      setDentists(dentistUsers);

      // Fetch all leave schedules from localStorage for all dentists
      const allLeaves = [];
      dentistUsers.forEach(dentist => {
        const saved = localStorage.getItem(`leave_schedules_${dentist.id}`);
        if (saved) {
          const schedules = JSON.parse(saved);
          schedules.forEach(schedule => {
            allLeaves.push({
              ...schedule,
              dentist_id: dentist.id,
              dentist_name: dentist.full_name,
              dentist_email: dentist.email
            });
          });
        }
      });

      setAllLeaveSchedules(allLeaves);
    } catch (error) {
      console.error('Error fetching leave data:', error);
      toast.error('Failed to load leave schedules');
    } finally {
      setLoading(false);
    }
  };

  const getLeaveStatus = (leave) => {
    // First check admin approval/rejection status
    if (leave.status === 'approved') {
      return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    } else if (leave.status === 'rejected') {
      return { status: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' };
    }
    
    // Then check time-based status for scheduled leaves
    const today = new Date();
    const startDate = parseISO(leave.start_date);
    const endDate = parseISO(leave.end_date);

    if (isAfter(today, endDate)) {
      return { status: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-800' };
    } else if (isWithinInterval(today, { start: startDate, end: endDate })) {
      return { status: 'active', label: 'Active', color: 'bg-orange-100 text-orange-800' };
    } else if (isBefore(today, startDate)) {
      return { status: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    }
    return { status: 'unknown', label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  };

  const filteredLeaves = allLeaveSchedules.filter(leave => {
    const matchesSearch = 
      leave.dentist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const leaveStatus = getLeaveStatus(leave);
    const matchesStatus = statusFilter === 'all' || leaveStatus.status === statusFilter;
    
    const matchesDentist = selectedDentist === 'all' || leave.dentist_id === selectedDentist;

    return matchesSearch && matchesStatus && matchesDentist;
  });

  const handleViewDetails = (leave) => {
    setSelectedLeave(leave);
    setShowLeaveModal(true);
  };

  const handleApproveLeave = async (leave) => {
    setActionLoading(true);
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local storage
      const saved = localStorage.getItem(`leave_schedules_${leave.dentist_id}`);
      if (saved) {
        const schedules = JSON.parse(saved);
        const updatedSchedules = schedules.map(schedule =>
          schedule.id === leave.id
            ? { ...schedule, status: 'approved', approved_at: new Date().toISOString() }
            : schedule
        );
        localStorage.setItem(`leave_schedules_${leave.dentist_id}`, JSON.stringify(updatedSchedules));
      }
      
      toast.success('Leave approved successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error approving leave:', error);
      toast.error('Failed to approve leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectLeave = async (leave) => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setActionLoading(true);
    try {
      // In a real implementation, this would be an API call
      const saved = localStorage.getItem(`leave_schedules_${leave.dentist_id}`);
      if (saved) {
        const schedules = JSON.parse(saved);
        const updatedSchedules = schedules.map(schedule =>
          schedule.id === leave.id
            ? { 
                ...schedule, 
                status: 'rejected', 
                rejected_at: new Date().toISOString(),
                rejection_reason: reason
              }
            : schedule
        );
        localStorage.setItem(`leave_schedules_${leave.dentist_id}`, JSON.stringify(updatedSchedules));
      }
      
      toast.success('Leave rejected');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error rejecting leave:', error);
      toast.error('Failed to reject leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLeave = async (leave) => {
    if (!window.confirm(`Are you sure you want to delete this leave schedule for ${leave.dentist_name}?`)) {
      return;
    }

    try {
      const saved = localStorage.getItem(`leave_schedules_${leave.dentist_id}`);
      if (saved) {
        const schedules = JSON.parse(saved);
        const updatedSchedules = schedules.filter(schedule => schedule.id !== leave.id);
        localStorage.setItem(`leave_schedules_${leave.dentist_id}`, JSON.stringify(updatedSchedules));
      }
      
      toast.success('Leave schedule deleted');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting leave:', error);
      toast.error('Failed to delete leave schedule');
    }
  };

  const closeModal = () => {
    setShowLeaveModal(false);
    setSelectedLeave(null);
  };

  const getStatusStats = () => {
    const stats = {
      total: allLeaveSchedules.length,
      scheduled: 0,
      approved: 0,
      rejected: 0
    };

    allLeaveSchedules.forEach(leave => {
      const status = getLeaveStatus(leave);
      if (stats.hasOwnProperty(status.status)) {
        stats[status.status] = (stats[status.status] || 0) + 1;
      }
    });

    return stats;
  };

  const stats = getStatusStats();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarX className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Dentist Leave Management
            </h2>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Leave Requests</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <CalendarX className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Scheduled</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.scheduled}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Approved</p>
                <p className="text-2xl font-bold text-green-900">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Rejected</p>
                <p className="text-2xl font-bold text-red-900">{stats.rejected}</p>
              </div>
              <X className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by dentist name, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dentist Filter
            </label>
            <select
              value={selectedDentist}
              onChange={(e) => setSelectedDentist(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Dentists</option>
              {dentists.map(dentist => (
                <option key={dentist.id} value={dentist.id}>
                  Dr. {dentist.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leave Schedules List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Leave Schedules ({filteredLeaves.length})
          </h3>
        </div>

        {filteredLeaves.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leave schedules found</h3>
            <p className="text-gray-500">
              {allLeaveSchedules.length === 0 
                ? 'No dentists have scheduled any leave yet.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLeaves.map((leave) => {
              const status = getLeaveStatus(leave);
              return (
                <div key={`${leave.dentist_id}-${leave.id}`} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Dr. {leave.dentist_name}</h4>
                          <p className="text-sm text-gray-600">{leave.dentist_email}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-gray-600">Reason</p>
                          <p className="text-gray-900">{leave.reason}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-gray-600">Duration</p>
                          <p className="text-gray-900">{leave.duration_days} day{leave.duration_days > 1 ? 's' : ''}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-gray-600">Start Date</p>
                          <p className="text-gray-900">{format(parseISO(leave.start_date), 'PPP')}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-gray-600">End Date</p>
                          <p className="text-gray-900">{format(parseISO(leave.end_date), 'PPP')}</p>
                        </div>
                      </div>

                      {leave.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Notes:</span> {leave.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleViewDetails(leave)}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      
                      {status.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleApproveLeave(leave)}
                            disabled={actionLoading}
                            className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectLeave(leave)}
                            disabled={actionLoading}
                            className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDeleteLeave(leave)}
                        className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Details Modal */}
      {showLeaveModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Leave Details</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Dentist Info */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Dr. {selectedLeave.dentist_name}</h4>
                  <p className="text-sm text-gray-600">{selectedLeave.dentist_email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLeaveStatus(selectedLeave).color}`}>
                  {getLeaveStatus(selectedLeave).label}
                </span>
              </div>

              {/* Leave Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Leave Information</h5>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Reason</p>
                      <p className="text-gray-900">{selectedLeave.reason}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Duration</p>
                      <p className="text-gray-900">{selectedLeave.duration_days} day{selectedLeave.duration_days > 1 ? 's' : ''}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Created</p>
                      <p className="text-gray-900">{format(parseISO(selectedLeave.created_at), 'PPpp')}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Schedule</h5>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Start Date</p>
                      <p className="text-gray-900">{format(parseISO(selectedLeave.start_date), 'PPPP')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">End Date</p>
                      <p className="text-gray-900">{format(parseISO(selectedLeave.end_date), 'PPPP')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedLeave.notes && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Additional Notes</h5>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{selectedLeave.notes}</p>
                  </div>
                </div>
              )}

              {selectedLeave.status === 'rejected' && selectedLeave.rejection_reason && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Rejection Reason</h5>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <p className="text-red-700">{selectedLeave.rejection_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                {getLeaveStatus(selectedLeave).status === 'scheduled' && (
                  <>
                    <button
                      onClick={() => {
                        handleApproveLeave(selectedLeave);
                        closeModal();
                      }}
                      disabled={actionLoading}
                      className="btn btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve Leave
                    </button>
                    <button
                      onClick={() => {
                        handleRejectLeave(selectedLeave);
                        closeModal();
                      }}
                      disabled={actionLoading}
                      className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject Leave
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaveManagement;
