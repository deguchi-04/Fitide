'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AppState } from '@/lib/fit-types';
import { nutritionDays, shiftDate, weekStart, type NutritionWindow } from '@/lib/progress-data';

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
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="progress-fullscreen" showCloseButton={false}>
      <header className="chart-panel-header"><DialogTitle>{title}</DialogTitle><Button variant="ghost" size="icon" aria-label="Fechar gráfico" onClick={() => setExpanded(false)}><X /></Button></header>
      <DialogDescription className="sr-only">Gráfico ampliado com os mesmos dados e controlos.</DialogDescription>
      {expanded && children(true)}
    </DialogContent></Dialog>
  </Card>;
}

export function ProgressCharts({ state, today }: { state: AppState; today: string }) {
  const years = [...new Set([Number(today.slice(0, 4)), ...state.weights.map(item => Number(item.date.slice(0, 4)))])].sort((a, b) => b - a);
  const [year, setYear] = useState(Number(state.weights.map(item => item.date).sort().at(-1)?.slice(0, 4) ?? today.slice(0, 4)));
  const lastNutrition = [...state.meals, ...state.water].map(item => item.date).filter(date => date <= today).sort().at(-1) ?? today;
  const [endWeek, setEndWeek] = useState(weekStart(lastNutrition));
  const [window, setWindow] = useState<NutritionWindow>('week');
  const [waterWeek, setWaterWeek] = useState(weekStart(lastNutrition));
  const [waterWindow, setWaterWindow] = useState<NutritionWindow>('week');
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const weight = state.weights.filter(item => item.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date)).map(item => ({ ...item, time: new Date(`${item.date}T12:00:00`).getTime() }));
  const macros = nutritionDays(state, endWeek, window);
  const water = nutritionDays(state, waterWeek, waterWindow);
  const macroConfig = { protein: { label: 'Proteína (g)', color: '#168fbd' }, carbs: { label: 'Hidratos (g)', color: '#ef6f4c' }, fat: { label: 'Gordura (g)', color: '#13805f' } };
  const goals = { protein: state.goals.proteinG, carbs: state.goals.carbsG, fat: state.goals.fatG };
  const rangeControls = (anchor: string, setAnchor: (date: string) => void, range: NutritionWindow, setRange: (range: NutritionWindow) => void) => <div className="nutrition-period-controls">
    <div className="segmented">{(['week', 'month', 'year'] as const).map((key, index) => <button type="button" key={key} aria-pressed={range === key} className={range === key ? 'selected' : ''} onClick={() => setRange(key)}>{['Semana', 'Mês', 'Ano'][index]}</button>)}</div>
    <div className="chart-period-navigation"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setAnchor(shiftDate(anchor, -7))}><ChevronLeft /></Button><span aria-live="polite">{shortDate(shiftDate(anchor, range === 'week' ? 0 : range === 'month' ? -21 : -357))} — {shortDate(shiftDate(anchor, 6))}<small>{range === 'week' ? '1 semana' : range === 'month' ? '4 semanas' : '52 semanas'} · {anchor.slice(0, 4)}</small></span><Button variant="outline" size="icon" aria-label="Semana seguinte" onClick={() => setAnchor(shiftDate(anchor, 7))}><ChevronRight /></Button></div>
    <Button variant="ghost" onClick={() => setAnchor(weekStart(lastNutrition))}>Últimos registos</Button>
  </div>;
  const gesture = (anchor: string, change: (value: string) => void) => ({
    onTouchStart: (event: React.TouchEvent) => { event.stopPropagation(); if (event.touches.length === 1) swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; },
    onTouchMove: (event: React.TouchEvent) => event.stopPropagation(),
    onTouchCancel: () => { swipe.current = null; },
    onTouchEnd: (event: React.TouchEvent) => { event.stopPropagation(); const start = swipe.current; swipe.current = null; if (!start || !event.changedTouches.length) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) change(shiftDate(anchor, dx < 0 ? 7 : -7)); },
  });
  const height = (full: boolean) => ({ height: full ? 'max(280px, calc(100dvh - 280px))' : '280px', width: '100%' });
  return <>
    <ChartPanel title="Peso e gordura corporal" id="progress-weight-chart-v2">{full => <>
      <div className="weight-year-controls"><label>Ano <select aria-label="Ano do gráfico do peso" value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(item => <option key={item}>{item}</option>)}</select></label><span>Meta: {state.profile.targetWeightKg} kg</span></div>
      {weight.length ? <ChartContainer style={height(full)} config={{ weightKg: { label: 'Peso (kg)', color: '#168fbd' }, bodyFatPercent: { label: 'Gordura (%)', color: '#ef6f4c' } }}><AreaChart data={weight} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="time" type="number" scale="time" domain={[new Date(year, 0, 1).getTime(), new Date(year, 11, 31, 23, 59).getTime()]} ticks={Array.from({ length: 12 }, (_, index) => new Date(year, index, 1).getTime())} tickFormatter={value => new Date(value).toLocaleDateString('pt-PT', { month: 'short' })} tickLine={false}/>
        <YAxis yAxisId="weight" width={45} domain={[Math.floor(Math.min(state.profile.targetWeightKg, ...weight.map(item => item.weightKg)) - 2), Math.ceil(Math.max(state.profile.targetWeightKg, ...weight.map(item => item.weightKg)) + 2)]}/><YAxis yAxisId="fat" orientation="right" width={40} unit="%" hide={!weight.some(item => item.bodyFatPercent != null)} domain={['auto', 'auto']}/>
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => new Date(Number(value)).toLocaleDateString('pt-PT')} />}/><ReferenceLine yAxisId="weight" y={state.profile.targetWeightKg} stroke="#e5483f" strokeOpacity={.4} strokeDasharray="7 6"/>
        <Area yAxisId="weight" dataKey="weightKg" stroke="var(--color-weightKg)" fill="var(--color-weightKg)" fillOpacity={.08} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false}/><Area yAxisId="fat" dataKey="bodyFatPercent" stroke="var(--color-bodyFatPercent)" fill="transparent" dot={{ r: 3 }} connectNulls isAnimationActive={false}/>
      </AreaChart></ChartContainer> : <p className="chart-empty">Sem medições em {year}. Escolhe outro ano ou regista o teu peso.</p>}
    </>}</ChartPanel>
    <ChartPanel title="Macronutrientes por dia" id="progress-macros-v2">{full => <div className="nutrition-chart-swipe" {...gesture(endWeek, setEndWeek)}>
      {rangeControls(endWeek, setEndWeek, window, setWindow)}
      <div className="daily-goal-legend">{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <span key={key}><i style={{ background: macroConfig[key].color }}/>{macroConfig[key].label}: meta {goals[key]} g/dia</span>)}</div>
      <ChartContainer style={height(full)} config={macroConfig}>{window === 'week' ? <BarChart data={macros}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate}/><YAxis width={40}/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/>{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <ReferenceLine key={key} y={goals[key]} stroke="#e5483f" strokeOpacity={.3} strokeDasharray="7 6"/>)}{Object.keys(goals).map(key => <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} isAnimationActive={false}/>)}</BarChart> : <LineChart data={macros}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40}/><YAxis width={40}/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/>{(Object.keys(goals) as Array<keyof typeof goals>).map(key => <ReferenceLine key={key} y={goals[key]} stroke="#e5483f" strokeOpacity={.3} strokeDasharray="7 6"/>)}{Object.keys(goals).map(key => <Line key={key} dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/>)}</LineChart>}</ChartContainer>
      <p className="chart-data-note">Desliza para mudar de semana. Dias sem registos ficam em branco; os valores nunca são acumulados.</p>
    </div>}</ChartPanel>
    <ChartPanel title="Água por dia" id="progress-water-v2">{full => <div className="nutrition-chart-swipe" {...gesture(waterWeek, setWaterWeek)}>
      {rangeControls(waterWeek, setWaterWeek, waterWindow, setWaterWindow)}<p className="chart-data-note">Meta diária: {state.goals.waterLiters} L</p>
      <ChartContainer style={height(full)} config={{ water: { label: 'Água (L)', color: '#35a6d1' } }}><BarChart data={water}><CartesianGrid vertical={false} opacity={.25}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={30}/><YAxis width={40}/><ChartTooltip content={<ChartTooltipContent labelFormatter={value => shortDate(String(value))}/>}/><ReferenceLine y={state.goals.waterLiters} stroke="#e5483f" strokeOpacity={.35} strokeDasharray="7 6"/><Bar dataKey="water" fill="var(--color-water)" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ChartContainer>
    </div>}</ChartPanel>
  </>;
}
