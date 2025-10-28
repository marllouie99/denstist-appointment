import express from 'express';
import { supabase } from '../services/supabase.js';

const router = express.Router();

// Get all services (public route)
router.get('/', async (req, res) => {
  try {
    const { data: services, error } = await supabase
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

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error || !service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new service (admin only)
router.post('/', async (req, res) => {
  try {
    const { name, description, price, duration } = req.body;

    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data: service, error } = await supabase
      .from('services')
      .insert([{
        name,
        description,
        price: parseFloat(price),
        duration: duration || 60
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ service });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service (admin only)
router.put('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { name, description, price, duration, is_active } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (duration !== undefined) updateData.duration = duration;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: service, error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Check if service has any appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('service_id', serviceId)
      .limit(1);

    if (appointments && appointments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete service with existing appointments. Deactivate instead.' 
      });
    }

    const { error } = await supabase
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

// Get service statistics
router.get('/stats', async (req, res) => {
  try {
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select(`
        id,
        name,
        price,
        appointments:appointments(id, status)
      `);

    if (servicesError) {
      return res.status(400).json({ error: servicesError.message });
    }

    const stats = services.map(service => ({
      id: service.id,
      name: service.name,
      price: service.price,
      totalAppointments: service.appointments.length,
      approvedAppointments: service.appointments.filter(a => a.status === 'approved').length,
      pendingAppointments: service.appointments.filter(a => a.status === 'pending').length,
      revenue: service.appointments
        .filter(a => a.status === 'approved')
        .length * parseFloat(service.price)
    }));

    res.json({ stats });
  } catch (error) {
    console.error('Get service stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
