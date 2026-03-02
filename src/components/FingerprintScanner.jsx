import { useState } from 'react';
import { Fingerprint, Loader2, AlertCircle, Wifi } from 'lucide-react';

/**
 * FingerprintScanner Component
 * Integration-ready interface for external fingerprint scanner
 * 
 * Architecture:
 * Fingerprint Device → Local Middleware Service (Node.js) → Supabase API
 */
export default function FingerprintScanner({
    onCapture,
    onError,
    isProcessing = false,
    compact = false,
}) {
    const [status, setStatus] = useState('idle'); // idle, connecting, scanning, success, error
    const [middlewareConnected, setMiddlewareConnected] = useState(false);

    /**
     * Simulate connecting to local fingerprint middleware
     * In production, this would connect to a local Node.js service
     * running on the kiosk machine
     */
    const connectMiddleware = async () => {
        setStatus('connecting');
        try {
            // Simulate middleware connection
            // In production: fetch('http://localhost:3001/api/fingerprint/status')
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setMiddlewareConnected(true);
            setStatus('idle');
        } catch (err) {
            setStatus('error');
            onError?.('Failed to connect to fingerprint scanner middleware');
        }
    };

    /**
     * Trigger fingerprint scan
     * In production, this sends a request to the local middleware
     * which communicates with the biometric device
     */
    const startScan = async () => {
        setStatus('scanning');
        try {
            // Simulate fingerprint capture
            // In production: fetch('http://localhost:3001/api/fingerprint/capture')
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Simulated fingerprint template
            const template = {
                type: 'fingerprint',
                data: 'simulated-template-' + Date.now(),
                quality: 85,
            };

            setStatus('success');
            onCapture?.(template);

            // Reset status after animation
            setTimeout(() => setStatus('idle'), 1500);
        } catch (err) {
            setStatus('error');
            onError?.('Fingerprint scan failed');
            setTimeout(() => setStatus('idle'), 2000);
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'connecting':
                return 'text-warning-400';
            case 'scanning':
                return 'text-primary-400';
            case 'success':
                return 'text-success-400';
            case 'error':
                return 'text-danger-400';
            default:
                return 'text-surface-400';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'connecting':
                return 'Connecting to scanner...';
            case 'scanning':
                return 'Place your finger on the scanner...';
            case 'success':
                return 'Fingerprint captured!';
            case 'error':
                return 'Scan failed. Try again.';
            default:
                return middlewareConnected ? 'Scanner ready' : 'Scanner not connected';
        }
    };

    return (
        <div className={`flex flex-col items-center gap-4 ${compact ? '' : 'w-full'}`}>
            {/* Scanner Visual */}
            <div
                className={`relative flex items-center justify-center bg-surface-900 border-2 rounded-2xl transition-all duration-500 ${compact ? 'w-48 h-48' : 'w-64 h-64'
                    } ${status === 'scanning'
                        ? 'border-primary-400 animate-pulse-glow'
                        : status === 'success'
                            ? 'border-success-400'
                            : status === 'error'
                                ? 'border-danger-400'
                                : 'border-surface-700'
                    }`}
            >
                <Fingerprint
                    className={`transition-all duration-500 ${compact ? 'w-16 h-16' : 'w-24 h-24'
                        } ${getStatusColor()} ${status === 'scanning' ? 'animate-pulse' : ''
                        }`}
                />

                {status === 'scanning' && (
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Connection Status Indicator */}
                <div className="absolute top-3 right-3">
                    <div
                        className={`w-3 h-3 rounded-full ${middlewareConnected ? 'bg-success-500' : 'bg-surface-600'
                            }`}
                    />
                </div>
            </div>

            {/* Status Text */}
            <p className={`text-sm font-medium ${getStatusColor()}`}>{getStatusText()}</p>

            {/* Controls */}
            {!compact && (
                <div className="flex gap-3">
                    {!middlewareConnected ? (
                        <button
                            onClick={connectMiddleware}
                            disabled={status === 'connecting'}
                            className="btn-primary"
                            id="btn-connect-scanner"
                        >
                            {status === 'connecting' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Wifi className="w-4 h-4" />
                            )}
                            Connect Scanner
                        </button>
                    ) : (
                        <button
                            onClick={startScan}
                            disabled={status === 'scanning' || isProcessing}
                            className="btn-primary"
                            id="btn-scan-fingerprint"
                        >
                            {status === 'scanning' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Fingerprint className="w-4 h-4" />
                            )}
                            {status === 'scanning' ? 'Scanning...' : 'Scan Fingerprint'}
                        </button>
                    )}
                </div>
            )}

            {/* Architecture Note */}
            {!compact && !middlewareConnected && (
                <div className="flex items-start gap-2 text-xs text-surface-500 max-w-xs text-center">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                        Requires local middleware service running on the kiosk device for
                        hardware communication.
                    </span>
                </div>
            )}
        </div>
    );
}
