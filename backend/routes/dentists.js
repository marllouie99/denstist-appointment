import express from 'express';
import multer from 'multer';
import path from 'path';
import { supabase } from '../services/supabase.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Get all dentists with their profiles and availability
router.get('/', async (req, res) => {
  try {
    console.log('Fetching dentists from database...');
    
    // First, get all users with dentist role
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, avatar_url, profile_image')
      .eq('role', 'dentist');
      
    console.log('Raw users query result:', { users, usersError });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return res.status(400).json({ error: usersError.message });
    }

    if (!users || users.length === 0) {
      console.log('No dentists found in users table');
      return res.json({ dentists: [] });
    }

    // Get all dentist profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('dentist_profile')
      .select('*');

    if (profilesError) {
      console.error('Error fetching dentist profiles:', profilesError);
      // Continue with empty profiles if there's an error
    }

    // Combine user data with their profiles
    const dentists = users.map(user => {
      const profile = profiles?.find(p => p.dentist_id === user.id) || {};
      return {
        id: user.id, // This is the UUID that should be used for booking
        dentist_id: user.id, // Also include as dentist_id for clarity
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url || profile.avatar_url || null,
        profile_image: user.profile_image || null,
        specialization: profile.specialization || 'General Dentistry',
        qualifications: profile.qualifications || 'DDS',
        availability: profile.availability || {},
        bio: profile.bio || 'Experienced dental professional',
        years_of_experience: profile.years_of_experience || 5,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    });

    console.log(`Successfully fetched ${dentists.length} dentists`);
    res.json({ dentists });
  } catch (error) {
    console.error('Get dentists error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dentists',
      details: error.message 
    });
  }
});

