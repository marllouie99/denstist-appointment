import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const ProcessConfirmation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    processTokens();
  }, []);

  const processTokens = async () => {
    try {
      // Extract tokens from the current URL hash
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresAt = params.get('expires_at');
      const type = params.get('type');

      if (accessToken && refreshToken && type === 'magiclink') {
        // Set the session with the tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Session error:', error);
          toast.error('Failed to confirm email. Please try again.');
          navigate('/auth/confirm');
          return;
        }

        if (data.user) {
          // Check if user profile exists
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Create user profile if it doesn't exist
            const userData = data.user.user_metadata || {};
            const role = userData.role || 'patient';
            
            const { error: createError } = await supabase
              .from('users')
              .insert([{
                id: data.user.id,
                email: data.user.email,
                role: role,
                full_name: userData.full_name || '',
                is_active: true
              }]);

            if (createError) {
              console.error('Profile creation error:', createError);
              toast.error('Email confirmed but failed to create profile. Please contact support.');
              return;
            }

            // Create dentist profile if needed
            if (role === 'dentist') {
              await supabase
                .from('dentist_profile')
                .insert([{
                  dentist_id: data.user.id,
                  specialization: userData.specialization || '',
                  qualifications: userData.qualifications || ''
                }]);
            }
          }

          toast.success('Email confirmed successfully! Welcome!');
          
          // Redirect based on user role
          const userRole = data.user.user_metadata?.role || 'patient';
          switch (userRole) {
            case 'patient':
              navigate('/patient/dashboard');
              break;
            case 'dentist':
              navigate('/dentist/dashboard');
              break;
            case 'admin':
              navigate('/admin/dashboard');
              break;
            default:
              navigate('/');
          }
        }
      } else {
        toast.error('Invalid confirmation link');
        navigate('/auth/confirm');
      }
    } catch (error) {
      console.error('Confirmation processing error:', error);
      toast.error('An error occurred during confirmation');
      navigate('/auth/confirm');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing your confirmation...</p>
      </div>
    </div>
  );
};

export default ProcessConfirmation;
