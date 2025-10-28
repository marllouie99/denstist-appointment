import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from '../services/supabase.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 [AUTH] Authentication attempt:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : 'None',
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (!token) {
    console.log('❌ [AUTH] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check if it's a test token (for development)
    if (token.startsWith('test-jwt-token-')) {
      console.log('🧪 [AUTH] Test token detected, using existing real user...');
      
      // Instead of creating a test user, use an existing real user from the database
      const { data: realUsers, error: realUserError } = await supabaseAdmin
        .from('users')
        .select('*')
        .limit(1)
        .single();
      
      if (realUserError || !realUsers) {
        console.error('❌ [AUTH] No real users found for testing:', realUserError);
        return res.status(404).json({ 
          error: 'No users available for testing',
          details: 'Please create a real user account first' 
        });
      }
      
      console.log('✅ [AUTH] Using real user for testing:', realUsers.email);
      req.user = realUsers;
      return next();
    }

    console.log('🔍 [AUTH] Verifying token with Supabase...');
    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('❌ [AUTH] Supabase token verification error:', {
        error: error.message,
        code: error.code,
        status: error.status
      });
      return res.status(403).json({ error: 'Invalid or expired token', details: error.message });
    }

    if (!user) {
      console.log('❌ [AUTH] No user returned from Supabase');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    console.log('✅ [AUTH] Token verified, user found:', {
      id: user.id,
      email: user.email
    });

    // Get user profile from database
    console.log('🔍 [AUTH] Fetching user profile from database...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [AUTH] User profile fetch error:', {
        error: profileError.message,
        code: profileError.code,
        userId: user.id
      });
      return res.status(404).json({ error: 'User profile not found', details: profileError.message });
    }

    console.log('✅ [AUTH] User profile found:', {
      id: profile.id,
      email: profile.email,
      role: profile.role
    });

    req.user = { ...user, ...profile };
    next();
  } catch (error) {
    console.error('❌ [AUTH] Unexpected authentication error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(403).json({ error: 'Token verification failed', details: error.message });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
