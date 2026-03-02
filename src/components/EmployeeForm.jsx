import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Loader2, Check, AlertCircle, RefreshCw, Fingerprint } from 'lucide-react';
// Import modern TF.js FIRST (overrides face-api's broken bundled version)
import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models';

// Force CPU backend using modern TF.js API
let backendReady = false;
const ensureCpuBackend = async () => {
    if (backendReady) return;
    try {
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('✅ TF.js v' + tf.version_core + ' backend:', tf.getBackend());
    } catch (e) {
        console.warn('Backend setup warning:', e.message);
    }
    backendReady = true;
};

export default function EmployeeForm({ employee = null, onSubmit, onCancel, departments = [] }) {
    const isEdit = !!employee;
    const [formData, setFormData] = useState({ employee_code: '', name: '', department: '', is_active: true });
    const [showCamera, setShowCamera] = useState(false);
    const [faceEnrolled, setFaceEnrolled] = useState(false);
    const [embedding, setEmbedding] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [cameraReady, setCameraReady] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [processing, setProcessing] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [fpEnrolled, setFpEnrolled] = useState(false);
    const [fpCred, setFpCred] = useState(null);
    const [fpLoading, setFpLoading] = useState(false);
    const [fpError, setFpError] = useState(null);

    useEffect(() => {
        if (employee) {
            setFormData({
                employee_code: employee.employee_code || '',
                name: employee.name || '',
                department: employee.department || '',
                is_active: employee.is_active ?? true,
            });
            setFaceEnrolled(!!employee.face_embedding);
            setFpEnrolled(!!employee.fingerprint_template);
        }
    }, [employee]);

    useEffect(() => () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }, []);

    const handleChange = (f, v) => {
        setFormData(p => ({ ...p, [f]: v }));
        setErrors(p => ({ ...p, [f]: null }));
    };

    const validate = () => {
        const e = {};
        if (!formData.employee_code.trim()) e.employee_code = 'Required';
        if (!formData.name.trim()) e.name = 'Required';
        if (!formData.department.trim()) e.department = 'Required';
        setErrors(e);
        return !Object.keys(e).length;
    };

    // ─── Load Models (with CPU backend) ──────────────
    const loadModels = useCallback(async () => {
        if (modelsLoaded) return true;
        try {
            console.log('⏳ Setting CPU backend...');
            await ensureCpuBackend();
            console.log('⏳ Loading face models...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setModelsLoaded(true);
            console.log('✅ All face models loaded on CPU backend');
            return true;
        } catch (err) {
            console.error('❌ Model load error:', err);
            return false;
        }
    }, [modelsLoaded]);

    // ─── Camera Controls ─────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraLoading(true);
        setCameraError(null);
        setPhoto(null);
        try {
            const ok = await loadModels();
            if (!ok) { setCameraError('Failed to load face models.'); setCameraLoading(false); return; }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            setCameraReady(true);
        } catch (err) {
            setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera not available.');
        } finally { setCameraLoading(false); }
    }, [loadModels]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraReady(false);
    }, []);

    // ─── Take Photo (instant snapshot) ───────────────
    const takePhoto = useCallback(() => {
        if (!videoRef.current) return;
        const v = videoRef.current;
        const c = document.createElement('canvas');
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL('image/jpeg', 0.9));
        stopCamera();
        console.log('📸 Photo taken!');
    }, [stopCamera]);

    // ─── Process Photo (detect face from JPEG) ───────
    const processPhoto = useCallback(async () => {
        if (!photo || !modelsLoaded) return;
        setProcessing(true);
        setCameraError(null);
        try {
            console.log('🔍 Processing face on CPU backend...');
            const img = await faceapi.fetchImage(photo);
            console.log('🖼️ Image loaded, detecting face...');

            const startTime = performance.now();
            const det = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ Detection took ${elapsed}s`);

            if (!det) {
                setCameraError('No face detected. Please retake with better lighting.');
                setProcessing(false);
                return;
            }

            console.log('✅ Face detected! Score:', det.detection.score.toFixed(3));

            const raw = Array.from(det.descriptor);
            const padded = new Array(512).fill(0);
            raw.forEach((v, i) => { padded[i] = v; });

            setEmbedding(padded);
            setFaceEnrolled(true);
            setShowCamera(false);
            setPhoto(null);
        } catch (err) {
            console.error('❌ Face processing error:', err);
            setCameraError('Detection failed: ' + err.message);
        } finally { setProcessing(false); }
    }, [photo, modelsLoaded]);

    // Auto-process photo when captured
    useEffect(() => { if (photo && modelsLoaded) processPhoto(); }, [photo, modelsLoaded, processPhoto]);
    useEffect(() => {
        if (showCamera && !photo) startCamera();
        else if (!showCamera) { stopCamera(); setPhoto(null); }
    }, [showCamera]);

    // ─── Fingerprint (WebAuthn) ──────────────────────
    const enrollFp = useCallback(async () => {
        setFpLoading(true); setFpError(null);
        try {
            if (!window.PublicKeyCredential) { setFpError('Not supported.'); return; }
            const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!avail) { setFpError('No scanner found.'); return; }
            const cred = await navigator.credentials.create({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: { name: 'BioAttend', id: window.location.hostname },
                    user: { id: new TextEncoder().encode(formData.employee_code || 'tmp'), name: formData.employee_code || 'Emp', displayName: formData.name || 'Emp' },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
                    timeout: 60000, attestation: 'none',
                },
            });
            if (cred) { setFpCred(btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))); setFpEnrolled(true); }
        } catch (err) {
            if (err.name === 'NotAllowedError') setFpError('Cancelled.');
            else if (err.name === 'InvalidStateError') { setFpError('Already enrolled.'); setFpEnrolled(true); }
            else setFpError(err.message);
        } finally { setFpLoading(false); }
    }, [formData.employee_code, formData.name]);

    // ─── Submit ──────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            const data = { ...formData };
            if (embedding) data.face_embedding = embedding;
            if (fpCred) data.fingerprint_template = fpCred;
            await onSubmit(data);
        } catch (err) { console.error(err); } finally { setSubmitting(false); }
    };

    const depts = departments.length ? departments : ['Production', 'Quality Control', 'Warehouse', 'Maintenance', 'Administration', 'IT', 'HR', 'Finance', 'Logistics', 'R&D'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #1e293b' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                        {isEdit ? 'Edit Employee' : 'Add New Employee'}
                    </h2>
                    <button onClick={() => { stopCamera(); onCancel(); }}
                        style={{ padding: '8px', borderRadius: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
                    {/* Row 1: Code + Name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Employee Code *</label>
                            <input type="text" placeholder="EMP-001" value={formData.employee_code}
                                onChange={e => handleChange('employee_code', e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: errors.employee_code ? '1px solid #ef4444' : '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            {errors.employee_code && <p style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>{errors.employee_code}</p>}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Full Name *</label>
                            <input type="text" placeholder="John Doe" value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: errors.name ? '1px solid #ef4444' : '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            {errors.name && <p style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>{errors.name}</p>}
                        </div>
                    </div>

                    {/* Row 2: Department + Active */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>Department *</label>
                            <select value={formData.department} onChange={e => handleChange('department', e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: errors.department ? '1px solid #ef4444' : '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                                <option value="">Select</option>
                                {depts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            {errors.department && <p style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>{errors.department}</p>}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={formData.is_active} onChange={e => handleChange('is_active', e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} />
                            <span style={{ fontSize: '13px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>Active</span>
                        </label>
                    </div>

                    {/* ─── Biometric Section ───────────────────── */}
                    <div style={{ border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
                        <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #1e293b', fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                            🔐 Biometric Enrollment
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                            {/* Face row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCamera ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: faceEnrolled ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)' }}>
                                        {faceEnrolled ? <Check size={16} color="#22c55e" /> : <Camera size={16} color="#3b82f6" />}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>Face Recognition</p>
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{faceEnrolled ? '✅ Captured' : 'Primary biometric'}</p>
                                    </div>
                                </div>
                                {!showCamera && (
                                    <button type="button" onClick={() => setShowCamera(true)}
                                        style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                        {faceEnrolled ? 'Retake' : 'Enroll Face'}
                                    </button>
                                )}
                            </div>

                            {/* Camera / Photo area */}
                            {showCamera && (
                                <div>
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#020617', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
                                        {!photo && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />}
                                        {photo && <img src={photo} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />}

                                        {cameraLoading && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Loader2 size={28} color="#3b82f6" className="animate-spin" />
                                                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Loading camera & AI models...</p>
                                            </div>
                                        )}
                                        {processing && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Loader2 size={28} color="#06b6d4" className="animate-spin" />
                                                <p style={{ color: '#06b6d4', fontSize: '12px', margin: 0 }}>Analyzing face (CPU mode)...</p>
                                                <p style={{ color: '#64748b', fontSize: '10px', margin: 0 }}>This may take 5-10 seconds</p>
                                            </div>
                                        )}
                                        {cameraReady && !photo && !processing && (
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,23,42,0.8)', borderRadius: '8px', padding: '4px 10px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                                                <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>LIVE</span>
                                            </div>
                                        )}
                                    </div>

                                    {cameraError && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '10px' }}>
                                            <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '12px', color: '#f87171' }}>{cameraError}</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {!photo ? (
                                            <button type="button" onClick={takePhoto} disabled={!cameraReady}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: cameraReady ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#334155', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: cameraReady ? 'pointer' : 'not-allowed' }}>
                                                <Camera size={14} /> 📸 Capture Face
                                            </button>
                                        ) : !processing ? (
                                            <button type="button" onClick={() => { setPhoto(null); setCameraError(null); startCamera(); }}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                                <RefreshCw size={14} /> Retake Photo
                                            </button>
                                        ) : null}
                                        <button type="button" onClick={() => setShowCamera(false)}
                                            style={{ padding: '10px 16px', borderRadius: '10px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '13px', cursor: 'pointer' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid #1e293b', margin: '12px 0' }} />

                            {/* Fingerprint row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fpEnrolled ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)' }}>
                                        {fpEnrolled ? <Check size={16} color="#22c55e" /> : <Fingerprint size={16} color="#f59e0b" />}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0 }}>Fingerprint</p>
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{fpEnrolled ? '✅ Registered' : 'Optional backup'}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={enrollFp} disabled={fpLoading}
                                    style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                                    {fpLoading ? '...' : fpEnrolled ? 'Rescan' : 'Enroll'}
                                </button>
                            </div>
                            {fpError && <p style={{ fontSize: '11px', color: '#f87171', margin: '6px 0 0 46px' }}>{fpError}</p>}
                        </div>
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" disabled={submitting}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: submitting ? '#1e40af' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}>
                            {submitting && <Loader2 size={16} className="animate-spin" />}
                            {isEdit ? 'Update Employee' : 'Add Employee'}
                        </button>
                        <button type="button" onClick={() => { stopCamera(); onCancel(); }}
                            style={{ padding: '12px 20px', borderRadius: '12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: '14px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
