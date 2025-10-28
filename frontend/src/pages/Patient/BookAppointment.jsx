import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dentistsAPI, servicesAPI, appointmentsAPI } from '../../lib/api';
import { Calendar, Clock, User, Coins } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import GoogleCalendarView from '../../components/GoogleCalendarView';
import { formatPHPCurrencyCompact } from '../../utils/currency';

const BookAppointment = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [dentists, setDentists] = useState([]);
  const [services, setServices] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    dentist_id: '',
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      console.log('Fetching initial data...');
      
      // Fetch dentists and services in parallel
      const [dentistsRes, servicesRes] = await Promise.all([
        dentistsAPI.getAll().catch(err => {
          console.error('Error fetching dentists:', err);
          return { data: { dentists: [] } };
        }),
        servicesAPI.getAll().catch(err => {
          console.error('Error fetching services:', err);
          return { data: { services: [] } };
        })
      ]);
      
      // Log the raw response for debugging
      console.log('Dentists API Response:', dentistsRes);
      
      // Process dentists data
      const dentistsData = dentistsRes.data?.dentists || [];
      console.log(`Found ${dentistsData.length} dentists`);
      
      // Ensure we have valid dentist data
      if (dentistsData.length === 0) {
        console.warn('No dentists found in the response');
        toast.error('No dentists available at the moment. Please try again later.');
      } else {
        console.log('Sample dentist data:', dentistsData[0]);
        console.log('All dentist IDs:', dentistsData.map(d => ({ id: d.id, type: typeof d.id, name: d.full_name })));
        console.log('Raw dentist data:', JSON.stringify(dentistsData, null, 2));
      }
      
      setDentists(dentistsData);
      setServices(servicesRes.data?.services || []);
      
    } catch (error) {
      console.error('Error in fetchInitialData:', error);
      toast.error('Failed to load required data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async (dentistId, date) => {
    try {
      setLoading(true);
      console.log('fetchAvailability called with:', { 
        dentistId, 
        date, 
        formData: formData,
        selectedDentist: dentists.find(d => d.id === formData.dentist_id)
      });
      
      if (!dentistId || dentistId === '') {
        console.error('Invalid dentist ID:', dentistId);
        toast.error('Please select a dentist first');
        return;
      }

      const response = await dentistsAPI.getAvailability(dentistId, date);
      console.log('Availability API response:', response);
      console.log('Available slots from API:', response.data.available_slots);
      
      const slots = response.data.available_slots || [];
      console.log('Setting available slots:', slots);
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to load availability');
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDentistSelect = (dentistId) => {
    setFormData({ ...formData, dentist_id: dentistId });
    setStep(2);
  };

  const handleServiceSelect = (serviceId) => {
    setFormData({ ...formData, service_id: serviceId });
    setStep(3);
  };

  const handleDateSelect = (date) => {
    console.log('handleDateSelect called with:', date);
    console.log('Current formData:', formData);
    
    setFormData({ ...formData, appointment_date: date });
    
    // Only fetch availability if a dentist has been selected
    if (formData.dentist_id) {
      console.log('Fetching availability for dentist:', formData.dentist_id, 'date:', date);
      fetchAvailability(formData.dentist_id, date);
      // Don't change step - let user select time in the same view
    } else {
      console.warn('No dentist selected, cannot fetch availability');
      toast.error('Please select a dentist first');
    }
  };

  const handleTimeSelect = (time) => {
    console.log('handleTimeSelect called with:', time);
    console.log('Setting appointment_time and moving to step 4');
    
    setFormData({ ...formData, appointment_time: time });
    setStep(4);
    
    toast.success('Time selected! Proceeding to confirmation.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.appointment_time) {
      toast.error('Please select a date and time');
      return;
    }

    // Debug authentication
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    console.log('Authentication check:');
    console.log('Token exists:', !!token);
    console.log('User exists:', !!user);
    console.log('User data:', user ? JSON.parse(user) : null);
    
    try {
      setLoading(true);
      const appointmentData = {
        dentist_id: formData.dentist_id,
        service_id: parseInt(formData.service_id),
        appointment_time: formData.appointment_time,
        notes: formData.notes
      };

      console.log('Booking appointment with data:', appointmentData);
      console.log('API endpoint will be: http://localhost:5000/api/appointments/book');
      
      // Test direct fetch to see if it's an axios issue
      try {
        const token = localStorage.getItem('access_token');
        console.log('Making direct fetch request...');
        
        const directResponse = await fetch('http://localhost:5000/api/appointments/book', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(appointmentData)
        });
        
        console.log('Direct fetch response status:', directResponse.status);
        console.log('Direct fetch response headers:', directResponse.headers);
        
        if (directResponse.ok) {
          const data = await directResponse.json();
          console.log('Direct fetch success:', data);
          toast.success('Appointment booked successfully!');
          navigate('/patient/dashboard');
          return;
        } else {
          const errorData = await directResponse.json();
          console.log('Direct fetch error:', errorData);
        }
      } catch (fetchError) {
        console.error('Direct fetch failed:', fetchError);
      }
      
      // Fallback to original axios call
      const response = await appointmentsAPI.book(appointmentData);
      console.log('Booking response:', response);
      
      if (response.data) {
        toast.success('Appointment booked successfully!');
        navigate('/patient/dashboard');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      const message = error.response?.data?.error || 'Failed to book appointment';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const selectedDentist = dentists.find(d => d.id === formData.dentist_id);
  const selectedService = services.find(s => s.id === parseInt(formData.service_id));

  // Generate next 14 days for date selection
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), i + 1);
    return date.toISOString().split('T')[0];
  });

  if (loading && step === 1) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Book an Appointment</h1>
        <p className="text-gray-600 mt-2">Choose your dentist, service, and preferred time</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNum ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNum}
              </div>
              {stepNum < 4 && (
                <div className={`w-12 h-0.5 ${step > stepNum ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card p-8">
        {/* Step 1: Select Dentist */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center justify-center mb-3">
                <User className="w-6 h-6 mr-2" />
                Select a Dentist
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Choose from our qualified dentists. Each dentist has their own specialization and availability. 
                Click on a dentist to proceed with booking your appointment.
              </p>
            </div>
            
            {dentists.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Dentists Available</h3>
                <p className="text-gray-600">Please check back later or contact support.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
                {dentists.map((dentist) => {
                  const profile = dentist.dentist_profile?.[0] || {};
                  const specialization = profile.specialization || dentist.specialization || 'General Dentist';
                  const qualifications = profile.qualifications || dentist.qualifications || 'DDS';
                  const yearsOfExperience = profile.years_of_experience || dentist.years_of_experience || '5';
                  
                  return (
                    <div
                      key={dentist.id}
                      onClick={() => handleDentistSelect(dentist.id)}
                      className={`border rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                        formData.dentist_id === dentist.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-start space-x-5">
                        {/* Dentist Avatar */}
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold">
                          {dentist.full_name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </div>
                        
                        {/* Dentist Info */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">
                              Dr. {dentist.full_name}
                            </h3>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {specialization}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {dentist.bio || 'Experienced dental professional'}
                          </p>
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {qualifications.split(',').map((qual, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {qual.trim()}
                              </span>
                            ))}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center text-sm text-gray-500">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                              </svg>
                              {yearsOfExperience} years experience
                            </div>
                            
                            <button 
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                formData.dentist_id === dentist.id 
                                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                  : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDentistSelect(dentist.id);
                              }}
                            >
                              {formData.dentist_id === dentist.id ? 'Selected ✓' : 'Select'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Service */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                <Coins className="w-6 h-6 mr-2" />
                Select a Service
              </h2>
              <button
                onClick={() => setStep(1)}
                className="btn btn-secondary"
              >
                Back
              </button>
            </div>

            <div className="space-y-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      <p className="text-gray-600 mt-1">{service.description}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Duration: {service.duration || 60} minutes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{formatPHPCurrencyCompact(service.price)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Select Date & Time with Google Calendar View */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                <Calendar className="w-6 h-6 mr-2" />
                Select Date & Time
              </h2>
              <button
                onClick={() => setStep(2)}
                className="btn btn-secondary"
              >
                Back
              </button>
            </div>

            <GoogleCalendarView
              onDateSelect={handleDateSelect}
              selectedDate={formData.appointment_date ? new Date(formData.appointment_date) : null}
              availableSlots={availableSlots}
              onTimeSelect={handleTimeSelect}
              dentistId={formData.dentist_id}
            />
            
          </div>
        )}


        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                Confirm Your Appointment
              </h2>
              <button
                onClick={() => setStep(3)}
                className="btn btn-secondary"
              >
                Back
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Appointment Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Dentist:</span> Dr. {selectedDentist?.full_name}</p>
                    <p><span className="font-medium">Service:</span> {selectedService?.name}</p>
                    <p><span className="font-medium">Date:</span> {format(new Date(formData.appointment_date), 'PPPP')}</p>
                    <p><span className="font-medium">Time:</span> {
                      formData.appointment_time && !isNaN(new Date(formData.appointment_time)) 
                        ? format(new Date(formData.appointment_time), 'h:mm a')
                        : 'Invalid time'
                    }</p>
                    <p><span className="font-medium">Duration:</span> {selectedService?.duration || 60} minutes</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Cost</h3>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPHPCurrencyCompact(selectedService?.price)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Payment will be required after dentist approval
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="appointment-notes" className="label">Additional Notes (Optional)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Any specific concerns or requests..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  autoComplete="off"
                  name="notes"
                  id="appointment-notes"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => navigate('/patient/dashboard')}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookAppointment;
