import express from 'express';
import { supabase, supabaseAdmin } from '../services/supabase.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('🔍 [ADMIN USERS] GET /admin/users endpoint called:', {
    timestamp: new Date().toISOString(),
    queryParams: req.query,
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    const { role, status } = req.query;

    console.log('🔍 [ADMIN USERS] Building Supabase query with filters:', {
      roleFilter: role,
      statusFilter: status,
      hasRoleFilter: !!role,
      hasStatusFilter: !!status
    });

    let query = supabaseAdmin
      .from('users')
      .select(`
        *,
        dentist_profile:dentist_profile(specialization, qualifications)
      `);

    if (role) {
      console.log('🔍 [ADMIN USERS] Applying role filter:', role);
      query = query.eq('role', role);
    }

    console.log('🔍 [ADMIN USERS] Executing Supabase query...');
    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [ADMIN USERS] Supabase query error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        queryFilters: { role, status }
      });
      return res.status(400).json({ error: error.message });
    }

    console.log('✅ [ADMIN USERS] Query successful, processing results:', {
      totalUsers: users?.length || 0,
      userBreakdown: {
        patients: users?.filter(u => u.role === 'patient').length || 0,
        dentists: users?.filter(u => u.role === 'dentist').length || 0,
        admins: users?.filter(u => u.role === 'admin').length || 0
      },
      activeUsers: users?.filter(u => u.is_active).length || 0,
      inactiveUsers: users?.filter(u => !u.is_active).length || 0,
      sampleUserData: users?.slice(0, 3).map(u => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at
      })) || []
    });

    // Specifically log patient data for debugging
    const patients = users?.filter(u => u.role === 'patient') || [];
    console.log('👥 [ADMIN USERS] Patient-specific data analysis:', {
      totalPatients: patients.length,
      activePatients: patients.filter(p => p.is_active).length,
      inactivePatients: patients.filter(p => !p.is_active).length,
      patientsWithNames: patients.filter(p => p.full_name).length,
      patientsWithEmails: patients.filter(p => p.email).length,
      patientSample: patients.slice(0, 5).map(p => ({
        id: p.id,
        full_name: p.full_name || 'NO_NAME',
        email: p.email || 'NO_EMAIL',
        is_active: p.is_active,
        created_at: p.created_at,
        phone: p.phone || 'NO_PHONE'
      }))
    });

    res.json({ users });
  } catch (error) {
    console.error('❌ [ADMIN USERS] Unexpected error in GET /admin/users:', {
      error: error.message,
      stack: error.stack,
      queryParams: req.query,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('🗑️ [ADMIN DELETE USER] DELETE /admin/users/:id endpoint called:', {
    userId: req.params.id,
    timestamp: new Date().toISOString(),
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('🔍 [ADMIN DELETE USER] Checking if user exists...');
    
    // First check if user exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role')
      .eq('id', id)
      .single();

    if (checkError || !existingUser) {
      console.error('❌ [ADMIN DELETE USER] User not found:', {
        userId: id,
        error: checkError?.message
      });
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ [ADMIN DELETE USER] User found, proceeding with deletion:', {
      userId: id,
      userName: existingUser.full_name,
      userEmail: existingUser.email,
      userRole: existingUser.role
    });

    // Delete user from database
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ [ADMIN DELETE USER] Supabase delete error:', {
        error: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code
      });
      return res.status(400).json({ error: 'Failed to delete user' });
    }

    console.log('✅ [ADMIN DELETE USER] User deleted successfully:', {
      userId: id,
      userName: existingUser.full_name,
      userEmail: existingUser.email,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: 'User deleted successfully',
      deleted_user: {
        id: existingUser.id,
        full_name: existingUser.full_name,
        email: existingUser.email,
        role: existingUser.role
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN DELETE USER] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error while deleting user' });
  }
});

