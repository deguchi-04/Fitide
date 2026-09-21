'use client';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AppState } from '@/lib/fit-types';

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

export function WorkoutProgression({ state }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const records = state.workoutSessions.flatMap(session => (session.exercises ?? []).filter(exercise => exercise.sets.length).map(exercise => ({ ...exercise, date: session.date, sessionId: session.id })));
  const choices = [...new Map(records.map(record => [record.key, record])).values()].sort((a,b) => a.name.localeCompare(b.name,'pt'));
  const [selected, setSelected] = useState('');
  const [metric, setMetric] = useState<'load' | 'reps'>('load');
  const key = choices.some(item => item.key === selected) ? selected : choices[0]?.key;
  const history = records.filter(record => record.key === key).sort((a,b) => a.date.localeCompare(b.date));
  const sets = history.flatMap(item => item.sets);
  const best = [...sets].sort((a,b) => b.load-a.load || b.reps-a.reps)[0];
  const reps = sets.length ? Math.max(...sets.map(set => set.reps)) : 0;
  const chart = history.map(item => ({ date: item.date, load: Math.max(...item.sets.map(set => set.load)), reps: Math.max(...item.sets.map(set => set.reps)) }));
  const config = { load: { label: 'Carga máxima (kg)', color: 'var(--primary)' }, reps: { label: 'Repetições máximas', color: 'var(--primary)' } };
  return <section className="personal-panel wide workout-progression" data-widget-id="progress-load-v2">
    <h3>Recordes e progressão</h3>
    <p>O último treino é a referência de carga e repetições. Podes ajustar cada série durante o treino.</p>
    {!choices.length ? <p>Conclui um treino com séries marcadas para começar o histórico. Os treinos antigos não guardavam cargas individuais.</p> : <>
      <label className="workout-progression-select"><span>Exercício</span><select aria-label="Exercício no gráfico de progressão" value={key} onChange={event => setSelected(event.target.value)}>{choices.map(item => <option key={item.key} value={item.key}>{item.name} · {item.equipment}</option>)}</select></label>
      <div className="record-stats"><div><span>Maior carga</span><strong>{best?.load} <small>kg</small></strong><small>{best?.reps} repetições nessa série</small></div><div><span>Mais repetições</span><strong>{reps} <small>reps</small></strong><small>Numa única série</small></div></div>
      <div className="segmented workout-progression-metrics" aria-label="Métrica do gráfico">{(['load', 'reps'] as const).map(value => <button type="button" key={value} className={metric === value ? 'selected' : ''} aria-pressed={metric === value} onClick={() => setMetric(value)}>{value === 'load' ? 'Carga' : 'Repetições'}</button>)}</div>
      <p className="workout-progression-unit">{metric === 'load' ? 'Carga máxima por sessão · kg' : 'Repetições máximas numa série por sessão'}</p>
      <ChartContainer className="workout-progression-chart" config={config}>
        <LineChart data={chart} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={.2}/>
          <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" minTickGap={24} tickLine={false} axisLine={false} tickMargin={10} padding={{ left: 12, right: 12 }}/>
          <YAxis width={36} allowDecimals={metric === 'load'} tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']}/>
          <ChartTooltip content={<ChartTooltipContent labelFormatter={value => formatDate(String(value))}/>}/>
          <Line key={metric} name={config[metric].label} dataKey={metric} stroke={`var(--color-${metric})`} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false}/>
        </LineChart>
      </ChartContainer>
    </>}
  </section>;
}
