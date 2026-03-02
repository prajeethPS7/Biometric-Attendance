-- ============================================
-- SEED DATA FOR TESTING
-- Run this after schema.sql
-- ============================================

-- Insert sample devices
INSERT INTO devices (device_name, location, is_active) VALUES
  ('Main Entrance Kiosk', 'Building A - Ground Floor', true),
  ('Factory Floor Scanner', 'Production Hall - East Wing', true),
  ('Warehouse Gate', 'Warehouse B - Loading Dock', true),
  ('Office Lobby', 'Building C - Reception', false);

-- Insert sample employees (without face embeddings - those need to be enrolled via webcam)
INSERT INTO employees (employee_code, name, department, is_active) VALUES
  ('EMP-001', 'Rajesh Kumar', 'Production', true),
  ('EMP-002', 'Priya Sharma', 'Quality Control', true),
  ('EMP-003', 'Amit Patel', 'Warehouse', true),
  ('EMP-004', 'Sneha Reddy', 'HR', true),
  ('EMP-005', 'Vikram Singh', 'Maintenance', true),
  ('EMP-006', 'Ananya Iyer', 'Administration', true),
  ('EMP-007', 'Rahul Verma', 'IT', true),
  ('EMP-008', 'Deepika Nair', 'Finance', true),
  ('EMP-009', 'Arjun Mehta', 'Logistics', true),
  ('EMP-010', 'Kavita Joshi', 'R&D', true),
  ('EMP-011', 'Suresh Babu', 'Production', true),
  ('EMP-012', 'Meera Das', 'Quality Control', false);

-- Insert default shift (if not already inserted)
INSERT INTO shifts (shift_name, start_time, end_time, grace_minutes)
VALUES ('Morning Shift', '09:00', '17:00', 15)
ON CONFLICT DO NOTHING;

INSERT INTO shifts (shift_name, start_time, end_time, grace_minutes)
VALUES ('Night Shift', '21:00', '05:00', 10)
ON CONFLICT DO NOTHING;
