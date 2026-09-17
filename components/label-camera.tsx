'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';

type CameraCapabilities = MediaTrackCapabilities & { focusMode?: string[]; focusDistance?: { min: number; max: number; step: number }; zoom?: { min: number; max: number; step: number } };

export function LabelCamera({ onPhoto, onClose, title = "Fotografar rótulo" }: { title?: string; onPhoto: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  useEffect(() => {
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onClose(); };
    window.addEventListener('fitide-back', back, true);
    return () => window.removeEventListener('fitide-back', back, true);
  }, [onClose]);
  useEffect(() => {
    let disposed = false;
    setReady(false);
    setError('');
    navigator.mediaDevices?.getUserMedia({ audio: false, video: { ...(cameraId ? {deviceId:{exact:cameraId}} : {facingMode:{ideal:'environment'}}), width: { ideal: 1920, max: 1920 }, height: { ideal: 1440, max: 1920 } } })
      .then(async media => {
        if (disposed) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        void navigator.mediaDevices.enumerateDevices().then(devices => { if (!disposed) setCameras(devices.filter(device => device.kind === 'videoinput')); }).catch(() => undefined);
        const track = media.getVideoTracks()[0];
        const caps = track.getCapabilities() as CameraCapabilities;
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
    <DialogPortal><DialogOverlay className="camera-scrim" /><DialogPrimitive.Popup className="camera-dialog">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>Foco automático. Mantém alguma distância e espera até o texto ficar nítido.</DialogDescription>
      {cameras.length > 1 && <label>Câmara<select aria-label="Escolher câmara" value={cameraId} onChange={event => setCameraId(event.target.value)}><option value="">Traseira automática</option>{cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Câmara ${index + 1}`}</option>)}</select></label>}
      <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} style={{ width: '100%', maxHeight: '48dvh', objectFit: 'contain', background: '#111' }} />
      {error && <p role="alert">{error}</p>}
      <Button disabled={!ready || busy} onClick={() => void capture()}>{busy ? 'A preparar…' : 'Tirar fotografia'}</Button>
      <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
    </DialogPrimitive.Popup></DialogPortal>
  </Dialog>;
}
