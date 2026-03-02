import { useState, useCallback } from 'react';
import {
    processAttendance,
    logFailedAttempt,
    getAttendanceLogs,
    getAttendanceSummary,
} from '../services/attendanceService';

/**
 * Hook for attendance operations
 */
export function useAttendance() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    const markAttendance = useCallback(async (params) => {
        setLoading(true);
        setError(null);
        try {
            const result = await processAttendance(params);
            if (!result.success) {
                setError(result.error);
            }
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, []);

    const recordFailedAttempt = useCallback(async (params) => {
        try {
            await logFailedAttempt(params);
        } catch (err) {
            console.error('Failed to record failed attempt:', err);
        }
    }, []);

    const fetchLogs = useCallback(async (filters = {}) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAttendanceLogs(filters);
            if (result.success) {
                setLogs(result.data);
                setTotalCount(result.count);
            } else {
                setError(result.error);
            }
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSummary = useCallback(async (date) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAttendanceSummary(date);
            if (result.success) {
                setSummary(result.data);
            } else {
                setError(result.error);
            }
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        summary,
        logs,
        totalCount,
        markAttendance,
        recordFailedAttempt,
        fetchLogs,
        fetchSummary,
    };
}

export default useAttendance;
