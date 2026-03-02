-- ============================================
-- BIOMETRIC ATTENDANCE MANAGEMENT SYSTEM
-- Supabase Database Schema
-- ============================================

-- Enable required extensions
-- NOTE: Before running this, go to Supabase Dashboard > Database > Extensions
-- and enable both "uuid-ossp" and "vector" extensions from the UI.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. PROFILES TABLE (for role-based access)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'hr')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  face_embedding vector(512),  -- pgvector for face embeddings
  fingerprint_template TEXT,    -- Encrypted fingerprint template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster similarity search
-- NOTE: ivfflat index requires rows to exist first.
-- Run this AFTER inserting employees with face embeddings:
-- CREATE INDEX idx_employees_face_embedding
--   ON employees USING ivfflat (face_embedding vector_cosine_ops)
--   WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_employees_active 
  ON employees (is_active);

CREATE INDEX IF NOT EXISTS idx_employees_department 
  ON employees (department);

CREATE INDEX IF NOT EXISTS idx_employees_code 
  ON employees (employee_code);

-- ============================================
-- 3. ATTENDANCE LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  device_id TEXT,
  verification_method TEXT CHECK (verification_method IN ('face', 'fingerprint')),
  confidence_score FLOAT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee 
  ON attendance_logs (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_check_in 
  ON attendance_logs (check_in DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_status 
  ON attendance_logs (status);

CREATE INDEX IF NOT EXISTS idx_attendance_device 
  ON attendance_logs (device_id);

-- Composite index for daily attendance lookups
CREATE INDEX IF NOT EXISTS idx_attendance_daily 
  ON attendance_logs (employee_id, check_in, status);

-- ============================================
-- 4. DEVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. SHIFTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_name TEXT,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  grace_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default shift
INSERT INTO shifts (shift_name, start_time, end_time, grace_minutes)
VALUES ('Default Shift', '09:00', '17:00', 15)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Employees: Authenticated users can read
CREATE POLICY "Authenticated users can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Attendance Logs: Authenticated users can read, insert
CREATE POLICY "Authenticated users can view attendance"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert attendance"
  ON attendance_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON attendance_logs FOR UPDATE
  TO authenticated
  USING (true);

-- Allow anonymous kiosk to read attendance logs (needed to check if already checked in today)
CREATE POLICY "Anon can read attendance for kiosk"
  ON attendance_logs FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous kiosk to update attendance logs (needed for check-out)
CREATE POLICY "Anon can update attendance for kiosk"
  ON attendance_logs FOR UPDATE
  TO anon
  USING (true);

-- Allow anonymous access for kiosk mode
CREATE POLICY "Anon can read employees for verification"
  ON employees FOR SELECT
  TO anon
  USING (is_active = true);

-- Devices: Authenticated users can manage
CREATE POLICY "Authenticated users can view devices"
  ON devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage devices"
  ON devices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Shifts: Everyone can read
CREATE POLICY "Anyone can read shifts"
  ON shifts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to find best face match using cosine similarity
CREATE OR REPLACE FUNCTION match_face(
  query_embedding vector(512),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 1
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_code TEXT,
  department TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.employee_code,
    e.department,
    1 - (e.face_embedding <=> query_embedding) AS similarity
  FROM employees e
  WHERE e.is_active = true
    AND e.face_embedding IS NOT NULL
    AND 1 - (e.face_embedding <=> query_embedding) >= match_threshold
  ORDER BY e.face_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get attendance summary for a date
CREATE OR REPLACE FUNCTION get_attendance_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  total_employees INT;
  total_present INT;
  total_late INT;
  total_failed INT;
  shift_start TIME;
  grace_min INT;
BEGIN
  -- Get total active employees
  SELECT COUNT(*) INTO total_employees
  FROM employees WHERE is_active = true;

  -- Get unique present employees
  SELECT COUNT(DISTINCT employee_id) INTO total_present
  FROM attendance_logs
  WHERE DATE(check_in) = target_date
    AND status = 'success';

  -- Get failed attempts
  SELECT COUNT(*) INTO total_failed
  FROM attendance_logs
  WHERE DATE(check_in) = target_date
    AND status = 'failed';

  -- Get shift info for late calculation
  SELECT s.start_time, s.grace_minutes
  INTO shift_start, grace_min
  FROM shifts s LIMIT 1;

  -- Calculate late arrivals
  IF shift_start IS NOT NULL THEN
    SELECT COUNT(DISTINCT employee_id) INTO total_late
    FROM attendance_logs
    WHERE DATE(check_in) = target_date
      AND status = 'success'
      AND check_in::TIME > (shift_start + (grace_min || ' minutes')::INTERVAL);
  ELSE
    total_late := 0;
  END IF;

  result := json_build_object(
    'total_employees', total_employees,
    'total_present', total_present,
    'total_absent', total_employees - total_present,
    'total_late', total_late,
    'total_failed', total_failed,
    'date', target_date
  );

  RETURN result;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE OR REPLACE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
