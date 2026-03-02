import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle, ScanFace } from 'lucide-react';

/**
 * FaceScanner Component
 * Live camera feed with face detection overlay
 */
export default function FaceScanner({
    onCapture,
    onError,
    isScanning = false,
    isProcessing = false,
    faceHook,
    autoStart = false,
    compact = false,
}) {
    const localVideoRef = useRef(null);
    const [cameraReady, setCameraReady] = useState(false);

    const {
        modelsLoaded,
        loading: modelLoading,
        error: faceError,
        cameraActive,
        loadModels,
        startCamera,
        stopCamera,
        detectFace,
    } = faceHook;

    // Load models on mount
    useEffect(() => {
        loadModels();
    }, [loadModels]);

    // Auto-start camera when models are loaded
    useEffect(() => {
        if (modelsLoaded && autoStart && localVideoRef.current) {
            handleStartCamera();
        }
        return () => {
            if (!autoStart) stopCamera();
        };
    }, [modelsLoaded, autoStart]);

    const handleStartCamera = async () => {
        const success = await startCamera(localVideoRef.current);
        if (success) {
            setCameraReady(true);
        }
    };

    const handleCapture = async () => {
        if (!cameraActive) return;

        const result = await detectFace();
        if (result) {
            onCapture?.(result);
        } else {
            onError?.('No face detected');
        }
    };

    useEffect(() => {
        if (faceError) {
            onError?.(faceError);
        }
    }, [faceError, onError]);

    return (
        <div className={`flex flex-col items-center gap-4 ${compact ? '' : 'w-full'}`}>
            {/* Camera View */}
            <div
                className={`camera-container relative bg-surface-900 ${compact ? 'w-64 h-48' : 'w-full max-w-lg aspect-[4/3]'
                    } rounded-2xl overflow-hidden`}
            >
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    onLoadedData={() => setCameraReady(true)}
                />

                {/* Scanning Overlay */}
                {isScanning && (
                    <div className="scan-overlay">
                        <div className="scan-corners" />
                    </div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-surface-950/70 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
                            <span className="text-primary-300 font-medium text-sm">Processing...</span>
                        </div>
                    </div>
                )}

                {/* Camera Not Active */}
                {!cameraActive && !modelLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900">
                        <Camera className="w-12 h-12 text-surface-500" />
                        <span className="text-surface-500 text-sm">Camera inactive</span>
                    </div>
                )}

                {/* Models Loading */}
                {modelLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900">
                        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
                        <span className="text-surface-400 text-sm">Loading face models...</span>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {faceError && (
                <div className="flex items-center gap-2 text-danger-400 text-sm bg-danger-500/10 px-4 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{faceError}</span>
                </div>
            )}

            {/* Controls */}
            {!compact && (
                <div className="flex gap-3">
                    {!cameraActive ? (
                        <button
                            onClick={handleStartCamera}
                            disabled={!modelsLoaded || modelLoading}
                            className="btn-primary"
                            id="btn-start-camera"
                        >
                            <Camera className="w-4 h-4" />
                            Start Camera
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleCapture}
                                disabled={isProcessing || !cameraReady}
                                className="btn-primary"
                                id="btn-scan-face"
                            >
                                <ScanFace className="w-4 h-4" />
                                {isProcessing ? 'Processing...' : 'Scan Face'}
                            </button>
                            <button
                                onClick={stopCamera}
                                className="btn-secondary"
                                id="btn-stop-camera"
                            >
                                Stop Camera
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