// Activate/Deactivate user
router.patch('/users/:id/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('🔧 Backend - PATCH /users/:id/status called:', {
    userId: req.params.id,
    userIdType: typeof req.params.id,
    requestBody: req.body,
    bodyType: typeof req.body,
    hasIsActive: req.body.hasOwnProperty('is_active'),
    isActiveValue: req.body.is_active,
    isActiveType: typeof req.body.is_active,
    headers: {
      contentType: req.headers['content-type'],
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    },
    timestamp: new Date().toISOString()
  });

  try {
    const userId = req.params.id;
    const { is_active } = req.body;

    // Validate inputs
    if (!userId) {
      console.error('❌ Backend - Missing userId parameter');
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (typeof is_active !== 'boolean') {
      console.error('❌ Backend - Invalid is_active type:', {
        received: is_active,
        type: typeof is_active,
        expected: 'boolean'
      });
      return res.status(400).json({ error: 'is_active must be a boolean value' });
    }

    console.log('✅ Backend - Input validation passed, updating user in database');

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ is_active })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Backend - Supabase error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId,
        is_active
      });
      return res.status(400).json({ error: error.message });
    }

    if (!user) {
      console.error('❌ Backend - User not found:', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ Backend - User status updated successfully:', {
      userId,
      oldStatus: user.is_active !== is_active ? !is_active : 'unknown',
      newStatus: is_active,
      user: { id: user.id, email: user.email, is_active: user.is_active }
    });

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('❌ Backend - Update user status error:', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id,
      requestBody: req.body,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all services
router.get('/services', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data: services, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create service
router.post('/services', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, price, duration } = req.body;

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .insert([{
        name,
        description,
        price,
        duration
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service
router.put('/services/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { name, description, price, duration } = req.body;

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .update({
        name,
        description,
        price,
        duration
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service
router.delete('/services/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const serviceId = req.params.id;

    const { error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all appointments (admin view)
router.get('/appointments', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { status, date_from, date_to } = req.query;

    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name, email),
        dentist:users!appointments_dentist_id_fkey(id, full_name, email),
        service:services(id, name, price)
      `);

    if (status) {
      query = query.eq('status', status);
    }

    if (date_from) {
      query = query.gte('appointment_time', date_from);
    }

    if (date_to) {
      query = query.lte('appointment_time', date_to);
    }

    const { data: appointments, error } = await query.order('appointment_time', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ appointments });
  } catch (error) {
    console.error('Get admin appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Override appointment decision
router.patch('/appointments/:id/override', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { status, reason } = req.body;

    const updateData = {
      status,
      admin_override: true,
      admin_override_reason: reason || 'Admin override'
    };

    // If status is rejected, also set the rejection_reason
    if (status === 'rejected' && reason) {
      updateData.rejection_reason = reason;
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Appointment status overridden successfully',
      appointment
    });
  } catch (error) {
    console.error('Override appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('📊 [ADMIN STATS] GET /admin/dashboard/stats endpoint called:', {
    timestamp: new Date().toISOString(),
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    console.log('📊 [ADMIN STATS] Fetching user statistics...');
    // Get user counts
    const { data: userStats, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .neq('role', 'admin');

    if (userError) {
      console.error('❌ [ADMIN STATS] Error fetching user stats:', userError);
    } else {
      console.log('✅ [ADMIN STATS] User stats fetched:', {
        totalUsers: userStats?.length || 0,
        breakdown: {
          patients: userStats?.filter(u => u.role === 'patient').length || 0,
          dentists: userStats?.filter(u => u.role === 'dentist').length || 0,
          others: userStats?.filter(u => u.role !== 'patient' && u.role !== 'dentist').length || 0
        }
      });
    }

    console.log('📊 [ADMIN STATS] Fetching appointment statistics...');
    // Get appointment stats
    const { data: appointmentStats, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('status, payment_status');

    if (appointmentError) {
      console.error('❌ [ADMIN STATS] Error fetching appointment stats:', appointmentError);
    } else {
      console.log('✅ [ADMIN STATS] Appointment stats fetched:', {
        totalAppointments: appointmentStats?.length || 0,
        statusBreakdown: {
          pending: appointmentStats?.filter(a => a.status === 'pending').length || 0,
          approved: appointmentStats?.filter(a => a.status === 'approved').length || 0,
          rejected: appointmentStats?.filter(a => a.status === 'rejected').length || 0,
          cancelled: appointmentStats?.filter(a => a.status === 'cancelled').length || 0
        }
      });
    }

    console.log('📊 [ADMIN STATS] Fetching revenue statistics...');
    // Get revenue stats
    const { data: revenueStats, error: revenueError } = await supabaseAdmin
      .from('payments')
      .select('amount, status')
      .eq('status', 'completed');

    if (revenueError) {
      console.error('❌ [ADMIN STATS] Error fetching revenue stats:', revenueError);
    } else {
      console.log('✅ [ADMIN STATS] Revenue stats fetched:', {
        totalTransactions: revenueStats?.length || 0,
        totalRevenue: revenueStats?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0
      });
    }

    // Process statistics
    const stats = {
      users: {
        total: userStats?.length || 0,
        patients: userStats?.filter(u => u.role === 'patient').length || 0,
        dentists: userStats?.filter(u => u.role === 'dentist').length || 0
      },
      appointments: {
        total: appointmentStats?.length || 0,
        pending: appointmentStats?.filter(a => a.status === 'pending').length || 0,
        approved: appointmentStats?.filter(a => a.status === 'approved').length || 0,
        rejected: appointmentStats?.filter(a => a.status === 'rejected').length || 0,
        cancelled: appointmentStats?.filter(a => a.status === 'cancelled').length || 0
      },
      revenue: {
        total: revenueStats?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0,
        transactions: revenueStats?.length || 0
      }
    };

    console.log('📊 [ADMIN STATS] Final processed statistics:', {
      stats,
      timestamp: new Date().toISOString()
    });

    res.json({ stats });
  } catch (error) {
    console.error('❌ [ADMIN STATS] Unexpected error in GET /admin/dashboard/stats:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get revenue report
router.get('/reports/revenue', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { date_from, date_to, dentist_id } = req.query;

    let query = supabase
      .from('payments')
      .select(`
        *,
        appointment:appointments(
          id,
          appointment_time,
          dentist:users!appointments_dentist_id_fkey(full_name),
          patient:users!appointments_patient_id_fkey(full_name),
          service:services(name)
        )
      `)
      .eq('status', 'completed');

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    if (dentist_id) {
      query = query.eq('appointment.dentist_id', dentist_id);
    }

    const { data: payments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const totalRevenue = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    res.json({
      payments,
      summary: {
        total_revenue: totalRevenue,
        total_transactions: payments.length,
        period: { date_from, date_to }
      }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dentist revenue analytics
router.get('/analytics/dentist-revenue', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('📊 [DENTIST REVENUE] GET /admin/analytics/dentist-revenue endpoint called:', {
    timestamp: new Date().toISOString(),
    queryParams: req.query,
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    const { period = 'all', dentist_id } = req.query;

    // Calculate date ranges based on period
    const now = new Date();
    let dateFilter = null;

    switch (period) {
      case 'today':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'this_month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case 'this_year':
        dateFilter = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
      default:
        dateFilter = null; // All time
    }

    console.log('📊 [DENTIST REVENUE] Calculated date filter:', {
      period,
      dateFilter,
      currentDate: now.toISOString()
    });

    // Build query for payments with appointment and dentist details
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        appointment:appointments!appointment_id(
          id,
          appointment_time,
          dentist_id,
          patient_id,
          service_id,
          dentist:users!dentist_id(
            id,
            full_name,
            email
          ),
          patient:users!patient_id(
            id,
            full_name,
            email
          ),
          service:services!service_id(
            id,
            name,
            price
          )
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    // Apply date filter if specified
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    console.log('📡 [DENTIST REVENUE] Executing payments query...');
    const { data: payments, error } = await query;

    if (error) {
      console.error('❌ [DENTIST REVENUE] Payments query error:', error);
      return res.status(400).json({ error: 'Failed to fetch payment data' });
    }

    console.log('✅ [DENTIST REVENUE] Payments query successful:', {
      totalPayments: payments?.length || 0,
      period,
      dateFilter
    });

    // Group revenue by dentist
    const dentistRevenue = {};
    const dentistStats = {};

    payments.forEach(payment => {
      const appointment = payment.appointment;
      if (!appointment || !appointment.dentist) return;

      const dentistId = appointment.dentist.id;
      const dentistName = appointment.dentist.full_name;
      const amount = parseFloat(payment.amount) || 0;

      if (!dentistRevenue[dentistId]) {
        dentistRevenue[dentistId] = {
          dentist_id: dentistId,
          dentist_name: dentistName,
          dentist_email: appointment.dentist.email,
          total_revenue: 0,
          total_transactions: 0,
          services: {},
          patients: new Set(),
          recent_payments: []
        };
      }

      dentistRevenue[dentistId].total_revenue += amount;
      dentistRevenue[dentistId].total_transactions += 1;
      dentistRevenue[dentistId].patients.add(appointment.patient?.id);

      // Track service revenue for this dentist
      const serviceName = appointment.service?.name || 'Unknown Service';
      if (!dentistRevenue[dentistId].services[serviceName]) {
        dentistRevenue[dentistId].services[serviceName] = {
          revenue: 0,
          count: 0
        };
      }
      dentistRevenue[dentistId].services[serviceName].revenue += amount;
      dentistRevenue[dentistId].services[serviceName].count += 1;

      // Add to recent payments (limit to 5 per dentist)
      if (dentistRevenue[dentistId].recent_payments.length < 5) {
        dentistRevenue[dentistId].recent_payments.push({
          id: payment.id,
          amount: payment.amount,
          created_at: payment.created_at,
          patient_name: appointment.patient?.full_name || 'Unknown',
          service_name: serviceName
        });
      }
    });

    // Convert Set to count for patients
    Object.values(dentistRevenue).forEach(dentist => {
      dentist.unique_patients = dentist.patients.size;
      delete dentist.patients; // Remove Set object for JSON serialization
    });

    // Sort dentists by revenue (highest first)
    const sortedDentists = Object.values(dentistRevenue).sort((a, b) => b.total_revenue - a.total_revenue);

    // Calculate overall statistics
    const totalRevenue = sortedDentists.reduce((sum, dentist) => sum + dentist.total_revenue, 0);
    const totalTransactions = sortedDentists.reduce((sum, dentist) => sum + dentist.total_transactions, 0);

    console.log('📊 [DENTIST REVENUE] Processed dentist revenue data:', {
      totalDentists: sortedDentists.length,
      totalRevenue,
      totalTransactions,
      period,
      topDentist: sortedDentists[0] ? {
        name: sortedDentists[0].dentist_name,
        revenue: sortedDentists[0].total_revenue
      } : null
    });

    res.json({
      period,
      date_filter: dateFilter,
      summary: {
        total_revenue: totalRevenue,
        total_transactions: totalTransactions,
        total_dentists: sortedDentists.length,
        average_revenue_per_dentist: sortedDentists.length > 0 ? totalRevenue / sortedDentists.length : 0
      },
      dentists: sortedDentists,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [DENTIST REVENUE] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error while fetching dentist revenue data' });
  }
});

// Get system analytics dashboard
router.get('/analytics/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get user statistics
    const { data: userStats } = await supabase
      .from('users')
      .select('role, is_active, created_at');

    // Get appointment statistics
    const { data: appointmentStats } = await supabase
      .from('appointments')
      .select('status, created_at, appointment_time');

    // Get payment statistics
    const { data: paymentStats } = await supabase
      .from('payments')
      .select('status, amount, created_at');

    // Calculate metrics
    const totalUsers = userStats?.length || 0;
    const activeUsers = userStats?.filter(u => u.is_active).length || 0;
    const totalPatients = userStats?.filter(u => u.role === 'patient').length || 0;
    const totalDentists = userStats?.filter(u => u.role === 'dentist').length || 0;

    const totalAppointments = appointmentStats?.length || 0;
    const pendingAppointments = appointmentStats?.filter(a => a.status === 'pending').length || 0;
    const approvedAppointments = appointmentStats?.filter(a => a.status === 'approved').length || 0;

    const totalRevenue = paymentStats?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    const completedPayments = paymentStats?.filter(p => p.status === 'completed').length || 0;

    // Monthly growth data (last 6 months)
    const monthlyData = generateMonthlyData(userStats, appointmentStats, paymentStats);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        totalPatients,
        totalDentists,
        totalAppointments,
        pendingAppointments,
        approvedAppointments,
        totalRevenue,
        completedPayments
      },
      monthlyData
    });
  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit logs
router.get('/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, table_name, user_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users(full_name, email)
      `);

    if (action) query = query.eq('action', action);
    if (table_name) query = query.eq('table_name', table_name);
    if (user_id) query = query.eq('user_id', user_id);

    const { data: logs, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk user management
router.patch('/users/bulk', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { user_ids, action, value } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'User IDs array required' });
    }

    let updateData = {};
    
    switch (action) {
      case 'activate':
        updateData = { is_active: true };
        break;
      case 'deactivate':
        updateData = { is_active: false };
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: updatedUsers, error } = await supabase
      .from('users')
      .update(updateData)
      .in('id', user_ids)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: `Successfully ${action}d ${updatedUsers.length} users`,
      users: updatedUsers
    });
  } catch (error) {
    console.error('Bulk user management error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate monthly data
function generateMonthlyData(users, appointments, payments) {
  const months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthUsers = users?.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= monthStart && createdAt <= monthEnd;
    }).length || 0;
    
    const monthAppointments = appointments?.filter(a => {
      const createdAt = new Date(a.created_at);
      return createdAt >= monthStart && createdAt <= monthEnd;
    }).length || 0;
    
    const monthRevenue = payments?.filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt >= monthStart && createdAt <= monthEnd && p.status === 'completed';
    }).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    
    months.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      users: monthUsers,
      appointments: monthAppointments,
      revenue: monthRevenue
    });
  }
  
  return months;
}

