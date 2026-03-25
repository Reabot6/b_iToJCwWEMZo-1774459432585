'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Download, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type UploadState = 'idle' | 'uploading' | 'positioning' | 'success' | 'error';

interface DPPosition {
  x: number;
  y: number;
  scale: number;
}

export function DPUploader() {
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string>('');
  const [userName, setUserName] = useState('');
  const [flyerSrc, setFlyerSrc] = useState<string>(''); // the original flyer background
  const [dpSrc, setDpSrc] = useState<string>('');       // the cutout DP from API
  const [resultImage, setResultImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Positioning state ---
  const [dpPos, setDpPos] = useState<DPPosition>({ x: 50, y: 50, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, dpX: 0, dpY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dpRef = useRef<HTMLImageElement>(null);

  // DP natural size relative to flyer (as % of flyer width)
  const DP_SIZE_PERCENT = 28; // default DP is 28% of the flyer width

  // Frame colours matched to the NIMEPA flyer palette
  const FRAME_OUTER = '#00AADD';   // bright cyan-blue accent
  const FRAME_INNER = '#FFFFFF';   // white separator ring
  const FRAME_GLOW  = '#0077AA';   // darker teal for the drop-shadow

  const handleFile = useCallback(async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG, PNG, or WebP');
      setState('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Max 5MB');
      setState('error');
      return;
    }

    setState('uploading');
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', userName);
      // Tell the API to return ONLY the cutout DP (transparent background PNG)
      // and the flyer separately — OR return just the DP cutout and we composite client-side.
      // If your API already returns the composited image, adapt accordingly.
      formData.append('mode', 'cutout'); // optional: signal we want just the cutout

      const response = await fetch('/api/generate-dp', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const dpUrl = URL.createObjectURL(blob);
      setDpSrc(dpUrl);

      // Use your static flyer image path here
      setFlyerSrc('/flyer.jpg'); // ← update to your actual flyer asset path

      // Default DP to center of flyer
      setDpPos({ x: 50, y: 50, scale: 1 });
      setState('positioning');
    } catch (err: any) {
      setError(err.message || 'Failed to process photo');
      setState('error');
    }
  }, [userName]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  // ---- Drag handlers ----
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      dpX: dpPos.x,
      dpY: dpPos.y,
    };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mouseX) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.current.mouseY) / rect.height) * 100;
    setDpPos(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100, dragStart.current.dpX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.dpY + dy)),
    }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    dragStart.current = {
      mouseX: t.clientX,
      mouseY: t.clientY,
      dpX: dpPos.x,
      dpY: dpPos.y,
    };
  };

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const t = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((t.clientX - dragStart.current.mouseX) / rect.width) * 100;
    const dy = ((t.clientY - dragStart.current.mouseY) / rect.height) * 100;
    setDpPos(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100, dragStart.current.dpX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.dpY + dy)),
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  // ---- Scale controls ----
  const scaleUp = () => setDpPos(p => ({ ...p, scale: Math.min(3, +(p.scale + 0.1).toFixed(1)) }));
  const scaleDown = () => setDpPos(p => ({ ...p, scale: Math.max(0.2, +(p.scale - 0.1).toFixed(1)) }));
  const resetPos = () => setDpPos({ x: 50, y: 50, scale: 1 });

  // ---- Flatten to canvas & download ----
  const confirmAndDownload = () => {
    const container = containerRef.current;
    const dpImg = dpRef.current;
    if (!container || !dpImg) return;

    // We draw at a fixed high-res output size (e.g. 1080×1080 or match flyer aspect)
    const OUTPUT_W = 1080;
    const OUTPUT_H = 1080; // adjust to your flyer's aspect ratio

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d')!;

    const flyer = new window.Image();
    flyer.crossOrigin = 'anonymous';
    flyer.onload = () => {
      // Draw flyer background
      ctx.drawImage(flyer, 0, 0, OUTPUT_W, OUTPUT_H);

      const dp = new window.Image();
      dp.crossOrigin = 'anonymous';
      dp.onload = () => {
        // DP diameter = DP_SIZE_PERCENT% of output width, scaled by user
        const dpD = (DP_SIZE_PERCENT / 100) * OUTPUT_W * dpPos.scale;
        const radius = dpD / 2;

        // Centre position
        const cx = (dpPos.x / 100) * OUTPUT_W;
        const cy = (dpPos.y / 100) * OUTPUT_H;

        // --- 1. Outer glow (soft teal halo) ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
        ctx.shadowColor = 'rgba(0, 119, 170, 0.55)';
        ctx.shadowBlur = 28;
        ctx.fillStyle = 'rgba(0, 170, 221, 0.28)';
        ctx.fill();
        ctx.restore();

        // --- 2. Cyan-blue outer border ring ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#00AADD';
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.restore();

        // --- 3. White inner separator ring ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();

        // --- 4. Clip to circle and draw DP photo (contain + center) ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // Scale the DP to fit entirely inside the circle (contain logic)
        const naturalW = dp.naturalWidth;
        const naturalH = dp.naturalHeight;
        const fitScale = Math.min((dpD) / naturalW, (dpD) / naturalH);
        const drawW = naturalW * fitScale;
        const drawH = naturalH * fitScale;
        // Center within the circle
        ctx.drawImage(dp, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        ctx.restore();

        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          setResultImage(url);
          setState('success');
        }, 'image/jpeg', 0.95);
      };
      dp.src = dpSrc;
    };
    flyer.src = flyerSrc;
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `NIMEPA-Beach-Cleanup-${userName || 'DP'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setState('idle');
    setError('');
    setDpSrc('');
    setFlyerSrc('');
    setResultImage('');
    setUserName('');
    setDpPos({ x: 50, y: 50, scale: 1 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 space-y-4">

      {/* ── IDLE ── */}
      {state === 'idle' && (
        <Card className="p-8 border-2">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Generate Your DP</h2>
              <p className="text-muted-foreground">Upload your photo and position it perfectly on the official flyer</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Your Name (optional)</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Adeolu"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 hover:border-primary transition-colors cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Click to choose your photo</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, WebP • Max 5MB</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── UPLOADING ── */}
      {state === 'uploading' && (
        <Card className="p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 font-semibold">Processing your photo...</p>
          <p className="text-sm text-muted-foreground">Removing background…</p>
        </Card>
      )}

      {/* ── POSITIONING ── */}
      {state === 'positioning' && dpSrc && flyerSrc && (
        <div className="space-y-4">
          <Card className="p-4 border-blue-200 bg-blue-50">
            <div className="flex items-center gap-3">
              <Move className="w-5 h-5 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800 font-medium">
                Drag your photo to the perfect spot on the flyer, then resize if needed.
              </p>
            </div>
          </Card>

          {/* Flyer canvas */}
          <div
            ref={containerRef}
            className="relative w-full rounded-xl overflow-hidden border-2 border-border shadow-lg select-none"
            style={{ aspectRatio: '1 / 1', cursor: 'default' }}
          >
            {/* Flyer background */}
            <img
              src={flyerSrc}
              alt="Flyer"
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />

            {/* Draggable DP — circular framed */}
            <div
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
              style={{
                position: 'absolute',
                width: `${DP_SIZE_PERCENT * dpPos.scale}%`,
                aspectRatio: '1 / 1',
                left: `${dpPos.x}%`,
                top: `${dpPos.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
                borderRadius: '50%',
                border: '3px solid #FFFFFF',
                outline: '4px solid #00AADD',
                boxShadow: '0 0 0 7px rgba(0,170,221,0.30), 0 6px 24px rgba(0,100,160,0.55)',
                overflow: 'hidden',
              }}
            >
              <img
                ref={dpRef}
                src={dpSrc}
                alt="Your photo"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  borderRadius: '50%',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Drag hint overlay — fades after first drag */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none flex items-center gap-1.5">
              <Move className="w-3 h-3" /> Drag to reposition
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={scaleDown} title="Smaller">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm w-12 text-center font-mono">{Math.round(dpPos.scale * 100)}%</span>
              <Button variant="outline" size="icon" onClick={scaleUp} title="Larger">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={resetPos} title="Reset position">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Start Over</Button>
              <Button onClick={confirmAndDownload}>
                <CheckCircle className="mr-2 w-4 h-4" /> Confirm Position
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {state === 'success' && resultImage && (
        <div className="space-y-4">
          <Card className="p-4 border-green-200 bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Your DP is ready!</p>
                <p className="text-sm text-green-800">Download and share your NIMEPA flyer.</p>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden border-2">
            <img src={resultImage} alt="Final DP" className="w-full h-auto" />
          </Card>
          <div className="flex gap-3 flex-col sm:flex-row">
            <Button onClick={downloadResult} className="flex-1 h-12 text-lg">
              <Download className="mr-2 w-5 h-5" /> Download Flyer
            </Button>
            <Button onClick={reset} variant="outline" className="flex-1 h-12">
              Upload Another Photo
            </Button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {state === 'error' && (
        <div className="space-y-4">
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </Card>
          <Button onClick={reset} className="w-full h-12">Try Again</Button>
        </div>
      )}
    </div>
  );
}