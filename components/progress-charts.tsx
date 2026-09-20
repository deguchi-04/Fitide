'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Maximize2, X } from '@/components/material-icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AppState } from '@/lib/fit-types';
import { nutritionDays, weightHistory, measurementDomain, shiftDate, weekStart, type NutritionWindow } from '@/lib/progress-data';

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
function ChartPanel({ title, id, children }: { title: string; id: string; children: (expanded: boolean) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const back = (event: Event) => { event.preventDefault(); setExpanded(false); };
    window.addEventListener('fitide-back', back);
    return () => window.removeEventListener('fitide-back', back);
  }, [expanded]);
  return <Card className="panel chart-card wide" data-widget-id={id}>
    <CardHeader className="chart-panel-header"><CardTitle>{title}</CardTitle><Button variant="ghost" size="icon" aria-label={`Expandir ${title}`} onClick={() => setExpanded(true)}><Maximize2 /></Button></CardHeader>
    <CardContent>{children(false)}</CardContent>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogPortal><DialogOverlay /><DialogPrimitive.Popup className="progress-chart-modal">
      <header className="chart-panel-header"><DialogTitle>{title}</DialogTitle><Button variant="ghost" size="icon" aria-label="Fechar gráfico" onClick={() => setExpanded(false)}><X /></Button></header>
      <DialogDescription className="sr-only">Gráfico ampliado com os mesmos dados e controlos.</DialogDescription>
      {expanded && children(true)}
    </DialogPrimitive.Popup></DialogPortal></Dialog>
  </Card>;
}

