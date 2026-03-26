'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, CheckCircle, Loader2, Download,
  Move, ZoomIn, ZoomOut, RotateCcw, Waves, AlertCircle, Crop
} from 'lucide-react';

type UploadState = 'idle' | 'cropping' | 'positioning' | 'generating' | 'success' | 'error';

interface DPPosition { x: number; y: number; scale: number; }
interface CropBox    { x: number; y: number; size: number; } // all in px on the preview canvas

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
const FLYER    = '/flyer-template.jpg';

export function DPUploader() {
  const [state, setState]             = useState<UploadState>('idle');
  const [error, setError]             = useState('');
  const [userName, setUserName]       = useState('');
  const [rawSrc, setRawSrc]           = useState('');   // original uploaded image
  const [croppedSrc, setCroppedSrc]   = useState('');   // cropped square data URL
  const [resultImage, setResultImage] = useState('');
  const [dpPos, setDpPos]             = useState<DPPosition>({ x: 50, y: 50, scale: 1 });
  const [hintVisible, setHintVisible] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Crop state
  const [cropBox, setCropBox]         = useState<CropBox>({ x: 0, y: 0, size: 200 });
  const cropCanvasRef                 = useRef<HTMLDivElement>(null);
  const cropImgRef                    = useRef<HTMLImageElement>(null);
  const cropDragging                  = useRef(false);
  const cropDragStart                 = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  // Positioning state
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const dragging      = useRef(false);
  const dragStart     = useRef({ mouseX: 0, mouseY: 0, dpX: 0, dpY: 0 });

  // ── File load ────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG, PNG, WebP, GIF or BMP');
      setState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Max 10MB');
      setState('error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawSrc(e.target?.result as string);
      setState('cropping');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (f) handleFile(f);
  };

  // ── Init crop box once image loads ───────────────────────
  const initCropBox = useCallback(() => {
    const img = cropImgRef.current;
    const wrap = cropCanvasRef.current;
    if (!img || !wrap) return;
    const W = wrap.offsetWidth;
    const H = wrap.offsetHeight;
    // Square crop = 70% of the shorter side, centred
    const size = Math.round(Math.min(W, H) * 0.70);
    setCropBox({ x: Math.round((W - size) / 2), y: Math.round((H - size) / 2), size });
  }, []);

  // ── Crop box drag ────────────────────────────────────────
  const onCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    cropDragging.current = true;
    cropDragStart.current = { mx: e.clientX, my: e.clientY, bx: cropBox.x, by: cropBox.y };
  };
  const onCropTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    cropDragging.current = true;
    cropDragStart.current = { mx: t.clientX, my: t.clientY, bx: cropBox.x, by: cropBox.y };
  };

  const onCropMouseMove = useCallback((e: MouseEvent) => {
    if (!cropDragging.current || !cropCanvasRef.current) return;
    const wrap = cropCanvasRef.current;
    const dx = e.clientX - cropDragStart.current.mx;
    const dy = e.clientY - cropDragStart.current.my;
    setCropBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(wrap.offsetWidth  - prev.size, cropDragStart.current.bx + dx)),
      y: Math.max(0, Math.min(wrap.offsetHeight - prev.size, cropDragStart.current.by + dy)),
    }));
  }, []);

  const onCropTouchMove = useCallback((e: TouchEvent) => {
    if (!cropDragging.current || !cropCanvasRef.current) return;
    const t = e.touches[0];
    const wrap = cropCanvasRef.current;
    const dx = t.clientX - cropDragStart.current.mx;
    const dy = t.clientY - cropDragStart.current.my;
    setCropBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(wrap.offsetWidth  - prev.size, cropDragStart.current.bx + dx)),
      y: Math.max(0, Math.min(wrap.offsetHeight - prev.size, cropDragStart.current.by + dy)),
    }));
  }, []);

  const onCropMouseUp = useCallback(() => { cropDragging.current = false; }, []);

  // Resize crop box
  const growCrop  = () => {
    if (!cropCanvasRef.current) return;
    const wrap = cropCanvasRef.current;
    setCropBox(prev => {
      const maxSize = Math.min(wrap.offsetWidth - prev.x, wrap.offsetHeight - prev.y, prev.size + 20);
      return { ...prev, size: Math.min(Math.min(wrap.offsetWidth, wrap.offsetHeight), maxSize) };
    });
  };
  const shrinkCrop = () => setCropBox(prev => ({ ...prev, size: Math.max(60, prev.size - 20) }));

  // ── Confirm crop — render to canvas, get data URL ────────
  const confirmCrop = () => {
    const img  = cropImgRef.current;
    const wrap = cropCanvasRef.current;
    if (!img || !wrap) return;

    const wrapW = wrap.offsetWidth;
    const wrapH = wrap.offsetHeight;

    // Scale factor: img is displayed inside wrap via object-fit:contain
    const imgNatW = img.naturalWidth;
    const imgNatH = img.naturalHeight;
    const scale   = Math.min(wrapW / imgNatW, wrapH / imgNatH);
    const rendW   = imgNatW * scale;
    const rendH   = imgNatH * scale;
    const offX    = (wrapW - rendW) / 2; // letterbox offset
    const offY    = (wrapH - rendH) / 2;

    // Map crop box (in wrap px) back to natural image coords
    const srcX = Math.max(0, (cropBox.x - offX) / scale);
    const srcY = Math.max(0, (cropBox.y - offY) / scale);
    const srcS = cropBox.size / scale;

    const canvas = document.createElement('canvas');
    canvas.width  = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, 600, 600);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCroppedSrc(dataUrl);
    setDpPos({ x: 50, y: 50, scale: 1 });
    setHintVisible(true);
    setState('positioning');
  };

  // ── Position drag ────────────────────────────────────────
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
    window.addEventListener('mouseup',  onMouseUp);
    window.addEventListener('mousemove', onCropMouseMove);
    window.addEventListener('mouseup',  onCropMouseUp);
    window.addEventListener('touchmove', onTouchMove,    { passive: true });
    window.addEventListener('touchend',  onMouseUp);
    window.addEventListener('touchmove', onCropTouchMove, { passive: true });
    window.addEventListener('touchend',  onCropMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',  onMouseUp);
      window.removeEventListener('mousemove', onCropMouseMove);
      window.removeEventListener('mouseup',  onCropMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onMouseUp);
      window.removeEventListener('touchmove', onCropTouchMove);
      window.removeEventListener('touchend',  onCropMouseUp);
    };
  }, [onMouseMove, onMouseUp, onCropMouseMove, onCropMouseUp, onTouchMove, onCropTouchMove]);

  const scaleUp   = () => setDpPos(p => ({ ...p, scale: Math.min(3,   +(p.scale + 0.1).toFixed(1)) }));
  const scaleDown = () => setDpPos(p => ({ ...p, scale: Math.max(0.2, +(p.scale - 0.1).toFixed(1)) }));
  const resetPos  = () => setDpPos({ x: 50, y: 50, scale: 1 });

  // ── Canvas export ────────────────────────────────────────
  const confirmAndGenerate = () => {
    setState('generating');
    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d')!;

    const flyerImg = new window.Image();
    flyerImg.onload = () => {
      ctx.drawImage(flyerImg, 0, 0, OUTPUT_W, OUTPUT_H);

      const dpImg = new window.Image();
      dpImg.onload = () => {
        const dpD    = (DP_SIZE_PERCENT / 100) * OUTPUT_W * dpPos.scale;
        const radius = dpD / 2;
        const cx     = (dpPos.x / 100) * OUTPUT_W;
        const cy     = (dpPos.y / 100) * OUTPUT_H;

        // Glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
        ctx.shadowColor = 'rgba(0,119,170,0.55)';
        ctx.shadowBlur  = 28;
        ctx.fillStyle   = 'rgba(0,170,221,0.25)';
        ctx.fill();
        ctx.restore();

        // Cyan ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = C.blue;
        ctx.lineWidth   = 8;
        ctx.stroke();
        ctx.restore();

        // White ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = C.white;
        ctx.lineWidth   = 5;
        ctx.stroke();
        ctx.restore();

        // Photo — cropped square so cover fills perfectly
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(dpImg, cx - radius, cy - radius, dpD, dpD);
        ctx.restore();

        // Name pill
        const name = userName.trim();
        if (name) {
          const fontSize = Math.max(24, Math.round(radius * 0.28));
          ctx.font = `700 ${fontSize}px Arial, sans-serif`;
          const textW  = ctx.measureText(name).width;
          const pillH  = fontSize + 22;
          const padX   = 24;
          const dotR   = 6;
          const pillW  = textW + padX * 2 + dotR * 2 + 12;
          const pillX  = cx - pillW / 2;
          const pillY  = cy + radius + 16;
          const pRad   = pillH / 2;

          // Background
          ctx.save();
          ctx.shadowColor = 'rgba(0,80,140,0.5)';
          ctx.shadowBlur  = 14;
          ctx.beginPath();
          ctx.moveTo(pillX + pRad, pillY);
          ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, pRad);
          ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, pRad);
          ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pRad);
          ctx.arcTo(pillX, pillY, pillX + pillW, pillY, pRad);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0,30,55,0.88)';
          ctx.fill();
          ctx.restore();

          // Border
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pillX + pRad, pillY);
          ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, pRad);
          ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, pRad);
          ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pRad);
          ctx.arcTo(pillX, pillY, pillX + pillW, pillY, pRad);
          ctx.closePath();
          ctx.strokeStyle = C.blue;
          ctx.lineWidth   = 2.5;
          ctx.stroke();
          ctx.restore();

          // Dot
          const dotCX = pillX + padX;
          const dotCY = pillY + pillH / 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(dotCX, dotCY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = C.blue;
          ctx.fill();
          ctx.restore();

          // Text
          ctx.save();
          ctx.font         = `700 ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle    = '#FFFFFF';
          ctx.textBaseline = 'middle';
          ctx.shadowColor  = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur   = 4;
          ctx.fillText(name, dotCX + dotR + 10, dotCY);
          ctx.restore();
        }

        canvas.toBlob(blob => {
          if (!blob) { setState('error'); setError('Failed to generate image'); return; }
          setResultImage(URL.createObjectURL(blob));
          setState('success');
        }, 'image/jpeg', 0.95);
      };
      dpImg.onerror = () => { setState('error'); setError('Failed to load your photo'); };
      dpImg.src = croppedSrc;
    };
    flyerImg.onerror = () => { setState('error'); setError('Failed to load flyer — make sure flyer-template.jpg is in /public'); };
    flyerImg.src = FLYER;
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
    setState('idle'); setError(''); setRawSrc(''); setCroppedSrc('');
    setResultImage(''); setDpPos({ x: 50, y: 50, scale: 1 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Styles ───────────────────────────────────────────────
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '12px 24px', fontWeight: 700, fontSize: '15px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: `0 4px 16px rgba(${C.glowRgb},0.35)`,
  };
  const btnOutline: React.CSSProperties = {
    background: 'transparent', color: C.blueDark,
    border: `2px solid ${C.blue}`, borderRadius: '10px',
    padding: '10px 20px', fontWeight: 600, fontSize: '14px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
  };
  const btnIcon: React.CSSProperties = {
    ...btnOutline, padding: '8px', borderRadius: '8px', justifyContent: 'center',
  };

  return (
    <div style={{ width: '100%', padding: '32px', boxSizing: 'border-box' }}>

      {/* ── IDLE ── */}
      {state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Waves size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: C.blueDeep }}>Generate Your DP</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#5a7f99' }}>Upload · crop · position · download</p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.blueDeep, marginBottom: '6px' }}>
              Your Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional — shown on flyer)</span>
            </label>
            <input
              type="text" value={userName} onChange={e => setUserName(e.target.value)}
              placeholder="e.g. Adeolu"
              style={{
                width: '100%', padding: '12px 14px', border: `2px solid #d0e8f5`,
                borderRadius: '10px', fontSize: '15px', outline: 'none',
                color: '#1a3a4a', background: '#f4fafd', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = C.blue; }}
              onBlur={e  => { e.target.style.borderColor = '#d0e8f5'; }}
            />
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={e => { e.preventDefault(); setIsDraggingOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{
              border: `2.5px dashed ${isDraggingOver ? C.blue : '#b8dff0'}`,
              borderRadius: '14px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
              background: isDraggingOver ? `linear-gradient(135deg,${C.blue}18,${C.blue}08)` : 'linear-gradient(135deg,#f0f9ff,#e6f4fc)',
              transition: 'all 0.2s',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
              onChange={handleFileInput} style={{ display: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: `linear-gradient(135deg,${C.blue}22,${C.blue}44)`,
                border: `2px solid ${C.blue}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload size={28} color={C.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: C.blueDeep, fontSize: '15px' }}>
                  {isDraggingOver ? 'Drop it!' : 'Click or drag your photo here'}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#6a99b0' }}>JPG, PNG, WebP · Max 10MB</p>
              </div>
            </div>
          </div>

          <div style={{
            background: '#eaf6fd', borderRadius: '10px', padding: '12px 16px',
            borderLeft: `4px solid ${C.blue}`, display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <p style={{ margin: 0, fontSize: '13px', color: '#2a6a88' }}>
              <strong>Best results:</strong> Upload a clear headshot. You will crop it to fit the frame in the next step.
            </p>
          </div>
        </div>
      )}

      {/* ── CROPPING ── */}
      {state === 'cropping' && rawSrc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: `linear-gradient(135deg,${C.blue}18,${C.blue}08)`,
            border: `1.5px solid ${C.blue}44`, borderRadius: '10px',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Crop size={18} color={C.blue} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '13px', color: C.blueDeep, fontWeight: 500 }}>
              <strong>Drag the box</strong> to select which part of your photo to use in the frame
            </p>
          </div>

          {/* Crop canvas */}
          <div
            ref={cropCanvasRef}
            style={{
              position: 'relative', width: '100%', aspectRatio: '1 / 1',
              borderRadius: '14px', overflow: 'hidden',
              border: `2px solid ${C.blue}44`,
              boxShadow: `0 8px 32px rgba(${C.glowRgb},0.2)`,
              background: '#000', userSelect: 'none',
            }}
          >
            {/* Full photo */}
            <img
              ref={cropImgRef}
              src={rawSrc}
              alt="Your photo"
              onLoad={initCropBox}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
            />

            {/* Dark overlay with hole cut out via box-shadow trick */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'rgba(0,0,0,0.52)',
              // cut the crop box out using clip-path won't work cleanly; use 4 overlay rects instead
            }} />

            {/* Clear crop box — drawn on top of overlay */}
            <div
              onMouseDown={onCropMouseDown}
              onTouchStart={onCropTouchStart}
              style={{
                position: 'absolute',
                left:   cropBox.x,
                top:    cropBox.y,
                width:  cropBox.size,
                height: cropBox.size,
                cursor: 'move',
                borderRadius: '50%',
                border: `3px solid ${C.white}`,
                outline: `4px solid ${C.blue}`,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.50), 0 0 0 7px rgba(0,170,221,0.3), 0 4px 20px rgba(${C.glowRgb},0.5)`,
                boxSizing: 'border-box',
              }}
            >
              {/* Corner guides */}
              {['topleft','topright','bottomleft','bottomright'].map(c => (
                <div key={c} style={{
                  position: 'absolute',
                  width: '14px', height: '14px',
                  borderColor: C.blue, borderStyle: 'solid',
                  borderWidth: c.includes('top') ? '3px 0 0 0' : '0 0 3px 0',
                  ...(c.includes('left')  ? { left:  0,  borderLeftWidth:  '3px', borderRightWidth:  0 } : {}),
                  ...(c.includes('right') ? { right: 0,  borderRightWidth: '3px', borderLeftWidth:   0 } : {}),
                  ...(c.includes('top')   ? { top:   0 } : { bottom: 0 }),
                }} />
              ))}

              {/* Centre crosshair */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: '20px', height: '20px', pointerEvents: 'none',
              }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: `${C.blue}88` }} />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: `${C.blue}88` }} />
              </div>
            </div>
          </div>

          {/* Crop controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button style={btnIcon} onClick={shrinkCrop} title="Smaller crop"><ZoomOut size={16} color={C.blueDark} /></button>
              <span style={{ fontSize: '12px', color: '#6a99b0', fontWeight: 500 }}>Resize</span>
              <button style={btnIcon} onClick={growCrop}   title="Larger crop"><ZoomIn  size={16} color={C.blueDark} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnOutline} onClick={reset}>Start Over</button>
              <button style={btnPrimary} onClick={confirmCrop}>
                <Crop size={16} /> Use This Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POSITIONING ── */}
      {state === 'positioning' && croppedSrc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: `linear-gradient(135deg,${C.blue}18,${C.blue}08)`,
            border: `1.5px solid ${C.blue}44`, borderRadius: '10px',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Move size={18} color={C.blue} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '13px', color: C.blueDeep, fontWeight: 500 }}>
              <strong>Drag</strong> your photo on the flyer · use <strong>+ / −</strong> to resize
            </p>
          </div>

          <div ref={containerRef} style={{
            position: 'relative', width: '100%', aspectRatio: '1 / 1',
            borderRadius: '14px', overflow: 'hidden',
            border: `2px solid ${C.blue}44`,
            boxShadow: `0 8px 32px rgba(${C.glowRgb},0.2)`,
            userSelect: 'none', cursor: 'default',
          }}>
            <img src={FLYER} alt="Flyer"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
              draggable={false}
            />

            {/* Circular DP */}
            <div onMouseDown={onMouseDown} onTouchStart={onTouchStart} style={{
              position: 'absolute',
              width:    `${DP_SIZE_PERCENT * dpPos.scale}%`,
              aspectRatio: '1 / 1',
              left:     `${dpPos.x}%`,
              top:      `${dpPos.y}%`,
              transform: 'translate(-50%,-50%)',
              cursor: 'grab', userSelect: 'none', touchAction: 'none',
              borderRadius: '50%',
              border:   `3px solid ${C.white}`,
              outline:  `4px solid ${C.blue}`,
              boxShadow: `0 0 0 7px rgba(0,170,221,0.25), 0 6px 24px rgba(${C.glowRgb},0.5)`,
              overflow: 'hidden',
            }}>
              <img src={croppedSrc} alt="Your photo" draggable={false} style={{
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
                borderRadius: '50%', display: 'block', pointerEvents: 'none',
              }} />
            </div>

            {/* Name pill */}
            {userName.trim() && (
              <div style={{
                position: 'absolute',
                left:  `${dpPos.x}%`,
                top:   `calc(${dpPos.y}% + ${(DP_SIZE_PERCENT * dpPos.scale) / 2}% + 1%)`,
                transform: 'translateX(-50%)',
                pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
              }}>
                <div style={{
                  background: 'rgba(0,30,55,0.85)', border: `1.5px solid ${C.blue}`,
                  borderRadius: '20px', padding: '3px 12px 3px 8px',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  boxShadow: `0 2px 12px rgba(${C.glowRgb},0.4)`,
                }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
                  <span style={{
                    color: '#fff',
                    fontSize: `clamp(8px, ${DP_SIZE_PERCENT * dpPos.scale * 0.38}px, 16px)`,
                    fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    {userName.trim()}
                  </span>
                </div>
              </div>
            )}

            {hintVisible && (
              <div style={{
                position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,40,60,0.72)', backdropFilter: 'blur(4px)',
                color: '#fff', fontSize: '12px', fontWeight: 500,
                padding: '6px 14px', borderRadius: '20px',
                pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
              }}>
                <Move size={12} /> Drag to reposition
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button style={btnIcon} onClick={scaleDown} title="Smaller"><ZoomOut size={16} color={C.blueDark} /></button>
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.blueDeep, minWidth: '44px', textAlign: 'center' }}>
                {Math.round(dpPos.scale * 100)}%
              </span>
              <button style={btnIcon} onClick={scaleUp}  title="Larger"><ZoomIn  size={16} color={C.blueDark} /></button>
              <button style={btnIcon} onClick={resetPos} title="Reset"><RotateCcw size={16} color={C.blueDark} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnOutline} onClick={() => setState('cropping')}>Re-crop</button>
              <button style={btnOutline} onClick={reset}>Start Over</button>
              <button style={btnPrimary} onClick={confirmAndGenerate}>
                <CheckCircle size={16} /> Confirm &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GENERATING ── */}
      {state === 'generating' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 20px',
            background: `linear-gradient(135deg,${C.blue}22,${C.blue}44)`,
            border: `2px solid ${C.blue}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader2 size={32} color={C.blue} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '17px', color: C.blueDeep }}>Generating your flyer…</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#6a99b0' }}>Just a moment</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {state === 'success' && resultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#edfaf3', border: '1.5px solid #6ee7b7',
            borderRadius: '10px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <CheckCircle size={22} color="#059669" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#065f46', fontSize: '15px' }}>Your DP is ready! 🎉</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>Download and share on WhatsApp, Instagram, or Twitter.</p>
            </div>
          </div>
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${C.blue}44`, boxShadow: `0 8px 32px rgba(${C.glowRgb},0.2)` }}>
            <img src={resultImage} alt="Final DP" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '14px 24px', fontSize: '16px' }} onClick={downloadResult}>
              <Download size={18} /> Download Flyer
            </button>
            <button style={{ ...btnOutline, padding: '14px 20px' }} onClick={reset}>Upload Another</button>
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