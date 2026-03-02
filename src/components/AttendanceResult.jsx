import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, User, Building2, Hash } from 'lucide-react';

/**
 * AttendanceResult Component
 * Displays verification result with animated feedback
 * Used in kiosk mode for success/failure screens
 */
export default function AttendanceResult({
    result,
    onReset,
    autoResetDelay = 5000,
}) {
    const [countdown, setCountdown] = useState(Math.ceil(autoResetDelay / 1000));
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger entrance animation
        requestAnimationFrame(() => setVisible(true));

        // Auto-reset countdown
        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onReset?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [autoResetDelay, onReset]);

    if (!result) return null;

    const isSuccess = result.success && result.type !== 'duplicate';
    const isDuplicate = result.type === 'duplicate';

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'
                } ${isSuccess
                    ? 'bg-success-600/20'
                    : isDuplicate
                        ? 'bg-warning-500/20'
                        : 'bg-danger-600/20'
                }`}
            style={{ backdropFilter: 'blur(8px)' }}
        >
            <div
                className={`flex flex-col items-center gap-6 p-12 rounded-3xl max-w-md w-full mx-4 transition-all duration-500 ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'
                    } ${isSuccess
                        ? 'bg-surface-900 border-2 border-success-500/30'
                        : isDuplicate
                            ? 'bg-surface-900 border-2 border-warning-500/30'
                            : 'bg-surface-900 border-2 border-danger-500/30'
                    }`}
            >
                {/* Status Icon */}
                <div className="animate-success-ring">
                    {isSuccess ? (
                        <div className="w-24 h-24 rounded-full bg-success-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-14 h-14 text-success-400" />
                        </div>
                    ) : isDuplicate ? (
                        <div className="w-24 h-24 rounded-full bg-warning-500/20 flex items-center justify-center">
                            <Clock className="w-14 h-14 text-warning-400" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-danger-500/20 flex items-center justify-center">
                            <XCircle className="w-14 h-14 text-danger-400" />
                        </div>
                    )}
                </div>

                {/* Status Text */}
                <div className="text-center">
                    <h2
                        className={`text-2xl font-bold mb-2 ${isSuccess
                            ? 'text-success-400'
                            : isDuplicate
                                ? 'text-warning-400'
                                : 'text-danger-400'
                            }`}
                    >
                        {isSuccess
                            ? result.type === 'check_in'
                                ? 'Checked In!'
                                : 'Checked Out!'
                            : isDuplicate
                                ? 'Already Recorded'
                                : result.type === 'error'
                                    ? 'Error'
                                    : 'Verification Failed'}
                    </h2>
                    <p className="text-surface-400 text-sm">{result.message}</p>
                </div>

                {/* Employee Info (on success) */}
                {isSuccess && result.employee && (
                    <div className="w-full space-y-3 bg-surface-800/50 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-primary-400" />
                            <div>
                                <p className="text-xs text-surface-500">Employee</p>
                                <p className="text-surface-100 font-semibold">{result.employee.name}</p>
                            </div>
                        </div>
                        {result.employee.employeeCode && (
                            <div className="flex items-center gap-3">
                                <Hash className="w-5 h-5 text-primary-400" />
                                <div>
                                    <p className="text-xs text-surface-500">Employee Code</p>
                                    <p className="text-surface-200">{result.employee.employeeCode}</p>
                                </div>
                            </div>
                        )}
                        {result.employee.department && (
                            <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-primary-400" />
                                <div>
                                    <p className="text-xs text-surface-500">Department</p>
                                    <p className="text-surface-200">{result.employee.department}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-primary-400" />
                            <div>
                                <p className="text-xs text-surface-500">Time</p>
                                <p className="text-surface-200">
                                    {new Date().toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confidence Score */}
                {result.confidence !== undefined && (
                    <div className="text-center">
                        <p className="text-xs text-surface-500">Confidence</p>
                        <p className={`text-lg font-bold ${result.confidence >= 0.85
                            ? 'text-success-400'
                            : result.confidence >= 0.75
                                ? 'text-warning-400'
                                : 'text-danger-400'
                            }`}>
                            {(result.confidence * 100).toFixed(1)}%
                        </p>
                    </div>
                )}

                {/* Auto-reset countdown */}
                <div className="flex items-center gap-2 text-surface-500 text-sm">
                    <div className="w-8 h-8 rounded-full border-2 border-surface-600 flex items-center justify-center text-xs font-bold">
                        {countdown}
                    </div>
                    <span>Auto-reset in {countdown}s</span>
                </div>

                {/* Manual Reset */}
                <button
                    onClick={onReset}
                    className="btn-secondary text-sm"
                    id="btn-reset-result"
                >
                    Tap to reset now
                </button>
            </div>
        </div>
    );
}
