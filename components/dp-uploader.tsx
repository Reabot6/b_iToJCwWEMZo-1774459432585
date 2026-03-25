'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  Download, Move, ZoomIn, ZoomOut, RotateCcw, Waves
} from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'positioning' | 'success' | 'error';

interface DPPosition {
  x: number;
  y: number;
  scale: number;
}

// ── Flyer palette ──────────────────────────────────────────────
const C = {
  blue:     '#00AADD',
  blueDark: '#0077AA',
  blueDeep: '#005580',
  white:    '#FFFFFF',
  glowRgb:  '0, 119, 170',
};

const DP_SIZE_PERCENT = 28;
const OUTPUT_W = 1080;
const OUTPUT_H = 1080;

export function DPUploader() {
  const [state, setState]           = useState<UploadState>('idle');
  const [error, setError]           = useState('');
  const [userName, setUserName]     = useState('');
  const [flyerSrc, setFlyerSrc]     = useState('');
  const [dpSrc, setDpSrc]           = useState('');
  const [resultImage, setResultImage] = useState('');
  const [dpPos, setDpPos]           = useState<DPPosition>({ x: 50, y: 50, scale: 1 });
  const [hintVisible, setHintVisible] = useState(true);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const dpRef         = useRef<HTMLImageElement>(null);
  const dragging      = useRef(false);
  const dragStart     = useRef({ mouseX: 0, mouseY: 0, dpX: 0, dpY: 0 });

  // ── File handling ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG, PNG, or WebP'); setState('error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Max 5MB'); setState('error'); return;
    }

    setState('uploading');
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', userName);
      formData.append('mode', 'cutout');

      const response = await fetch('/api/generate-dp', { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const blob = await response.blob();
      setDpSrc(URL.createObjectURL(blob));
      setFlyerSrc('/flyer-template.jpg'); // ← your flyer asset
      setDpPos({ x: 50, y: 50, scale: 1 });
      setHintVisible(true);
      setState('positioning');
    } catch (err: any) {
      setError(err.message || 'Failed to process photo');
      setState('error');
    }
  }, [userName]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.[0]) handleFile(files[0]);
  };

  // ── Drag ──────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setHintVisible(false);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, dpX: dpPos.x, dpY: dpPos.y };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    setHintVisible(false);
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, dpX: dpPos.x, dpY: dpPos.y };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mouseX) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.current.mouseY) / rect.height) * 100;
    setDpPos(p => ({
      ...p,
      x: Math.max(0, Math.min(100, dragStart.current.dpX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.dpY + dy)),
    }));
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const t = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((t.clientX - dragStart.current.mouseX) / rect.width) * 100;
    const dy = ((t.clientY - dragStart.current.mouseY) / rect.height) * 100;
    setDpPos(p => ({
      ...p,
      x: Math.max(0, Math.min(100, dragStart.current.dpX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.dpY + dy)),
    }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

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

  // ── Scale ──────────────────────────────────────────────────
  const scaleUp   = () => setDpPos(p => ({ ...p, scale: Math.min(3,   +(p.scale + 0.1).toFixed(1)) }));
  const scaleDown = () => setDpPos(p => ({ ...p, scale: Math.max(0.2, +(p.scale - 0.1).toFixed(1)) }));
  const resetPos  = () => setDpPos({ x: 50, y: 50, scale: 1 });

  // ── Canvas export ──────────────────────────────────────────
  const confirmAndDownload = () => {
    if (!containerRef.current || !dpRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d')!;

    const flyer = new window.Image();
    flyer.crossOrigin = 'anonymous';
    flyer.onload = () => {
      ctx.drawImage(flyer, 0, 0, OUTPUT_W, OUTPUT_H);

      const dp = new window.Image();
      dp.crossOrigin = 'anonymous';
      dp.onload = () => {
        const dpD    = (DP_SIZE_PERCENT / 100) * OUTPUT_W * dpPos.scale;
        const radius = dpD / 2;
        const cx     = (dpPos.x / 100) * OUTPUT_W;
        const cy     = (dpPos.y / 100) * OUTPUT_H;

        // 1. Outer glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
        ctx.shadowColor = `rgba(${C.glowRgb}, 0.55)`;
        ctx.shadowBlur  = 28;
        ctx.fillStyle   = `rgba(0,170,221,0.28)`;
        ctx.fill();
        ctx.restore();

        // 2. Cyan-blue border
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = C.blue;
        ctx.lineWidth   = 8;
        ctx.stroke();
        ctx.restore();

        // 3. White separator
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = C.white;
        ctx.lineWidth   = 5;
        ctx.stroke();
        ctx.restore();

        // 4. Clipped photo — contain + center
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        const fitScale = Math.min(dpD / dp.naturalWidth, dpD / dp.naturalHeight);
        const drawW    = dp.naturalWidth  * fitScale;
        const drawH    = dp.naturalHeight * fitScale;
        ctx.drawImage(dp, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        ctx.restore();

        canvas.toBlob(blob => {
          if (!blob) return;
          setResultImage(URL.createObjectURL(blob));
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
    link.href     = resultImage;
    link.download = `NIMEPA-Beach-Cleanup-${userName || 'DP'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setState('idle'); setError(''); setDpSrc(''); setFlyerSrc('');
    setResultImage(''); setUserName(''); setDpPos({ x: 50, y: 50, scale: 1 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Shared button style helpers ────────────────────────────
  const btnPrimary: React.CSSProperties = {
    background:   `linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
    color:        '#fff',
    border:       'none',
    borderRadius: '10px',
    padding:      '12px 24px',
    fontWeight:   700,
    fontSize:     '15px',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    gap:          '8px',
    boxShadow:    `0 4px 16px rgba(${C.glowRgb},0.35)`,
    transition:   'opacity 0.15s',
  };
  const btnOutline: React.CSSProperties = {
    background:   'transparent',
    color:        C.blueDark,
    border:       `2px solid ${C.blue}`,
    borderRadius: '10px',
    padding:      '10px 20px',
    fontWeight:   600,
    fontSize:     '14px',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    gap:          '6px',
    transition:   'background 0.15s',
  };
  const btnIcon: React.CSSProperties = {
    ...btnOutline,
    padding:      '8px',
    borderRadius: '8px',
    justifyContent: 'center',
  };

  return (
    <div style={{ width: '100%', padding: '32px', boxSizing: 'border-box' }}>

      {/* ── IDLE ── */}
      {state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Waves size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: C.blueDeep }}>
                Generate Your DP
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#5a7f99' }}>
                Upload your photo · position it · download
              </p>
            </div>
          </div>

          {/* Name input */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.blueDeep, marginBottom: '6px' }}>
              Your Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="e.g. Adeolu"
              style={{
                width: '100%', padding: '12px 14px', border: `2px solid #d0e8f5`,
                borderRadius: '10px', fontSize: '15px', outline: 'none',
                color: '#1a3a4a', background: '#f4fafd', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.blue}
              onBlur={e  => e.target.style.borderColor = '#d0e8f5'}
            />
          </div>

          {/* Upload zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = C.blue; }}
            onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#b8dff0'; }}
            onDrop={e => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).style.borderColor = '#b8dff0';
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            style={{
              border: `2.5px dashed #b8dff0`,
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #f0f9ff, #e6f4fc)',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.blue}22, ${C.blue}44)`,
                border: `2px solid ${C.blue}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload size={28} color={C.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: C.blueDeep, fontSize: '15px' }}>
                  Click or drag your photo here
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#6a99b0' }}>
                  JPG, PNG, WebP · Max 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div style={{
            background: '#eaf6fd', borderRadius: '10px', padding: '12px 16px',
            borderLeft: `4px solid ${C.blue}`,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <p style={{ margin: 0, fontSize: '13px', color: '#2a6a88' }}>
              <strong>Best results:</strong> Use a clear headshot or portrait with good lighting and a plain background.
            </p>
          </div>
        </div>
      )}

      {/* ── UPLOADING ── */}
      {state === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${C.blue}22, ${C.blue}44)`,
            border: `2px solid ${C.blue}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader2 size={32} color={C.blue} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '17px', color: C.blueDeep }}>
            Processing your photo…
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#6a99b0' }}>
            Removing background with AI — this takes a few seconds
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── POSITIONING ── */}
      {state === 'positioning' && dpSrc && flyerSrc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Instruction banner */}
          <div style={{
            background: `linear-gradient(135deg, ${C.blue}18, ${C.blue}08)`,
            border: `1.5px solid ${C.blue}44`, borderRadius: '10px',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Move size={18} color={C.blue} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '13px', color: C.blueDeep, fontWeight: 500 }}>
              <strong>Drag</strong> your photo to position it on the flyer. Use <strong>+ / −</strong> to resize.
            </p>
          </div>

          {/* Flyer canvas */}
          <div
            ref={containerRef}
            style={{
              position: 'relative', width: '100%', aspectRatio: '1 / 1',
              borderRadius: '14px', overflow: 'hidden',
              border: `2px solid ${C.blue}44`,
              boxShadow: `0 8px 32px rgba(${C.glowRgb},0.2)`,
              userSelect: 'none', cursor: 'default',
            }}
          >
            {/* Flyer background */}
            <img
              src={flyerSrc} alt="Flyer"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
              draggable={false}
            />

            {/* Draggable DP with circular frame */}
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
                border: `3px solid ${C.white}`,
                outline: `4px solid ${C.blue}`,
                boxShadow: `0 0 0 7px rgba(0,170,221,0.25), 0 6px 24px rgba(${C.glowRgb},0.5)`,
                overflow: 'hidden',
              }}
            >
              <img
                ref={dpRef}
                src={dpSrc}
                alt="Your photo"
                draggable={false}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'contain', objectPosition: 'center center',
                  borderRadius: '50%', display: 'block', pointerEvents: 'none',
                }}
              />
            </div>

            {/* Drag hint */}
            {hintVisible && (
              <div style={{
                position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,40,60,0.72)', backdropFilter: 'blur(4px)',
                color: '#fff', fontSize: '12px', fontWeight: 500,
                padding: '6px 14px', borderRadius: '20px',
                pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Move size={12} /> Drag to reposition
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            {/* Scale controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button style={btnIcon} onClick={scaleDown} title="Smaller"><ZoomOut size={16} color={C.blueDark} /></button>
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.blueDeep, minWidth: '44px', textAlign: 'center' }}>
                {Math.round(dpPos.scale * 100)}%
              </span>
              <button style={btnIcon} onClick={scaleUp} title="Larger"><ZoomIn size={16} color={C.blueDark} /></button>
              <button style={btnIcon} onClick={resetPos} title="Reset">
                <RotateCcw size={16} color={C.blueDark} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnOutline} onClick={reset}>Start Over</button>
              <button style={btnPrimary} onClick={confirmAndDownload}>
                <CheckCircle size={16} /> Confirm Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {state === 'success' && resultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Success banner */}
          <div style={{
            background: '#edfaf3', border: '1.5px solid #6ee7b7',
            borderRadius: '10px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <CheckCircle size={22} color="#059669" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#065f46', fontSize: '15px' }}>
                Your DP is ready! 🎉
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                Download and share on WhatsApp, Instagram, or Twitter.
              </p>
            </div>
          </div>

          {/* Result preview */}
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${C.blue}44`, boxShadow: `0 8px 32px rgba(${C.glowRgb},0.2)` }}>
            <img src={resultImage} alt="Final DP" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '14px 24px', fontSize: '16px' }}
              onClick={downloadResult}>
              <Download size={18} /> Download Flyer
            </button>
            <button style={{ ...btnOutline, flex: '0 0 auto', padding: '14px 20px' }} onClick={reset}>
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {state === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fca5a5',
            borderRadius: '10px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <AlertCircle size={22} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#7f1d1d', fontSize: '15px' }}>Something went wrong</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>{error}</p>
            </div>
          </div>
          <button style={{ ...btnPrimary, justifyContent: 'center', padding: '14px', fontSize: '15px' }} onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}