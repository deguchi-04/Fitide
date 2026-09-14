'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function LabelCamera({ onPhoto, onClose }: { onPhoto: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onClose(); };
    window.addEventListener('fitide-back', back, true);
    return () => window.removeEventListener('fitide-back', back, true);
  }, [onClose]);
  useEffect(() => {
    let disposed = false;
    navigator.mediaDevices?.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600, max: 1920 }, height: { ideal: 1200, max: 1920 } } })
      .then(async media => {
        if (disposed) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
      }).catch(() => { if (!disposed) setError('Não foi possível abrir a câmara. Autoriza a câmara nas definições da Fitide ou escolhe uma imagem da galeria.'); });
    if (!navigator.mediaDevices?.getUserMedia) setError('Esta instalação não permite a câmara integrada. Atualiza o APK ou usa a galeria.');
    return () => { disposed = true; stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
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
    <DialogContent style={{ zIndex: 10001, maxWidth: 560 }}>
      <DialogTitle>Fotografar rótulo</DialogTitle>
      <DialogDescription>Aproxima a tabela e inclui o cabeçalho por 100 g/ml.</DialogDescription>
      <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} style={{ width: '100%', maxHeight: '60dvh', objectFit: 'contain', background: '#111' }} />
      {error && <p role="alert">{error}</p>}
      <Button disabled={!ready || busy} onClick={() => void capture()}>{busy ? 'A preparar…' : 'Tirar fotografia'}</Button>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
    </DialogContent>
  </Dialog>;
}
