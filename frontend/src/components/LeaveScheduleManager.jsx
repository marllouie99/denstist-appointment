import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Save, X, CalendarX, Clock, AlertCircle, CheckCircle, Edit3 } from 'lucide-react';
import { format, addDays, isAfter, isBefore, parseISO, isValid } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const LeaveScheduleManager = () => {
  const { user } = useAuth();
  const [leaveSchedules, setLeaveSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [newLeave, setNewLeave] = useState({
    start_date: '',
    end_date: '',
    duration_days: 1,
    reason: '',
    notes: ''
  });

  useEffect(() => {
    fetchLeaveSchedules();
  }, []);

  const fetchLeaveSchedules = async () => {
    try {
      setLoading(true);
      // For now, we'll use localStorage to simulate API calls
      // In a real implementation, this would be an API call
      const saved = localStorage.getItem(`leave_schedules_${user?.id}`);
      if (saved) {
        setLeaveSchedules(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error fetching leave schedules:', error);
      toast.error('Failed to load leave schedules');
    } finally {
      setLoading(false);
    }
  };

  const saveLeaveSchedules = (schedules) => {
    // For now, save to localStorage
    // In a real implementation, this would be an API call
    localStorage.setItem(`leave_schedules_${user?.id}`, JSON.stringify(schedules));
  };

  const calculateEndDate = (startDate, days) => {
    if (!startDate || !days) return '';
    try {
      const start = new Date(startDate);
      const end = addDays(start, parseInt(days) - 1);
      return format(end, 'yyyy-MM-dd');
    } catch (error) {
      return '';
    }
  };

  const handleDurationChange = (days) => {
    setNewLeave(prev => ({
      ...prev,
      duration_days: days,
      end_date: calculateEndDate(prev.start_date, days)
    }));
  };

  const handleStartDateChange = (date) => {
    setNewLeave(prev => ({
      ...prev,
      start_date: date,
      end_date: calculateEndDate(date, prev.duration_days)
    }));
  };

  const validateLeave = (leave) => {
    if (!leave.start_date) {
      toast.error('Please select a start date');
      return false;
    }

    if (!leave.reason.trim()) {
      toast.error('Please provide a reason for leave');
      return false;
    }

    const startDate = new Date(leave.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isBefore(startDate, today)) {
      toast.error('Leave start date cannot be in the past');
      return false;
    }

    // Check for overlapping leave periods
    const endDate = new Date(leave.end_date);
    const overlapping = leaveSchedules.some(existing => {
      if (editingLeave && existing.id === editingLeave.id) return false;
      
      const existingStart = new Date(existing.start_date);
      const existingEnd = new Date(existing.end_date);
      
      return (
        (startDate >= existingStart && startDate <= existingEnd) ||
        (endDate >= existingStart && endDate <= existingEnd) ||
        (startDate <= existingStart && endDate >= existingEnd)
      );
    });

    if (overlapping) {
      toast.error('Leave period overlaps with existing leave schedule');
      return false;
    }

    return true;
  };

  const handleAddLeave = () => {
    if (!validateLeave(newLeave)) return;

    setSaving(true);
    try {
      const leaveToAdd = {
        id: Date.now().toString(),
        ...newLeave,
        status: 'scheduled',
        created_at: new Date().toISOString()
      };

      const updatedSchedules = [...leaveSchedules, leaveToAdd];
      setLeaveSchedules(updatedSchedules);
      saveLeaveSchedules(updatedSchedules);

      toast.success(`Leave scheduled for ${newLeave.duration_days} day${newLeave.duration_days > 1 ? 's' : ''}`);
      setShowAddModal(false);
      setNewLeave({
        start_date: '',
        end_date: '',
        duration_days: 1,
        reason: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error adding leave:', error);
      toast.error('Failed to schedule leave');
    } finally {
      setSaving(false);
    }
  };

  const handleEditLeave = (leave) => {
    setEditingLeave(leave);
    setNewLeave({
      start_date: leave.start_date,
      end_date: leave.end_date,
      duration_days: leave.duration_days,
      reason: leave.reason,
      notes: leave.notes || ''
    });
    setShowAddModal(true);
  };

  const handleUpdateLeave = () => {
    if (!validateLeave(newLeave)) return;

    setSaving(true);
    try {
      const updatedSchedules = leaveSchedules.map(leave =>
        leave.id === editingLeave.id
          ? { ...leave, ...newLeave, updated_at: new Date().toISOString() }
          : leave
      );

      setLeaveSchedules(updatedSchedules);
      saveLeaveSchedules(updatedSchedules);

      toast.success('Leave schedule updated successfully');
      setShowAddModal(false);
      setEditingLeave(null);
      setNewLeave({
        start_date: '',
        end_date: '',
        duration_days: 1,
        reason: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error updating leave:', error);
      toast.error('Failed to update leave schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeave = (leaveId) => {
    const leave = leaveSchedules.find(l => l.id === leaveId);
    if (!leave) return;

    const statusText = leave.status === 'rejected' ? 'rejected' : '';
    const confirmMessage = leave.status === 'rejected' 
      ? `Are you sure you want to delete this rejected leave schedule (${leave.reason})? This action cannot be undone.`
      : `Are you sure you want to delete this leave schedule (${leave.reason})?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const updatedSchedules = leaveSchedules.filter(l => l.id !== leaveId);
      setLeaveSchedules(updatedSchedules);
      saveLeaveSchedules(updatedSchedules);
      
      const successMessage = leave.status === 'rejected' 
        ? 'Rejected leave schedule deleted successfully'
        : 'Leave schedule deleted';
      toast.success(successMessage);
    } catch (error) {
      console.error('Error deleting leave:', error);
      toast.error('Failed to delete leave schedule');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingLeave(null);
    setNewLeave({
      start_date: '',
      end_date: '',
      duration_days: 1,
      reason: '',
      notes: ''
    });
  };

  const getLeaveStatus = (leave) => {
    // First check admin approval/rejection status
    if (leave.status === 'approved') {
      return { status: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' };
    } else if (leave.status === 'rejected') {
      return { status: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' };
    }
    
    // Then check time-based status for scheduled/approved leaves
    const today = new Date();
    const startDate = new Date(leave.start_date);
    const endDate = new Date(leave.end_date);

    if (isAfter(today, endDate)) {
      return { status: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-800' };
    } else if (today >= startDate && today <= endDate) {
      return { status: 'active', label: 'Active', color: 'bg-orange-100 text-orange-800' };
    } else {
      return { status: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    }
  };

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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Leave Schedule Management
          </h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Schedule Leave
        </button>
      </div>

      {leaveSchedules.length === 0 ? (
        <div className="text-center py-12">
          <CalendarX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leave scheduled</h3>
          <p className="text-gray-500 mb-4">Schedule your leave days to block appointment bookings</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            Schedule Your First Leave
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {leaveSchedules
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
            .map((leave) => {
              const status = getLeaveStatus(leave);
              return (
                <div key={leave.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{leave.reason}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-600">Start Date</p>
                            <p className="text-gray-900">{format(new Date(leave.start_date), 'PPP')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <div>
                            <p className="font-medium text-gray-600">End Date</p>
                            <p className="text-gray-900">{format(new Date(leave.end_date), 'PPP')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="font-medium text-gray-600">Duration</p>
                            <p className="text-gray-900">{leave.duration_days} day{leave.duration_days > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                      
                      {leave.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Notes:</span> {leave.notes}
                          </p>
                        </div>
                      )}
                      
                      {leave.status === 'rejected' && leave.rejection_reason && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                              <p className="text-sm text-red-700">{leave.rejection_reason}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {leave.status === 'approved' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-medium text-green-800">This leave has been approved by admin</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {(status.status === 'scheduled' && leave.status !== 'approved' && leave.status !== 'rejected') && (
                        <button
                          onClick={() => handleEditLeave(leave)}
                          className="btn btn-sm btn-secondary flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                      {(leave.status !== 'approved') && (
                        <button
                          onClick={() => handleDeleteLeave(leave.id)}
                          className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add/Edit Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLeave ? 'Edit Leave Schedule' : 'Schedule Leave'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map(days => (
                    <button
                      key={days}
                      onClick={() => handleDurationChange(days)}
                      className={`p-2 text-sm rounded-md border transition-colors ${
                        newLeave.duration_days === days
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {days} day{days > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newLeave.start_date}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={newLeave.end_date}
                  readOnly
                  className="w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Automatically calculated based on duration
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Leave *
                </label>
                <select
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select a reason</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal Leave">Personal Leave</option>
                  <option value="Family Emergency">Family Emergency</option>
                  <option value="Medical Appointment">Medical Appointment</option>
                  <option value="Conference/Training">Conference/Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={newLeave.notes}
                  onChange={(e) => setNewLeave(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional notes about your leave..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Important:</p>
                    <ul className="mt-1 space-y-1">
                      <li>• Patients cannot book appointments during your leave</li>
                      <li>• Existing appointments during this period should be rescheduled</li>
                      <li>• Leave schedules cannot overlap</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={editingLeave ? handleUpdateLeave : handleAddLeave}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingLeave ? 'Update Leave' : 'Schedule Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Leave Schedule Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Schedule leave in advance to avoid conflicts with existing appointments</li>
          <li>• Choose from 1-7 days duration for your leave period</li>
          <li>• Patients will not be able to book appointments during your leave</li>
          <li>• You can edit or delete scheduled leave before it starts</li>
          <li>• Consider notifying patients about upcoming leave periods</li>
        </ul>
      </div>
    </div>
  );
};

export default LeaveScheduleManager;
