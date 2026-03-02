// Supabase Edge Function: get-attendance-report
// Returns attendance data with filters and summary
//
// Deploy: supabase functions deploy get-attendance-report
// Usage: POST /functions/v1/get-attendance-report
// Body: {
//   "date_from": "2026-03-01",
//   "date_to": "2026-03-01",
//   "department": "Production",
//   "employee_id": "uuid",
//   "status": "success",
//   "page": 1,
//   "page_size": 50
// }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const {
            date_from,
            date_to,
            department,
            employee_id,
            status,
            page = 1,
            page_size = 50,
        } = await req.json();

        // Build query
        let query = supabase
            .from('attendance_logs')
            .select('*, employees(name, employee_code, department)', { count: 'exact' })
            .order('check_in', { ascending: false });

        // Apply filters
        if (date_from) {
            query = query.gte('check_in', new Date(date_from).toISOString());
        }
        if (date_to) {
            const endDate = new Date(date_to);
            endDate.setHours(23, 59, 59, 999);
            query = query.lte('check_in', endDate.toISOString());
        }
        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }
        if (status) {
            query = query.eq('status', status);
        }

        // Pagination
        const from = (page - 1) * page_size;
        const to = from + page_size - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        // Filter by department client-side
        let filteredData = data;
        if (department) {
            filteredData = data.filter(
                (log) => log.employees?.department === department
            );
        }

        // Calculate summary
        const successLogs = (data || []).filter((l) => l.status === 'success');
        const failedLogs = (data || []).filter((l) => l.status === 'failed');
        const uniquePresent = new Set(successLogs.map((l) => l.employee_id)).size;

        // Get shift info for late calculation
        const { data: shift } = await supabase.from('shifts').select('*').limit(1).single();

        let lateCount = 0;
        if (shift && date_from) {
            const [shiftHour, shiftMin] = shift.start_time.split(':').map(Number);
            const graceMinutes = shift.grace_minutes || 0;

            lateCount = successLogs.filter((log) => {
                const checkIn = new Date(log.check_in);
                const lateThreshold = new Date(checkIn);
                lateThreshold.setHours(shiftHour, shiftMin + graceMinutes, 0, 0);
                return checkIn > lateThreshold;
            }).length;
        }

        const response = {
            data: filteredData,
            summary: {
                total_present: uniquePresent,
                total_late: lateCount,
                total_failed: failedLogs.length,
                total_records: count,
            },
            pagination: {
                page,
                page_size,
                total: count,
                total_pages: Math.ceil((count || 0) / page_size),
            },
        };

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
