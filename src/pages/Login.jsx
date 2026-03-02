import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ScanFace,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    ArrowRight,
    Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
    const navigate = useNavigate();
    const { signIn, loading } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.email || !formData.password) {
            setError('Please fill in all fields');
            return;
        }

        const result = await signIn(formData.email, formData.password);
        if (result.success) {
            toast.success('Welcome back!');
            navigate('/dashboard');
        } else {
            setError(result.error || 'Invalid email or password');
        }
    };

    return (
        <div className="min-h-screen flex bg-surface-950 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary-600/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-600/5 blur-3xl" />

                {/* Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '64px 64px',
                    }}
                />
            </div>

            {/* Left Panel - Branding */}
            <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 relative">
                <div className="max-w-md space-y-8 animate-fade-in">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-primary-500/20">
                        <ScanFace className="w-10 h-10 text-white" />
                    </div>

                    <div>
                        <h1 className="text-4xl font-bold text-surface-100 leading-tight mb-3">
                            BioAttend
                        </h1>
                        <p className="text-lg text-surface-400 leading-relaxed">
                            Industrial Biometric Attendance Management System
                        </p>
                    </div>

                    <div className="space-y-4">
                        {[
                            { icon: ScanFace, text: 'Face Recognition Verification' },
                            { icon: Shield, text: 'Secure & Encrypted Biometrics' },
                            { icon: ArrowRight, text: 'Real-time Attendance Tracking' },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 text-surface-400 animate-slide-in-left"
                                style={{ animationDelay: `${i * 150}ms` }}
                            >
                                <div className="w-10 h-10 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center">
                                    <feature.icon className="w-5 h-5 text-primary-400" />
                                </div>
                                <span className="text-sm">{feature.text}</span>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-surface-600 pt-4">
                        © 2026 BioAttend. Enterprise Biometric Solutions.
                    </p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-6 relative">
                <div className="w-full max-w-md animate-slide-in-up">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
                            <ScanFace className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-surface-100">BioAttend</h1>
                            <p className="text-xs text-surface-500">Industrial Attendance</p>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="glass rounded-2xl p-8">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-surface-100">
                                Welcome Back
                            </h2>
                            <p className="text-sm text-surface-500 mt-1">
                                Sign in to manage attendance
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm mb-5">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div>
                                <label className="form-label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                                    <input
                                        type="email"
                                        className="form-input pl-10"
                                        placeholder="admin@company.com"
                                        value={formData.email}
                                        onChange={(e) =>
                                            setFormData((p) => ({ ...p, email: e.target.value }))
                                        }
                                        id="input-email"
                                        autoComplete="email"
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
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) =>
                                            setFormData((p) => ({ ...p, password: e.target.value }))
                                        }
                                        id="input-password"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full justify-center py-3 text-base"
                                id="btn-login"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Info */}
                        <div className="mt-6 text-center">
                            <p className="text-xs text-surface-600">
                                Contact your administrator for account access
                            </p>
                        </div>
                    </div>

                    {/* Kiosk Link */}
                    <div className="mt-6 text-center">
                        <Link
                            to="/kiosk"
                            className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-primary-400 transition-colors"
                        >
                            <ScanFace className="w-4 h-4" />
                            Open Attendance Kiosk
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
