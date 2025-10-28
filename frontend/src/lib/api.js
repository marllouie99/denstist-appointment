import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Request deduplication cache
const pendingRequests = new Map();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    console.log('📡 API - Request interceptor:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : null,
      hasUser: !!user,
      userPreview: user ? JSON.parse(user).email : null,
      headers: {
        'Content-Type': config.headers['Content-Type'],
        'Authorization': token ? 'Bearer [TOKEN]' : 'Missing'
      },
      timestamp: new Date().toISOString()
    });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ API - Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API - Response success:', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      statusText: response.statusText,
      dataSize: response.data ? JSON.stringify(response.data).length : 0,
      dataPreview: response.data ? (
        typeof response.data === 'object' ? 
        Object.keys(response.data).join(', ') : 
        String(response.data).substring(0, 100)
      ) : null,
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('❌ API - Response error:', {
      url: error.config?.url,
      method: error.config?.method,
      fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'Unknown',
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      isNetworkError: error.message?.includes('Network Error') || error.code === 'ECONNREFUSED',
      isTimeoutError: error.code === 'ECONNABORTED',
      timestamp: new Date().toISOString()
    });

    // Enhanced error analysis
    if (error.response?.status === 400) {
      console.error('🔍 API - 400 Bad Request Analysis:', {
        possibleCauses: [
          'Invalid request parameters',
          'Missing required fields',
          'Malformed request body',
          'Authentication token issues',
          'Invalid user ID format',
          'Database validation errors'
        ],
        requestDetails: {
          method: error.config?.method,
          url: error.config?.url,
          fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'Unknown',
          data: error.config?.data,
          dataType: typeof error.config?.data,
          dataStringified: error.config?.data ? JSON.stringify(error.config?.data) : null,
          headers: error.config?.headers
        },
        responseDetails: {
          data: error.response?.data,
          headers: error.response?.headers,
          status: error.response?.status,
          statusText: error.response?.statusText
        },
        debugSuggestions: [
          'Check if all required fields are present',
          'Verify data types match backend expectations',
          'Ensure user ID is valid and exists',
          'Check authentication token validity',
          'Verify request payload structure',
          'Check if backend endpoint /admin/users/:id/status exists',
          'Verify backend expects PATCH method for this endpoint',
          'Check if user has admin permissions',
          'Verify database connection and user exists in DB'
        ],
        backendDebugging: {
          userIdFromUrl: error.config?.url?.match(/\/admin\/users\/([^\/]+)\/status/)?.[1],
          httpMethod: error.config?.method?.toUpperCase(),
          contentType: error.config?.headers?.['Content-Type'],
          authHeader: error.config?.headers?.['Authorization'] ? 'Present' : 'Missing'
        }
      });
    } else if (error.response?.status === 401) {
      console.error('🔍 API - 401 Unauthorized detected, clearing auth data and redirecting to login');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 404) {
      console.error('🔍 API - 404 Not Found Analysis:', {
        possibleCauses: [
          'Endpoint does not exist',
          'Server not running',
          'Incorrect URL path',
          'Route not registered'
        ]
      });
    } else if (error.message?.includes('Network Error') || error.code === 'ECONNREFUSED') {
      console.error('🔍 API - Network Error Analysis:', {
        possibleCauses: [
          'Backend server not running',
          'Port 5000 not accessible',
          'CORS issues',
          'Firewall blocking connection'
        ],
        suggestedActions: [
          'Check if backend server is running on port 5000',
          'Verify API_BASE_URL configuration',
          'Check network connectivity'
        ]
      });
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  confirmEmail: (data) => api.post('/auth/confirm', data),
  resendConfirmation: (email) => api.post('/auth/resend-confirmation', { email }),
  testLogin: () => api.post('/auth/test-login'),
};

// Appointments API
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  book: (data) => api.post('/appointments/book', data),
  approve: (id) => api.patch(`/appointments/${id}/approve`),
  reject: (id, reason) => api.patch(`/appointments/${id}/reject`, { reason }),
  cancel: (id) => api.patch(`/appointments/${id}/cancel`),
};

