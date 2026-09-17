'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Widget = { id: string; label: string; element: HTMLElement };

export function WidgetReorderButton({ page, label, order, onChange }: {
  page: string; label: string; order: string[]; onChange: (order: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const orderRef = useRef(order);
  const onChangeRef = useRef(onChange);
  const cleanupDrag = useRef<(() => void) | null>(null);
  useEffect(() => { orderRef.current = order; onChangeRef.current = onChange; }, [order, onChange]);

  const container = useCallback(() => {
    const wrapper = buttonRef.current?.closest<HTMLElement>('[data-widget-page]');
    const selector = ({ settings: '.settings-grid', progress: '.progress-widgets', calendar: '.calendar-layout', workout: '.workout-day-list, .live-exercises' } as Record<string, string>)[page];
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

  const apply = useCallback((items: Widget[], saved: string[], animate = false) => {
    const before = new Map(items.map(item => [item.id, item.element.getBoundingClientRect()]));
    const ids = [...saved, ...items.map((item) => item.id).filter((id) => !saved.includes(id))];
    items.forEach((item) => { item.element.style.order = String(ids.indexOf(item.id)); });
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) items.forEach(item => { const old = before.get(item.id)!; const next = item.element.getBoundingClientRect(); if (old.x !== next.x || old.y !== next.y) item.element.animate([{ transform: `translate(${old.x-next.x}px,${old.y-next.y}px)` }, { transform: 'translate(0,0)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
  }, []);

  useEffect(() => {
    const root = container();
    if (!root) return;
    const bindings = new Map<HTMLElement, { down: (event: PointerEvent) => void; key: (event: KeyboardEvent) => void; tab: string | null }>();
    const preventClick = (event: Event) => { if (editing) { event.preventDefault(); event.stopPropagation(); } };
    root.addEventListener('click', preventClick, true);
    root.addEventListener('contextmenu', preventClick);
    const refresh = () => {
      const items = read();
      apply(items, orderRef.current);
      items.forEach((item) => item.element.classList.toggle('widget-editable', editing));
      if (editing) items.forEach(widget => {
        if (bindings.has(widget.element)) return;
        const down = (event: PointerEvent) => startDrag(event, widget);
        const key = (event: KeyboardEvent) => {
          if (event.target !== widget.element || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
          event.preventDefault(); const items = ordered(); const from = items.findIndex(item => item.id === widget.id);
          const to = from + (['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1);
          if (to < 0 || to >= items.length) return;
          [items[from],items[to]] = [items[to],items[from]]; save(items);
          setAnnouncement(`${widget.label} na posição ${to + 1}`);
        };
        bindings.set(widget.element, { down, key, tab: widget.element.getAttribute('tabindex') });
        widget.element.tabIndex = 0;
        widget.element.addEventListener('pointerdown', down, true);
        widget.element.addEventListener('keydown', key);
      });
    };
    root.classList.toggle('widgets-editing', editing);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      root.removeEventListener('click', preventClick, true); root.removeEventListener('contextmenu', preventClick);
      bindings.forEach(({down,key,tab},element) => { element.removeEventListener('pointerdown', down, true); element.removeEventListener('keydown', key); if(tab === null) element.removeAttribute('tabindex'); else element.setAttribute('tabindex',tab); });
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

  function startDrag(event: PointerEvent, widget: Widget) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    cleanupDrag.current?.();
    const handle = widget.element;
    const pointerId = event.pointerId;
    handle.setPointerCapture(pointerId);
    let x = event.clientX;
    let y = event.clientY;
    let ghost: HTMLElement | null = null;
    let frame = 0;
    let lastTarget = ''; let lastMove = 0;
    const origin = { x, y }; let previousY = y, offsetX = 0, offsetY = 0;
    let finished = false;
    let scroller: HTMLElement | null = handle.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    const scroll = (amount: number) => scroller ? scroller.scrollBy(0, amount) : window.scrollBy(0, amount);
    const initial = ordered();
    let current = initial;
    const tick = () => {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${x - offsetX}px,${y - offsetY}px,0) scale(1.015)`;
      const edge = y < 130 ? -12 : y > window.innerHeight - 140 ? 12 : 0;
      if (edge) scroll(edge);
      // Hit-testing actual card bounds works in both single-column and desktop grids.
      const target = current.find((item) => {
        if (item.id === widget.id) return false;
        const rect = item.element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top + 8 && y <= rect.bottom - 8;
      });
      if (target && target.id !== lastTarget && performance.now() - lastMove > 240) {
        lastMove = performance.now();
        const from = current.findIndex((item) => item.id === widget.id);
        const to = current.findIndex((item) => item.id === target.id);
        current = [...current];
        current.splice(from, 1);
        current.splice(to, 0, widget);
        apply(current, current.map((item) => item.id), true);
        lastTarget = target.id;
      } else if (!target) lastTarget = '';
      frame = requestAnimationFrame(tick);
    };
    const hold = window.setTimeout(() => {
      const rect = handle.getBoundingClientRect(); offsetX = origin.x - rect.left; offsetY = origin.y - rect.top;
      ghost = handle.cloneNode(true) as HTMLElement;
      ghost.classList.remove('widget-editable', 'widget-drag-source'); ghost.classList.add('widget-drag-preview');
      ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      ghost.setAttribute('aria-hidden','true'); ghost.inert = true;
      const appearance = getComputedStyle(handle);
      Object.assign(ghost.style, { padding: appearance.padding, display: appearance.display, gap: appearance.gap, gridTemplateColumns: appearance.gridTemplateColumns, fontSize: appearance.fontSize, fontWeight: appearance.fontWeight, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', order: '', transformOrigin: `${offsetX}px ${offsetY}px` });
      navigator.vibrate?.(15);
      document.body.appendChild(ghost);
      widget.element.classList.add('widget-drag-source');
      setAnnouncement(`A mover ${widget.label}`);
      frame = requestAnimationFrame(tick);
    }, 350);
    const move = (e: PointerEvent) => { if (e.pointerId === pointerId) { x = e.clientX; y = e.clientY; e.preventDefault(); if (!ghost && Math.hypot(x-origin.x,y-origin.y)>10) { window.clearTimeout(hold); scroll(previousY-y); } previousY=y; } };
    const finish = (e?: PointerEvent) => {
      if (finished || (e && e.pointerId !== pointerId)) return;
      finished = true;
      window.clearTimeout(hold);
      cancelAnimationFrame(frame);
      const preview = ghost;
      if (!preview) widget.element.classList.remove('widget-drag-source');
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
      if (preview) { const rect = handle.getBoundingClientRect(); if (e?.type === 'pointerup' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { preview.animate([{ transform: preview.style.transform }, { transform: `translate3d(${rect.left}px,${rect.top}px,0) scale(1)` }], { duration: 180, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => undefined).finally(() => { preview.remove(); handle.classList.remove('widget-drag-source'); }); } else { preview.remove(); handle.classList.remove('widget-drag-source'); } }
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
      {editing && <span>Mantém premido qualquer widget e arrasta. No teclado, usa as setas.</span>}
      <Button ref={buttonRef} type="button" variant={editing ? 'default' : 'outline'} onClick={() => setEditing(!editing)}>
        {editing ? <Check /> : <GripVertical />}{editing ? 'Concluir' : 'Reordenar widgets'}
      </Button>
      {editing && <Button type="button" variant="ghost" onClick={() => { cleanupDrag.current?.(); onChange([]); orderRef.current = []; apply(read(), []); }}><RotateCcw /> Repor ordem</Button>}
      <output className="sr-only" aria-live="polite">{announcement || `Personalizar ${label}`}</output>
    </div>

  </>;
}
