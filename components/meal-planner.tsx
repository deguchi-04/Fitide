'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shoppingList } from '@/lib/personal-tracking';
import type { AppState, Meal } from '@/lib/fit-types';
export function MealPlanner({ state, setState, date, onCreate, onEdit }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; date: string; onCreate: (date: string) => void; onEdit: (meal: Meal) => void }) {
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + 6); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const planned = (state.plannedMeals ?? []).filter(meal => meal.date >= from && meal.date <= to).sort((a,b) => a.date.localeCompare(b.date) || ['Pequeno-almoço','Almoço','Lanche','Jantar','Ceia'].indexOf(a.type)-['Pequeno-almoço','Almoço','Lanche','Jantar','Ceia'].indexOf(b.type));
  const list = shoppingList(planned);
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState('');
  return <section className="personal-panel"><h3>Refeições planeadas e compras</h3><p>Planeado não conta como consumido. Marca a refeição quando a comeres.</p>
    <div className="planning-controls"><label>De<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Até<Input type="date" min={from} value={to} onChange={e => setTo(e.target.value)} /></label><Button disabled={!from} onClick={() => onCreate(from)}>Planear refeição</Button></div>
    {from > to && <p role="alert">A data final deve ser igual ou posterior à inicial.</p>}
    <details><summary>Usar uma refeição anterior</summary><div className="planning-controls"><select aria-label="Refeição a planear" value={template} onChange={e => setTemplate(e.target.value)}><option value="">Escolhe uma refeição</option>{[...state.meals].reverse().map(meal => <option key={meal.id} value={meal.id}>{meal.date} · {meal.type} · {meal.ingredients.map(i => i.name).join(', ')}</option>)}</select><Button disabled={!template || !from} onClick={() => { const meal = state.meals.find(m => m.id === template); if (meal) { setState(current => ({ ...current, plannedMeals: [...(current.plannedMeals ?? []), { ...meal, id: crypto.randomUUID(), date: from, createdAt: new Date().toISOString(), ingredients: meal.ingredients.map(item => ({ ...item, id: crypto.randomUUID() })) }] })); setMessage(`Refeição planeada para ${from}.`); } }}>Planear para {from}</Button></div></details>
    {planned.map(meal => <div key={meal.id} className="planned-meal"><button className="meal-edit-button" onClick={() => onEdit(meal)}><strong>{meal.date} · {meal.type}</strong><small>{meal.ingredients.map(i => `${i.name} (${i.grams} g)`).join(', ')}</small></button><div><Button variant="outline" disabled={meal.date > new Date().toLocaleDateString('en-CA')} onClick={() => { setState(current => { if (!(current.plannedMeals ?? []).some(m => m.id === meal.id)) return current; return { ...current, meals: [...current.meals, { ...meal, id: crypto.randomUUID(), createdAt: new Date().toISOString() }], plannedMeals: current.plannedMeals?.filter(m => m.id !== meal.id) }; }); setMessage('Refeição registada no diário.'); }}>Já comi</Button><Button variant="ghost" onClick={() => setState(current => ({ ...current, plannedMeals: current.plannedMeals?.filter(m => m.id !== meal.id) }))}>Remover</Button></div></div>)}
    {!planned.length && <p>Sem refeições planeadas neste período.</p>}
    <h4>Lista de compras</h4><p>Quantidades em gramas, no estado indicado no ingrediente (cru/cozido). Confirma o que já tens em casa.</p>
    {list.map(item => { const key = `${from}|${to}|${item.key}|${item.grams}`; return <label className="shopping-item" key={key}><input type="checkbox" checked={(state.shoppingChecked ?? []).includes(key)} onChange={e => setState(current => ({ ...current, shoppingChecked: e.target.checked ? [...new Set([...(current.shoppingChecked ?? []), key])] : (current.shoppingChecked ?? []).filter(k => k !== key) }))} /><span>{item.name}</span><strong>{item.grams} g</strong></label>; })}
    {message && <p role="status">{message}</p>}
  </section>;
}
