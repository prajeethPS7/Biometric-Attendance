import { useEffect, useState } from 'react';
import {
    Users,
    UserCheck,
    UserX,
    Clock,
    AlertTriangle,
    TrendingUp,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ScanFace,
    Fingerprint,
    ChevronRight,
} from 'lucide-react';
import { useAttendance } from '../hooks/useAttendance';
import { format } from 'date-fns';

export default function AdminDashboard() {
    const { summary, fetchSummary, loading } = useAttendance();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchSummary(new Date());
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    const stats = [
        {
            label: 'Total Present',
            value: summary?.totalPresent || 0,
            icon: UserCheck,
            color: 'from-emerald-500/20 to-emerald-600/10',
            textColor: 'text-success-400',
            borderColor: 'border-success-500/20',
            trend: '+12%',
            trendUp: true,
        },
        {
            label: 'Total Absent',
            value: summary?.totalAbsent || 0,
            icon: UserX,
            color: 'from-red-500/20 to-red-600/10',
            textColor: 'text-danger-400',
            borderColor: 'border-danger-500/20',
            trend: '-5%',
            trendUp: false,
        },
        {
            label: 'Late Arrivals',
            value: summary?.totalLate || 0,
            icon: Clock,
            color: 'from-amber-500/20 to-amber-600/10',
            textColor: 'text-warning-400',
            borderColor: 'border-warning-500/20',
            trend: '-8%',
            trendUp: false,
        },
        {
            label: 'Failed Attempts',
            value: summary?.totalFailed || 0,
            icon: AlertTriangle,
            color: 'from-rose-500/20 to-rose-600/10',
            textColor: 'text-danger-400',
            borderColor: 'border-danger-500/20',
            trend: null,
            trendUp: false,
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Real-time attendance overview for{' '}
                        {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                </div>

                {/* Live Clock */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                    <span className="text-lg font-mono font-bold text-surface-100 tabular-nums">
                        {currentTime.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={stat.label}
                        className={`stat-card animate-slide-in-up border ${stat.borderColor}`}
                        style={{ animationDelay: `${i * 80}ms` }}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div
                                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                            >
                                <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
                            </div>
                            {stat.trend && (
                                <div
                                    className={`flex items-center gap-0.5 text-xs font-medium ${stat.trendUp ? 'text-success-400' : 'text-danger-400'
                                        }`}
                                >
                                    {stat.trendUp ? (
                                        <ArrowUpRight className="w-3 h-3" />
                                    ) : (
                                        <ArrowDownRight className="w-3 h-3" />
                                    )}
                                    {stat.trend}
                                </div>
                            )}
                        </div>
                        <p className={`text-3xl font-bold ${stat.textColor} mb-1`}>
                            {loading ? (
                                <span className="skeleton inline-block w-10 h-8" />
                            ) : (
                                stat.value
                            )}
                        </p>
                        <p className="text-xs text-surface-500 font-medium">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-surface-800/50 border border-surface-700/50 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary-400" />
                            <h2 className="font-semibold text-surface-100">Recent Activity</h2>
                        </div>
                        <span className="text-xs text-surface-500">Today</span>
                    </div>

                    <div className="divide-y divide-surface-700/30">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-4">
                                    <div className="skeleton w-10 h-10 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="skeleton h-4 w-1/3 rounded" />
                                        <div className="skeleton h-3 w-1/2 rounded" />
                                    </div>
                                    <div className="skeleton h-6 w-16 rounded-full" />
                                </div>
                            ))
                        ) : summary?.recentLogs?.length > 0 ? (
                            summary.recentLogs.map((log, i) => (
                                <div
                                    key={log.id || i}
                                    className="flex items-center gap-4 p-4 hover:bg-surface-800/50 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'success'
                                                ? 'bg-success-500/10'
                                                : 'bg-danger-500/10'
                                            }`}
                                    >
                                        {log.verification_method === 'fingerprint' ? (
                                            <Fingerprint
                                                className={`w-5 h-5 ${log.status === 'success'
                                                        ? 'text-success-400'
                                                        : 'text-danger-400'
                                                    }`}
                                            />
                                        ) : (
                                            <ScanFace
                                                className={`w-5 h-5 ${log.status === 'success'
                                                        ? 'text-success-400'
                                                        : 'text-danger-400'
                                                    }`}
                                            />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-200 truncate">
                                            {log.employees?.name || 'Unknown Employee'}
                                        </p>
                                        <p className="text-xs text-surface-500">
                                            {log.check_in
                                                ? new Date(log.check_in).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })
                                                : '—'}{' '}
                                            · {log.employees?.department || '—'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {log.confidence_score && (
                                            <span className="text-[10px] text-surface-500 font-mono">
                                                {(log.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        )}
                                        <span
                                            className={`badge text-[10px] ${log.status === 'success'
                                                    ? 'badge-success'
                                                    : 'badge-danger'
                                                }`}
                                        >
                                            {log.check_out ? 'Out' : log.status === 'success' ? 'In' : 'Failed'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Calendar className="w-12 h-12 text-surface-700" />
                                <p className="text-surface-500 text-sm">No attendance records today</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats Sidebar */}
                <div className="space-y-4">
                    {/* Workforce Summary */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-primary-400" />
                            <h2 className="font-semibold text-surface-100 text-sm">Workforce</h2>
                        </div>

                        <div className="text-center mb-4">
                            <p className="text-4xl font-bold text-surface-100">
                                {loading ? (
                                    <span className="skeleton inline-block w-14 h-10" />
                                ) : (
                                    summary?.totalEmployees || 0
                                )}
                            </p>
                            <p className="text-xs text-surface-500 mt-1">Total Active Employees</p>
                        </div>

                        {/* Attendance Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-surface-500">Attendance Rate</span>
                                <span className="text-surface-300 font-medium">
                                    {summary?.totalEmployees
                                        ? (
                                            ((summary.totalPresent || 0) / summary.totalEmployees) *
                                            100
                                        ).toFixed(0)
                                        : 0}
                                    %
                                </span>
                            </div>
                            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary-500 to-cyan-500 rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${summary?.totalEmployees
                                                ? ((summary.totalPresent || 0) / summary.totalEmployees) * 100
                                                : 0
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Verification Methods */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-surface-100 mb-4">
                            Verification Methods
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center">
                                    <ScanFace className="w-5 h-5 text-primary-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-surface-200">Face Recognition</p>
                                    <p className="text-xs text-success-400">Active</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                                <div className="w-9 h-9 rounded-lg bg-warning-500/10 flex items-center justify-center">
                                    <Fingerprint className="w-5 h-5 text-warning-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-surface-200">Fingerprint</p>
                                    <p className="text-xs text-warning-400">Integration Ready</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-surface-100 mb-4">
                            System Status
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Database', status: 'Connected', ok: true },
                                { label: 'Face Models', status: 'Loaded', ok: true },
                                { label: 'Auth Service', status: 'Active', ok: true },
                                { label: 'FP Middleware', status: 'Standby', ok: false },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-surface-500">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-2 h-2 rounded-full ${item.ok
                                                    ? 'bg-success-500'
                                                    : 'bg-warning-500'
                                                }`}
                                        />
                                        <span
                                            className={`text-xs font-medium ${item.ok ? 'text-success-400' : 'text-warning-400'
                                                }`}
                                        >
                                            {item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
