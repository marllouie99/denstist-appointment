import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../lib/api';
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const EmailConfirmed = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirmEmail, user, loading, signOut, clearAllAuthData } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, success, error, expired
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  // Watch for user changes from AuthContext
  useEffect(() => {
    if (!loading && user && status === 'loading') {
      console.log('✅ EmailConfirmed - User detected from AuthContext:', user);
      setStatus('success');
      setMessage('Email confirmed successfully! You are now logged in.');
      // No automatic redirect - user will see success message only
    }
  }, [user, loading, status]);

  // Additional check for localStorage changes (backup detection)
  useEffect(() => {
    const checkStoredUser = () => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser && status === 'loading') {
        console.log('✅ EmailConfirmed - User detected from localStorage');
        try {
          const userData = JSON.parse(storedUser);
          setStatus('success');
          setMessage('Email confirmed successfully! You are now logged in.');
          // No automatic redirect - user will see success message only
        } catch (error) {
          console.error('EmailConfirmed - Error parsing stored user:', error);
        }
      }
    };

    // Check immediately and then periodically
    checkStoredUser();
    const interval = setInterval(checkStoredUser, 500);
    
    // Clean up after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, navigate]);

  const handleEmailConfirmation = async () => {
    console.log('🔍 EmailConfirmed - Starting confirmation process');
    console.log('🔍 EmailConfirmed - URL params:', Object.fromEntries(searchParams.entries()));
    
    try {
      // Check for error parameters first (expired link, etc.)
      const error = searchParams.get('error');
      const errorCode = searchParams.get('error_code');
      const errorDescription = searchParams.get('error_description');

      console.log('🔍 EmailConfirmed - Error params:', { error, errorCode, errorDescription });

      if (error) {
        console.log('❌ EmailConfirmed - Error detected in URL params');
        if (errorCode === 'otp_expired') {
          setStatus('expired');
          setMessage('Your confirmation link has expired. Please request a new one.');
        } else {
          setStatus('error');
          setMessage(errorDescription || 'Invalid confirmation link. Please try again.');
        }
        return;
      }

      // Check for new token_hash method
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      console.log('🔍 EmailConfirmed - Token params:', { tokenHash: tokenHash ? 'Present' : 'Missing', type });
      
      if (tokenHash && type === 'email') {
        console.log('✅ EmailConfirmed - Valid token_hash found, confirming email...');
        
        // Use the new backend confirmation endpoint
        const result = await confirmEmail(tokenHash);
        
        console.log('🔍 EmailConfirmed - Confirmation result:', result);
        
        if (result.success) {
          console.log('✅ EmailConfirmed - Email confirmed successfully');
          setStatus('success');
          setMessage('Email confirmed successfully! You are now logged in.');
          // No automatic redirect - user will see success message only
        } else {
          console.log('❌ EmailConfirmed - Confirmation failed:', result.error);
          if (result.error && result.error.includes('expired')) {
            setStatus('expired');
            setMessage('Your confirmation link has expired. Please request a new one.');
          } else {
            setStatus('error');
            setMessage(result.error || 'Email confirmation failed. Please try again.');
          }
        }
        return;
      }

      // Check if user is already signed in (confirmation might have worked in background)
      console.log('🔍 EmailConfirmed - Checking if user is already signed in...');
      
      // Wait a moment for AuthContext to process the session
      setTimeout(() => {
        const storedToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');
        
        console.log('🔍 EmailConfirmed - Stored credentials check:', {
          hasToken: !!storedToken,
          hasUser: !!storedUser,
          userPreview: storedUser ? JSON.parse(storedUser).email : null
        });
        
        if (storedToken && storedUser) {
          console.log('✅ EmailConfirmed - User is already signed in, treating as successful confirmation');
          setStatus('success');
          setMessage('Email confirmed successfully! You are now logged in.');
          // No automatic redirect - user will see success message only
          return;
        }
        
        // If no stored credentials, show error
        console.log('❌ EmailConfirmed - No stored credentials found, showing error');
        setStatus('error');
        setMessage('Invalid confirmation link. Please try again.');
      }, 1000); // Wait 1 second for AuthContext to process
      
    } catch (error) {
      console.error('Confirmation error:', error);
      setStatus('error');
      setMessage('An unexpected error occurred. Please try again.');
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setResending(true);
      const response = await authAPI.resendConfirmation(email);
      toast.success('Confirmation email sent! Please check your inbox.');
      setMessage('A new confirmation email has been sent. Please check your inbox and spam folder.');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to resend confirmation email';
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    console.log('🔓 EmailConfirmed - Sign In button clicked, using same function as navbar Sign Out...');
    await signOut();
    navigate('/');
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader className="w-16 h-16 text-blue-600 animate-spin" />;
      default:
        // Always show success icon for non-loading states
        return <CheckCircle className="w-16 h-16 text-green-600" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Confirming Your Email...';
      default:
        // Always show success title for non-loading states
        return 'Confirmation Successful!';
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case 'success':
        return 'btn-primary';
      case 'error':
        return 'btn-secondary';
      default:
        return 'btn-primary';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {getIcon()}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {getTitle()}
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-8">
            {message}
          </p>

          {/* Action Buttons */}
          {status !== 'loading' && (
            <div className="space-y-3">
              {status === 'success' ? (
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium text-green-600 mb-2">
                    🎉 Confirmation Successful!
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Your account has been successfully confirmed.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="w-full btn btn-primary"
                  >
                    Sign In
                  </button>
                </div>
              ) : status === 'expired' ? (
                <>
                  <div className="space-y-3">
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleResendConfirmation}
                      disabled={resending}
                      className="w-full btn btn-primary flex items-center justify-center gap-2"
                    >
                      {resending ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Resend Confirmation Email
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full btn btn-secondary"
                  >
                    Register Again
                  </button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium text-green-600 mb-2">
                    🎉 Confirmation Successful!
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Your account has been successfully confirmed.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="w-full btn btn-primary"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Having trouble? Contact our support team for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmed;