// Get all payments (admin only)
router.get('/payments', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('🔍 [ADMIN PAYMENTS] GET /admin/payments endpoint called:', {
    timestamp: new Date().toISOString(),
    queryParams: req.query,
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    const { status, limit = 100 } = req.query;

    console.log('🔍 [ADMIN PAYMENTS] Building Supabase query with filters:', {
      statusFilter: status,
      limitFilter: limit,
      hasStatusFilter: !!status
    });

    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        appointment:appointments!appointment_id(
          id,
          appointment_time,
          patient:users!patient_id(
            id,
            full_name,
            email
          ),
          service:services!service_id(
            id,
            name,
            price
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Apply status filter if provided
    if (status && status !== 'all') {
      console.log('🔍 [ADMIN PAYMENTS] Applying status filter:', status);
      query = query.eq('status', status);
    }

    console.log('📡 [ADMIN PAYMENTS] Executing Supabase query...');
    const { data: payments, error } = await query;

    if (error) {
      console.error('❌ [ADMIN PAYMENTS] Supabase query error:', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.status(400).json({ error: 'Failed to fetch payments' });
    }

    console.log('✅ [ADMIN PAYMENTS] Query successful, found', payments?.length || 0, 'payments');

    // Transform data for frontend
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      payment_method: payment.payment_method || 'Online',
      transaction_id: payment.paypal_transaction_id || payment.transaction_id,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
      notes: payment.notes,
      patient_name: payment.appointment?.patient?.full_name || 'Unknown Patient',
      patient_email: payment.appointment?.patient?.email || 'No email',
      service_name: payment.appointment?.service?.name || 'Unknown Service',
      appointment_date: payment.appointment?.appointment_time,
      appointment_id: payment.appointment_id
    }));

    console.log('🔄 [ADMIN PAYMENTS] Transformed payments for frontend:', {
      count: transformedPayments.length,
      sample: transformedPayments.slice(0, 2).map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        patient_name: p.patient_name,
        service_name: p.service_name
      }))
    });

    res.json({ 
      payments: transformedPayments,
      total_count: transformedPayments.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN PAYMENTS] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error while fetching payments' });
  }
});

// Update payment status (admin only)
router.patch('/payments/:id/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  console.log('🔄 [ADMIN PAYMENT UPDATE] PATCH /admin/payments/:id/status endpoint called:', {
    paymentId: req.params.id,
    newStatus: req.body.status,
    timestamp: new Date().toISOString(),
    userFromToken: req.user ? { id: req.user.id, role: req.user.role } : null
  });

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    console.log('📡 [ADMIN PAYMENT UPDATE] Updating payment status in database...');
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [ADMIN PAYMENT UPDATE] Supabase update error:', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.status(400).json({ error: 'Failed to update payment status' });
    }

    console.log('✅ [ADMIN PAYMENT UPDATE] Payment status updated successfully:', {
      paymentId: id,
      oldStatus: 'unknown',
      newStatus: status,
      updatedAt: payment.updated_at
    });

    res.json({ 
      message: 'Payment status updated successfully',
      payment: {
        id: payment.id,
        status: payment.status,
        updated_at: payment.updated_at
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN PAYMENT UPDATE] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Internal server error while updating payment status' });
  }
});

export default router;