// Dentists API
export const dentistsAPI = {
  getAll: () => api.get('/dentists'),
  getById: (id) => api.get(`/dentists/${id}`),
  getProfile: (id) => api.get(`/dentists/${id}`),
  updateProfile: (data) => api.put('/dentists/profile', data),
  updateAvailability: (data) => api.put('/dentists/availability', data),
  getMyAppointments: (params) => api.get('/dentists/appointments/my', { params }),
  getAvailability: (id, date) => api.get(`/dentists/${id}/availability`, { params: { date } }),
  getPaymentHistory: () => api.get('/dentists/payments/history'),
  approveAppointment: (id) => api.patch(`/dentists/appointments/${id}/approve`),
  rejectAppointment: (id, reason) => api.patch(`/dentists/appointments/${id}/reject`, { reason }),
  uploadAvatar: (formData) => {
    return api.post('/dentists/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Services API
export const servicesAPI = {
  getAll: () => api.get('/services'),
  getById: (id) => api.get(`/services/${id}`),
};

// Payments API
export const paymentsAPI = {
  create: (data) => api.post('/payments/create', data),
  execute: (data) => {
    console.log('🚨 paymentsAPI.execute called with:', data);
    console.log('🚨 API base URL:', API_BASE_URL);
    console.log('🚨 Full URL will be:', `${API_BASE_URL}/payments/execute`);
    return api.post('/payments/execute', data);
  },
  getHistory: () => api.get('/payments/history'),
  getById: (id) => api.get(`/payments/${id}`),
};

// Admin API
export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  updateUserStatus: (id, data) => {
    const requestKey = `PATCH:/admin/users/${id}/status:${JSON.stringify(data)}`;
    
    console.log('🔧 adminAPI.updateUserStatus called:', {
      id,
      idType: typeof id,
      data,
      dataType: typeof data,
      endpoint: `/admin/users/${id}/status`,
      method: 'PATCH',
      requestKey,
      hasPendingRequest: pendingRequests.has(requestKey),
      pendingRequestsCount: pendingRequests.size,
      timestamp: new Date().toISOString()
    });
    
    // Check for duplicate request
    if (pendingRequests.has(requestKey)) {
      console.warn('⚠️ adminAPI.updateUserStatus - Duplicate request detected, returning existing promise:', requestKey);
      return pendingRequests.get(requestKey);
    }
    
    // Validate inputs
    if (!id) {
      console.error('❌ adminAPI.updateUserStatus - Missing user ID');
      throw new Error('User ID is required');
    }
    
    if (!data || typeof data !== 'object') {
      console.error('❌ adminAPI.updateUserStatus - Invalid data object:', data);
      throw new Error('Data object is required');
    }
    
    if (!data.hasOwnProperty('is_active')) {
      console.error('❌ adminAPI.updateUserStatus - Missing is_active field in data:', data);
      throw new Error('is_active field is required in data object');
    }
    
    console.log('✅ adminAPI.updateUserStatus - Validation passed, making API call');
    
    // Create and cache the request promise
    const requestPromise = api.patch(`/admin/users/${id}/status`, data)
      .then(response => {
        console.log('🧹 adminAPI.updateUserStatus - Request completed successfully, removing from cache:', requestKey);
        pendingRequests.delete(requestKey);
        return response;
      })
      .catch(error => {
        console.log('🧹 adminAPI.updateUserStatus - Request failed, removing from cache:', requestKey);
        pendingRequests.delete(requestKey);
        throw error;
      });
    
    // Cache the request
    pendingRequests.set(requestKey, requestPromise);
    console.log('💾 adminAPI.updateUserStatus - Request cached:', {
      requestKey,
      totalPendingRequests: pendingRequests.size
    });
    
    return requestPromise;
  },
  getServices: () => api.get('/admin/services'),
  createService: (data) => api.post('/admin/services', data),
  updateService: (id, data) => api.put(`/admin/services/${id}`, data),
  deleteService: (id) => api.delete(`/admin/services/${id}`),
  getAppointments: (params) => api.get('/admin/appointments', { params }),
  overrideAppointment: (id, data) => api.patch(`/admin/appointments/${id}/override`, data),
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getAnalyticsDashboard: () => api.get('/admin/analytics/dashboard'),
  getRevenueReport: (params) => api.get('/admin/reports/revenue', { params }),
  getDentistRevenue: (params) => api.get('/admin/analytics/dentist-revenue', { params }),
  getPayments: (params) => api.get('/admin/payments', { params }),
  updatePaymentStatus: (id, data) => api.patch(`/admin/payments/${id}/status`, data),
};

export { api };
export default api;
