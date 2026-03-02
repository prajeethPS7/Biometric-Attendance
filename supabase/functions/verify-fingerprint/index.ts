// Supabase Edge Function: verify-fingerprint
// Verifies fingerprint template against stored encrypted templates
//
// Deploy: supabase functions deploy verify-fingerprint
// Usage: POST /functions/v1/verify-fingerprint
// Body: { "template": "...", "device_id": "kiosk-main" }
//
// NOTE: In production, fingerprint matching should be done by
// the local middleware service, not the edge function.
// This function receives the employee_id from the middleware
// after local matching and processes the attendance.

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

        const { employee_id, template, device_id = 'unknown', confidence = 0.95 } = await req.json();

        // If middleware has already matched and sends employee_id
        if (employee_id) {
            // Verify employee is active
            const { data: employee, error } = await supabase
                .from('employees')
                .select('id, name, employee_code, department, is_active')
                .eq('id', employee_id)
                .single();

            if (error || !employee) {
                return new Response(
                    JSON.stringify({ matched: false, message: 'Employee not found.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (!employee.is_active) {
                return new Response(
                    JSON.stringify({ matched: false, message: 'Employee account is deactivated.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    matched: true,
                    employee: {
                        id: employee.id,
                        name: employee.name,
                        employee_code: employee.employee_code,
                        department: employee.department,
                    },
                    confidence,
                    message: `Welcome, ${employee.name}!`,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // If no employee_id, template-based lookup is not supported yet
        return new Response(
            JSON.stringify({
                matched: false,
                message: 'Fingerprint verification requires local middleware service.',
                integration_note: 'Connect a fingerprint scanner via the local middleware to enable this feature.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
