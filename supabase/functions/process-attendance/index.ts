// Supabase Edge Function: process-attendance
// Handles attendance check-in/check-out logic
//
// Deploy: supabase functions deploy process-attendance
// Usage: POST /functions/v1/process-attendance
// Body: {
//   "employee_id": "uuid",
//   "device_id": "kiosk-main",
//   "verification_method": "face" | "fingerprint",
//   "confidence_score": 0.92
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
            employee_id,
            device_id = 'unknown',
            verification_method = 'face',
            confidence_score = 0,
        } = await req.json();

        // Validate input
        if (!employee_id) {
            return new Response(
                JSON.stringify({ error: 'employee_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify employee exists and is active
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('id, name, is_active')
            .eq('id', employee_id)
            .single();

        if (empError || !employee) {
            return new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!employee.is_active) {
            return new Response(
                JSON.stringify({ error: 'Employee account is deactivated' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get today's date range
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        // Check existing attendance for today
        const { data: existing } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employee_id)
            .gte('check_in', startOfDay)
            .lte('check_in', endOfDay)
            .eq('status', 'success')
            .order('check_in', { ascending: false })
            .limit(1);

        let result;

        if (!existing || existing.length === 0) {
            // Rule 1: No record → Insert check_in
            const { data, error } = await supabase
                .from('attendance_logs')
                .insert({
                    employee_id,
                    check_in: now.toISOString(),
                    device_id,
                    verification_method,
                    confidence_score,
                    status: 'success',
                })
                .select()
                .single();

            if (error) throw error;

            result = {
                success: true,
                type: 'check_in',
                record: data,
                employee_name: employee.name,
                message: `Check-in recorded for ${employee.name}`,
            };
        } else if (existing[0].check_out === null) {
            // Rule 2: Record exists, no check_out → Update check_out
            const { data, error } = await supabase
                .from('attendance_logs')
                .update({ check_out: now.toISOString() })
                .eq('id', existing[0].id)
                .select()
                .single();

            if (error) throw error;

            result = {
                success: true,
                type: 'check_out',
                record: data,
                employee_name: employee.name,
                message: `Check-out recorded for ${employee.name}`,
            };
        } else {
            // Rule 3: Both exist → Reject duplicate
            result = {
                success: true,
                type: 'duplicate',
                record: existing[0],
                employee_name: employee.name,
                message: `Attendance already fully recorded for ${employee.name} today`,
            };
        }

        return new Response(JSON.stringify(result), {
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
