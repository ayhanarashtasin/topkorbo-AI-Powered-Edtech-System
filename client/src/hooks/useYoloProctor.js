import { useEffect, useRef, useState, useCallback } from 'react';

const CELL_PHONE_CLASS_ID = 67; // COCO dataset class for 'cell phone'
const CONFIDENCE_THRESHOLD = 0.40; // 40% confidence threshold for responsive detection
const INFERENCE_INTERVAL_MS = 300; // CPU (WASM) fallback: run inference every 300ms (~3.3 FPS)
const WEBGPU_INTERVAL_MS = 150; // GPU (WebGPU): run every 150ms (~6.6 FPS) for real-time response
const DEBOUNCE_MS = 3000; // Min 3 seconds between backend snapshot uploads
const MODEL_INPUT_SIZE = 640; // Fixed YOLOv8 ONNX input resolution (model is exported at 640x640)

/**
 * useYoloProctor — real-time mobile phone detection during contests.
 *
 * Runs a pre-trained YOLOv8-nano ONNX model directly in the browser via
 * WebAssembly/WebGL. When a cell phone is detected in consecutive frames,
 * captures a snapshot with the bounding box drawn on it and POSTs to the
 * server for audit logging.
 *
 * @param {Object} options
 * @param {string} options.contestId - The active contest ID
 * @param {boolean} options.enabled - Whether proctoring is active
 * @param {Function} options.onViolation - Callback when a violation is detected
 * @returns {{ status, phoneDetected, violationCount, videoRef, error }}
 */