export function ProgressCharts({ state, today }: { state: AppState; today: string }) {
  const lastNutrition = [...state.meals, ...state.water].map(item => item.date).filter(date => date <= today).sort().at(-1) ?? today;
  const [endWeek, setEndWeek] = useState(weekStart(lastNutrition));
  const [window, setWindow] = useState<NutritionWindow>('week');
  const [waterWeek, setWaterWeek] = useState(weekStart(lastNutrition));
  const [waterWindow, setWaterWindow] = useState<NutritionWindow>('week');
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const weight = weightHistory(state.weights, today);
  const weightDomain = measurementDomain(weight.map(item => item.weightKg));
  const fatDomain = measurementDomain(weight.flatMap(item => item.bodyFatPercent == null ? [] : [item.bodyFatPercent]));
  const macros = nutritionDays(state, endWeek, window);
  const water = nutritionDays(state, waterWeek, waterWindow);
  const macroConfig = { protein: { label: 'Proteína (g)', color: 'var(--macro-protein)' }, carbs: { label: 'Hidratos (g)', color: 'var(--macro-carbs)' }, fat: { label: 'Gordura (g)', color: 'var(--macro-fat)' } };
  const goals = { protein: state.goals.proteinG, carbs: state.goals.carbsG, fat: state.goals.fatG };
  const rangeControls = (anchor: string, setAnchor: (date: string) => void, range: NutritionWindow, setRange: (range: NutritionWindow) => void, latest = lastNutrition) => <div className="nutrition-period-controls">
    <div className="segmented">{(['week', 'month'] as const).map((key, index) => <button type="button" key={key} aria-pressed={range === key} className={range === key ? 'selected' : ''} onClick={() => setRange(key)}>{['Semana', '4 semanas'][index]}</button>)}</div>
    <div className="chart-period-navigation"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setAnchor(shiftDate(anchor, -7))}><ChevronLeft /></Button><span aria-live="polite">{shortDate(shiftDate(anchor, range === 'week' ? 0 : range === 'month' ? -21 : -357))} — {shortDate(shiftDate(anchor, 6))}<small>{range === 'week' ? '1 semana' : range === 'month' ? '4 semanas' : '52 semanas'} · {anchor.slice(0, 4)}</small></span><Button variant="outline" size="icon" aria-label="Semana seguinte" onClick={() => setAnchor(shiftDate(anchor, 7))}><ChevronRight /></Button></div>
    <Button variant="ghost" onClick={() => setAnchor(weekStart(latest))}>Últimos registos</Button>
  </div>;
  const gesture = (anchor: string, change: (value: string) => void) => ({
    onTouchStart: (event: React.TouchEvent) => { event.stopPropagation(); if (event.touches.length === 1) swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; },
    onTouchMove: (event: React.TouchEvent) => {
      event.stopPropagation();
      const start = swipe.current;
      if (!start || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - start.x, dy = event.touches[0].clientY - start.y;
      if (Math.abs(dx) <= Math.abs(dy) * 1.4) return;
      const chart = event.currentTarget.querySelector<HTMLElement>('[data-slot="chart"]');
      if (chart) chart.style.transform = `translateX(${Math.max(-65, Math.min(65, dx * .35))}px)`;
    },
    onTouchCancel: (event: React.TouchEvent) => { swipe.current = null; const chart = event.currentTarget.querySelector<HTMLElement>('[data-slot="chart"]'); if (chart) chart.style.transform = ''; },
    onTouchEnd: (event: React.TouchEvent) => { event.stopPropagation(); const start = swipe.current; swipe.current = null; if (!start || !event.changedTouches.length) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; const chart = event.currentTarget.querySelector<HTMLElement>('[data-slot="chart"]'); if (chart) chart.style.transform = '';
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        change(shiftDate(anchor, dx < 0 ? 7 : -7));
        if (chart && !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) chart.animate([{ transform: `translateX(${dx < 0 ? 36 : -36}px)`, opacity: .65 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } },
  });
  const height = (full: boolean) => ({ height: full ? 'max(280px, calc(100dvh - 280px))' : '280px', width: '100%' });
  return <>
    <ChartPanel title="Peso e gordura corporal" id="progress-weight-chart-v2">{full => <div className="weight-history-chart" onTouchStart={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
      <p className="chart-data-note">{weight.length ? `Desde a primeira medição: ${shortDate(weight[0].date)} ${weight[0].date.slice(0, 4)}` : 'Regista o teu peso para acompanhar a evolução.'}</p>
      <p className="chart-data-note">{weight.length} registos · Meta: {state.profile.targetWeightKg} kg · escala automática</p>
      {<ChartContainer style={height(full)} config={{ weightKg: { label: 'Peso (kg)', color: '#168fbd' }, bodyFatPercent: { label: 'Gordura (%)', color: '#ef6f4c' } }}><AreaChart data={weight} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tickLine={false} padding={{ left: 12, right: 12 }} interval="preserveStartEnd"/>
        <YAxis yAxisId="weight" width={45} domain={weightDomain} allowDataOverflow/><YAxis yAxisId="fat" orientation="right" width={40} unit="%" hide={!weight.some(item => item.bodyFatPercent != null)} domain={fatDomain} allowDataOverflow/>
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))} />}/><ReferenceLine yAxisId="weight" y={state.profile.targetWeightKg} stroke="#e5483f" strokeOpacity={.4} strokeDasharray="7 6"/>
        <Area yAxisId="weight" dataKey="weightKg" stroke="var(--color-weightKg)" fill="var(--color-weightKg)" fillOpacity={.08} strokeWidth={2} dot={{ r: 4 }} connectNulls isAnimationActive={false}/><Area yAxisId="fat" dataKey="bodyFatPercent" stroke="var(--color-bodyFatPercent)" fill="transparent" dot={{ r: 3 }} connectNulls isAnimationActive={false}/>
      </AreaChart></ChartContainer>}
    </div>}</ChartPanel>
    <ChartPanel title="Macronutrientes por dia" id="progress-macros-v2">{full => <div className="nutrition-chart-swipe" {...gesture(endWeek, setEndWeek)}>
      {rangeControls(endWeek, setEndWeek, window, setWindow)}
      <div className="daily-goal-legend">{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <span key={key}><i style={{ background: macroConfig[key].color }}/>{macroConfig[key].label}: meta {goals[key]} g/dia</span>)}</div>
      <ChartContainer style={height(full)} config={macroConfig}>{window === 'week' ? <BarChart data={macros}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate}/><YAxis width={40} domain={[0, 500]} ticks={[0, 100, 200, 300, 400, 500]} allowDataOverflow/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/>{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <ReferenceLine key={key} y={goals[key]} stroke="#e5483f" strokeOpacity={.3} strokeDasharray="7 6"/>)}{Object.keys(goals).map(key => <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} isAnimationActive={false}/>)}</BarChart> : <LineChart data={macros}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40}/><YAxis width={40} domain={[0, 500]} ticks={[0, 100, 200, 300, 400, 500]} allowDataOverflow/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/>{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <ReferenceLine key={key} y={goals[key]} stroke="#e5483f" strokeOpacity={.3} strokeDasharray="7 6"/>)}{Object.keys(goals).map(key => <Line key={key} dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/>)}</LineChart>}</ChartContainer>
      <p className="chart-data-note">Desliza para mudar de semana. Dias sem registos ficam em branco; os valores nunca são acumulados.</p>
    </div>}</ChartPanel>
    <ChartPanel title="Água por dia" id="progress-water-v2">{full => <div className="nutrition-chart-swipe" {...gesture(waterWeek, setWaterWeek)}>
      {rangeControls(waterWeek, setWaterWeek, waterWindow, setWaterWindow)}<p className="chart-data-note">Meta diária: {state.goals.waterLiters} L</p>
      <ChartContainer style={height(full)} config={{ water: { label: 'Água (L)', color: 'var(--macro-fiber)' } }}><BarChart data={water}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={30}/><YAxis width={40} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} allowDataOverflow/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/><ReferenceLine y={state.goals.waterLiters} stroke="#e5483f" strokeOpacity={.35} strokeDasharray="7 6"/><Bar dataKey="water" fill="var(--color-water)" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ChartContainer>
    </div>}</ChartPanel>
  </>;
}
