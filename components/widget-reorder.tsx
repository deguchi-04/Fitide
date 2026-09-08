'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Widget = { id: string; label: string; element: HTMLElement };

export function WidgetReorderButton({ page, label, order, onChange }: {
  page: string; label: string; order: string[]; onChange: (order: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const orderRef = useRef(order);
  const onChangeRef = useRef(onChange);
  const cleanupDrag = useRef<(() => void) | null>(null);
  useEffect(() => { orderRef.current = order; onChangeRef.current = onChange; }, [order, onChange]);

  const container = useCallback(() => {
    const wrapper = buttonRef.current?.closest<HTMLElement>('[data-widget-page]');
    const selector = ({ settings: '.settings-grid', progress: '.charts-grid', calendar: '.calendar-layout', workout: '.workout-day-list, .live-exercises' } as Record<string, string>)[page];
    return wrapper?.querySelector<HTMLElement>(selector ?? '.dashboard-grid, .content-page') ?? null;
  }, [page]);

  const read = useCallback((): Widget[] => {
    const root = container();
    if (!root) return [];
    const seen = new Map<string, number>();
    return Array.from(root.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .filter((node) => !node.matches('.page-intro, .settings-actions, .back-to-workout, .dialog-backdrop, dialog, [role="dialog"], [role="alertdialog"]'))
      .map((element) => {
        const heading = element.querySelector<HTMLElement>('[data-slot="card-title"], h2, h3, .eyebrow, strong');
        const label = heading?.textContent?.trim().replace(/\s+/g, ' ') || 'Widget';
        // Retain IDs from the previous version. Freeze them on the element so
        // live timers and dates cannot change identity halfway through a drag.
        const classKey = Array.from(element.classList).filter((name) => !['panel', 'wide', 'widget-editable', 'widget-drag-source'].includes(name)).slice(0, 2).join('-');
        const base = `${classKey} ${label}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-').slice(0, 72);
        const occurrence = seen.get(base) ?? 0;
        seen.set(base, occurrence + 1);
        const id = element.dataset.widgetId ?? (occurrence ? `${base}-${occurrence + 1}` : base);
        element.dataset.widgetId = id;
        return { id, label, element };
      });
  }, [container]);

  const apply = useCallback((items: Widget[], saved: string[]) => {
    const ids = [...saved, ...items.map((item) => item.id).filter((id) => !saved.includes(id))];
    items.forEach((item) => { item.element.style.order = String(ids.indexOf(item.id)); });
  }, []);

  useEffect(() => {
    const root = container();
    if (!root) return;
    const refresh = () => {
      const items = read();
      apply(items, orderRef.current);
      items.forEach((item) => item.element.classList.toggle('widget-editable', editing));
      if (editing) setWidgets(items);
    };
    root.classList.toggle('widgets-editing', editing);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      cleanupDrag.current?.();
      root.classList.remove('widgets-editing');
      read().forEach((item) => item.element.classList.remove('widget-editable', 'widget-drag-source'));
    };
  }, [editing, container, read, apply]);

  useEffect(() => { if (!cleanupDrag.current) apply(read(), order); }, [order, read, apply]);
  useEffect(() => {
    if (!editing) return;
    const close = (event: Event) => { event.preventDefault(); setEditing(false); };
    window.addEventListener('fitide-back', close);
    return () => window.removeEventListener('fitide-back', close);
  }, [editing]);

  function ordered() {
    return read().sort((a, b) => Number(a.element.style.order) - Number(b.element.style.order));
  }
  function save(items: Widget[]) {
    const ids = items.map((item) => item.id);
    orderRef.current = ids;
    apply(items, ids);
    onChangeRef.current(ids);
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, widget: Widget) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    cleanupDrag.current?.();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    handle.setPointerCapture(pointerId);
    let x = event.clientX;
    let y = event.clientY;
    let ghost: HTMLElement | null = null;
    let frame = 0;
    let lastTarget = '';
    const initial = ordered();
    let current = initial;
    const tick = () => {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${x + 12}px,${y - 24}px,0)`;
      const edge = y < 130 ? -12 : y > window.innerHeight - 140 ? 12 : 0;
      if (edge) window.scrollBy(0, edge);
      // Hit-testing actual card bounds works in both single-column and desktop grids.
      const target = current.find((item) => {
        if (item.id === widget.id) return false;
        const rect = item.element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top + 8 && y <= rect.bottom - 8;
      });
      if (target && target.id !== lastTarget) {
        const from = current.findIndex((item) => item.id === widget.id);
        const to = current.findIndex((item) => item.id === target.id);
        current = [...current];
        current.splice(from, 1);
        current.splice(to, 0, widget);
        apply(current, current.map((item) => item.id));
        lastTarget = target.id;
      } else if (!target) lastTarget = '';
      frame = requestAnimationFrame(tick);
    };
    const hold = window.setTimeout(() => {
      ghost = document.createElement('div');
      ghost.className = 'widget-drag-preview';
      ghost.textContent = widget.label;
      document.body.appendChild(ghost);
      widget.element.classList.add('widget-drag-source');
      setAnnouncement(`A mover ${widget.label}`);
      frame = requestAnimationFrame(tick);
    }, 180);
    const move = (e: PointerEvent) => { if (e.pointerId === pointerId) { x = e.clientX; y = e.clientY; e.preventDefault(); } };
    const finish = (e?: PointerEvent) => {
      if (e && e.pointerId !== pointerId) return;
      window.clearTimeout(hold);
      cancelAnimationFrame(frame);
      ghost?.remove();
      widget.element.classList.remove('widget-drag-source');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      cleanupDrag.current = null;
      if (e?.type === 'pointerup' && ghost) {
        save(current);
        setAnnouncement(`${widget.label} na posição ${current.findIndex((item) => item.id === widget.id) + 1}`);
      } else apply(initial, initial.map((item) => item.id));
    };
    const cancel = (e: PointerEvent) => finish(e);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    cleanupDrag.current = () => finish();
  }

  return <>
    <div className={`widget-reorder-footer ${editing ? 'is-editing' : ''}`}>
      {editing && <span>Mantém premido o puxador de um card e arrasta.</span>}
      <Button ref={buttonRef} type="button" variant={editing ? 'default' : 'outline'} onClick={() => setEditing(!editing)}>
        {editing ? <Check /> : <GripVertical />}{editing ? 'Concluir' : 'Reordenar widgets'}
      </Button>
      {editing && <Button type="button" variant="ghost" onClick={() => { cleanupDrag.current?.(); onChange([]); orderRef.current = []; apply(read(), []); }}><RotateCcw /> Repor ordem</Button>}
      <output className="sr-only" aria-live="polite">{announcement || `Personalizar ${label}`}</output>
    </div>
    {editing && widgets.map((widget) => createPortal(
      <button type="button" className="widget-drag-handle" aria-label={`Mover ${widget.label}`} title="Mantém premido e arrasta; ou usa as setas do teclado" onPointerDown={(event) => startDrag(event, widget)} onKeyDown={(event) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const items = ordered();
        const from = items.findIndex((item) => item.id === widget.id);
        const to = from + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1);
        if (to < 0 || to >= items.length) return;
        [items[from], items[to]] = [items[to], items[from]];
        save(items);
        setAnnouncement(`${widget.label} na posição ${to + 1}`);
      }}><GripVertical /><span>Mover</span></button>, widget.element, widget.id,
    ))}
  </>;
}
