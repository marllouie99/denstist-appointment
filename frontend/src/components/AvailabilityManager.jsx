import { useState, useEffect } from 'react';
import { Clock, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { dentistsAPI } from '../lib/api';

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' }
];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
];

const AvailabilityManager = ({ dentistProfile, onUpdate }) => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dentistProfile?.availability) {
      setAvailability(dentistProfile.availability);
    } else {
      // Initialize with default availability (Monday-Friday, 9AM-5PM)
      const defaultAvailability = {};
      DAYS_OF_WEEK.forEach(day => {
        if (['mon', 'tue', 'wed', 'thu', 'fri'].includes(day.key)) {
          defaultAvailability[day.key] = {
            available: true,
            start: '09:00',
            end: '17:00'
          };
        } else {
          defaultAvailability[day.key] = {
            available: false,
            start: '09:00',
            end: '17:00'
          };
        }
      });
      setAvailability(defaultAvailability);
    }
  }, [dentistProfile]);

  const handleDayToggle = (dayKey) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        available: !prev[dayKey]?.available
      }
    }));
  };

  const handleTimeChange = (dayKey, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value
      }
    }));
  };

  const validateAvailability = () => {
    for (const day of DAYS_OF_WEEK) {
      const dayAvailability = availability[day.key];
      if (dayAvailability?.available) {
        if (!dayAvailability.start || !dayAvailability.end) {
          toast.error(`Please set start and end times for ${day.label}`);
          return false;
        }
        if (dayAvailability.start >= dayAvailability.end) {
          toast.error(`End time must be after start time for ${day.label}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateAvailability()) return;

    setSaving(true);
    try {
      const response = await dentistsAPI.updateAvailability({ availability });
      
      toast.success('Availability updated successfully');
      if (onUpdate) {
        onUpdate(response.data.availability);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error(error.response?.data?.error || 'Failed to update availability');
    } finally {
      setSaving(false);
    }
  };

  const copyToAllDays = (sourceDay) => {
    const sourceAvailability = availability[sourceDay];
    if (!sourceAvailability) return;

    const newAvailability = { ...availability };
    DAYS_OF_WEEK.forEach(day => {
      if (day.key !== sourceDay) {
        newAvailability[day.key] = { ...sourceAvailability };
      }
    });
    setAvailability(newAvailability);
    toast.success('Availability copied to all days');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Manage Availability
          </h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const dayAvailability = availability[day.key] || {};
          
          return (
            <div key={day.key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dayAvailability.available || false}
                      onChange={() => handleDayToggle(day.key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900">
                      {day.label}
                    </span>
                  </label>
                </div>
                
                {dayAvailability.available && (
                  <button
                    onClick={() => copyToAllDays(day.key)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Copy to all days
                  </button>
                )}
              </div>

              {dayAvailability.available && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <select
                      value={dayAvailability.start || '09:00'}
                      onChange={(e) => handleTimeChange(day.key, 'start', e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <select
                      value={dayAvailability.end || '17:00'}
                      onChange={(e) => handleTimeChange(day.key, 'end', e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {!dayAvailability.available && (
                <p className="text-sm text-gray-500 italic">
                  Not available on this day
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Set your regular working hours for each day</li>
          <li>• Patients can only book appointments during available times</li>
          <li>• Use "Copy to all days" to quickly set the same hours</li>
          <li>• Remember to account for lunch breaks and buffer time</li>
        </ul>
      </div>
    </div>
  );
};

export default AvailabilityManager;
