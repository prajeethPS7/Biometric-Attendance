import { useState, useRef, useCallback, useEffect } from 'react';
// face-api.js loaded dynamically when needed
let faceapi = null;

const MODEL_URL = '/models';

/**
 * Hook for face recognition operations
 * Uses face-api.js for face detection and embedding generation
 */
export function useFaceRecognition() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);

    /**
     * Load face-api.js models
     */
    const loadModels = useCallback(async () => {
        if (modelsLoaded) return true;
        setLoading(true);
        setError(null);

        try {
            // Dynamically import face-api.js
            if (!faceapi) {
                faceapi = await import('@vladmandic/face-api');
            }

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);

            setModelsLoaded(true);
            setLoading(false);
            return true;
        } catch (err) {
            console.error('Error loading face models:', err);
            setError('Failed to load face recognition models. Please ensure model files are in the /public/models directory.');
            setLoading(false);
            return false;
        }
    }, [modelsLoaded]);

    /**
     * Start camera stream
     */
    const startCamera = useCallback(async (videoElement) => {
        try {
            setError(null);

            if (videoElement) {
                videoRef.current = videoElement;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCameraActive(true);
            }

            return true;
        } catch (err) {
            console.error('Camera error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found. Please connect a camera.');
            } else {
                setError(`Camera error: ${err.message}`);
            }
            return false;
        }
    }, []);

    /**
     * Stop camera stream
     */
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    }, []);

    /**
     * Detect face and generate 128-dimensional embedding
     * face-api.js generates 128-dim embeddings by default
     * For 512-dim as required by spec, we pad with zeros (in production use a different model)
     */
    const detectFace = useCallback(async () => {
        if (!videoRef.current || !modelsLoaded) {
            setError('Camera or models not ready');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.5,
                }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!detection) {
                setError('No face detected. Please position your face in the camera view.');
                setLoading(false);
                return null;
            }

            // face-api.js returns 128-dim descriptor
            // Pad to 512 dimensions for pgvector compatibility
            const descriptor128 = Array.from(detection.descriptor);
            const embedding = [...descriptor128, ...new Array(384).fill(0)];

            setLoading(false);
            return {
                embedding,
                detection: {
                    score: detection.detection.score,
                    box: detection.detection.box,
                },
            };
        } catch (err) {
            console.error('Face detection error:', err);
            setError('Face detection failed. Please try again.');
            setLoading(false);
            return null;
        }
    }, [modelsLoaded]);

    /**
     * Capture a snapshot from the video feed
     */
    const captureSnapshot = useCallback(() => {
        if (!videoRef.current) return null;

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.8);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return {
        modelsLoaded,
        loading,
        error,
        cameraActive,
        videoRef,
        canvasRef,
        loadModels,
        startCamera,
        stopCamera,
        detectFace,
        captureSnapshot,
    };
}

export default useFaceRecognition;