export default function useYoloProctor({ contestId, enabled = false, onViolation } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const sessionRef = useRef(null);
  const streamRef = useRef(null);
  const ortRef = useRef(null);
  const isRunningRef = useRef(false);
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);
  const consecutiveDetectionsRef = useRef(0);
  const lastViolationTimeRef = useRef(0);
  // Reused input buffer avoids allocating ~1.2M floats per frame (less GC jank).
  const inputBufferRef = useRef(new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE));

  const [status, setStatus] = useState('idle'); // idle | requesting_camera | camera_ready | active | camera_only | error
  const [phoneDetected, setPhoneDetected] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [error, setError] = useState(null);

  // Initialize camera immediately, then load YOLO model in background
  const start = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setError(null);

    try {
      // 1. Start camera FIRST for instant feedback on mobile & desktop
      setStatus('requesting_camera');
      let stream = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (constraintErr) {
        console.warn('[Proctor] Ideal constraints failed, trying basic user-facing camera:', constraintErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
        } catch (facingErr) {
          console.warn('[Proctor] FacingMode failed, trying fallback video: true:', facingErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('muted', 'true');
        video.muted = true;

        try {
          await video.play();
        } catch (playErr) {
          console.warn('[Proctor] Video play auto-start caught:', playErr);
        }
      }

      setStatus('camera_ready');

      // 2. Load YOLO model in background without blocking camera feed
      try {
        // Prefer GPU (WebGPU) for real-time inference (~10-30ms/frame). Devices
        // without WebGPU (older iOS/iPadOS, old browsers) automatically fall back
        // to CPU (WASM) via the executionProviders chain — the feature still works,
        // just slower. The /webgpu bundle bundles both providers.
        const gpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;
        const ort = await import('onnxruntime-web/webgpu');
        ortRef.current = ort;

        // WASM settings only apply when it falls back to CPU. Single thread avoids
        // the SharedArrayBuffer / COOP-COEP requirement on mobile.
        if (ort.env && ort.env.wasm) {
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.simd = true;
        }

        sessionRef.current = await ort.InferenceSession.create('/models/yolov8n.onnx', {
          executionProviders: gpuAvailable ? ['webgpu', 'wasm'] : ['wasm'],
          graphOptimizationLevel: 'all'
        });

        // Warmup: the first inference lazily compiles GPU shaders / WASM kernels
        // (can take 1-2s). Running one throwaway pass now — before the detection
        // loop — means the FIRST real phone that appears is detected at full speed
        // instead of being missed during the cold-start stall.
        try {
          const inputName = sessionRef.current.inputNames?.[0] || 'images';
          const warmData = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
          const warmTensor = new ort.Tensor('float32', warmData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
          await sessionRef.current.run({ [inputName]: warmTensor });
        } catch (warmErr) {
          console.warn('[Proctor] Warmup inference skipped:', warmErr.message);
        }

        setStatus('active');

        // On GPU we poll faster for real-time response; on CPU fallback we poll
        // slower and rely on the in-flight guard to prevent overlapping runs.
        const intervalMs = gpuAvailable ? WEBGPU_INTERVAL_MS : INFERENCE_INTERVAL_MS;

        // Start detection loop
        if (isRunningRef.current && sessionRef.current) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            if (isRunningRef.current) {
              runInference();
            }
          }, intervalMs);
        }
      } catch (modelErr) {
        console.warn('[Proctor] YOLO model failed to load, running in camera-only fallback mode:', modelErr);
        setStatus('camera_only');
      }

    } catch (err) {
      console.error('[Proctor] Camera initialization failed:', err);
      isRunningRef.current = false;
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : `Camera setup failed: ${err.message || 'Unknown error'}`
      );
      setStatus('error');
    }
  }, []);

  // Stop everything
  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current = null;
    }
    inFlightRef.current = false;
    setStatus('idle');
    setPhoneDetected(false);
    consecutiveDetectionsRef.current = 0;
  }, []);

  // Run a single inference frame
  const runInference = async () => {
    const video = videoRef.current;
    const session = sessionRef.current;
    const ort = ortRef.current;
    if (!video || !session || !ort || video.readyState < 2) return;

    // In-flight guard: never start a new inference while one is still running.
    // Without this, the interval stacks overlapping runs that thrash the GPU/CPU
    // and make every inference slower.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const canvas = canvasRef.current;
      canvas.width = MODEL_INPUT_SIZE;
      canvas.height = MODEL_INPUT_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Letterbox: preserve the camera's aspect ratio instead of stretching it
      // into a square. YOLOv8 is trained on aspect-preserved + padded frames, so
      // stretching (old behaviour) distorted phones and tanked confidence. We
      // scale the frame to fit 640x640 and pad the remainder with neutral gray
      // (114) — the exact letterbox the model expects.
      const vw = video.videoWidth || MODEL_INPUT_SIZE;
      const vh = video.videoHeight || MODEL_INPUT_SIZE;
      const scale = Math.min(MODEL_INPUT_SIZE / vw, MODEL_INPUT_SIZE / vh);
      const drawW = vw * scale;
      const drawH = vh * scale;
      const padX = (MODEL_INPUT_SIZE - drawW) / 2;
      const padY = (MODEL_INPUT_SIZE - drawH) / 2;

      ctx.fillStyle = 'rgb(114,114,114)';
      ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      ctx.drawImage(video, padX, padY, drawW, drawH);

      const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      const inputTensor = preprocessImage(ort, imageData.data, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, inputBufferRef.current);

      const feeds = { images: inputTensor };
      const results = await session.run(feeds);
      const outputKey = session.outputNames?.[0] || Object.keys(results)[0];
      const output = results[outputKey];

      if (!output || !output.data) return;

      // Only scan the cell-phone class (67) instead of all 80 COCO classes.
      // ~80x less main-thread work per frame => faster cycles, less UI jank.
      const phoneModel = findBestPhone(output.data, output.dims);
      const phoneDetection = phoneModel && phoneModel.confidence >= CONFIDENCE_THRESHOLD
        ? phoneModel
        : null;

      // Map the box from letterboxed model space back to real video pixels so the
      // snapshot draws the red box in the right place.
      if (phoneDetection) {
        const [mx, my, mw, mh] = phoneDetection.bbox;
        phoneDetection.videoBbox = [
          (mx - padX) / scale,
          (my - padY) / scale,
          mw / scale,
          mh / scale
        ];
      }

      if (phoneDetection) {
        consecutiveDetectionsRef.current += 1;
        // Instant trigger if confidence >= 50%, or 2 frames if confidence >= 40%
        const isConfirmed = phoneDetection.confidence >= 0.50 || consecutiveDetectionsRef.current >= 2;

        if (isConfirmed) {
          setPhoneDetected(true);
          const now = Date.now();
          if (now - lastViolationTimeRef.current > DEBOUNCE_MS) {
            lastViolationTimeRef.current = now;
            handleViolation(phoneDetection);
          }
        }
      } else {
        consecutiveDetectionsRef.current = 0;
        setPhoneDetected(false);
      }
    } catch (err) {
      console.warn('[Proctor] Inference error:', err.message);
    } finally {
      inFlightRef.current = false;
    }
  };

  // Capture snapshot and report violation
  const handleViolation = (detection) => {
    const video = videoRef.current;
    if (!video) return;

    // Capture full-resolution snapshot
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth || 640;
    captureCanvas.height = video.videoHeight || 480;
    const captureCtx = captureCanvas.getContext('2d');
    captureCtx.drawImage(video, 0, 0);

    // Draw red bounding box on the snapshot. videoBbox is already in the
    // full-resolution video coordinate space (mapped out of the letterbox), so
    // no extra scaling is needed here.
    if (detection.videoBbox) {
      const [bx, by, bw, bh] = detection.videoBbox;
      captureCtx.strokeStyle = '#ef4444';
      captureCtx.lineWidth = 3;
      captureCtx.strokeRect(bx, by, bw, bh);
      // Label
      captureCtx.fillStyle = '#ef4444';
      captureCtx.font = 'bold 14px sans-serif';
      captureCtx.fillText(
        `Mobile Phone ${Math.round(detection.confidence * 100)}%`,
        bx,
        Math.max(by - 6, 14)
      );
    }

    const snapshotBase64 = captureCanvas.toDataURL('image/jpeg', 0.8);

    // Increment client-side violation counter immediately
    setViolationCount(prev => prev + 1);

    // Report to backend
    if (contestId) {
      const token = localStorage.getItem('topkorbo_token') || '';
      const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      fetch(`${backendBaseUrl}/contests/${contestId}/proctor/violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          violationType: 'MOBILE_PHONE_DETECTED',
          confidence: Math.round(detection.confidence * 100),
          image: snapshotBase64
        })
      }).catch(err => console.warn('[Proctor] Failed to report violation to server:', err.message));
    }

    if (onViolation) {
      onViolation({
        type: 'MOBILE_PHONE_DETECTED',
        confidence: detection.confidence,
        timestamp: Date.now()
      });
    }
  };

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && contestId) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, contestId, start, stop]);

  return { status, phoneDetected, violationCount, videoRef, error, start, stop };
}

// ── Tensor Preprocessing ──────────────────────────────────────────────────
// Converts RGBA Uint8ClampedArray to Float32 CHW Tensor [1, 3, H, W].
// Writes into a caller-provided buffer to avoid per-frame allocations.
function preprocessImage(ort, data, width, height, buffer) {
  const float32Data = buffer || new Float32Array(3 * width * height);
  const plane = width * height;
  for (let i = 0; i < plane; i++) {
    float32Data[i] = data[i * 4] / 255.0;             // R channel
    float32Data[plane + i] = data[i * 4 + 1] / 255.0; // G channel
    float32Data[2 * plane + i] = data[i * 4 + 2] / 255.0; // B channel
  }
  return new ort.Tensor('float32', float32Data, [1, 3, height, width]);
}

// ── YOLO Output Postprocessing ────────────────────────────────────────────
// YOLOv8 output shape: [1, 84, N] where 84 = 4 bbox coords + 80 class scores.
// We only care about phones, so we scan a single class row (67) instead of the
// full 80-class argmax — ~80x fewer reads per frame — and return just the
// highest-confidence phone box (no NMS needed for a single best pick).
function findBestPhone(output, dims) {
  const numAnchors = dims && dims[2] ? dims[2] : 8400;
  const scoreRow = (4 + CELL_PHONE_CLASS_ID) * numAnchors; // class 67 score offset

  let bestScore = -Infinity;
  let bestIdx = -1;
  for (let i = 0; i < numAnchors; i++) {
    const score = output[scoreRow + i];
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestIdx < 0 || bestScore < 0.35) return null; // Pre-filter threshold

  const cx = output[bestIdx];
  const cy = output[numAnchors + bestIdx];
  const w = output[2 * numAnchors + bestIdx];
  const h = output[3 * numAnchors + bestIdx];

  return {
    classId: CELL_PHONE_CLASS_ID,
    confidence: bestScore,
    bbox: [cx - w / 2, cy - h / 2, w, h]
  };
}
