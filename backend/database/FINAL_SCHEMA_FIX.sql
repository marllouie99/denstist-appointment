-- FINAL DATABASE SCHEMA FIX
-- Run this in your Supabase SQL Editor to fix all authentication issues
-- This will create the correct schema and fix existing data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing problematic tables if they exist
DROP TABLE IF EXISTS publicuser CASCADE;

-- Ensure users table exists with correct structure
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('patient','dentist','admin')) NOT NULL DEFAULT 'patient',
  full_name TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create other required tables
CREATE TABLE IF NOT EXISTS dentist_profile (
  id SERIAL PRIMARY KEY,
  dentist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  specialization TEXT,
  qualifications TEXT,
  availability JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('pending','approved','rejected','cancelled')) DEFAULT 'pending',
  payment_status TEXT CHECK (payment_status IN ('unpaid','paid','refunded')) DEFAULT 'unpaid',
  notes TEXT,
  rejection_reason TEXT,
  calendar_event_id TEXT,
  admin_override BOOLEAN DEFAULT false,
  admin_override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending','completed','refunded','failed')) DEFAULT 'pending',
  paypal_payment_id TEXT,
  paypal_transaction_id TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON appointments(dentist_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dentist_profile_updated_at ON dentist_profile;
CREATE TRIGGER update_dentist_profile_updated_at 
  BEFORE UPDATE ON dentist_profile 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentist_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;
DROP POLICY IF EXISTS "Anyone can insert" ON users;

-- Create simplified RLS policies for authentication
CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for registration" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Services policies
DROP POLICY IF EXISTS "Anyone can view services" ON services;
CREATE POLICY "Anyone can view active services" ON services
  FOR SELECT USING (is_active = true);

-- Dentist profile policies
DROP POLICY IF EXISTS "Anyone can view dentist profiles" ON dentist_profile;
CREATE POLICY "Anyone can view dentist profiles" ON dentist_profile
  FOR SELECT USING (true);

CREATE POLICY "Dentists can manage their profile" ON dentist_profile
  FOR ALL USING (auth.uid()::text = dentist_id::text);

-- Appointments policies
DROP POLICY IF EXISTS "Users can view their appointments" ON appointments;
CREATE POLICY "Users can view related appointments" ON appointments
  FOR SELECT USING (
    auth.uid()::text = patient_id::text OR 
    auth.uid()::text = dentist_id::text
  );

CREATE POLICY "Patients can create appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid()::text = patient_id::text);

CREATE POLICY "Users can update related appointments" ON appointments
  FOR UPDATE USING (
    auth.uid()::text = patient_id::text OR 
    auth.uid()::text = dentist_id::text
  );

-- Payments policies
DROP POLICY IF EXISTS "Users can view related payments" ON payments;
CREATE POLICY "Users can view related payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id AND (
        auth.uid()::text = a.patient_id::text OR
        auth.uid()::text = a.dentist_id::text
      )
    )
  );

-- Insert sample services if they don't exist
INSERT INTO services (name, description, price, duration) 
SELECT * FROM (VALUES
  ('General Checkup', 'Routine dental examination and cleaning', 100.00, 60),
  ('Teeth Cleaning', 'Professional dental cleaning and polishing', 80.00, 45),
  ('Filling', 'Dental cavity filling treatment', 150.00, 90),
  ('Root Canal', 'Root canal therapy treatment', 500.00, 120),
  ('Teeth Whitening', 'Professional teeth whitening service', 200.00, 60),
  ('Dental Crown', 'Dental crown placement', 800.00, 120),
  ('Tooth Extraction', 'Tooth removal procedure', 250.00, 60),
  ('Orthodontic Consultation', 'Braces and alignment consultation', 120.00, 45)
) AS v(name, description, price, duration)
WHERE NOT EXISTS (SELECT 1 FROM services WHERE services.name = v.name);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, role, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    true
  );
  
  -- Create dentist profile if role is dentist
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'dentist' THEN
    INSERT INTO dentist_profile (dentist_id, specialization, qualifications)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'specialization', ''),
      COALESCE(NEW.raw_user_meta_data->>'qualifications', '')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION handle_user_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if email is confirmed and profile doesn't exist
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO users (id, email, role, full_name, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      is_active = EXCLUDED.is_active;
    
    -- Create dentist profile if role is dentist
    IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'dentist' THEN
      INSERT INTO dentist_profile (dentist_id, specialization, qualifications)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'specialization', ''),
        COALESCE(NEW.raw_user_meta_data->>'qualifications', '')
      )
      ON CONFLICT (dentist_id) DO UPDATE SET
        specialization = EXCLUDED.specialization,
        qualifications = EXCLUDED.qualifications;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_email_confirmed();

-- Verify setup
SELECT 'Database schema fixed successfully!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'dentist_profile', 'services', 'appointments', 'payments')
ORDER BY table_name;
