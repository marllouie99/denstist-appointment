import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, CalendarX } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';

const GoogleCalendarView = ({ onDateSelect, selectedDate, availableSlots = [], onTimeSelect, dentistId }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(selectedDate || new Date());
  const [monthlyAvailability, setMonthlyAvailability] = useState({});
  const [dailySlots, setDailySlots] = useState({ available: [], unavailable: [] });
  const [leaveSchedules, setLeaveSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasClickedCalendar, setHasClickedCalendar] = useState(false);
  
  console.log('GoogleCalendarView props:', { selectedDate, availableSlots, slotsLength: availableSlots.length, dentistId });
  
  // Update selectedDay when selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      setSelectedDay(selectedDate);
    }
  }, [selectedDate]);

  // Fetch monthly availability when month changes or dentist changes
  useEffect(() => {
    if (dentistId) {
      fetchLeaveSchedules();
      fetchMonthlyAvailability();
    }
  }, [currentMonth, dentistId]);

  // Fetch detailed slots when a day is selected
  useEffect(() => {
    if (selectedDay && dentistId) {
      fetchDailySlots(selectedDay);
    }
  }, [selectedDay, dentistId]);

  const fetchLeaveSchedules = async () => {
    if (!dentistId) return;
    
    try {
      // For now, get leave schedules from localStorage
      // In a real implementation, this would be an API call
      const saved = localStorage.getItem(`leave_schedules_${dentistId}`);
      if (saved) {
        const schedules = JSON.parse(saved);
        console.log('Fetched leave schedules for dentist:', schedules);
        setLeaveSchedules(schedules);
      } else {
        setLeaveSchedules([]);
      }
    } catch (error) {
      console.error('Error fetching leave schedules:', error);
      setLeaveSchedules([]);
    }
  };

  const isDateOnLeave = (date) => {
    if (!leaveSchedules.length) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return leaveSchedules.some(leave => {
      try {
        // Only consider approved leave schedules
        if (leave.status !== 'approved') return false;
        
        const startDate = parseISO(leave.start_date);
        const endDate = parseISO(leave.end_date);
        const checkDate = parseISO(dateStr);
        
        return isWithinInterval(checkDate, { start: startDate, end: endDate });
      } catch (error) {
        console.error('Error checking leave date:', error);
        return false;
      }
    });
  };

  const getLeaveInfo = (date) => {
    if (!leaveSchedules.length) return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const leave = leaveSchedules.find(leave => {
      try {
        // Only consider approved leave schedules
        if (leave.status !== 'approved') return false;
        
        const startDate = parseISO(leave.start_date);
        const endDate = parseISO(leave.end_date);
        const checkDate = parseISO(dateStr);
        
        return isWithinInterval(checkDate, { start: startDate, end: endDate });
      } catch (error) {
        console.error('Error checking leave date:', error);
        return false;
      }
    });
    
    return leave || null;
  };

  const fetchMonthlyAvailability = async () => {
    if (!dentistId) return;
    
    setLoading(true);
    try {
      // First, get the dentist's schedule/availability settings
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://109.123.227.37:5000';
      const dentistResponse = await fetch(`${apiBaseUrl}/api/dentists/${dentistId}`);
      let dentistSchedule = null;
      
      if (dentistResponse.ok) {
        const dentistData = await dentistResponse.json();
        dentistSchedule = dentistData.dentist?.dentist_profile?.availability;
        console.log('Dentist schedule:', dentistSchedule);
      }
      
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const availability = {};
      
      // Check each day of the month for availability
      let day = monthStart;
      while (day <= monthEnd) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = format(day, 'eee').toLowerCase(); // mon, tue, wed, etc.
        
        // Check if dentist is available on this day of the week
        const daySchedule = dentistSchedule?.[dayOfWeek];
        const isDayAvailable = daySchedule?.available === true;
        const isOnLeave = isDateOnLeave(day);
        
        if (!isDayAvailable || isOnLeave) {
          // Dentist not available on this day of the week or is on leave
          availability[dateStr] = false;
        } else {
          // Dentist is available on this day, check for specific time slots
          try {
            const response = await fetch(`${apiBaseUrl}/api/dentists/${dentistId}/availability?date=${dateStr}`);
            if (response.ok) {
              const data = await response.json();
              availability[dateStr] = data.available_slots?.length > 0;
            } else {
              availability[dateStr] = false;
            }
          } catch (error) {
            console.error('Error fetching availability for', dateStr, error);
            availability[dateStr] = false;
          }
        }
        
        day = addDays(day, 1);
      }
      
      console.log('Monthly availability calculated:', availability);
      setMonthlyAvailability(availability);
    } catch (error) {
      console.error('Error fetching monthly availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySlots = async (date) => {
    if (!dentistId || !date) return;
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`🔍 Fetching detailed slots for ${dateStr}`);
      
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://109.123.227.37:5000';
      const response = await fetch(`${apiBaseUrl}/api/dentists/${dentistId}/availability?date=${dateStr}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Daily slots response:', data);
        
        setDailySlots({
          available: data.available_slots || [],
          unavailable: data.unavailable_slots || [],
          booked: data.booked_slots || []
        });
      } else {
        console.error('❌ Failed to fetch daily slots');
        setDailySlots({ available: [], unavailable: [], booked: [] });
      }
    } catch (error) {
      console.error('❌ Error fetching daily slots:', error);
      setDailySlots({ available: [], unavailable: [], booked: [] });
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";
  
  // Create calendar grid
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, new Date());
      const isSelected = selectedDay && isSameDay(day, selectedDay);
      const isPast = day < new Date().setHours(0, 0, 0, 0);
      const dateStr = format(day, 'yyyy-MM-dd');
      const hasAvailability = monthlyAvailability[dateStr] === true;
      const isOnLeave = isDateOnLeave(day);
      const leaveInfo = getLeaveInfo(day);
      const isClickable = !isPast && isCurrentMonth && hasAvailability && !isOnLeave;

      days.push(
        <div
          className={`
            min-h-[80px] p-2 border border-gray-100 transition-all duration-200 relative
            ${!isCurrentMonth ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : ''}
            ${isCurrentMonth && !hasAvailability && !isOnLeave ? 'text-gray-400 bg-gray-50 cursor-not-allowed' : ''}
            ${isCurrentMonth && isOnLeave ? 'text-red-600 bg-red-50 border-red-200 cursor-not-allowed' : ''}
            ${isCurrentMonth && hasAvailability && !isOnLeave ? 'text-gray-900 bg-white hover:bg-blue-50 cursor-pointer' : ''}
            ${isToday && hasAvailability && !isOnLeave ? 'bg-blue-100 border-blue-300' : ''}
            ${isToday && isOnLeave ? 'bg-red-100 border-red-300' : ''}
            ${isSelected ? 'bg-blue-500 text-white' : ''}
            ${isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
          `}
          key={day}
          onClick={() => {
            if (isClickable) {
              console.log('Calendar date clicked:', cloneDay);
              setSelectedDay(cloneDay);
              setHasClickedCalendar(true);
              const formattedDate = format(cloneDay, 'yyyy-MM-dd');
              console.log('Calling onDateSelect with:', formattedDate);
              onDateSelect(formattedDate);
            }
          }}
        >
          <span className={`
            text-sm font-medium
            ${isToday && !isSelected && hasAvailability ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}
          `}>
            {formattedDate}
          </span>
          
          {/* Availability indicators */}
          {isCurrentMonth && !isPast && (
            <div className="mt-1 space-y-1">
              {isOnLeave ? (
                <div className={`text-xs px-1 py-0.5 rounded text-center flex items-center justify-center gap-1 ${
                  isSelected ? 'bg-white text-red-500' : 'bg-red-100 text-red-700'
                }`}>
                  <CalendarX className="w-2 h-2" />
                  <span>On Leave</span>
                </div>
              ) : hasAvailability ? (
                <div className={`text-xs px-1 py-0.5 rounded text-center ${
                  isSelected ? 'bg-white text-blue-500' : 'bg-green-100 text-green-700'
                }`}>
                  Available
                </div>
              ) : (
                <div className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded text-center">
                  Unavailable
                </div>
              )}
              
              {/* Show leave reason if available */}
              {isOnLeave && leaveInfo && (
                <div className="text-xs text-red-600 px-1 py-0.5 rounded text-center bg-red-50 border border-red-200">
                  {leaveInfo.reason}
                </div>
              )}
            </div>
          )}
          
          {/* Loading indicator */}
          {loading && isCurrentMonth && !isPast && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day}>
        {days}
      </div>
    );
    days = [];
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center space-x-1">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>Click on a date first, then select your preferred time</span>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 bg-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="divide-y divide-gray-200">
        {rows}
      </div>

      {/* Time Slots Section - Show when date is selected */}
      {selectedDay && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            {isDateOnLeave(selectedDay) ? (
              <CalendarX className="w-4 h-4 text-red-600" />
            ) : (
              <Clock className="w-4 h-4 text-gray-600" />
            )}
            <h3 className="font-medium text-gray-900">
              {isDateOnLeave(selectedDay) ? 'Dentist on Leave' : 'Available times'} for {format(selectedDay, 'EEEE, MMMM d, yyyy')}
            </h3>
            {!isDateOnLeave(selectedDay) && (
              <span className="text-sm text-gray-500">
                ({dailySlots.available.length} available, {dailySlots.unavailable.length} unavailable)
              </span>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center space-x-4 mb-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-gray-600">Unavailable</span>
            </div>
          </div>
          
          {/* Show leave information if date is on leave */}
          {isDateOnLeave(selectedDay) ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CalendarX className="w-6 h-6 text-red-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-2">Dentist is on Leave</h4>
                  {(() => {
                    const leave = getLeaveInfo(selectedDay);
                    return leave ? (
                      <div className="space-y-2 text-sm text-red-800">
                        <p><span className="font-medium">Reason:</span> {leave.reason}</p>
                        <p><span className="font-medium">Duration:</span> {leave.duration_days} day{leave.duration_days > 1 ? 's' : ''}</p>
                        <p><span className="font-medium">Period:</span> {format(parseISO(leave.start_date), 'PPP')} - {format(parseISO(leave.end_date), 'PPP')}</p>
                        {leave.notes && (
                          <p><span className="font-medium">Notes:</span> {leave.notes}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-red-800">The dentist is not available on this date.</p>
                    );
                  })()}
                  <div className="mt-3 p-3 bg-red-100 rounded-md">
                    <p className="text-sm text-red-800">
                      <span className="font-medium">⚠️ No appointments available:</span> Please select a different date when the dentist is available.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (dailySlots.available.length > 0 || dailySlots.unavailable.length > 0) ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {/* Available Slots */}
              {dailySlots.available.map((slot, index) => {
                const timeSlot = typeof slot === 'string' ? slot : `${String(9 + index).padStart(2, '0')}:00`;
                const selectedDateStr = format(selectedDay, 'yyyy-MM-dd');
                const fullDateTime = `${selectedDateStr}T${timeSlot}:00.000Z`;
                
                // Convert to AM/PM format
                const [hours, minutes] = timeSlot.split(':');
                const hour24 = parseInt(hours);
                const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                const ampm = hour24 >= 12 ? 'PM' : 'AM';
                const displayTime = `${hour12}:${minutes} ${ampm}`;
                
                return (
                  <button
                    key={`available-${index}`}
                    onClick={() => {
                      if (hasClickedCalendar) {
                        console.log('Available time slot clicked:', timeSlot);
                        onTimeSelect(fullDateTime);
                      }
                    }}
                    disabled={!hasClickedCalendar}
                    className={`px-3 py-2 text-sm border rounded-md transition-colors text-center font-medium ${
                      hasClickedCalendar 
                        ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-500 hover:bg-green-100 cursor-pointer' 
                        : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                    title={!hasClickedCalendar ? 'Please select a date first' : ''}
                  >
                    {displayTime}
                  </button>
                );
              })}
              
              {/* Unavailable Slots */}
              {dailySlots.unavailable.map((slot, index) => {
                const timeSlot = typeof slot === 'string' ? slot : `${String(9 + index).padStart(2, '0')}:00`;
                
                // Convert to AM/PM format
                const [hours, minutes] = timeSlot.split(':');
                const hour24 = parseInt(hours);
                const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                const ampm = hour24 >= 12 ? 'PM' : 'AM';
                const displayTime = `${hour12}:${minutes} ${ampm}`;
                
                return (
                  <div
                    key={`unavailable-${index}`}
                    className="px-3 py-2 text-sm border border-red-300 bg-red-50 text-red-500 rounded-md text-center font-medium cursor-not-allowed opacity-75"
                    title="This time slot is already booked"
                  >
                    {displayTime}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">
                {loading ? 'Loading time slots...' : 'No time slots available for this date'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? 'Please wait while we fetch availability' : 'Please select a different date'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Message when no date selected */}
      {!selectedDay && (
        <div className="border-t border-gray-200 p-4 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500 text-sm">Click on an available date to view and select time slots</p>
          <p className="text-xs text-gray-400 mt-1">Green dates have available appointments</p>
        </div>
      )}

      {/* Message when date selected but no slots */}
      {selectedDay && availableSlots.length === 0 && (
        <div className="border-t border-gray-200 p-4 text-center">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500 text-sm">No available time slots for {format(selectedDay, 'EEEE, MMMM d, yyyy')}</p>
          <p className="text-xs text-gray-400 mt-1">Please select another date</p>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-600 flex-wrap">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
            <span>On Leave</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-100 rounded"></div>
            <span>Unavailable</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span>Past Dates</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarView;
