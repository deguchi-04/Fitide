'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowLeft, CirclePlay, LoaderCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workoutGroups, exerciseGroups } from '@/lib/workout-groups';
import type { WorkoutExercise } from '@/lib/fit-types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function ExerciseCatalog({ exercises, loading, replacing, onSelect, onClose }: {
  exercises: WorkoutExercise[];
  loading: boolean;
  replacing: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(36);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, number>>({});
  const searchId = useId();
  const equipmentChoices = useMemo(() => [...new Set(exercises.map((item) => item.equipment))].sort((a, b) => a.localeCompare(b, 'pt')), [exercises]);
  const groups = useMemo(() => {
    const query = normalize(search).trim();
    const filtered = exercises.filter((item) =>
      (group === 'all' || exerciseGroups(item).includes(group)) &&
      (equipment === 'all' || item.equipment === equipment) &&
      (!query || normalize(`${item.name} ${item.target} ${item.equipment}`).includes(query)));
    return workoutGroups.map((item) => ({ ...item, exercises: filtered.filter((exercise) =>
      (group === 'all' ? exerciseGroups(exercise)[0] : group) === item.value),
    })).filter((item) => item.exercises.length);
  }, [exercises, group, equipment, search]);
  const total = groups.reduce((sum, item) => sum + item.exercises.length, 0);
  function resetView() { setVisibleCount(36); setActiveId(null); }

  return <section className="exercise-catalog" aria-label="Catálogo visual de exercícios">
    <header className="exercise-catalog-heading">
      <Button type="button" variant="outline" onClick={onClose}><ArrowLeft /> Voltar ao treino</Button>
      <h3>{replacing ? 'Escolher substituição' : 'Catálogo de exercícios'}</h3>
      <p>Abre a demonstração para veres o movimento antes de escolher.</p>
    </header>
    <div className="exercise-catalog-filters">
      <label htmlFor={searchId}>Pesquisar<Input id={searchId} value={search} placeholder="Ex.: remada, halteres…" onChange={(event) => { setSearch(event.target.value); resetView(); }} /></label>
      <label>Grupo muscular<select value={group} onChange={(event) => { setGroup(event.target.value); resetView(); }}>
        <option value="all">Todos os grupos</option>{workoutGroups.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      <label>Equipamento<select value={equipment} onChange={(event) => { setEquipment(event.target.value); resetView(); }}>
        <option value="all">Todos os equipamentos</option>{equipmentChoices.map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
    </div>
    {loading ? <p aria-live="polite"><LoaderCircle className="spin" /> A carregar exercícios…</p> : <>
      <p aria-live="polite">{total} exercícios · {Math.min(total, visibleCount)} apresentados</p>
      {!total && <p>Não há exercícios para estes filtros. Experimenta outro grupo, equipamento ou nome.</p>}
      {groups.map((item, index) => {
        const offset = groups.slice(0, index).reduce((sum, preceding) => sum + preceding.exercises.length, 0);
        const shown = item.exercises.slice(0, Math.max(0, visibleCount - offset));
        if (!shown.length) return null;
        return <section key={item.value} className="exercise-catalog-group">
          <h4>{item.label} <span>{item.exercises.length}</span></h4>
          <div className="exercise-catalog-grid">{shown.map((exercise) => <article key={exercise.id} className={`exercise-catalog-card ${activeId === exercise.id ? 'is-previewing' : ''}`}>
            <h5>{exercise.name}</h5>
            <p>{exercise.target} · {exercise.equipment}</p>
            {activeId === exercise.id ? <>
              <CatalogGif key={exercise.id} exercise={exercise} />
              <Button type="button" variant="ghost" onClick={() => setActiveId(null)}><X /> Fechar demonstração</Button>
            </> : <button type="button" className="exercise-catalog-preview" onClick={() => setActiveId(exercise.id)} aria-expanded={false} aria-label={`Ver demonstração de ${exercise.name}`}><CirclePlay /><span>Ver demonstração</span></button>}
            <Button type="button" variant="outline" onClick={() => { onSelect(exercise.id); setAdded((current) => ({ ...current, [exercise.id]: (current[exercise.id] ?? 0) + 1 })); }}><Plus /> {replacing ? 'Usar este exercício' : 'Adicionar ao treino'}</Button>
            {!!added[exercise.id] && <output className="exercise-catalog-added">Adicionado ao treino{added[exercise.id] > 1 ? ` (${added[exercise.id]}×)` : ''}</output>}
          </article>)}</div>
        </section>;
      })}
      {visibleCount < total && <Button type="button" variant="outline" className="wide-button" onClick={() => setVisibleCount((count) => count + 36)}>Mostrar mais exercícios ({total - visibleCount})</Button>}
    </>}
  </section>;
}

function CatalogGif({ exercise }: { exercise: WorkoutExercise }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <div className="exercise-catalog-media">
    {!exercise.gifUrl || failed ? <p>A demonstração não está disponível neste momento.</p> : <>
      {!loaded && <span className="exercise-catalog-loading"><LoaderCircle className="spin" /> A carregar GIF…</span>}
      {/* Keep the animated GIF intact; the server proxy caches the original. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={exercise.gifUrl} alt={`Demonstração de ${exercise.name}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    </>}
  </div>;
}
