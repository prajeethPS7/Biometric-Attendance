import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export const ROLES = {
    ADMIN: 'admin',
    HR: 'hr',
};

const isSupabaseConfigured = () => {
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    return (
        url.startsWith('https://') &&
        url.includes('.supabase.co') &&
        key.length > 20 &&
        !url.includes('placeholder') &&
        !key.includes('placeholder') &&
        !url.includes('your_')
    );
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(true);
    const initialized = useRef(false);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            console.warn('Supabase not configured. Running in demo mode.');
            setLoading(false);
            setInitializing(false);
            return;
        }

        // Prevent double-init from React Strict Mode
        if (initialized.current) return;
        initialized.current = true;

        let subscription;

        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    // Ignore lock errors — they resolve themselves
                    if (error.message?.includes('Lock') || error.name === 'AbortError') {
                        console.warn('Auth lock contention (normal in dev mode), retrying...');
                        // Retry after a short delay
                        setTimeout(async () => {
                            try {
                                const { data: { session: retrySession } } = await supabase.auth.getSession();
                                if (retrySession?.user) {
                                    setUser(retrySession.user);
                                    await fetchUserRole(retrySession.user.id);
                                }
                            } catch (e) {
                                console.warn('Auth retry also failed, continuing without session');
                            } finally {
                                setLoading(false);
                                setInitializing(false);
                            }
                        }, 1000);
                        return;
                    }
                    throw error;
                }

                if (session?.user) {
                    setUser(session.user);
                    await fetchUserRole(session.user.id);
                }
            } catch (error) {
                // Catch AbortError from lock contention
                if (error?.name === 'AbortError' || error?.message?.includes('Lock')) {
                    console.warn('Auth lock error (harmless in dev):', error.message);
                } else {
                    console.error('Error getting session:', error);
                }
            } finally {
                setLoading(false);
                setInitializing(false);
            }
        };

        initAuth();

        // Listen for auth changes
        try {
            const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    await fetchUserRole(session.user.id);
                } else {
                    setUser(null);
                    setUserRole(null);
                }
                setLoading(false);
                setInitializing(false);
            });
            subscription = data?.subscription;
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('Auth listener error:', error);
            }
            setLoading(false);
            setInitializing(false);
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const fetchUserRole = async (userId) => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            if (currentUser?.user_metadata?.role) {
                setUserRole(currentUser.user_metadata.role);
                return;
            }

            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (data?.role) {
                setUserRole(data.role);
            } else {
                setUserRole(ROLES.ADMIN);
            }
        } catch {
            setUserRole(ROLES.ADMIN);
        }
    };

    const signIn = async (email, password) => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured.' };
        }
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Wait for onAuthStateChange to update user state
            // This prevents the race condition where navigate('/dashboard') fires
            // before user is set, causing ProtectedRoute to redirect back to /login
            if (data?.session?.user) {
                setUser(data.session.user);
                await fetchUserRole(data.session.user.id);
            }

            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email, password, role = ROLES.ADMIN) => {
        if (!isSupabaseConfigured()) {
            return { success: false, error: 'Supabase is not configured.' };
        }
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email, password,
                options: { data: { role } },
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        setLoading(true);
        try {
            await supabase.auth.signOut();
            setUser(null);
            setUserRole(null);
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            setLoading(false);
        }
    };

    const value = {
        user,
        userRole,
        loading,
        initializing,
        isAdmin: userRole === ROLES.ADMIN,
        isHR: userRole === ROLES.HR,
        isConfigured: isSupabaseConfigured(),
        signIn,
        signUp,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

export default AuthContext;
