// Supabase Edge Function: verify-face
// Compares a face embedding against stored embeddings using pgvector cosine similarity
//
// Deploy: supabase functions deploy verify-face
// Usage: POST /functions/v1/verify-face
// Body: { "embedding": [...512 floats], "device_id": "kiosk-main" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MATCH_THRESHOLD = 0.75;
const MAX_FAILED_ATTEMPTS = 5;

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { embedding, device_id = 'unknown' } = await req.json();

        // Validate input
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 512) {
            return new Response(
                JSON.stringify({ error: 'Invalid embedding. Expected 512-dimensional array.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check rate limit for device
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: failedCount } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('device_id', device_id)
            .eq('status', 'failed')
            .gte('check_in', oneHourAgo);

        if (failedCount >= MAX_FAILED_ATTEMPTS) {
            return new Response(
                JSON.stringify({
                    matched: false,
                    error: 'Too many failed attempts. Please wait before trying again.',
                    rate_limited: true,
                }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Use pgvector's cosine similarity via the match_face function
        const { data: matches, error: matchError } = await supabase.rpc('match_face', {
            query_embedding: `[${embedding.join(',')}]`,
            match_threshold: MATCH_THRESHOLD,
            match_count: 1,
        });

        if (matchError) {
            console.error('Match error:', matchError);
            throw matchError;
        }

        if (matches && matches.length > 0) {
            const match = matches[0];

            // Verify employee is active
            const { data: employee } = await supabase
                .from('employees')
                .select('is_active')
                .eq('id', match.employee_id)
                .single();

            if (!employee?.is_active) {
                return new Response(
                    JSON.stringify({
                        matched: false,
                        message: 'Employee account is deactivated.',
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    matched: true,
                    employee: {
                        id: match.employee_id,
                        name: match.employee_name,
                        employee_code: match.employee_code,
                        department: match.department,
                    },
                    confidence: match.similarity,
                    message: `Welcome, ${match.employee_name}!`,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // No match - log failed attempt
        await supabase.from('attendance_logs').insert({
            device_id,
            verification_method: 'face',
            confidence_score: 0,
            status: 'failed',
        });

        return new Response(
            JSON.stringify({
                matched: false,
                message: 'Face not recognized. Please try again or contact HR.',
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
