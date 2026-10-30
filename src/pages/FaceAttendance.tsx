import React, { useState, useEffect, useRef, useCallback } from 'react';
import ModuleLayout from '@/components/ModuleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, UserPlus, ScanLine, CheckCircle, XCircle, AlertCircle, Loader2, Upload, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { formatDateForDB } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { isCheckoutWindow, loadTimeWindowSettings } from '@/lib/timeWindow';
import { useTimeWindows } from '@/hooks/useTimeWindows';

declare global {
  interface Window { faceapi: any; }
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
const FACE_MATCH_THRESHOLD = 0.52;
const FACE_DETECTION_THRESHOLD = 0.55;
// Scan loop cadence (ms). Lower = snappier; too low wastes CPU.
const SCAN_INTERVAL_MS = 350;
// Hard cooldown so the scan loop never gets "stuck" — auto-stop after this.
const SCAN_COOLDOWN_MS = 12000;

type ScanPhase = 'idle' | 'warming' | 'detecting' | 'matching' | 'saving' | 'done' | 'error';

const getIndiaNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

const FaceAttendance: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  useTimeWindows();
  const isCheckout = isCheckoutWindow();
  const isSuperAdmin = adminProfile?.role === 'super_admin';

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState('');

  // Registration state
  const [regAdminId, setRegAdminId] = useState('');
  const [regPhoto, setRegPhoto] = useState<File | null>(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regStatus, setRegStatus] = useState('');

  // Scan state
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanResult, setScanResult] = useState<'success' | 'fail' | null>(null);
  const [matchDistance, setMatchDistance] = useState<number | null>(null);
  const [detectionStatus, setDetectionStatus] = useState('');
  const [autoScanning, setAutoScanning] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [phaseProgress, setPhaseProgress] = useState(0); // 0-100
  const [cooldownLeft, setCooldownLeft] = useState(0); // seconds

  // Data
  const [admins, setAdmins] = useState<any[]>([]);
  const [registeredFaces, setRegisteredFaces] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanRef = useRef<number | null>(null);
  const scanStartTimeoutRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);
  const cooldownTimerRef = useRef<number | null>(null);
  const cooldownIntervalRef = useRef<number | null>(null);
  const descriptorCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const detectorOptionsRef = useRef<any>(null);

  // Load face-api.js
  const loadFaceApi = useCallback(async () => {
    if (window.faceapi) { setModelsLoaded(true); return; }
    setModelLoading(true);
    setModelError('');
    try {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[src*="face-api"]')) {
          // Script already loading/loaded
          const checkFaceApi = setInterval(() => {
            if (window.faceapi) { clearInterval(checkFaceApi); resolve(); }
          }, 200);
          setTimeout(() => { clearInterval(checkFaceApi); reject(new Error('Timeout loading face-api.js')); }, 15000);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load face-api.js'));
        document.head.appendChild(script);
      });
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      // Tiny detector is ~5-10x faster than SSD for live video frames.
      detectorOptionsRef.current = new window.faceapi.TinyFaceDetectorOptions({
        inputSize: 256,
        scoreThreshold: 0.5,
      });
      setModelsLoaded(true);
    } catch (err: any) {
      setModelError(err.message || 'Failed to load face detection models');
    } finally {
      setModelLoading(false);
    }
  }, []);

  useEffect(() => { loadFaceApi(); loadTimeWindowSettings(); }, [loadFaceApi]);

  // Fetch data
  const fetchFaces = useCallback(async () => {
    const { data: faces, error } = await supabase
      .from('face_descriptors')
      .select('id, admin_id, face_photo_url, created_at, descriptor')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching face descriptors:', error);
      setRegisteredFaces([]);
      return [];
    }

    console.log('Fetched face descriptors:', faces?.length);
    setRegisteredFaces(faces || []);
    return faces || [];
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: adminsData } = await supabase.from('admins').select('id, name, email, role').eq('is_active', true);
      setAdmins(adminsData || []);
      await fetchFaces();

      // Check if already marked today
      if (adminProfile?.id) {
        const today = formatDateForDB(getIndiaNow());
        const { data: existing, error: attendanceError } = await supabase.from('attendance')
          .select('id').eq('admin_id', adminProfile.id).eq('date', today).maybeSingle();

        if (attendanceError && attendanceError.code !== 'PGRST116') {
          console.error('Error checking attendance status:', attendanceError);
        }

        setAlreadyMarked(Boolean(existing));
      }
    };
    fetchData();
  }, [adminProfile, fetchFaces]);

  // Auto-select current admin for non-super admins
  useEffect(() => {
    if (!isSuperAdmin && adminProfile?.id) {
      setSelectedAdminId(adminProfile.id);
    }
  }, [isSuperAdmin, adminProfile]);

  const getStoredDescriptor = useCallback((adminId?: string) => {
    if (!adminId) return null;
    // Hit the in-memory cache first (much faster on repeat scans)
    const cached = descriptorCacheRef.current.get(adminId);
    if (cached) return cached;

    const faceEntry = registeredFaces.find((face: any) => face.admin_id === adminId);
    const rawDescriptor = faceEntry?.descriptor;

    if (!Array.isArray(rawDescriptor) || rawDescriptor.length !== 128) {
      return null;
    }

    const normalized = rawDescriptor.map((value: unknown) => Number(value));
    if (normalized.some((value: number) => Number.isNaN(value))) {
      return null;
    }

    const f32 = new Float32Array(normalized);
    descriptorCacheRef.current.set(adminId, f32);
    return f32;
  }, [registeredFaces]);

  // Invalidate descriptor cache when registered faces change
  useEffect(() => {
    descriptorCacheRef.current.clear();
  }, [registeredFaces]);

  const currentTargetAdminId = isSuperAdmin ? (selectedAdminId || adminProfile?.id || '') : (adminProfile?.id || '');
  const currentTargetHasRegisteredFace = Boolean(currentTargetAdminId && getStoredDescriptor(currentTargetAdminId));

  const getAdminDetails = useCallback((adminId: string) => {
    return admins.find((admin) => admin.id === adminId);
  }, [admins]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (scanStartTimeoutRef.current) {
        clearTimeout(scanStartTimeoutRef.current);
        scanStartTimeoutRef.current = null;
      }
      if (autoScanRef.current) {
        clearInterval(autoScanRef.current);
        autoScanRef.current = null;
      }
      if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
      if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Auto-start camera only when a valid face is registered for the target admin
  useEffect(() => {
    if (!modelsLoaded || cameraActive || (alreadyMarked && !isCheckout)) return;

    if (!currentTargetAdminId) {
      setDetectionStatus(isSuperAdmin ? 'Select an admin to start scanning' : 'Loading your profile...');
      return;
    }

    if (!currentTargetHasRegisteredFace) {
      setDetectionStatus(
        isSuperAdmin
          ? 'Selected admin has no registered face yet'
          : 'Face not registered - contact Super Admin'
      );
      return;
    }

    setScanStatus('');
    setScanResult(null);
    setMatchDistance(null);
    setDetectionStatus('Starting camera...');

    if (!cameraActive) {
      startCamera();
    }
  }, [modelsLoaded, cameraActive, alreadyMarked, currentTargetAdminId, currentTargetHasRegisteredFace, isSuperAdmin]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRegPhoto(file);
      setRegPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async () => {
    if (!regAdminId || !regPhoto) { setRegStatus('Please select an admin and upload a photo'); return; }
    if (!modelsLoaded) { setRegStatus('Face models not loaded yet'); return; }
    setRegistering(true);
    setRegStatus('Processing face...');
    try {
      const img = await window.faceapi.bufferToImage(regPhoto);
      const allFaces = await window.faceapi.detectAllFaces(img);
      if (allFaces.length > 1) { setRegStatus('Multiple faces detected. Upload a photo with only one face.'); setRegistering(false); return; }
      if (allFaces.length === 0) { setRegStatus('No face detected. Upload a clear face photo.'); setRegistering(false); return; }
      const detection = await window.faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (!detection) { setRegStatus('Could not extract face features. Try a different photo.'); setRegistering(false); return; }
      const descriptorArray = Array.from(detection.descriptor as Float32Array);
      const registeredAdminId = regAdminId;
      
      const { error } = await supabase.from('face_descriptors').upsert({
        admin_id: registeredAdminId,
        descriptor: descriptorArray as any, 
        registered_by: adminProfile?.id,
      }, { onConflict: 'admin_id' });
      
      if (error) { setRegStatus(`Database error: ${error.message}`); setRegistering(false); return; }
      setRegStatus('Face registered successfully!');
      toast({ title: 'Success', description: 'Face registered for admin' });
      await fetchFaces();
      setSelectedAdminId(registeredAdminId);
      setRegPhoto(null); setRegPhotoPreview(''); setRegAdminId('');
    } catch (err: any) { setRegStatus(`Error: ${err.message}`); }
    finally { setRegistering(false); }
  };

  const startCooldown = () => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setCooldownLeft(Math.ceil(SCAN_COOLDOWN_MS / 1000));
    cooldownIntervalRef.current = window.setInterval(() => {
      setCooldownLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    cooldownTimerRef.current = window.setTimeout(() => {
      // Hard timeout — if still scanning without a match, stop & inform user.
      if (autoScanRef.current && !alreadyMarked) {
        if (autoScanRef.current) { clearInterval(autoScanRef.current); autoScanRef.current = null; }
        setAutoScanning(false);
        setPhase('error');
        setScanResult('fail');
        setScanStatus('Could not match face in time. Tap Retry to try again.');
      }
      if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
      setCooldownLeft(0);
    }, SCAN_COOLDOWN_MS);
  };

  const startCamera = async () => {
    try {
      if (scanStartTimeoutRef.current) {
        clearTimeout(scanStartTimeoutRef.current);
        scanStartTimeoutRef.current = null;
      }

      if (autoScanRef.current) {
        clearInterval(autoScanRef.current);
        autoScanRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setPhase('warming');
      setPhaseProgress(20);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      streamRef.current = stream;
      setCameraActive(true);
      setScanResult(null);
      setMatchDistance(null);
      setScanStatus('');
      setDetectionStatus('Camera ready — align your face in the frame');
      setPhaseProgress(40);

      // Start auto-scanning after short delay for camera to warm up
      scanStartTimeoutRef.current = window.setTimeout(() => {
        scanStartTimeoutRef.current = null;
        startAutoScan();
      }, 250);
    } catch (err: any) {
      setPhase('error');
      if (err.name === 'NotAllowedError') setScanStatus('Camera permission denied. Please allow camera access.');
      else if (err.name === 'NotFoundError') setScanStatus('No camera found on this device.');
      else setScanStatus(`Camera error: ${err.message}`);
    }
  };

  const stopEverything = () => {
    if (scanStartTimeoutRef.current) { clearTimeout(scanStartTimeoutRef.current); scanStartTimeoutRef.current = null; }
    if (autoScanRef.current) { clearInterval(autoScanRef.current); autoScanRef.current = null; }
    if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
    if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
    setCooldownLeft(0);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    scanningRef.current = false;
    setCameraActive(false);
    setAutoScanning(false);
    setDetectionStatus('');
  };

  // Auto-scan loop
  const startAutoScan = () => {
    const targetAdminId = isSuperAdmin ? (selectedAdminId || adminProfile?.id) : adminProfile?.id;
    const storedDescriptor = getStoredDescriptor(targetAdminId);

    if (!targetAdminId) {
      setAutoScanning(false);
      setDetectionStatus(isSuperAdmin ? 'Select an admin to start scanning' : 'Loading your profile...');
      return;
    }

    if (!storedDescriptor) {
      setAutoScanning(false);
      setDetectionStatus(
        isSuperAdmin
          ? 'Selected admin has no valid registered face'
          : 'Face not registered - contact Super Admin'
      );
      return;
    }

    if (autoScanRef.current) clearInterval(autoScanRef.current);
    setAutoScanning(true);
    setPhase('detecting');
    setPhaseProgress(50);
    startCooldown();

    autoScanRef.current = window.setInterval(async () => {
      if (!videoRef.current || !window.faceapi || scanningRef.current || !mountedRef.current) return;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.readyState < 2) return;

      scanningRef.current = true;

      try {
        // Fast path: TinyFaceDetector for the live frame, then a single landmark+descriptor pass.
        const opts = detectorOptionsRef.current || new window.faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 });
        const dets = await window.faceapi.detectAllFaces(video, opts);

        if (canvasRef.current) {
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          window.faceapi.matchDimensions(canvasRef.current, displaySize);
          const resized = window.faceapi.resizeResults(dets, displaySize);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); window.faceapi.draw.drawDetections(canvasRef.current, resized); }
        }

        if (dets.length === 0) { setDetectionStatus('No face in frame'); scanningRef.current = false; return; }
        if (dets.length > 1) { setDetectionStatus('Multiple faces detected'); scanningRef.current = false; return; }
        const score = dets[0].score;
        if (score < FACE_DETECTION_THRESHOLD) { setDetectionStatus('Low confidence - improve lighting'); scanningRef.current = false; return; }
        setDetectionStatus(`Face detected (${(score * 100).toFixed(0)}%)`);
        setPhase('matching');
        setPhaseProgress(70);

        const detection = await window.faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
        if (!detection) { scanningRef.current = false; return; }

        const liveDescriptor = detection.descriptor;
        const distance = window.faceapi.euclideanDistance(liveDescriptor, storedDescriptor);
        setMatchDistance(distance);
        const matchPercentage = Math.max(0, (1 - distance) * 100);

        if (distance <= FACE_MATCH_THRESHOLD) {
          // Match found! Stop scanning and mark attendance
          if (autoScanRef.current) { clearInterval(autoScanRef.current); autoScanRef.current = null; }
          if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
          if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
          setCooldownLeft(0);
          setAutoScanning(false);
          setPhase('saving');
          setPhaseProgress(90);

          const now = new Date();
          const indiaNow = getIndiaNow();
          const today = formatDateForDB(indiaNow);
          const { data: rpcStatus } = await supabase.rpc('attendance_status_for_time', { _at: now.toISOString() } as any);
          const status = (rpcStatus as string) || 'present';

          const { data: existing, error: existingError } = await supabase.from('attendance')
            .select('id').eq('admin_id', targetAdminId).eq('date', today).maybeSingle();

          if (existingError && existingError.code !== 'PGRST116') {
            setScanStatus(`Attendance lookup failed: ${existingError.message}`);
            setScanResult('fail');
            setPhase('error');
            scanningRef.current = false;
            return;
          }

          if (isCheckout) {
            // CHECKOUT FLOW (configured IST window)
            if (existing) {
              await supabase.from('attendance')
                .update({ check_out_time: now.toISOString(), updated_at: now.toISOString() })
                .eq('id', existing.id);
            } else {
              await supabase.from('attendance').insert({
                admin_id: targetAdminId, date: today, status: 'present',
                check_out_time: now.toISOString(),
                marked_by: adminProfile?.id || targetAdminId, marked_at: now.toISOString(),
              });
            }
            setDetectionStatus(`Face matched (${matchPercentage.toFixed(1)}%)`);
            setScanStatus('✅ Checked out — opening Work Log Entry…');
            setScanResult('success');
            setPhase('done');
            setPhaseProgress(100);
            toast({ title: '🌙 Checked Out', description: 'Now log your work for the day.' });
            setTimeout(() => {
              stopEverything();
              navigate('/dashboard/work-log?checkout=1');
            }, 1200);
            return;
          }
          if (existing) {
            setScanStatus('Attendance already marked for today!');
            setScanResult('success');
            setAlreadyMarked(true);
            setPhase('done');
            setPhaseProgress(100);
          } else {
            const { error: insertErr } = await supabase.from('attendance').insert({
              admin_id: targetAdminId, date: today, status,
              check_in_time: now.toISOString(), marked_by: adminProfile?.id || targetAdminId, marked_at: now.toISOString(),
            });
            if (insertErr) {
              setScanStatus(`Database error: ${insertErr.message}`);
              setScanResult('fail');
              setPhase('error');
            } else {
              setDetectionStatus(`Face matched (${matchPercentage.toFixed(1)}%)`);
              setScanStatus(`Attendance marked as ${status.toUpperCase()}!`);
              setScanResult('success');
              setAlreadyMarked(true);
              setPhase('done');
              setPhaseProgress(100);
              toast({ title: '✅ Attendance Marked', description: `Status: ${status.toUpperCase()} | Match: ${matchPercentage.toFixed(1)}%` });
            }
          }
          setTimeout(() => { stopEverything(); }, 2000);
        } else {
          setScanResult(null);
          setScanStatus(`Face detected, current match ${matchPercentage.toFixed(1)}%. Hold steady and look straight at the camera.`);
        }
      } catch (err: any) {
        console.error('Auto-scan error:', err);
        setScanStatus(`Scan error: ${err.message || 'Unable to process face scan'}`);
        setScanResult('fail');
        setPhase('error');
      } finally {
        scanningRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
  };

  const hasFaceRegistered = registeredFaces.some((f: any) => f.admin_id === adminProfile?.id);
  const unregisteredAdmins = admins.filter(a => !registeredFaces.some((f: any) => f.admin_id === a.id));

  return (
    <ModuleLayout
      title={isCheckout ? 'Checkout Face-Scan' : 'Face Attendance'}
      description={isCheckout
        ? 'You are in the configured IST checkout window — face-scan to check out and log your work.'
        : 'Mark attendance using face recognition'}
    >
      {/* Model Loading */}
      {!modelsLoaded && (
        <Card className="bg-card border-border mb-4">
          <CardContent className="p-4 flex items-center gap-3">
            {modelLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Loading face detection models...</span></>
            ) : modelError ? (
              <><AlertCircle className="w-5 h-5 text-destructive" /><span className="text-sm text-destructive">{modelError}</span><Button size="sm" variant="outline" onClick={loadFaceApi}>Retry</Button></>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="scan" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="scan"><ScanLine className="w-4 h-4 mr-1" /> Scan</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="register"><UserPlus className="w-4 h-4 mr-1" /> Register</TabsTrigger>}
        </TabsList>

        {/* SCAN TAB */}
        <TabsContent value="scan">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" /> Face Scan Attendance
              </CardTitle>
              {!isSuperAdmin && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Shield className="w-3 h-3" /> Scanning your face only — auto-detecting
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Super admin selector */}
              {isSuperAdmin && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Select Admin to scan for</Label>
                  <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Choose admin" /></SelectTrigger>
                    <SelectContent>
                      {admins.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.role}) {registeredFaces.some((f: any) => f.admin_id === a.id) ? '✅' : '❌'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Already marked (skip in checkout window so user can scan to check out) */}
              {alreadyMarked && !isCheckout ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                  <p className="text-lg font-semibold text-green-400">Attendance Already Marked!</p>
                  <p className="text-sm text-muted-foreground">Your attendance for today has been recorded.</p>
                  {matchDistance !== null && (
                    <Badge variant="outline" className="text-green-400 border-green-500/30">
                      Match: {((1 - matchDistance) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
              ) : !hasFaceRegistered && !isSuperAdmin ? (
                <div className="text-center py-8 space-y-3">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
                  <p className="text-sm text-yellow-400">Your face is not registered. Please contact Super Admin.</p>
                </div>
              ) : isSuperAdmin && !currentTargetHasRegisteredFace ? (
                <div className="text-center py-8 space-y-3">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
                  <p className="text-sm text-yellow-400">
                    {currentTargetAdminId
                      ? 'Selected admin has no valid face registration yet. Register the face first.'
                      : 'Select an admin to start scanning.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Camera view */}
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video max-w-lg mx-auto border border-border">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />

                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <Camera className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-sm">Starting camera...</span>
                      </div>
                    )}

                    {/* Detection overlay */}
                    {cameraActive && detectionStatus && (
                      <div className={`absolute top-2 left-2 right-2 text-center py-1 px-2 rounded text-xs font-medium ${
                        detectionStatus.includes('detected') && !detectionStatus.includes('Multiple') && !detectionStatus.includes('Low')
                          ? 'bg-green-500/80 text-white' : detectionStatus.includes('No face') || detectionStatus.includes('not registered')
                          ? 'bg-yellow-500/80 text-black' : 'bg-red-500/80 text-white'
                      }`}>
                        {detectionStatus}
                      </div>
                    )}

                    {/* Auto-scanning indicator */}
                    {autoScanning && (
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2">
                        <div className="bg-primary/90 text-primary-foreground text-xs py-1 px-3 rounded-full flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {phase === 'warming' && 'Warming camera...'}
                          {phase === 'detecting' && 'Detecting face...'}
                          {phase === 'matching' && 'Matching identity...'}
                          {phase === 'saving' && 'Saving attendance...'}
                          {phase === 'idle' && 'Auto-scanning...'}
                          {cooldownLeft > 0 && phase !== 'saving' && phase !== 'done' && ` (${cooldownLeft}s)`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phase progress */}
                  {(autoScanning || phase === 'saving' || phase === 'done') && (
                    <div className="max-w-lg mx-auto">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground capitalize">{phase}</span>
                        <span className="text-muted-foreground">{phaseProgress}%</span>
                      </div>
                      <Progress value={phaseProgress} className="h-1.5" />
                    </div>
                  )}

                  {/* Match indicator */}
                  {matchDistance !== null && (
                    <div className="max-w-lg mx-auto">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Match Score</span>
                        <span className={matchDistance <= FACE_MATCH_THRESHOLD ? 'text-green-400' : 'text-red-400'}>
                          {((1 - matchDistance) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.max(0, (1 - matchDistance) * 100)} className="h-2" />
                    </div>
                  )}

                  {/* Status */}
                  {scanStatus && (
                    <div className={`max-w-lg mx-auto text-center p-3 rounded-lg text-sm ${
                      scanResult === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      scanResult === 'fail' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <div className="flex items-center justify-center gap-2">
                        {scanResult === 'success' && <CheckCircle className="w-4 h-4" />}
                        {scanResult === 'fail' && <XCircle className="w-4 h-4" />}
                        {scanStatus}
                      </div>
                    </div>
                  )}

                  {/* Manual retry */}
                  {(!cameraActive || phase === 'error') && !alreadyMarked && modelsLoaded && (
                    <div className="flex justify-center">
                      <Button onClick={() => { setPhase('idle'); setPhaseProgress(0); setScanResult(null); setScanStatus(''); startCamera(); }} className="gap-2">
                        <Camera className="w-4 h-4" /> {phase === 'error' ? 'Retry Scan' : 'Retry Camera'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REGISTER TAB */}
        {isSuperAdmin && (
          <TabsContent value="register">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" /> Register Face
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Select Admin</Label>
                    <Select value={regAdminId} onValueChange={setRegAdminId}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Choose admin" /></SelectTrigger>
                      <SelectContent>
                        {admins.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({a.role}) {registeredFaces.some((f: any) => f.admin_id === a.id) && ' ✅'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Face Photo</Label>
                    <Input type="file" accept="image/*" onChange={handlePhotoChange} className="bg-background" />
                    {regPhotoPreview && <img src={regPhotoPreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg mt-2 border border-border" />}
                  </div>
                  {regStatus && (
                    <p className={`text-xs ${regStatus.includes('success') ? 'text-green-400' : regStatus.includes('Error') || regStatus.includes('Multiple') || regStatus.includes('No face') ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {regStatus}
                    </p>
                  )}
                  <Button onClick={handleRegister} disabled={registering || !modelsLoaded} className="w-full">
                    {registering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {registering ? 'Processing...' : 'Register Face'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Registered Faces ({registeredFaces.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {registeredFaces.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No faces registered yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {registeredFaces.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{getAdminDetails(f.admin_id)?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{getAdminDetails(f.admin_id)?.email || 'No email found'}</p>
                          </div>
                          <Badge variant="outline" className="text-green-400 border-green-500/30">Registered</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {unregisteredAdmins.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Unregistered ({unregisteredAdmins.length})</p>
                      <div className="space-y-1">
                        {unregisteredAdmins.slice(0, 5).map(a => (
                          <div key={a.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30">
                            <span className="text-xs">{a.name}</span>
                            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">Pending</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </ModuleLayout>
  );
};

export default FaceAttendance;
