import { supabase } from './supabaseClient';

// ============================================
// ATTENDANCE SERVICE
// Handles all attendance-related operations
// ============================================

/**
 * Process attendance check-in or check-out
 * Business Rules:
 * 1. No record today → Insert check_in
 * 2. Record exists, check_out is null → Update check_out
 * 3. Both exist → Reject duplicate
 */
export async function processAttendance({
    employeeId,
    deviceId = 'kiosk-main',
    verificationMethod = 'face',
    confidenceScore = 0,
}) {
    try {
        // Use local date boundaries to avoid timezone mismatch
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        console.log('[Attendance] Processing for employee:', employeeId);
        console.log('[Attendance] Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

        // Check for existing attendance record today
        const { data: existing, error: fetchError } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('check_in', startOfDay.toISOString())
            .lte('check_in', endOfDay.toISOString())
            .eq('status', 'success')
            .order('check_in', { ascending: false })
            .limit(1);

        if (fetchError) {
            console.error('[Attendance] Error fetching existing records:', fetchError);
            throw fetchError;
        }

        console.log('[Attendance] Existing records found:', existing?.length || 0, existing);

        const now = new Date().toISOString();
        let result;

        if (!existing || existing.length === 0) {
            // Rule 1: No record today → Insert check_in
            console.log('[Attendance] No existing record → CHECK IN');
            const { data, error } = await supabase
                .from('attendance_logs')
                .insert({
                    employee_id: employeeId,
                    check_in: now,
                    device_id: deviceId,
                    verification_method: verificationMethod,
                    confidence_score: confidenceScore,
                    status: 'success',
                })
                .select()
                .single();

            if (error) {
                console.error('[Attendance] Check-in insert error:', error);
                throw error;
            }
            console.log('[Attendance] ✅ Check-in recorded:', data);
            result = { type: 'check_in', record: data, message: 'Check-in recorded successfully' };
        } else if (existing[0].check_out === null) {
            // Rule 2: Record exists, no check_out → Update check_out
            console.log('[Attendance] Existing record without checkout → CHECK OUT, record id:', existing[0].id);
            const { data, error } = await supabase
                .from('attendance_logs')
                .update({ check_out: now })
                .eq('id', existing[0].id)
                .select()
                .single();

            if (error) {
                console.error('[Attendance] Check-out update error:', error);
                throw error;
            }
            console.log('[Attendance] ✅ Check-out recorded:', data);
            result = { type: 'check_out', record: data, message: 'Check-out recorded successfully' };
        } else {
            // Rule 3: Both exist → Reject duplicate
            console.log('[Attendance] Already has check-in and check-out → DUPLICATE');
            result = {
                type: 'duplicate',
                record: existing[0],
                message: 'Attendance already fully recorded for today',
            };
        }

        return { success: true, ...result };
    } catch (error) {
        console.error('Attendance processing error:', error);
        return { success: false, error: error.message, type: 'error', message: 'Failed to process attendance: ' + error.message };
    }
}

/**
 * Log a failed attendance attempt
 */
export async function logFailedAttempt({
    deviceId = 'kiosk-main',
    verificationMethod = 'face',
    confidenceScore = 0,
}) {
    try {
        const { error } = await supabase.from('attendance_logs').insert({
            employee_id: null,
            check_in: new Date().toISOString(),
            device_id: deviceId,
            verification_method: verificationMethod,
            confidence_score: confidenceScore,
            status: 'failed',
        });

        if (error) throw error;
    } catch (error) {
        console.error('Failed to log failed attempt:', error);
    }
}

/**
 * Get attendance logs with filters
 */
export async function getAttendanceLogs({
    dateFrom,
    dateTo,
    department,
    employeeId,
    status,
    page = 1,
    pageSize = 50,
} = {}) {
    try {
        let query = supabase
            .from('attendance_logs')
            .select('*, employees(name, employee_code, department)', { count: 'exact' })
            .order('check_in', { ascending: false });

        if (dateFrom) {
            query = query.gte('check_in', new Date(dateFrom).toISOString());
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            query = query.lte('check_in', end.toISOString());
        }
        if (employeeId) {
            query = query.eq('employee_id', employeeId);
        }
        if (status) {
            query = query.eq('status', status);
        }

        // Pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        // Filter by department client-side (since it's on joined table)
        let filteredData = data;
        if (department) {
            filteredData = data.filter(
                (log) => log.employees && log.employees.department === department
            );
        }

        return { success: true, data: filteredData, count, page, pageSize };
    } catch (error) {
        console.error('Error fetching attendance logs:', error);
        return { success: false, error: error.message, data: [], count: 0 };
    }
}

/**
 * Get attendance summary for dashboard
 */
export async function getAttendanceSummary(date) {
    try {
        const targetDate = date || new Date();
        const startOfDay = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate()
        ).toISOString();
        const endOfDay = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate(),
            23, 59, 59
        ).toISOString();

        // Get today's attendance
        const { data: todayLogs, error } = await supabase
            .from('attendance_logs')
            .select('*, employees(name, department)')
            .gte('check_in', startOfDay)
            .lte('check_in', endOfDay);

        if (error) throw error;

        // Get total active employees
        const { count: totalEmployees } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const successLogs = todayLogs.filter((l) => l.status === 'success');
        const failedLogs = todayLogs.filter((l) => l.status === 'failed');
        const uniquePresent = new Set(successLogs.map((l) => l.employee_id)).size;

        // Get shift for late calculation
        const { data: shifts } = await supabase
            .from('shifts')
            .select('*')
            .limit(1)
            .single();

        let lateCount = 0;
        if (shifts) {
            const [shiftHour, shiftMin] = shifts.start_time.split(':').map(Number);
            const graceMinutes = shifts.grace_minutes || 0;
            const lateThreshold = new Date(targetDate);
            lateThreshold.setHours(shiftHour, shiftMin + graceMinutes, 0, 0);

            lateCount = successLogs.filter((log) => {
                const checkIn = new Date(log.check_in);
                return checkIn > lateThreshold;
            }).length;
        }

        return {
            success: true,
            data: {
                totalPresent: uniquePresent,
                totalAbsent: (totalEmployees || 0) - uniquePresent,
                totalLate: lateCount,
                totalFailed: failedLogs.length,
                totalEmployees: totalEmployees || 0,
                recentLogs: todayLogs.slice(0, 10),
            },
        };
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        return {
            success: false,
            error: error.message,
            data: {
                totalPresent: 0,
                totalAbsent: 0,
                totalLate: 0,
                totalFailed: 0,
                totalEmployees: 0,
                recentLogs: [],
            },
        };
    }
}

/**
 * Export attendance data to CSV
 */
export function exportToCSV(data, filename = 'attendance_report') {
    if (!data || data.length === 0) return;

    const headers = [
        'Employee Code',
        'Employee Name',
        'Department',
        'Check In',
        'Check Out',
        'Method',
        'Confidence',
        'Status',
        'Device',
    ];

    const rows = data.map((log) => [
        log.employees?.employee_code || 'N/A',
        log.employees?.name || 'Unknown',
        log.employees?.department || 'N/A',
        log.check_in ? new Date(log.check_in).toLocaleString() : '',
        log.check_out ? new Date(log.check_out).toLocaleString() : '',
        log.verification_method || '',
        log.confidence_score ? (log.confidence_score * 100).toFixed(1) + '%' : '',
        log.status || '',
        log.device_id || '',
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}
