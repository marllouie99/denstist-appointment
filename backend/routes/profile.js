import express from 'express';
import { supabase, supabaseAdmin } from '../services/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Upload profile image
router.post('/upload-image', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    const userId = req.user.id;

    console.log('🖼️ [PROFILE] Profile image upload request for user:', userId);
    console.log('🖼️ [PROFILE] Request body keys:', Object.keys(req.body));
    console.log('🖼️ [PROFILE] Image data length:', imageData ? imageData.length : 'undefined');

    if (!imageData) {
      console.log('❌ [PROFILE] No image data provided');
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Validate base64 image data
    if (!imageData.startsWith('data:image/')) {
      console.log('❌ [PROFILE] Invalid image format:', imageData.substring(0, 50));
      return res.status(400).json({ error: 'Invalid image format' });
    }

    // Check image size (base64 is ~33% larger than binary)
    const imageSizeBytes = imageData.length * 0.75;
    const imageSizeMB = imageSizeBytes / (1024 * 1024);
    console.log('🖼️ [PROFILE] Estimated image size:', `${imageSizeMB.toFixed(2)}MB`);
    
    // Reduce size limit to avoid database index issues
    if (imageSizeMB > 2) {
      console.log('❌ [PROFILE] Image too large:', `${imageSizeMB.toFixed(2)}MB`);
      return res.status(400).json({ error: 'Image size must be less than 2MB to avoid database limitations' });
    }
    
    // Additional check for base64 string length
    if (imageData.length > 1500000) { // ~1.5MB base64 limit
      console.log('❌ [PROFILE] Base64 string too long:', imageData.length);
      return res.status(400).json({ error: 'Image data too large for database storage' });
    }

    console.log('✅ [PROFILE] Image validation passed, updating database...');

    // Use admin client to bypass RLS policies for profile image updates
    // First check if user exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError) {
      console.error('❌ [PROFILE] User not found:', checkError);
      return res.status(404).json({ 
        error: 'User not found',
        details: 'Please ensure you are logged in with a valid account' 
      });
    }

    // Update user profile with image data (save to both fields for full compatibility)
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ 
        profile_image: imageData,
        avatar_url: imageData, // Keep both fields in sync
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, full_name, phone, role, profile_image, avatar_url, created_at, updated_at')
      .single();

    if (error) {
      console.error('❌ [PROFILE] Supabase error updating profile image:', error);
      console.error('❌ [PROFILE] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Handle specific database errors
      if (error.code === '54000' || error.message?.includes('index row requires')) {
        return res.status(400).json({ 
          error: 'Image too large for database storage',
          details: 'Please use a smaller image (under 1MB)' 
        });
      }
      
      if (error.code === '42501') {
        return res.status(403).json({ 
          error: 'Database permission denied',
          details: 'Please contact support if this persists' 
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to update profile image',
        details: error.message 
      });
    }

    console.log('✅ [PROFILE] Profile image updated successfully for user:', userId);
    console.log('✅ [PROFILE] Updated user data:', { 
      id: data.id, 
      email: data.email, 
      has_profile_image: !!data.profile_image 
    });

    res.json({
      message: 'Profile image updated successfully',
      user: data
    });

  } catch (error) {
    console.error('❌ [PROFILE] Unexpected error in profile image upload:', error);
    console.error('❌ [PROFILE] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Get user profile with image
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('👤 [PROFILE] Fetching profile for user:', userId);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, role, profile_image, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ [PROFILE] Error fetching user profile:', error);
      console.error('❌ [PROFILE] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.status(500).json({ 
        error: 'Failed to fetch profile',
        details: error.message 
      });
    }

    console.log('✅ [PROFILE] Profile fetched successfully:', {
      id: data.id,
      email: data.email,
      has_profile_image: !!data.profile_image
    });

    res.json({
      user: data
    });

  } catch (error) {
    console.error('❌ [PROFILE] Unexpected error fetching profile:', error);
    console.error('❌ [PROFILE] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Update profile information
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone } = req.body;

    console.log('Profile update request for user:', userId, { full_name, phone });

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    console.log('Profile updated successfully for user:', userId);

    res.json({
      message: 'Profile updated successfully',
      user: data
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
