import { useState, useEffect, useCallback, useRef } from 'react';
import {
    ScanFace,
    Fingerprint,
    Maximize,
    Minimize,
    Clock,
    Shield,
    Camera,
    CameraOff,
    UserCheck,
    UserX,
    AlertCircle,
    Activity,
    ArrowLeft,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AttendanceResult from '../components/AttendanceResult';
import { verifyFaceEmbedding, checkRateLimit } from '../services/biometricService';
import { processAttendance, logFailedAttempt } from '../services/attendanceService';
import toast from 'react-hot-toast';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@vladmandic/face-api';

const DEVICE_ID = 'kiosk-main';
const SCAN_INTERVAL_MS = 3000;
const COOLDOWN_AFTER_RESULT_MS = 5000;
const MODEL_URL = '/models';

// Force CPU backend using modern TF.js
let backendReady = false;
const ensureCpuBackend = async () => {
    if (backendReady) return;
    try {
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('✅ Kiosk TF.js v' + tf.version_core + ' backend:', tf.getBackend());
    } catch (e) {
        console.warn('Backend setup warning:', e.message);
    }
    backendReady = true;
};

export default function AttendanceKiosk() {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scanIntervalRef = useRef(null);
    const streamRef = useRef(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [faceDetected, setFaceDetected] = useState(false);
    const [scanCount, setScanCount] = useState(0);
    const [lastEmployee, setLastEmployee] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // ─── Clock ───────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ─── Load face-api models (CPU backend) ────────────
    useEffect(() => {
        const loadModels = async () => {
            setModelsLoading(true);
            try {
                await ensureCpuBackend();
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                console.log('✅ Face models loaded on CPU backend');
            } catch (err) {
                console.error('❌ Failed to load face models:', err);
                setCameraError('Failed to load face recognition models.');
            } finally {
                setModelsLoading(false);
            }
        };
        loadModels();
    }, []);

    // ─── Start camera as soon as models are loaded ──────
    useEffect(() => {
        if (modelsLoaded) {
            startCamera();
        }
        return () => stopCamera();
    }, [modelsLoaded]);

    // ─── Start continuous scanning when camera is active ─
    useEffect(() => {
        if (cameraActive && modelsLoaded && !result) {
            startContinuousScanning();
        }
        return () => stopContinuousScanning();
    }, [cameraActive, modelsLoaded, result]);

    // ─── Camera Controls ────────────────────────────────
    const startCamera = async () => {
        try {
            setCameraError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraActive(true);
        } catch (err) {
            console.error('Camera error:', err);
            setCameraError(
                err.name === 'NotAllowedError'
                    ? 'Camera access denied. Please allow camera permission.'
                    : 'Could not access camera. Make sure a camera is connected.'
            );
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        stopContinuousScanning();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    // ─── Continuous Face Scanning Loop ──────────────────
    const startContinuousScanning = () => {
        stopContinuousScanning(); // Clear any existing interval
        setIsScanning(true);

        scanIntervalRef.current = setInterval(async () => {
            if (isProcessing || result) return; // Skip if processing or showing result
            await detectAndVerifyFace();
        }, SCAN_INTERVAL_MS);
    };

    const stopContinuousScanning = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        setIsScanning(false);
    };

    // ─── Core: Detect face → Generate embedding → Verify ─
    const detectAndVerifyFace = async () => {
        if (!videoRef.current || !modelsLoaded || isProcessing) return;

        try {
            const video = videoRef.current;

            // 1. Snapshot current frame to canvas (much faster than live video detection)
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 2. Detect face from the static canvas (CPU backend)
            const detection = await faceapi
                .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224,
                    scoreThreshold: 0.3,
                }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!detection) {
                setFaceDetected(false);
                return;
            }

            setFaceDetected(true);
            setScanCount((c) => c + 1);

            // 3. Get face embedding (128-dim from face-api, pad to 512-dim for pgvector)
            const rawDescriptor = Array.from(detection.descriptor);
            const embedding = new Array(512).fill(0);
            rawDescriptor.forEach((val, i) => {
                embedding[i] = val;
            });

            // 3. Don't start verification if already processing
            if (isProcessing) return;
            setIsProcessing(true);

            // 4. Check rate limit
            const rateLimit = await checkRateLimit(DEVICE_ID);
            if (!rateLimit.allowed) {
                showResult({
                    success: false,
                    type: 'rate_limited',
                    message: 'Too many failed attempts. Please wait and try again.',
                });
                return;
            }

            // 5. Verify face against database
            const verification = await verifyFaceEmbedding(embedding);

            if (verification.matched) {
                // 6. Process attendance (check-in / check-out / duplicate)
                const attendanceResult = await processAttendance({
                    employeeId: verification.employee.id,
                    deviceId: DEVICE_ID,
                    verificationMethod: 'face',
                    confidenceScore: verification.confidence,
                });

                if (!attendanceResult.success) {
                    // Attendance processing failed (e.g., RLS permission, DB error)
                    console.error('Attendance processing failed:', attendanceResult);
                    playSound('error');
                    showResult({
                        success: false,
                        type: 'error',
                        employee: verification.employee,
                        message: attendanceResult.message || 'Failed to record attendance. Please try again.',
                    });
                    return;
                }

                setLastEmployee(verification.employee);
                playSound(attendanceResult.type === 'duplicate' ? 'info' : 'success');

                showResult({
                    success: true,
                    type: attendanceResult.type, // 'check_in', 'check_out', 'duplicate'
                    employee: verification.employee,
                    confidence: verification.confidence,
                    message: attendanceResult.message,
                });
            } else {
                // 7. Log failed attempt
                await logFailedAttempt({
                    deviceId: DEVICE_ID,
                    verificationMethod: 'face',
                    confidenceScore: verification.confidence || 0,
                });

                playSound('error');

                showResult({
                    success: false,
                    type: 'unrecognized',
                    message: 'Face not recognized. Please contact HR for enrollment.',
                    confidence: verification.confidence,
                });
            }
        } catch (err) {
            console.error('Detection/verification error:', err);
            setIsProcessing(false);
        }
    };

    // ─── Show result and auto-resume scanning ────────────
    const showResult = (resultData) => {
        setResult(resultData);
        setIsProcessing(false);
        stopContinuousScanning();

        // Auto-dismiss and resume scanning after cooldown
        setTimeout(() => {
            setResult(null);
            setFaceDetected(false);
            // Resume scanning
            if (cameraActive && modelsLoaded) {
                startContinuousScanning();
            }
        }, COOLDOWN_AFTER_RESULT_MS);
    };

    // ─── Sound Effects ───────────────────────────────────
    const playSound = (type) => {
        if (!soundEnabled) return;

        try {
            const audio = new AudioContext();
            const osc = audio.createOscillator();
            const gain = audio.createGain();

            osc.connect(gain);
            gain.connect(audio.destination);
            gain.gain.value = 0.1;

            if (type === 'success') {
                osc.frequency.value = 880;
                osc.type = 'sine';
            } else if (type === 'error') {
                osc.frequency.value = 220;
                osc.type = 'square';
            } else {
                osc.frequency.value = 440;
                osc.type = 'sine';
            }

            osc.start();
            setTimeout(() => {
                osc.stop();
                audio.close();
            }, 200);
        } catch (e) {
            // Audio not supported, ignore
        }
    };

    // ─── Fullscreen ──────────────────────────────────────
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // ─── Status Indicator ───────────────────────────────
    const getStatusInfo = () => {
        if (cameraError) return { color: 'bg-danger-500', text: 'Camera Error', pulse: false };
        if (modelsLoading) return { color: 'bg-warning-500', text: 'Loading Models...', pulse: true };
        if (!cameraActive) return { color: 'bg-surface-500', text: 'Camera Off', pulse: false };
        if (isProcessing) return { color: 'bg-primary-500', text: 'Verifying...', pulse: true };
        if (faceDetected) return { color: 'bg-cyan-500', text: 'Face Detected', pulse: true };
        if (isScanning) return { color: 'bg-success-500', text: 'Monitoring', pulse: true };
        return { color: 'bg-surface-500', text: 'Idle', pulse: false };
    };

    const status = getStatusInfo();

    return (
        <div className={`${isFullscreen ? 'kiosk-mode' : ''} min-h-screen bg-surface-950 flex flex-col`}>
            {/* Result Overlay */}
            {result && (
                <AttendanceResult
                    result={result}
                    onReset={() => setResult(null)}
                    autoResetDelay={COOLDOWN_AFTER_RESULT_MS}
                />
            )}

            {/* ─── Header ─────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 lg:px-6 bg-surface-900/80 border-b border-surface-800">
                <div className="flex items-center gap-3">
                    {!isFullscreen && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
                            <ScanFace className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className={`font-bold text-surface-100 ${isFullscreen ? 'text-2xl' : 'text-lg'}`}>
                                BioAttend Kiosk
                            </h1>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />
                                <span className="text-xs text-surface-500">{status.text}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Sound Toggle */}
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                        title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    {/* Live Clock */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-surface-800 border border-surface-700 rounded-xl">
                        <Clock className="w-4 h-4 text-primary-400" />
                        <span className={`font-mono font-bold text-surface-100 tabular-nums ${isFullscreen ? 'text-2xl' : 'text-lg'}`}>
                            {currentTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })}
                        </span>
                    </div>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                        id="btn-toggle-fullscreen"
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* ─── Main Camera View ────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-4 lg:p-6 gap-6">
                {/* Camera Feed */}
                <div className="relative flex-1 max-w-3xl">
                    <div className={`relative rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${isProcessing
                        ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                        : faceDetected
                            ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
                            : result?.success
                                ? 'border-success-500'
                                : cameraActive
                                    ? 'border-surface-700'
                                    : 'border-surface-800'
                        }`}>
                        {/* Video Element */}
                        <video
                            ref={videoRef}
                            className="w-full aspect-video bg-surface-900 object-cover mirror"
                            autoPlay
                            playsInline
                            muted
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Canvas for face detection overlay */}
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                        />

                        {/* Scanning Overlay */}
                        {cameraActive && isScanning && !result && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Corner markers */}
                                <div className="absolute top-6 left-6 w-16 h-16 border-t-2 border-l-2 border-primary-400 rounded-tl-xl" />
                                <div className="absolute top-6 right-6 w-16 h-16 border-t-2 border-r-2 border-primary-400 rounded-tr-xl" />
                                <div className="absolute bottom-6 left-6 w-16 h-16 border-b-2 border-l-2 border-primary-400 rounded-bl-xl" />
                                <div className="absolute bottom-6 right-6 w-16 h-16 border-b-2 border-r-2 border-primary-400 rounded-br-xl" />

                                {/* Scanning line animation */}
                                <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-kiosk-scan" />

                                {/* Face detected indicator */}
                                {faceDetected && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-400 rounded-full animate-pulse opacity-50" />
                                )}
                            </div>
                        )}

                        {/* Camera Off State */}
                        {!cameraActive && !cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-900">
                                <CameraOff className="w-16 h-16 text-surface-600" />
                                <p className="text-surface-500">Camera initializing...</p>
                            </div>
                        )}

                        {/* Error State */}
                        {cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-900 p-8">
                                <AlertCircle className="w-16 h-16 text-danger-400" />
                                <p className="text-danger-400 text-center text-sm">{cameraError}</p>
                                <button
                                    onClick={startCamera}
                                    className="btn-primary mt-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Retry Camera
                                </button>
                            </div>
                        )}

                        {/* Status Bar at Bottom of Video */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-950/90 to-transparent p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />
                                    <span className={`text-sm font-medium ${isProcessing ? 'text-primary-400' : faceDetected ? 'text-cyan-400' : 'text-surface-400'
                                        }`}>
                                        {isProcessing ? '🔍 Verifying identity...' :
                                            faceDetected ? '👤 Face detected — verifying...' :
                                                isScanning ? '📷 Monitoring — show your face to check in' :
                                                    'Initializing...'}
                                    </span>
                                </div>
                                <span className="text-xs text-surface-600 font-mono">
                                    Scans: {scanCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className={`text-center mt-4 ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
                        <p className="text-surface-400">
                            {isScanning
                                ? '👋 Simply look at the camera to mark your attendance'
                                : modelsLoading
                                    ? 'Loading face recognition models...'
                                    : 'Starting camera...'}
                        </p>
                    </div>
                </div>

                {/* ─── Side Panel ──────────────────────────────── */}
                <div className="hidden lg:flex flex-col gap-4 w-72">
                    {/* How it Works */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary-400" />
                            How it Works
                        </h3>
                        <div className="space-y-4">
                            {[
                                { step: '1', text: 'Stand in front of the camera', icon: '👤' },
                                { step: '2', text: 'Face is detected automatically', icon: '🔍' },
                                { step: '3', text: 'Identity verified in seconds', icon: '✅' },
                                { step: '4', text: 'Attendance marked instantly', icon: '📋' },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-3">
                                    <span className="text-lg">{item.icon}</span>
                                    <div>
                                        <span className="text-xs text-surface-500">Step {item.step}</span>
                                        <p className="text-sm text-surface-300">{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Last Verified */}
                    {lastEmployee && (
                        <div className="bg-surface-800/50 border border-success-500/20 rounded-2xl p-5 animate-fade-in">
                            <h3 className="text-sm font-semibold text-surface-100 mb-3 flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-success-400" />
                                Last Verified
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-lg font-bold text-white">
                                    {lastEmployee.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-surface-100">{lastEmployee.name}</p>
                                    <p className="text-xs text-surface-500">{lastEmployee.employeeCode || lastEmployee.employee_code} · {lastEmployee.department}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fingerprint Option */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <div className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-warning-500/10 flex items-center justify-center">
                                <Fingerprint className="w-5 h-5 text-warning-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-surface-200">Fingerprint</p>
                                <p className="text-[11px] text-warning-400">Integration Ready</p>
                            </div>
                        </div>
                    </div>

                    {/* System Stats */}
                    <div className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-surface-100 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary-400" />
                            Session Stats
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-surface-500">Total Scans</span>
                                <span className="text-surface-300 font-mono">{scanCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-surface-500">Camera</span>
                                <span className={cameraActive ? 'text-success-400' : 'text-danger-400'}>
                                    {cameraActive ? 'Active' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-surface-500">Models</span>
                                <span className={modelsLoaded ? 'text-success-400' : 'text-warning-400'}>
                                    {modelsLoaded ? 'Loaded' : 'Loading...'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-surface-500">Device</span>
                                <span className="text-surface-400 font-mono text-xs">{DEVICE_ID}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Footer ──────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-900/80 border-t border-surface-800 text-xs text-surface-600">
                <p>
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </p>
                <div className="flex items-center gap-4">
                    <span>Device: {DEVICE_ID}</span>
                    <span>Powered by BioAttend</span>
                </div>
            </div>
        </div>
    );
}
