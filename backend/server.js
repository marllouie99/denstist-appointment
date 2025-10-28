import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import paymentRoutes from './routes/payments.js';
import paymentWebhookRoutes from './routes/paymentWebhook.js';
import dentistRoutes from './routes/dentists.js';
import adminRoutes from './routes/admin.js';
import serviceRoutes from './routes/services.js';
import profileRoutes from './routes/profile.js';

// Import cron jobs
import { initializeCronJobs } from './jobs/reminderCron.js';

// Import payment monitor
import { paymentStatusMonitor } from './services/paymentStatusMonitor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'https://frontend-production-8495.up.railway.app',
    'https://www.sandbox.paypal.com',
    'https://www.paypal.com',
    'https://checkout.paypal.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  
  // Special logging for payment execute requests
  if (req.url.includes('/payments/execute')) {
    console.log('🚨 PAYMENT EXECUTE REQUEST DETECTED!');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
  }
  
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Dentist Appointment System API is running',
    timestamp: new Date().toISOString()
  });
});

// Test route to verify server is working
app.get('/test-server', (req, res) => {
  console.log('[SERVER] Test route hit!');
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  });
});


// API Routes
console.log('🔧 Loading API routes...');
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes loaded');
app.use('/api/appointments', appointmentRoutes);
console.log('✅ Appointment routes loaded');
app.use('/api/payments', paymentRoutes);
console.log('✅ Payment routes loaded');
app.use('/api/webhooks', paymentWebhookRoutes);
console.log('✅ Payment webhook routes loaded');
app.use('/api/dentists', dentistRoutes);
console.log('✅ Dentist routes loaded');
app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes loaded');
app.use('/api/services', serviceRoutes);
console.log('✅ Service routes loaded');
app.use('/api/profile', profileRoutes);
console.log('✅ Profile routes loaded');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle payload too large errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'Payload too large',
      message: 'Request body exceeds the maximum allowed size'
    });
  }
  
  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ 
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🦷 Dentist Appointment System API running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Initialize cron jobs
  initializeCronJobs();
  
  // Initialize payment status monitor
  await paymentStatusMonitor.startMonitoring();
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  paymentStatusMonitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  paymentStatusMonitor.stopMonitoring();
  process.exit(0);
});
