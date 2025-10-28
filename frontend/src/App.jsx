import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import HomeDashboard from './pages/HomeDashboard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import EmailConfirmed from './pages/Auth/EmailConfirmed';
import ProcessConfirmation from './pages/Auth/ProcessConfirmation';
import PatientDashboard from './pages/Patient/PatientDashboard';
import BookAppointment from './pages/Patient/BookAppointment';
import Payment from './pages/Patient/Payment';
import PaymentHistory from './pages/Patient/PaymentHistory';
import DentistDashboard from './pages/Dentist/DentistDashboard';
import AdminDashboard from './pages/Admin/AdminDashboard';
import PaymentSuccess from './pages/Payment/PaymentSuccess';
import PaymentCancel from './pages/Payment/PaymentCancel';

// Error Pages
const NotFound = () => {
  const { signOut, clearAllAuthData } = useAuth();
  
  const handleRelogin = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear if logout fails
      clearAllAuthData();
    }
    // Force page reload to ensure clean state
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="text-xl text-gray-600 mt-4">Page not found</p>
        <button 
          onClick={handleRelogin}
          className="btn btn-primary mt-6"
        >
          Logout & Relogin
        </button>
      </div>
    </div>
  );
};

const Unauthorized = () => {
  const { user } = useAuth();
  
  // Redirect to appropriate dashboard based on user role
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'dentist':
      return <Navigate to="/dentist/dashboard" replace />;
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <div className="App">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: 'green',
                  secondary: 'black',
                },
              },
            }}
          />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              {/* Auth Routes */}
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="auth/confirm" element={<EmailConfirmed />} />
              <Route path="auth/process" element={<ProcessConfirmation />} />
              <Route path="unauthorized" element={<Unauthorized />} />
              
              {/* Home Dashboard for authenticated users */}
              <Route 
                path="home-dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['patient', 'dentist', 'admin']}>
                    <HomeDashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* Patient Routes */}
              <Route path="patient">
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['patient']}>
                      <PatientDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="book-appointment" 
                  element={
                    <ProtectedRoute allowedRoles={['patient']}>
                      <BookAppointment />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="payment/:appointmentId" 
                  element={
                    <ProtectedRoute allowedRoles={['patient']}>
                      <Payment />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="payment-history" 
                  element={
                    <ProtectedRoute allowedRoles={['patient']}>
                      <PaymentHistory />
                    </ProtectedRoute>
                  } 
                />
              </Route>

              {/* Payment Routes */}
              <Route path="payment">
                <Route path="success" element={<PaymentSuccess />} />
                <Route path="cancel" element={<PaymentCancel />} />
              </Route>

              {/* Dentist Routes */}
              <Route path="dentist">
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['dentist']}>
                      <DentistDashboard />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Admin Routes */}
              <Route path="admin">
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
              </Route>

              {/* Legacy dashboard redirect */}
              <Route path="dashboard" element={<DashboardRedirect />} />
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

// Component to redirect to appropriate dashboard based on user role
const DashboardRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect based on user role
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'dentist':
      return <Navigate to="/dentist/dashboard" replace />;
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    default:
      console.error('Unknown user role:', user.role);
      return <Navigate to="/login" replace />;
  }
};

export default App;
