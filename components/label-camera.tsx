'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type CameraCapabilities = MediaTrackCapabilities & { focusMode?: string[]; focusDistance?: { min: number; max: number; step: number }; zoom?: { min: number; max: number; step: number } };

export function LabelCamera({ onPhoto, onClose }: { onPhoto: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({});
  const [focusMessage, setFocusMessage] = useState('');
  const [focusBusy, setFocusBusy] = useState(false);
  const [focusDistance, setFocusDistance] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  async function focusAt(x = .5, y = .5) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || focusBusy) return;
    const modes = (track.getCapabilities() as CameraCapabilities).focusMode ?? [];
    const focusMode = modes.includes('single-shot') ? 'single-shot' : modes.includes('continuous') ? 'continuous' : null;
    if (!focusMode) { setFocusMessage('O dispositivo não disponibiliza autofocus aqui. Afasta um pouco o rótulo ou usa a galeria.'); return; }
    setFocusBusy(true);
    try {
      await track.applyConstraints({ advanced: [{ focusMode, pointsOfInterest: [{ x, y }] } as MediaTrackConstraintSet] });
      setFocusMessage('Foco solicitado. Espera até o texto ficar nítido antes de fotografar.');
    } catch { setFocusMessage('Não foi possível ajustar o foco. Experimenta afastar o rótulo.'); }
    finally { setFocusBusy(false); }
  }
  async function adjustCamera(key: 'zoom' | 'focusDistance', value: number) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ [key]: value, ...(key === 'focusDistance' ? {focusMode:'manual'} : {}) } as MediaTrackConstraintSet] });
      if (key === 'zoom') setZoom(value); else setFocusDistance(value);
    } catch { setFocusMessage('Este ajuste não está disponível na câmara atual.'); }
  }
  useEffect(() => {
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onClose(); };
    window.addEventListener('fitide-back', back, true);
    return () => window.removeEventListener('fitide-back', back, true);
  }, [onClose]);
  useEffect(() => {
    let disposed = false;
    setReady(false);
    setError('');
    setFocusMessage('');
    navigator.mediaDevices?.getUserMedia({ audio: false, video: { ...(cameraId ? {deviceId:{exact:cameraId}} : {facingMode:{ideal:'environment'}}), width: { ideal: 1920, max: 1920 }, height: { ideal: 1440, max: 1920 } } })
      .then(async media => {
        if (disposed) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        void navigator.mediaDevices.enumerateDevices().then(devices => { if (!disposed) setCameras(devices.filter(device => device.kind === 'videoinput')); }).catch(() => undefined);
        const track = media.getVideoTracks()[0];
        const caps = track.getCapabilities() as CameraCapabilities;
        setCapabilities(caps);
        const settings = track.getSettings() as MediaTrackSettings & { focusDistance?: number; zoom?: number };
        setZoom(settings.zoom ?? caps.zoom?.min ?? 1);
        setFocusDistance(settings.focusDistance ?? caps.focusDistance?.min ?? 0);
        if (caps.focusMode?.includes('continuous')) {
          try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }); } catch { /* Capture remains available. */ }
        }
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
      }).catch(() => { if (!disposed) setError('Não foi possível abrir a câmara. Autoriza a câmara nas definições da Fitide ou escolhe uma imagem da galeria.'); });
    if (!navigator.mediaDevices?.getUserMedia) setError('Esta instalação não permite a câmara integrada. Atualiza o APK ou usa a galeria.');
    return () => { disposed = true; stream.current?.getTracks().forEach(track => track.stop()); };
  }, [cameraId]);
  async function capture() {
    const source = video.current;
    if (!source?.videoWidth || busy) return;
    setBusy(true);
    try {
      const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(source.videoWidth * scale);
      canvas.height = Math.round(source.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
      canvas.width = canvas.height = 1;
      if (!blob) throw new Error('capture');
      stream.current?.getTracks().forEach(track => track.stop());
      onPhoto(new File([blob], 'rotulo.jpg', { type: 'image/jpeg' }));
    } catch { setError('Não consegui capturar a imagem. Tenta novamente.'); setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent style={{ zIndex: 10001, maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto' }}>
      <DialogTitle>Fotografar rótulo</DialogTitle>
      <DialogDescription>Inclui o cabeçalho por 100 g. Mantém alguma distância e toca no texto para focar.</DialogDescription>
      {cameras.length > 1 && <label>Câmara<select aria-label="Escolher câmara" value={cameraId} onChange={event => setCameraId(event.target.value)}><option value="">Traseira automática</option>{cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Câmara ${index + 1}`}</option>)}</select></label>}
      <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} onClick={event => { const box = event.currentTarget.getBoundingClientRect(); void focusAt((event.clientX-box.left)/box.width, (event.clientY-box.top)/box.height); }} style={{ width: '100%', maxHeight: '48dvh', objectFit: 'contain', background: '#111' }} />
      <Button variant="outline" disabled={!ready || focusBusy || busy} onClick={() => void focusAt()}>Voltar a focar</Button>
      {capabilities.focusDistance && capabilities.focusMode?.includes('manual') && <label>Foco manual<input aria-label="Foco manual" type="range" min={capabilities.focusDistance.min} max={capabilities.focusDistance.max} step={capabilities.focusDistance.step || .1} value={focusDistance} onChange={event => void adjustCamera('focusDistance', Number(event.target.value))} /></label>}
      {capabilities.zoom && <label>Zoom<input aria-label="Zoom da câmara" type="range" min={capabilities.zoom.min} max={Math.min(capabilities.zoom.max, 4)} step={capabilities.zoom.step || .1} value={zoom} onChange={event => void adjustCamera('zoom', Number(event.target.value))} /></label>}
      {focusMessage && <p role="status">{focusMessage}</p>}
      {error && <p role="alert">{error}</p>}
      <Button disabled={!ready || busy} onClick={() => void capture()}>{busy ? 'A preparar…' : 'Tirar fotografia'}</Button>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
    </DialogContent>
  </Dialog>;
}