// Get dentist by ID
router.get('/:id', async (req, res) => {
  try {
    const dentistId = req.params.id;

    const { data: dentist, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        created_at,
        avatar_url,
        profile_image,
        dentist_profile:dentist_profile(
          specialization,
          qualifications,
          availability,
          bio,
          years_of_experience
        )
      `)
      .eq('id', dentistId)
      .eq('role', 'dentist')
      .single();

    if (error || !dentist) {
      return res.status(404).json({ error: 'Dentist not found' });
    }

    res.json({ dentist });
  } catch (error) {
    console.error('Get dentist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dentist profile
router.put('/profile', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    const { specialization, qualifications, availability, bio, years_of_experience } = req.body;

    // Update dentist profile
    const { data: profile, error } = await supabase
      .from('dentist_profile')
      .update({
        specialization,
        qualifications,
        availability,
        bio,
        years_of_experience
      })
      .eq('dentist_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Profile updated successfully',
      profile
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dentist's appointments
router.get('/appointments/my', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:users!patient_id(id, full_name, email, phone),
        service:services!service_id(id, name, price)
      `)
      .eq('dentist_id', req.user.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: appointments, error } = await query.order('appointment_time', { ascending: true });

    if (error) {
      console.error('Appointments query error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Appointments with patient data:', appointments.map(a => ({
      id: a.id,
      patient: a.patient,
      service: a.service
    })));

    res.json({ appointments });
  } catch (error) {
    console.error('Get dentist appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dentist's availability with detailed time slots
router.get('/:id/availability', async (req, res) => {
  try {
    const dentistId = req.params.id;
    const { date } = req.query; // Format: YYYY-MM-DD

    console.log(`🔍 [AVAILABILITY] Fetching availability for dentist ${dentistId} on ${date}`);

    // Validate inputs
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    if (!dentistId) {
      return res.status(400).json({ error: 'Dentist ID is required' });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if date is in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestedDate < today) {
      return res.json({
        date,
        available_slots: [],
        unavailable_slots: [],
        booked_slots: [],
        message: 'Past dates are not available for booking'
      });
    }

    // Temporary fix: If dentist ID is "1" or "2", return sample availability
    if (dentistId === '1' || dentistId === '2') {
      console.log(`⚠️ [AVAILABILITY] Using temporary fix for dentist ID "${dentistId}"`);
      
      const sampleSlots = generateTimeSlots();
      const randomlyBookedSlots = sampleSlots.filter(() => Math.random() > 0.7); // Randomly book some slots for demo
      const availableSlots = sampleSlots.filter(slot => !randomlyBookedSlots.includes(slot));
      
      return res.json({ 
        date,
        available_slots: availableSlots,
        unavailable_slots: randomlyBookedSlots,
        booked_slots: randomlyBookedSlots,
        message: `Sample availability for dentist ID "${dentistId}"`
      });
    }

    // Get dentist profile and availability settings
    const { data: dentistProfile, error: profileError } = await supabase
      .from('dentist_profile')
      .select('availability')
      .eq('dentist_id', dentistId)
      .single();

    if (profileError) {
      console.error('❌ [AVAILABILITY] Error fetching dentist profile:', profileError);
      return res.status(404).json({ error: 'Dentist not found' });
    }

    // Check if dentist is available on this day of the week
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(); // mon, tue, wed, etc.
    const dayAvailability = dentistProfile?.availability?.[dayOfWeek];
    
    if (!dayAvailability || !dayAvailability.available) {
      console.log(`📅 [AVAILABILITY] Dentist not available on ${dayOfWeek}s`);
      return res.json({
        date,
        available_slots: [],
        unavailable_slots: [],
        booked_slots: [],
        message: `Dentist is not available on ${dayOfWeek}s`
      });
    }

    // Get existing appointments for the date
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('appointment_time, status')
      .eq('dentist_id', dentistId)
      .gte('appointment_time', startOfDay.toISOString())
      .lte('appointment_time', endOfDay.toISOString())
      .in('status', ['pending', 'approved', 'completed']);

    if (appointmentsError) {
      console.error('❌ [AVAILABILITY] Error fetching appointments:', appointmentsError);
      return res.status(400).json({ error: appointmentsError.message });
    }

    console.log(`📋 [AVAILABILITY] Found ${appointments?.length || 0} existing appointments`);

    // Generate all possible time slots based on dentist's working hours
    const workingHours = dayAvailability.hours || { start: '09:00', end: '17:00' };
    const allTimeSlots = generateTimeSlotsForDay(workingHours.start, workingHours.end);
    
    // Get booked time slots
    const bookedSlots = appointments?.map(apt => {
      const appointmentTime = new Date(apt.appointment_time);
      return appointmentTime.toTimeString().substring(0, 5); // Format: HH:MM
    }) || [];

    // Calculate available and unavailable slots
    const availableSlots = allTimeSlots.filter(slot => !bookedSlots.includes(slot));
    const unavailableSlots = allTimeSlots.filter(slot => bookedSlots.includes(slot));

    const response = {
      date,
      available_slots: availableSlots,
      unavailable_slots: unavailableSlots,
      booked_slots: bookedSlots,
      dentist_working_hours: workingHours,
      total_slots: allTimeSlots.length,
      available_count: availableSlots.length,
      booked_count: bookedSlots.length
    };

    console.log(`✅ [AVAILABILITY] Returning ${availableSlots.length} available slots out of ${allTimeSlots.length} total slots`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ [AVAILABILITY] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate time slots for a day
function generateTimeSlotsForDay(startTime, endTime, slotDuration = 60) {
  const slots = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMinute = startMinute;
  
  while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
    const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push(timeSlot);
    
    // Add slot duration (default 60 minutes)
    currentMinute += slotDuration;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }
  
  return slots;
}

// Helper function to generate default time slots
function generateTimeSlots() {
  return [
    '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00'
  ];
}

// Get dentist's payment history
router.get('/payments/history', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    console.log('🔍 [PAYMENTS] Fetching payment history for dentist:', req.user.id);
    
    // First, get appointments for this dentist
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id')
      .eq('dentist_id', req.user.id);

    if (appointmentsError) {
      console.error('❌ [PAYMENTS] Error fetching dentist appointments:', appointmentsError);
      return res.status(400).json({ error: appointmentsError.message });
    }

    const appointmentIds = appointments.map(apt => apt.id);
    console.log('🔍 [PAYMENTS] Found appointment IDs for dentist:', appointmentIds);

    if (appointmentIds.length === 0) {
      console.log('📝 [PAYMENTS] No appointments found for dentist, returning empty payments');
      return res.json({ payments: [] });
    }

    // Now get payments for these appointments with patient and service data
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        appointment:appointments!appointment_id(
          id,
          dentist_id,
          appointment_time,
          status,
          patient:users!patient_id(id, full_name, email, phone),
          service:services!service_id(id, name, price)
        )
      `)
      .in('appointment_id', appointmentIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Payment query error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Additional security check: verify all payments belong to this dentist
    const validPayments = payments.filter(payment => {
      if (!payment.appointment || payment.appointment.dentist_id !== req.user.id) {
        console.warn('🚨 [SECURITY] Filtered out payment that doesn\'t belong to dentist:', {
          paymentId: payment.id,
          appointmentDentistId: payment.appointment?.dentist_id,
          requestingDentistId: req.user.id
        });
        return false;
      }
      return true;
    });

    console.log('✅ [PAYMENTS] Returning', validPayments.length, 'validated payments for dentist:', req.user.id);
    console.log('🔍 [PAYMENTS] Payment details:', validPayments.map(p => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      appointmentId: p.appointment?.id,
      patientName: p.appointment?.patient?.full_name
    })));

    res.json({ payments: validPayments });
  } catch (error) {
    console.error('Get dentist payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload avatar (dentist)
router.post('/upload-avatar', authenticateToken, requireRole(['dentist']), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = `avatar_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    
    // For now, let's use a simple approach without Supabase Storage
    // Convert image to base64 and store directly in database
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    console.log('Processing image upload for user:', req.user.id);
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Update user's avatar_url in the users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: base64Image })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Update user error:', updateError);
      return res.status(400).json({ error: 'Failed to update profile' });
    }

    // Also update dentist_profile table if it exists
    const { error: profileUpdateError } = await supabase
      .from('dentist_profile')
      .update({ avatar_url: base64Image })
      .eq('dentist_id', req.user.id);

    // Don't fail if dentist_profile doesn't exist yet
    if (profileUpdateError) {
      console.log('Dentist profile update note:', profileUpdateError.message);
    }

    console.log('Avatar updated successfully for user:', req.user.id);

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatar_url: base64Image 
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve appointment (dentist)
router.patch('/appointments/:id/approve', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Get appointment details
    const { data: appointment, error: getError } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `)
      .eq('id', appointmentId)
      .eq('dentist_id', req.user.id)
      .single();

    if (getError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update appointment status
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ status: 'approved' })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Appointment approved successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Approve appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject appointment (dentist)
router.patch('/appointments/:id/reject', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { reason } = req.body;

    // Get appointment details
    const { data: appointment, error: getError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('dentist_id', req.user.id)
      .single();

    if (getError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update appointment status
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update({ 
        status: 'rejected',
        rejection_reason: reason || 'No reason provided'
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Appointment rejected successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dentist availability
router.put('/availability', authenticateToken, requireRole(['dentist']), async (req, res) => {
  try {
    const { availability } = req.body;
    
    // Validate availability format
    if (!availability || typeof availability !== 'object') {
      return res.status(400).json({ error: 'Valid availability data required' });
    }

    // Update dentist profile with new availability
    const { data: profile, error } = await supabase
      .from('dentist_profile')
      .update({ availability })
      .eq('dentist_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: 'Availability updated successfully',
      availability: profile.availability 
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available time slots for a dentist
router.get('/:id/available-slots', async (req, res) => {
  try {
    const dentistId = req.params.id;
    const { date, service_id } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    // Get dentist availability
    const { data: dentist, error: dentistError } = await supabase
      .from('dentist_profile')
      .select('availability')
      .eq('dentist_id', dentistId)
      .single();

    if (dentistError || !dentist) {
      return res.status(404).json({ error: 'Dentist not found' });
    }

    // Get service duration if service_id provided
    let serviceDuration = 60; // default
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration')
        .eq('id', service_id)
        .single();
      
      if (service) {
        serviceDuration = service.duration;
      }
    }

    // Get existing appointments for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: appointments } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('dentist_id', dentistId)
      .gte('appointment_time', startOfDay.toISOString())
      .lte('appointment_time', endOfDay.toISOString())
      .in('status', ['approved', 'pending']);

    // Calculate available slots based on availability and existing appointments
    const availableSlots = calculateAvailableSlots(
      dentist.availability,
      date,
      appointments || [],
      serviceDuration
    );

    res.json({ availableSlots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate available time slots
function calculateAvailableSlots(availability, date, existingAppointments, duration) {
  const dayOfWeek = new Date(date).toLocaleLowerCase().substring(0, 3); // mon, tue, etc.
  const dayAvailability = availability?.[dayOfWeek];
  
  if (!dayAvailability || !dayAvailability.available) {
    return [];
  }

  const slots = [];
  const { start, end } = dayAvailability;
  
  // Generate 30-minute slots between start and end times
  const startTime = new Date(`${date}T${start}`);
  const endTime = new Date(`${date}T${end}`);
  
  const current = new Date(startTime);
  
  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + duration * 60000);
    
    if (slotEnd <= endTime) {
      // Check if slot conflicts with existing appointments
      const hasConflict = existingAppointments.some(apt => {
        const aptTime = new Date(apt.appointment_time);
        const aptEnd = new Date(aptTime.getTime() + duration * 60000);
        
        return (current < aptEnd && slotEnd > aptTime);
      });
      
      if (!hasConflict) {
        slots.push({
          time: current.toTimeString().substring(0, 5),
          datetime: current.toISOString()
        });
      }
    }
    
    current.setMinutes(current.getMinutes() + 30);
  }
  
  return slots;
}

export default router;
