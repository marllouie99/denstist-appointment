import express from 'express';
import { supabase, supabaseAdmin, createUserProfile } from '../services/supabase.js';
import { getAuthUrl, getTokenFromCode } from '../services/googleCalendar.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', {
      body: req.body,
      headers: req.headers['content-type']
    });

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Environment check passed');

    const { email, password, full_name, role = 'patient', specialization, qualifications } = req.body;

    // Validate required fields
    if (!email) {
      console.log('Validation error: Email is required');
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!password) {
      console.log('Validation error: Password is required');
      return res.status(400).json({ error: 'Password is required' });
    }
    
    if (!full_name) {
      console.log('Validation error: Full name is required');
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Validate role
    if (!['patient', 'dentist'].includes(role)) {
      console.log('Validation error: Invalid role:', role);
      return res.status(400).json({ error: 'Invalid role. Only patient and dentist can register.' });
    }

    console.log('Attempting to create user in Supabase Auth...');

    // Create user in Supabase Auth with redirect URL
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role,
          specialization: specialization || '',
          qualifications: qualifications || ''
        },
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/confirm`
      }
    });

    if (error) {
      console.error('Supabase Auth error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('User created successfully:', data.user?.id);

    res.status(201).json({
      message: 'Registration successful. Please check your email to confirm your account.',
      user: data.user,
      confirmationSent: !data.session
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    console.log('Login attempt for email:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Get user profile
    console.log('Looking for user profile with ID:', data.user.id);
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      
      // Check if user is confirmed before creating profile
      if (!data.user.email_confirmed_at) {
        return res.status(400).json({ 
          error: 'Please confirm your email address before logging in',
          emailConfirmationRequired: true
        });
      }
      
      // Try to create the profile if it doesn't exist and email is confirmed
      const userData = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'patient',
        full_name: data.user.user_metadata?.full_name || '',
        is_active: true
      };
      
      console.log('Attempting to create missing profile:', userData);
      
      // Use admin client for profile creation to bypass RLS
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('users')
        .insert([userData])
        .select()
        .single();
        
      if (createError) {
        console.error('Failed to create profile:', createError);
        return res.status(500).json({ 
          error: 'User profile could not be created. Please contact support.',
          details: createError.message
        });
      }
      
      // Create dentist profile if needed
      if (userData.role === 'dentist') {
        await supabaseAdmin
          .from('dentist_profile')
          .insert({
            dentist_id: data.user.id,
            specialization: data.user.user_metadata?.specialization || '',
            qualifications: data.user.user_metadata?.qualifications || ''
          });
      }
      
      console.log('Created new profile:', newProfile);
      return res.json({
        message: 'Login successful',
        user: newProfile,
        session: data.session
      });
    }

    res.json({
      message: 'Login successful',
      user: profile,
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend confirmation email
router.post('/resend-confirmation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/confirm`
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Confirmation email sent successfully. Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm email
router.post('/confirm', async (req, res) => {
  try {
    const { token_hash, type } = req.body;

    if (!token_hash || type !== 'email') {
      return res.status(400).json({ error: 'Invalid confirmation parameters' });
    }

    // Verify the email confirmation token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'email'
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get the user profile (should be created by the trigger)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create it manually as fallback
      const userData = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'patient',
        full_name: data.user.user_metadata?.full_name || '',
        is_active: true
      };

      const { data: newProfile, error: createError } = await createUserProfile(userData);
      
      if (createError) {
        console.error('Error creating user profile:', createError);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }

      // Create dentist profile if needed
      if (userData.role === 'dentist') {
        await supabase
          .from('dentist_profile')
          .insert({
            dentist_id: data.user.id,
            specialization: data.user.user_metadata?.specialization || '',
            qualifications: data.user.user_metadata?.qualifications || ''
          });
      }

      return res.json({
        message: 'Email confirmed successfully',
        user: newProfile,
        session: data.session
      });
    }

    res.json({
      message: 'Email confirmed successfully',
      user: profile,
      session: data.session
    });
  } catch (error) {
    console.error('Email confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if it's a test token (for development)
    if (token.startsWith('test-jwt-token-')) {
      console.log('🧪 /me endpoint: Test token detected, returning test user');
      const testUser = {
        id: '00000000-0000-0000-0000-000000000001', // Use proper UUID format
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'patient',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return res.json({ user: testUser });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ user: profile });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test login for development
router.post('/test-login', async (req, res) => {
  try {
    console.log('🧪 Test login endpoint called');
    
    // Create a test user object
    const testUser = {
      id: '00000000-0000-0000-0000-000000000001', // Use proper UUID format
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'patient',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Create a simple JWT token for testing
    const testToken = 'test-jwt-token-' + Date.now();
    
    console.log('🧪 Test login successful, returning test user and token');
    
    res.json({
      message: 'Test login successful',
      user: testUser,
      session: {
        access_token: testToken,
        token_type: 'bearer',
        expires_in: 3600,
        user: testUser
      }
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google Calendar OAuth
router.get('/google/auth', (req, res) => {
  const { state } = req.query;
  const authUrl = getAuthUrl(state);
  res.json({ authUrl });
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const result = await getTokenFromCode(code);
    
    if (result.success && result.tokens) {
      // Extract dentist ID from state parameter (if provided)
      let dentistId = null;
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
          dentistId = stateData.dentistId;
        } catch (e) {
          console.error('Error parsing state:', e);
        }
      }
      
      // If no dentist ID in state, we'll need to handle this differently
      // For now, we'll redirect with success and handle token storage on frontend
      if (dentistId) {
        // Store tokens in database
        const expiresAt = result.tokens.expiry_date 
          ? new Date(result.tokens.expiry_date).toISOString()
          : null;
          
        const { error } = await supabase
          .from('google_calendar_tokens')
          .upsert({
            dentist_id: dentistId,
            access_token: result.tokens.access_token,
            refresh_token: result.tokens.refresh_token,
            expires_at: expiresAt,
            scope: result.tokens.scope
          });
          
        if (error) {
          console.error('Error storing Google Calendar tokens:', error);
          return res.redirect(`${process.env.FRONTEND_URL}/dashboard?google_auth=error`);
        }
        
        // Update dentist profile to mark calendar as connected
        await supabase
          .from('dentist_profile')
          .update({ calendar_connected: true })
          .eq('dentist_id', dentistId);
      }
      
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?google_auth=success`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?google_auth=error`);
    }
  } catch (error) {
    console.error('Google auth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?google_auth=error`);
  }
});

export default router;
