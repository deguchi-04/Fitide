'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LabelCamera } from '@/components/label-camera';

export function FoodPhotoTools({ mode, onText, onProduct, onLabelPhoto }: { mode: 'label' | 'food' | 'barcode'; onText: (text: string, mode: 'label' | 'food') => void; onProduct: (name: string, values: Record<string, number>) => void; onLabelPhoto: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  async function lookup(value: string) {
    setBusy(true); setMessage('A procurar produto…');
    try { const response = await fetch(`/api/barcode?code=${encodeURIComponent(value)}`); const data = await response.json() as { error?: string; name: string; values: Record<string, number> }; if (!response.ok) throw new Error(data.error); onProduct(data.name, data.values); setMessage('Open Food Facts · confirma os valores por 100 g. Campos em falta ficam vazios.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não encontrado.'); } finally { setBusy(false); }
  }
  async function photo(file: File) {
    if (mode === 'label') { setCamera(false); onLabelPhoto(file); if (input.current) input.current.value = ''; return; }
    setCamera(false); setBusy(true); setMessage('A analisar…');
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file, { resizeWidth: 1400 });
      if (mode === 'barcode') {
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (image: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (!Detector) throw new Error('Leitura de códigos indisponível neste dispositivo. Escreve os números abaixo.');
        const results = await new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(bitmap);
        if (!results.length) throw new Error('Código não detetado. Fotografa mais perto ou escreve os números.');
        setCode(results[0].rawValue); await lookup(results[0].rawValue); return;
      }
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const image = canvas.toDataURL('image/jpeg', .8).split(',')[1]; canvas.width = canvas.height = 1;
      const response = await fetch('/api/food-vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mode }), signal: AbortSignal.timeout(35000) });
      const data = await response.json() as { error?: string; text: string }; if (!response.ok) throw new Error(data.error);
      onText(data.text, mode); setMessage(mode === 'food' ? 'Porções estimadas. Revê os alimentos e pesos no assistente antes de adicionar.' : 'Confirma os valores preenchidos antes de adicionar.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na leitura.'); } finally { bitmap?.close(); setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <section className="food-photo-tools" aria-label={mode === 'barcode' ? 'Ler código de barras' : mode === 'label' ? 'Ler tabela nutricional' : 'Fotografar prato'}>
    <p>{mode === 'barcode' ? 'Fotografa o código de barras para procurar o produto. Também podes usar uma foto da galeria.' : mode === 'label' ? 'Fotografa a tabela nutricional ou escolhe uma foto. Revê os valores reconhecidos pelo Gemini.' : 'A análise com Gemini envia a foto à Google. Revê os alimentos e as porções estimadas.'}</p>
    <div className="photo-action-grid"><Button type="button" disabled={busy} onClick={() => setCamera(true)}>📷 Fotografar</Button><Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>🖼️ Galeria</Button></div>
    <input ref={input} type="file" accept="image/*" hidden onChange={event => { if (event.target.files?.[0]) void photo(event.target.files[0]); }} />
    {mode === 'barcode' && <label>Código do produto<input inputMode="numeric" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /><Button type="button" disabled={busy || !/^\d{8,14}$/.test(code)} onClick={() => void lookup(code)}>Procurar</Button></label>}
    {message && <p role="status">{message}</p>}{camera && <LabelCamera onClose={() => setCamera(false)} onPhoto={file => void photo(file)} />}
  </section>;
}
