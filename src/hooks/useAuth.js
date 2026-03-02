import { useAuth as useAuthContext } from '../context/AuthContext';

/**
 * Hook for accessing auth state and methods
 * Re-exports the context hook for clean imports
 */
export function useSupabaseAuth() {
    return useAuthContext();
}

export default useSupabaseAuth;
