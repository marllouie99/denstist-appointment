import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { authAPI } from '../lib/api';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isProfileFetching, setIsProfileFetching] = useState(false);

  // Enhanced setUser with logging
  const setUserWithLogging = (newUser) => {
    // Only log significant changes
    if (!newUser && user) {
      console.log('🚨 USER SIGN-OUT DETECTED!');
    } else if (newUser && (!user || user.id !== newUser.id)) {
      console.log('✅ AuthContext - User authenticated:', { id: newUser.id, email: newUser.email, role: newUser.role });
    }
    
    setUser(newUser);
  };

  useEffect(() => {
    // Prevent multiple initializations in React Strict Mode
    if (hasInitialized) {
      console.log('AuthContext - Already initialized, skipping...');
      return;
    }
    
    let isMounted = true;
    let subscription = null;
    
    console.log('AuthContext - useEffect initializing...');
    setHasInitialized(true);
    
    const initializeAuth = async () => {
      if (!isMounted) return;
      
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('🔍 AuthContext - Initial session check:', {
          session: session ? {
            user_id: session.user?.id,
            email: session.user?.email,
            expires_at: session.expires_at
          } : null,
          localStorage_token: localStorage.getItem('access_token') ? 'Present' : 'Missing',
          localStorage_user: localStorage.getItem('user') ? 'Present' : 'Missing'
        });
        
        if (session?.user) {
          console.log('AuthContext - Session found, fetching user profile');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('AuthContext - No session found, checking localStorage...');
          await handleNoSession();
        }
      } catch (error) {
        console.error('AuthContext - Error during initialization:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const setupAuthListener = () => {
      if (!isMounted) return;
      
      // Listen for auth changes
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        
        // Only log significant auth events
        if (event !== 'INITIAL_SESSION' && event !== 'TOKEN_REFRESHED') {
          console.log('🔐 AuthContext - Auth event:', event, session?.user?.email || 'No user');
        }

        // Handle different auth events
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('AuthContext - User signed in, checking if profile fetch needed');
          setSession(session);
          // Only fetch profile if we don't already have this user loaded
          if (!user || user.id !== session.user.id) {
            fetchUserProfile(session.user.id);
          } else {
            console.log('AuthContext - User profile already loaded, skipping fetch');
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🔓 AuthContext - User signed out, clearing all data');
          setSession(null);
          setUserWithLogging(null);
          setIsProfileFetching(false);
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('AuthContext - Token refreshed');
          setSession(session);
          // Update stored token if we have one
          if (localStorage.getItem('access_token')) {
            localStorage.setItem('access_token', session.access_token);
          }
        } else if (event === 'INITIAL_SESSION') {
          // This is handled in initializeAuth, don't duplicate logic here
          console.log('AuthContext - Initial session event (handled in initialization)');
        } else {
          console.log('AuthContext - Other auth event:', event);
          if (isMounted) {
            setLoading(false);
          }
        }
      });
      
      subscription = authSubscription;
    };

    // Initialize auth and setup listener
    initializeAuth().then(() => {
      if (isMounted) {
        setupAuthListener();
      }
    });

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []); // Keep empty dependency array but use isMounted flag

  const handleNoSession = async () => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    console.log('AuthContext - localStorage check:', {
      storedToken: storedToken ? `${storedToken.substring(0, 20)}...` : 'Missing',
      storedUser: storedUser ? 'Present' : 'Missing',
      storedUserPreview: storedUser ? JSON.parse(storedUser).email : 'N/A'
    });
    
    if (storedToken && storedUser) {
      console.log('AuthContext - Stored credentials found, validating...');
      try {
        // Validate token by making API call
        const response = await authAPI.getMe();
        if (response.data.user) {
          console.log('AuthContext - Token valid, restoring user session');
          const userData = JSON.parse(storedUser);
          setUserWithLogging(userData);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('AuthContext - Token validation failed:', error);
        // Clear invalid credentials
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    } else if (storedToken && !storedUser) {
      console.log('AuthContext - Token exists but no user data, fetching profile...');
      try {
        const response = await authAPI.getMe();
        if (response.data.user) {
          console.log('AuthContext - User profile fetched successfully');
          setUserWithLogging(response.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('AuthContext - Failed to fetch user profile:', error);
        localStorage.removeItem('access_token');
      }
    } else if (!storedToken && storedUser) {
      console.log('AuthContext - User data exists but no token, clearing user data');
      localStorage.removeItem('user');
    } else {
      console.log('AuthContext - No stored credentials found');
    }
    
    setLoading(false);
  };

  const fetchUserProfile = async (userId) => {
    // Prevent duplicate profile fetches
    if (isProfileFetching) {
      console.log('AuthContext - Profile fetch already in progress, skipping...');
      return;
    }
    
    // If we already have a user with the same ID, skip fetch
    if (user && user.id === userId) {
      console.log('AuthContext - User profile already loaded for userId:', userId);
      setLoading(false);
      return;
    }
    
    console.log('AuthContext - fetchUserProfile started for userId:', userId);
    setIsProfileFetching(true);
    
    try {
      // Get user profile from users table only
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('AuthContext - Error fetching user profile from Supabase:', error);
        throw error;
      }
      
      if (data) {
        console.log('✅ AuthContext - Profile loaded:', data.email, data.role);
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      }
    } catch (error) {
      console.error('AuthContext - Error in fetchUserProfile:', error);
      // Profile should be created by database triggers, but fallback to API call
      try {
        const token = localStorage.getItem('access_token');
        console.log('AuthContext - Fallback to API call, token present:', !!token);
        if (token) {
          const response = await authAPI.getMe();
          if (response.data.user) {
            console.log('AuthContext - User profile fetched from API:', {
              id: response.data.user.id,
              email: response.data.user.email,
              role: response.data.user.role
            });
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
        }
      } catch (apiError) {
        console.error('AuthContext - Error fetching profile from API:', apiError);
        console.error('AuthContext - API Error details:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data
        });
      }
    } finally {
      setLoading(false);
      setIsProfileFetching(false);
      console.log('AuthContext - fetchUserProfile completed');
    }
  };

  const signUp = async (userData) => {
    try {
      setLoading(true);
      const response = await authAPI.register(userData);
      
      // Check if email confirmation was sent
      if (response.data.confirmationSent) {
        toast.success('Registration successful! Please check your email to confirm your account.');
        return { success: true, confirmationSent: true };
      }
      
      // If session exists (email confirmation disabled), log in immediately
      if (response.data.session) {
        localStorage.setItem('access_token', response.data.session.access_token);
        setSession(response.data.session);
        setUser(response.data.user);
        toast.success('Registration successful!');
        return { success: true, confirmationSent: false };
      }
      
      // Default success case
      toast.success(response.data.message || 'Registration successful!');
      return { success: true, confirmationSent: true };
      
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('🔐 AuthContext - signIn called:', { email });
      setLoading(true);
      
      console.log('📡 AuthContext - Making login API call...');
      const response = await authAPI.login({ email, password });
      
      console.log('✅ AuthContext - Login API response received:', {
        hasSession: !!response.data.session,
        hasUser: !!response.data.user,
        sessionPreview: response.data.session ? {
          access_token: response.data.session.access_token?.substring(0, 20) + '...',
          expires_in: response.data.session.expires_in
        } : null,
        userPreview: response.data.user ? {
          id: response.data.user.id,
          email: response.data.user.email,
          role: response.data.user.role
        } : null
      });
      
      if (response.data.session) {
        console.log('💾 AuthContext - Storing session data in localStorage');
        localStorage.setItem('access_token', response.data.session.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        console.log('🔄 AuthContext - Updating state with session and user');
        setSession(response.data.session);
        setUserWithLogging(response.data.user);
        
        console.log('✅ AuthContext - Login successful with session');
        toast.success('Login successful!');
        return { success: true };
      }
      
      // If no session but response is successful
      if (response.data.user) {
        console.log('⚠️ AuthContext - Login successful but no session received');
        setUserWithLogging(response.data.user);
        toast.success('Login successful!');
        return { success: true };
      }
      
      // If we get here, something unexpected happened
      console.error('❌ AuthContext - Login failed - no user data received');
      toast.error('Login failed - no user data received');
      return { success: false, error: 'No user data received' };
      
    } catch (error) {
      console.error('Login error:', error);
      const errorData = error.response?.data;
      const message = errorData?.error || error.message || 'Login failed';
      
      // Handle email confirmation requirement
      if (errorData?.emailConfirmationRequired) {
        toast.error('Please check your email and confirm your account before logging in');
        return { 
          success: false, 
          error: message, 
          emailConfirmationRequired: true 
        };
      }
      
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const confirmEmail = async (token_hash) => {
    try {
      setLoading(true);
      const response = await authAPI.confirmEmail({ 
        token_hash, 
        type: 'email' 
      });
      
      if (response.data.session) {
        localStorage.setItem('access_token', response.data.session.access_token);
        setSession(response.data.session);
        setUser(response.data.user);
        toast.success('Email confirmed successfully!');
        return { success: true, user: response.data.user };
      }
      
      toast.success(response.data.message || 'Email confirmed successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Email confirmation failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async (email) => {
    try {
      const response = await authAPI.resendConfirmation(email);
      toast.success('Confirmation email sent! Please check your inbox.');
      return { success: true, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to resend confirmation email';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Complete logout function that clears everything
  const clearAllAuthData = () => {
    console.log('🧹 AuthContext - Clearing all authentication data');
    setUserWithLogging(null);
    setSession(null);
    setLoading(false);
    setIsProfileFetching(false);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    // Also clear any other auth-related localStorage items
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear(); // Clear session storage as well
  };

  const signOut = async () => {
    console.log('🔓 AuthContext - Starting logout process...');
    
    try {
      // Clear all data immediately to prevent any further API calls
      clearAllAuthData();
      console.log('✅ AuthContext - Local data cleared');
      
      // Try to call logout API (in background, don't block on it)
      authAPI.logout().then(() => {
        console.log('✅ AuthContext - Server logout successful');
      }).catch((error) => {
        console.warn('⚠️ AuthContext - Server logout failed:', error.message);
      });
      
      // Force sign out from Supabase (in background)
      supabase.auth.signOut().then(() => {
        console.log('✅ AuthContext - Supabase logout successful');
      }).catch((error) => {
        console.warn('⚠️ AuthContext - Supabase logout failed:', error.message);
      });
      
    } catch (error) {
      console.error('❌ AuthContext - Logout error:', error);
      // Even if there's an error, make sure we clear local data
      clearAllAuthData();
    }
    
    console.log('🔓 AuthContext - Logout completed');
  };

  // Test login for development
  const testLogin = async () => {
    try {
      console.log('🧪 AuthContext - testLogin called');
      setLoading(true);
      
      const response = await authAPI.testLogin();
      console.log('🧪 AuthContext - testLogin response:', response.data);
      
      const { user: userData, session: sessionData } = response.data;
      
      // Store in localStorage
      localStorage.setItem('access_token', sessionData.access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Update state
      setUserWithLogging(userData);
      setSession(sessionData);
      
      console.log('🧪 AuthContext - testLogin successful');
      toast.success('Test login successful!');
      
      return { user: userData, session: sessionData };
    } catch (error) {
      console.error('AuthContext - testLogin error:', error);
      toast.error('Test login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    token: session?.access_token || localStorage.getItem('access_token'),
    signUp,
    signIn,
    signOut,
    clearAllAuthData,
    confirmEmail,
    resendConfirmation,
    testLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
