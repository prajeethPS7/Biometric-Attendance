import { useState, useEffect, useCallback } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Trash2,
    X,
    Save,
    Loader2,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function UserManagement() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'hr',
        full_name: '',
    });
    const [formError, setFormError] = useState('');

    // Fetch all users (profiles + auth data)
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Create new user via Supabase Auth
    const handleCreateUser = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.email || !formData.password || !formData.full_name) {
            setFormError('Please fill in all fields');
            return;
        }

        if (formData.password.length < 6) {
            setFormError('Password must be at least 6 characters');
            return;
        }

        setCreating(true);
        try {
            // Use Supabase Admin API (via service role) or client signup
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        role: formData.role,
                        full_name: formData.full_name,
                    },
                },
            });

            if (error) throw error;

            // Update profile with full_name if not set by trigger
            if (data.user) {
                await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        role: formData.role,
                        full_name: formData.full_name,
                    });
            }

            toast.success(`User "${formData.full_name}" created successfully!`);
            setShowForm(false);
            setFormData({ email: '', password: '', role: 'hr', full_name: '' });
            fetchUsers();
        } catch (err) {
            setFormError(err.message || 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    // Update user role
    const handleUpdateRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Role updated');
            fetchUsers();
        } catch (err) {
            toast.error('Failed to update role');
        }
    };

    // Delete user (remove profile - auth user remains but can't access)
    const handleDeactivateUser = async (userId, userName) => {
        if (!confirm(`Are you sure you want to remove "${userName}"? They will no longer be able to access the system.`)) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            toast.success('User removed');
            fetchUsers();
        } catch (err) {
            toast.error('Failed to remove user');
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <Shield className="w-16 h-16 text-surface-600" />
                <h2 className="text-xl font-bold text-surface-300">Access Restricted</h2>
                <p className="text-surface-500 text-sm">Only administrators can manage system users</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">User Management</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Add and manage system operators (Admin / HR)
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(true);
                        setFormError('');
                        setFormData({ email: '', password: '', role: 'hr', full_name: '' });
                    }}
                    className="btn-primary"
                    id="btn-add-user"
                >
                    <UserPlus className="w-4 h-4" />
                    Add New User
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{users.length}</p>
                        <p className="text-[11px] text-surface-500">Total Users</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {users.filter((u) => u.role === 'admin').length}
                        </p>
                        <p className="text-[11px] text-surface-500">Admins</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {users.filter((u) => u.role === 'hr').length}
                        </p>
                        <p className="text-[11px] text-surface-500">HR Users</p>
                    </div>
                </div>
            </div>

            {/* User List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-5 flex items-center gap-4">
                            <div className="skeleton w-12 h-12 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <div className="skeleton h-4 w-1/3 rounded" />
                                <div className="skeleton h-3 w-1/4 rounded" />
                            </div>
                            <div className="skeleton h-8 w-20 rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center">
                        <Users className="w-8 h-8 text-surface-600" />
                    </div>
                    <p className="text-lg font-medium text-surface-400">No users found</p>
                    <p className="text-sm text-surface-600">Create your first system user</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map((user, i) => (
                        <div
                            key={user.id}
                            className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-5 flex items-center gap-4 hover:border-surface-600/50 transition-all animate-slide-in-up"
                            style={{ animationDelay: `${i * 60}ms` }}
                        >
                            {/* Avatar */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white ${user.role === 'admin'
                                    ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                                    : 'bg-gradient-to-br from-cyan-600 to-cyan-800'
                                }`}>
                                {user.full_name?.[0]?.toUpperCase() || '?'}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-surface-100 truncate">
                                    {user.full_name || 'Unnamed User'}
                                </p>
                                <p className="text-xs text-surface-500 truncate">
                                    ID: {user.id.substring(0, 8)}... · Joined {new Date(user.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {/* Role Badge & Actions */}
                            <div className="flex items-center gap-3">
                                <select
                                    className="form-select w-28 text-xs py-1.5"
                                    value={user.role}
                                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="hr">HR</option>
                                </select>

                                <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-info'
                                    }`}>
                                    {user.role === 'admin' ? 'Admin' : 'HR'}
                                </span>

                                <button
                                    onClick={() => handleDeactivateUser(user.id, user.full_name)}
                                    className="p-2 rounded-lg hover:bg-danger-500/10 text-surface-500 hover:text-danger-400 transition-colors"
                                    title="Remove user"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Create User Modal ─────────────────────── */}
            {showForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80"
                    style={{ backdropFilter: 'blur(4px)' }}
                >
                    <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-md animate-slide-in-up">
                        <div className="flex items-center justify-between p-5 border-b border-surface-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-primary-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-surface-100">Add New User</h2>
                                    <p className="text-xs text-surface-500">Create a system operator account</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-2 rounded-lg hover:bg-surface-700 text-surface-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-5 space-y-5">
                            {/* Error */}
                            {formError && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Full Name */}
                            <div>
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Priya Sharma"
                                    value={formData.full_name}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, full_name: e.target.value }))
                                    }
                                    id="input-user-name"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="form-label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                                    <input
                                        type="email"
                                        className="form-input pl-10"
                                        placeholder="user@company.com"
                                        value={formData.email}
                                        onChange={(e) =>
                                            setFormData((p) => ({ ...p, email: e.target.value }))
                                        }
                                        id="input-user-email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="form-label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-input pl-10 pr-10"
                                        placeholder="Minimum 6 characters"
                                        value={formData.password}
                                        onChange={(e) =>
                                            setFormData((p) => ({ ...p, password: e.target.value }))
                                        }
                                        id="input-user-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="form-label">Role</label>
                                <select
                                    className="form-select"
                                    value={formData.role}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, role: e.target.value }))
                                    }
                                    id="select-user-role"
                                >
                                    <option value="hr">HR — Can manage employees & view reports</option>
                                    <option value="admin">Admin — Full system access</option>
                                </select>
                            </div>

                            {/* Info */}
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-surface-400">
                                <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                                <p>
                                    The user will be able to sign in with these credentials at the login page.
                                    They will have access based on their assigned role.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="btn-primary flex-1 justify-center"
                                    id="btn-create-user"
                                >
                                    {creating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Create User
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
