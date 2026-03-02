import { supabase } from './supabaseClient';

// ============================================
// BIOMETRIC SERVICE
// Face recognition & fingerprint helpers
// ============================================

const FACE_MATCH_THRESHOLD = 0.75;
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Compute cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
}

/**
 * Check if device/IP has too many failed attempts (rate limiting)
 */
export async function checkRateLimit(deviceId) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { count, error } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('device_id', deviceId)
            .eq('status', 'failed')
            .gte('check_in', oneHourAgo);

        if (error) throw error;

        return {
            allowed: (count || 0) < MAX_FAILED_ATTEMPTS,
            attempts: count || 0,
            maxAttempts: MAX_FAILED_ATTEMPTS,
        };
    } catch (error) {
        console.error('Rate limit check error:', error);
        return { allowed: true, attempts: 0, maxAttempts: MAX_FAILED_ATTEMPTS };
    }
}

/**
 * Verify face embedding against stored embeddings
 * Uses client-side cosine similarity comparison
 */
export async function verifyFaceEmbedding(embedding) {
    try {
        // Fetch all active employees with face embeddings
        const { data: employees, error } = await supabase
            .from('employees')
            .select('id, name, employee_code, department, face_embedding')
            .eq('is_active', true)
            .not('face_embedding', 'is', null);

        if (error) throw error;

        if (!employees || employees.length === 0) {
            return { matched: false, message: 'No enrolled employees found' };
        }

        let bestMatch = null;
        let bestScore = 0;

        for (const employee of employees) {
            let storedEmbedding = employee.face_embedding;

            // Parse if stored as string
            if (typeof storedEmbedding === 'string') {
                try {
                    storedEmbedding = JSON.parse(storedEmbedding);
                } catch {
                    continue;
                }
            }

            if (!Array.isArray(storedEmbedding)) continue;

            const similarity = cosineSimilarity(embedding, storedEmbedding);

            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = employee;
            }
        }

        if (bestScore >= FACE_MATCH_THRESHOLD && bestMatch) {
            return {
                matched: true,
                employee: {
                    id: bestMatch.id,
                    name: bestMatch.name,
                    employeeCode: bestMatch.employee_code,
                    department: bestMatch.department,
                },
                confidence: bestScore,
                message: `Welcome, ${bestMatch.name}!`,
            };
        }

        return {
            matched: false,
            confidence: bestScore,
            message: 'Face not recognized. Please try again or contact HR.',
        };
    } catch (error) {
        console.error('Face verification error:', error);
        return { matched: false, error: error.message, message: 'Verification failed' };
    }
}

/**
 * Enroll face embedding for an employee
 */
export async function enrollFaceEmbedding(employeeId, embedding) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .update({ face_embedding: embedding })
            .eq('id', employeeId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data, message: 'Face enrolled successfully' };
    } catch (error) {
        console.error('Face enrollment error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Store encrypted fingerprint template
 */
export async function enrollFingerprint(employeeId, template) {
    try {
        // In production, encrypt the template before storing
        const encryptedTemplate = btoa(JSON.stringify(template));

        const { data, error } = await supabase
            .from('employees')
            .update({ fingerprint_template: encryptedTemplate })
            .eq('id', employeeId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data, message: 'Fingerprint enrolled successfully' };
    } catch (error) {
        console.error('Fingerprint enrollment error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verify fingerprint template
 * In production, this would be handled by a local middleware service
 */
export async function verifyFingerprint(template) {
    try {
        const { data: employees, error } = await supabase
            .from('employees')
            .select('id, name, employee_code, department, fingerprint_template')
            .eq('is_active', true)
            .not('fingerprint_template', 'is', null);

        if (error) throw error;

        // Placeholder for actual fingerprint matching logic
        // In production, this would use a fingerprint SDK
        for (const employee of employees) {
            try {
                const stored = JSON.parse(atob(employee.fingerprint_template));
                // Simulated match comparison
                if (stored && template) {
                    return {
                        matched: true,
                        employee: {
                            id: employee.id,
                            name: employee.name,
                            employeeCode: employee.employee_code,
                            department: employee.department,
                        },
                        confidence: 0.95,
                        message: `Welcome, ${employee.name}!`,
                    };
                }
            } catch {
                continue;
            }
        }

        return {
            matched: false,
            message: 'Fingerprint not recognized.',
        };
    } catch (error) {
        console.error('Fingerprint verification error:', error);
        return { matched: false, error: error.message };
    }
}

/**
 * Get employee by ID
 */
export async function getEmployee(employeeId) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get all employees
 */
export async function getEmployees(filters = {}) {
    try {
        let query = supabase
            .from('employees')
            .select('*', { count: 'exact' })
            .order('name', { ascending: true });

        if (filters.department) {
            query = query.eq('department', filters.department);
        }
        if (filters.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive);
        }
        if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%,employee_code.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;

        if (error) throw error;
        return { success: true, data, count };
    } catch (error) {
        console.error('Error fetching employees:', error);
        return { success: false, error: error.message, data: [], count: 0 };
    }
}

/**
 * Create employee
 */
export async function createEmployee(employeeData) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .insert(employeeData)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error creating employee:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update employee
 */
export async function updateEmployee(employeeId, updates) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', employeeId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error updating employee:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete / deactivate employee
 */
export async function deactivateEmployee(employeeId) {
    try {
        const { data, error } = await supabase
            .from('employees')
            .update({ is_active: false })
            .eq('id', employeeId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error deactivating employee:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// DEVICE MANAGEMENT
// ============================================

export async function getDevices() {
    try {
        const { data, error } = await supabase
            .from('devices')
            .select('*')
            .order('device_name', { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message, data: [] };
    }
}

export async function createDevice(deviceData) {
    try {
        const { data, error } = await supabase
            .from('devices')
            .insert(deviceData)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function updateDevice(deviceId, updates) {
    try {
        const { data, error } = await supabase
            .from('devices')
            .update(updates)
            .eq('id', deviceId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function toggleDeviceStatus(deviceId, isActive) {
    return updateDevice(deviceId, { is_active: isActive });
}
