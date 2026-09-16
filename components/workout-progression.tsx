'use client';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AppState } from '@/lib/fit-types';
export function WorkoutProgression({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const records = state.workoutSessions.flatMap(session => (session.exercises ?? []).filter(exercise => exercise.sets.length).map(exercise => ({ ...exercise, date: session.date, sessionId: session.id })));
  const choices = [...new Map(records.map(record => [record.key, record])).values()].sort((a,b) => a.name.localeCompare(b.name,'pt'));
  const [selected, setSelected] = useState(''); const key = choices.some(item => item.key === selected) ? selected : choices[0]?.key;
  const history = records.filter(record => record.key === key).sort((a,b) => a.date.localeCompare(b.date));
  const sets = history.flatMap(item => item.sets);
  const best = [...sets].sort((a,b) => b.load-a.load || b.reps-a.reps)[0];
  const reps = sets.length ? Math.max(...sets.map(set => set.reps)) : 0;
  const chart = history.map(item => ({ date: item.date, load: Math.max(...item.sets.map(set => set.load)), reps: Math.max(...item.sets.map(set => set.reps)) }));
  return <section className="personal-panel"><h3>Recordes e progressão de carga</h3><label className="shopping-item workout-reuse"><input type="checkbox" checked={state.reuseWorkoutPerformance !== false} onChange={event => setState(current => ({ ...current, reuseWorkoutPerformance: event.target.checked }))} /><span>Reutilizar as últimas séries nos próximos treinos</span></label><p>Apenas séries marcadas como feitas são guardadas. A carga e as repetições continuam editáveis; não aumentamos a carga automaticamente.</p>
    {!choices.length ? <p>Conclui um treino com séries marcadas para começar o histórico. Os treinos antigos não guardavam cargas individuais.</p> : <><select aria-label="Exercício no gráfico de progressão" value={key} onChange={event => setSelected(event.target.value)}>{choices.map(item => <option key={item.key} value={item.key}>{item.name} · {item.equipment}</option>)}</select><div className="record-stats"><p>Maior carga<strong>{best?.load} kg × {best?.reps} reps</strong></p><p>Mais repetições numa série<strong>{reps} reps</strong></p></div><div style={{ width: '100%', height: 230 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} /><YAxis width={45} unit=" kg"/><Tooltip/><Line name="Maior carga da sessão (kg)" dataKey="load" stroke="#168fbd" strokeWidth={3} dot={{ r: 4 }} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>}
  </section>;
}
