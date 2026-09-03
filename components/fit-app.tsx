'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  Apple,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Dumbbell,
  Flame,
  Home,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  TrendingDown,
  Utensils,
  Waves,
  X,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { bmr, roundNutrients, suggestedGoals, sumNutrients, tdee, weeksToGoal } from '@/lib/calculations';
import { defaultState } from '@/lib/default-state';
import type { Activity, AppState, IngredientEntry, Meal, Nutrients, Profile, WorkoutPlan } from '@/lib/fit-types';
import { tacoFoods, TACO_URL } from '@/lib/taco';

type Page = 'today' | 'meals' | 'workout' | 'calendar' | 'progress' | 'settings';
const pageLabels: Record<Page, string> = { today: 'Hoje', meals: 'Refeições', workout: 'Treino', calendar: 'Calendário', progress: 'Progresso', settings: 'Definições' };
const navItems = [
  { id: 'today' as Page, label: 'Hoje', icon: Home },
  { id: 'meals' as Page, label: 'Refeições', icon: Utensils },
  { id: 'workout' as Page, label: 'Treino', icon: Dumbbell },
  { id: 'calendar' as Page, label: 'Calendário', icon: CalendarDays },
  { id: 'progress' as Page, label: 'Progresso', icon: Scale },
];
const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const fullDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function mergeState(saved: Partial<AppState>): AppState {
  return {
    ...defaultState,
    ...saved,
    profile: { ...defaultState.profile, ...saved.profile },
    goals: { ...defaultState.goals, ...saved.goals },
    activities: saved.activities ?? [],
    meals: saved.meals ?? [],
    weights: saved.weights ?? [],
    water: saved.water ?? [],
    fasts: saved.fasts ?? [],
    workoutPlans: saved.workoutPlans ?? [],
    workoutSessions: saved.workoutSessions ?? [],
  };
}

export default function FitApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [page, setPage] = useState<Page>('today');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const [mealOpen, setMealOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch('/api/state')
      .then((response) => response.json() as Promise<{ state: AppState | null }>)
      .then(({ state: saved }) => {
        if (saved) setState(mergeState(saved));
        setSync('saved');
      })
      .catch(() => setSync('error'))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSync('saving');
    const timer = window.setTimeout(() => {
      fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) })
        .then((response) => {
          if (!response.ok) throw new Error('sync');
          setSync('saved');
        })
        .catch(() => setSync('error'));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [state, loaded]);

  const dayMeals = useMemo(() => state.meals.filter((meal) => meal.date === selectedDate), [state.meals, selectedDate]);
  const consumed = useMemo(() => roundNutrients(sumNutrients(dayMeals.flatMap((meal) => meal.ingredients))), [dayMeals]);
  const water = state.water.find((entry) => entry.date === selectedDate)?.liters ?? 0;
  const remaining = Math.round(state.goals.calorieTarget - consumed.calories);
  const maintenance = tdee(state.profile, state.activities);
  const estimate = weeksToGoal(state.profile, state.goals.calorieTarget, maintenance);
  const fastSeconds = state.activeFastStart ? Math.max(0, Math.floor((now - new Date(state.activeFastStart).getTime()) / 1000)) : 0;

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateWater(delta: number) {
    const liters = Math.max(0, Math.round((water + delta) * 10) / 10);
    patchState({ water: [...state.water.filter((entry) => entry.date !== selectedDate), { date: selectedDate, liters }] });
  }

  function toggleFast() {
    if (state.activeFastStart) {
      patchState({ fasts: [...state.fasts, { id: uid(), start: state.activeFastStart, end: new Date().toISOString() }], activeFastStart: undefined });
    } else {
      patchState({ activeFastStart: new Date().toISOString() });
    }
  }

  if (!loaded) {
    return <div className="loading-screen"><div className="brand-mark large"><span>F</span><strong>Forma</strong></div><LoaderCircle className="spin" /><p>A preparar o teu espaço pessoal…</p></div>;
  }

  if (!state.profile.configured) {
    return <Onboarding state={state} onComplete={setState} />;
  }

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="brand-mark"><span>F</span><strong>Forma</strong></div>
        <nav aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}><Icon />{label}</button>)}
        </nav>
        <button className={`nav-item settings ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}><Settings />Definições</button>
      </aside>

      <section className="main-surface">
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</p>
            <h1>{page === 'today' ? `Olá, ${state.profile.name.split(' ')[0]}!` : pageLabels[page]}</h1>
          </div>
          <div className="top-actions">
            <label className="date-pill"><CalendarDays /><input aria-label="Data selecionada" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <span className={`sync-dot ${sync}`} title={sync === 'saved' ? 'Guardado' : sync === 'saving' ? 'A guardar' : 'Não foi possível guardar'} />
            <button className="avatar" onClick={() => setPage('settings')}>{state.profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</button>
          </div>
        </header>

        {page === 'today' && <TodayPage state={state} date={selectedDate} consumed={consumed} water={water} remaining={remaining} fastSeconds={fastSeconds} onWater={updateWater} onFast={toggleFast} onAddMeal={() => setMealOpen(true)} onGo={setPage} />}
        {page === 'meals' && <MealsPage meals={dayMeals} consumed={consumed} date={selectedDate} onAdd={() => setMealOpen(true)} onDelete={(id) => patchState({ meals: state.meals.filter((meal) => meal.id !== id) })} />}
        {page === 'workout' && <WorkoutPage state={state} setState={setState} />}
        {page === 'calendar' && <CalendarPage state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
        {page === 'progress' && <ProgressPage state={state} setState={setState} />}
        {page === 'settings' && <SettingsPage state={state} setState={setState} maintenance={maintenance} estimate={estimate} />}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.slice(0, 2).map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon /><span>{label}</span></button>)}
        <button className="add" aria-label="Adicionar refeição" onClick={() => setMealOpen(true)}><Plus /></button>
        {navItems.filter((item) => item.id === 'workout' || item.id === 'progress').map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon /><span>{label}</span></button>)}
      </nav>

      {mealOpen && <MealDialog date={selectedDate} onClose={() => setMealOpen(false)} onSave={(meal) => { patchState({ meals: [...state.meals, meal] }); setMealOpen(false); }} />}
    </main>
  );
}

function Onboarding({ state, onComplete }: { state: AppState; onComplete: (state: AppState) => void }) {
  const [profile, setProfile] = useState<Profile>(state.profile);
  const [goal, setGoal] = useState(state.goals.kind);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextProfile = { ...profile, configured: true };
    onComplete({ ...state, profile: nextProfile, goals: suggestedGoals(nextProfile, [], goal), weights: [{ id: uid(), date: localDateKey(), weightKg: nextProfile.currentWeightKg, bodyFatPercent: nextProfile.bodyFatPercent }] });
  }
  return (
    <div className="onboarding-shell">
      <section className="onboarding-copy">
        <div className="brand-mark large"><span>F</span><strong>Forma</strong></div>
        <div><p className="eyebrow light">O TEU ESPAÇO PESSOAL</p><h1>Um plano que começa em ti.</h1><p>Nutrição, treino, jejum e progresso reunidos num painel privado e simples de usar.</p></div>
        <div className="feature-notes"><span><Check /> Metas calculadas e ajustáveis</span><span><Check /> Dados guardados com segurança</span><span><Check /> Treinos pensados para academia</span></div>
      </section>
      <form className="onboarding-form" onSubmit={submit}>
        <div><p className="eyebrow">COMEÇAR</p><h2>Conta-me o essencial</h2><p>Estes dados servem para calcular o metabolismo e as tuas metas iniciais.</p></div>
        <Field label="Nome"><Input required value={profile.name} placeholder="Como te chamas?" onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
        <div className="form-grid three"><Field label="Idade"><NumberInput value={profile.age} onChange={(value) => setProfile({ ...profile, age: value })} /></Field><Field label="Altura (cm)"><NumberInput value={profile.heightCm} onChange={(value) => setProfile({ ...profile, heightCm: value })} /></Field><Field label="Sexo"><select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Profile['sex'] })}><option value="male">Masculino</option><option value="female">Feminino</option></select></Field></div>
        <div className="form-grid two"><Field label="Peso atual (kg)"><NumberInput value={profile.currentWeightKg} step="0.1" onChange={(value) => setProfile({ ...profile, currentWeightKg: value })} /></Field><Field label="Peso objetivo (kg)"><NumberInput value={profile.targetWeightKg} step="0.1" onChange={(value) => setProfile({ ...profile, targetWeightKg: value })} /></Field></div>
        <div className="form-grid three optional-grid"><Field label="% gordura atual · opcional"><NumberInput value={profile.bodyFatPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, bodyFatPercent: value || undefined })} /></Field><Field label="% gordura objetivo · opcional"><NumberInput value={profile.targetBodyFatPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, targetBodyFatPercent: value || undefined })} /></Field><Field label="% massa magra · opcional"><NumberInput value={profile.leanMassPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, leanMassPercent: value || undefined })} /></Field></div>
        <Field label="Objetivo principal"><div className="goal-options">{(['lose_fat', 'maintain', 'gain_muscle'] as const).map((item) => <button type="button" className={goal === item ? 'selected' : ''} onClick={() => setGoal(item)} key={item}>{item === 'lose_fat' ? 'Perder gordura' : item === 'maintain' ? 'Manter peso' : 'Ganhar músculo'}</button>)}</div></Field>
        <Button size="lg" type="submit" className="wide-button">Criar o meu plano <ChevronRight /></Button>
        <small>Estimativas orientativas. Para necessidades clínicas, consulta um profissional de saúde.</small>
      </form>
    </div>
  );
}

function TodayPage({ state, date, consumed, water, remaining, fastSeconds, onWater, onFast, onAddMeal, onGo }: { state: AppState; date: string; consumed: Nutrients; water: number; remaining: number; fastSeconds: number; onWater: (delta: number) => void; onFast: () => void; onAddMeal: () => void; onGo: (page: Page) => void }) {
  const caloriePercent = Math.min(100, Math.round((consumed.calories / state.goals.calorieTarget) * 100));
  const activePlan = state.workoutPlans.at(-1);
  return (
    <div className="dashboard-grid page-enter">
      <section className="hero-card">
        <div className="hero-copy"><span className="status-pill"><TrendingDown /> {remaining >= 0 ? 'Dentro do objetivo' : 'Objetivo ultrapassado'}</span><p className="eyebrow light">BALANÇO DE HOJE</p><h2>{Math.abs(remaining).toLocaleString('pt-PT')} kcal</h2><p>{remaining >= 0 ? 'ainda disponíveis no teu objetivo diário' : 'acima do teu objetivo diário'}</p><div className="hero-progress"><span style={{ width: `${caloriePercent}%` }} /></div><div className="hero-caption"><span>{Math.round(consumed.calories).toLocaleString('pt-PT')} consumidas</span><span>{state.goals.calorieTarget.toLocaleString('pt-PT')} objetivo</span></div></div>
        <div className="goal-ring" style={{ background: `conic-gradient(#e7a766 0 ${caloriePercent}%, rgba(255,255,255,.13) ${caloriePercent}% 100%)` }}><div><strong>{caloriePercent}%</strong><span>do dia</span></div></div>
      </section>
      <section className="metrics-grid">
        <Metric label="Consumidas" value={Math.round(consumed.calories).toLocaleString('pt-PT')} unit="kcal" icon={Apple} tone="plum" />
        <Metric label="Gasto estimado" value={tdee(state.profile, state.activities).toLocaleString('pt-PT')} unit="kcal/dia" icon={Flame} tone="orange" />
        <Metric label="Água" value={water.toFixed(1).replace('.', ',')} unit={`de ${state.goals.waterLiters} L`} icon={Waves} tone="blue" />
        <Metric label="Jejum" value={state.activeFastStart ? formatDuration(fastSeconds) : 'Pronto'} unit={`meta ${state.goals.fastingHours} h`} icon={TimerReset} tone="green" />
      </section>
      <Card className="panel meals-panel">
        <CardHeader className="panel-heading"><div><p className="eyebrow">ALIMENTAÇÃO</p><CardTitle>Refeições de hoje</CardTitle></div><Button variant="ghost" onClick={onAddMeal}><Plus /> Adicionar</Button></CardHeader>
        <CardContent>{state.meals.filter((meal) => meal.date === date).length ? state.meals.filter((meal) => meal.date === date).slice(-3).map((meal) => <MealRow meal={meal} key={meal.id} />) : <EmptyState icon={Utensils} title="Ainda sem refeições" text="Adiciona a primeira refeição do dia." action="Registar refeição" onClick={onAddMeal} />}</CardContent>
      </Card>
      <Card className="panel training-panel">
        <CardHeader className="panel-heading"><div><p className="eyebrow">TREINO</p><CardTitle>{activePlan?.name ?? 'Plano por criar'}</CardTitle></div><div className="round-icon"><Dumbbell /></div></CardHeader>
        <CardContent>{activePlan ? <><div className="training-meta"><span>{activePlan.exercises.length} exercícios</span><span>≈ 50 min</span><span>{activePlan.source}</span></div><div className="exercise-stack">{activePlan.exercises.slice(0, 2).map((exercise, index) => <div key={exercise.id}><span>0{index + 1}</span><p><strong>{exercise.name}</strong><small>{exercise.sets} × {exercise.reps} · {exercise.restSeconds} s</small></p></div>)}</div><Button className="wide-button" onClick={() => onGo('workout')}><Dumbbell /> Abrir treino</Button></> : <EmptyState icon={Sparkles} title="Cria o teu primeiro plano" text="Uma rotina de academia adaptada ao objetivo." action="Sugerir treino" onClick={() => onGo('workout')} />}</CardContent>
      </Card>
      <Card className="panel water-fast-panel"><CardHeader><p className="eyebrow">HÁBITOS</p><CardTitle>Água & jejum</CardTitle></CardHeader><CardContent className="habit-grid"><div><div className="habit-heading"><Waves /><span><strong>{water.toFixed(1)} L</strong><small>de {state.goals.waterLiters} L</small></span></div><Progress value={(water / state.goals.waterLiters) * 100} /><div className="stepper"><Button variant="outline" size="icon" onClick={() => onWater(-0.25)}><Minus /></Button><Button onClick={() => onWater(.25)}>+ 250 ml</Button></div></div><div><div className="habit-heading"><TimerReset /><span><strong>{state.activeFastStart ? formatDuration(fastSeconds) : `${state.goals.fastingHours}:00 h`}</strong><small>{state.activeFastStart ? 'jejum em curso' : 'meta configurada'}</small></span></div><Button className="wide-button" variant={state.activeFastStart ? 'outline' : 'default'} onClick={onFast}>{state.activeFastStart ? <CirclePause /> : <CirclePlay />}{state.activeFastStart ? 'Terminar jejum' : 'Começar jejum'}</Button></div></CardContent></Card>
      <Card className="panel macros-panel"><CardHeader className="panel-heading"><div><p className="eyebrow">NUTRIÇÃO</p><CardTitle>Macros do dia</CardTitle></div><Button variant="ghost" onClick={() => onGo('settings')}>Ajustar metas</Button></CardHeader><CardContent className="macro-bars"><Macro name="Proteína" current={consumed.protein} target={state.goals.proteinG} color="var(--plum)" /><Macro name="Hidratos" current={consumed.carbs} target={state.goals.carbsG} color="var(--orange)" /><Macro name="Gordura" current={consumed.fat} target={state.goals.fatG} color="var(--green)" /><Macro name="Fibra" current={consumed.fiber} target={state.goals.fiberG} color="var(--blue)" /></CardContent></Card>
    </div>
  );
}

function MealsPage({ meals, consumed, date, onAdd, onDelete }: { meals: Meal[]; consumed: Nutrients; date: string; onAdd: () => void; onDelete: (id: string) => void }) {
  return <div className="content-page page-enter"><section className="page-intro"><div><p className="eyebrow">DIÁRIO ALIMENTAR</p><h2>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</h2><p>Regista por ingrediente; os totais são calculados automaticamente.</p></div><Button size="lg" onClick={onAdd}><Plus /> Nova refeição</Button></section><section className="summary-strip"><MiniStat label="Energia" value={`${Math.round(consumed.calories)} kcal`} /><MiniStat label="Proteína" value={`${consumed.protein.toFixed(1)} g`} /><MiniStat label="Fibra" value={`${consumed.fiber.toFixed(1)} g`} /><MiniStat label="Vitamina C" value={`${consumed.vitaminC.toFixed(1)} mg`} /></section><div className="meal-list">{meals.length ? meals.map((meal) => <Card key={meal.id} className="meal-card"><CardContent><MealRow meal={meal} expanded /><Button variant="ghost" size="icon" aria-label="Eliminar refeição" onClick={() => onDelete(meal.id)}><Trash2 /></Button></CardContent></Card>) : <Card className="panel"><CardContent><EmptyState icon={Utensils} title="O diário está vazio" text="Usa a TACO ou informa os valores do rótulo para começar." action="Adicionar refeição" onClick={onAdd} /></CardContent></Card>}</div><p className="source-note">Referência nutricional: <a href={TACO_URL} target="_blank" rel="noreferrer">TACO 4.ª edição, NEPA/UNICAMP</a>. Valores por 100 g e arredondados.</p></div>;
}

function MealDialog({ date, onClose, onSave }: { date: string; onClose: () => void; onSave: (meal: Meal) => void }) {
  const [type, setType] = useState('Almoço');
  const [mode, setMode] = useState<'TACO' | 'Rótulo'>('TACO');
  const [foodId, setFoodId] = useState(tacoFoods[0].id);
  const [grams, setGrams] = useState(100);
  const [manualName, setManualName] = useState('');
  const [manual, setManual] = useState<Nutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, calcium: 0, iron: 0, vitaminC: 0 });
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const total = roundNutrients(sumNutrients(ingredients));

  function addIngredient() {
    if (mode === 'TACO') {
      const food = tacoFoods.find((item) => item.id === foodId)!;
      const factor = grams / 100;
      setIngredients([...ingredients, { id: uid(), name: food.name, grams, source: 'TACO', ...roundNutrients({ calories: food.calories * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor, fiber: food.fiber * factor, calcium: food.calcium * factor, iron: food.iron * factor, vitaminC: food.vitaminC * factor }) }]);
    } else if (manualName.trim()) {
      setIngredients([...ingredients, { id: uid(), name: manualName.trim(), grams, source: 'Rótulo', ...manual }]);
      setManualName('');
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="meal-title"><header><div><p className="eyebrow">NOVA REFEIÇÃO</p><h2 id="meal-title">O que comeste?</h2></div><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></header><div className="dialog-scroll"><div className="form-grid two"><Field label="Tipo de refeição"><select value={type} onChange={(event) => setType(event.target.value)}>{['Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar', 'Ceia'].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Fonte"><div className="segmented"><button className={mode === 'TACO' ? 'selected' : ''} onClick={() => setMode('TACO')} type="button">Tabela TACO</button><button className={mode === 'Rótulo' ? 'selected' : ''} onClick={() => setMode('Rótulo')} type="button">Rótulo</button></div></Field></div>{mode === 'TACO' ? <div className="form-grid ingredient-input"><Field label="Alimento"><select value={foodId} onChange={(event) => setFoodId(event.target.value)}>{tacoFoods.map((food) => <option value={food.id} key={food.id}>{food.name}</option>)}</select></Field><Field label="Peso (g)"><NumberInput value={grams} onChange={setGrams} /></Field><Button type="button" onClick={addIngredient}><Plus /> Adicionar</Button></div> : <div className="manual-food"><div className="form-grid two"><Field label="Nome"><Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Ex.: iogurte proteico" /></Field><Field label="Peso da porção (g)"><NumberInput value={grams} onChange={setGrams} /></Field></div><p className="field-hint">Valores para a porção consumida</p><div className="form-grid four">{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'calcium', 'iron', 'vitaminC'] as const).map((key) => <Field key={key} label={key === 'calories' ? 'kcal' : key === 'protein' ? 'Proteína g' : key === 'carbs' ? 'Hidratos g' : key === 'fat' ? 'Gordura g' : key === 'fiber' ? 'Fibra g' : key === 'calcium' ? 'Cálcio mg' : key === 'iron' ? 'Ferro mg' : 'Vit. C mg'}><NumberInput value={manual[key]} step="0.1" onChange={(value) => setManual({ ...manual, [key]: value })} /></Field>)}</div><Button type="button" onClick={addIngredient}><Plus /> Adicionar ingrediente</Button></div>}<div className="ingredient-list"><div className="ingredient-head"><strong>Ingredientes</strong><span>{ingredients.length}</span></div>{ingredients.map((item) => <div className="ingredient-row" key={item.id}><div><strong>{item.name}</strong><small>{item.grams} g · {item.source}</small></div><span>{Math.round(item.calories)} kcal</span><Button variant="ghost" size="icon" onClick={() => setIngredients(ingredients.filter((entry) => entry.id !== item.id))}><X /></Button></div>)}</div><div className="nutrition-total"><MiniStat label="Total" value={`${Math.round(total.calories)} kcal`} /><MiniStat label="Proteína" value={`${total.protein} g`} /><MiniStat label="Hidratos" value={`${total.carbs} g`} /><MiniStat label="Fibra" value={`${total.fiber} g`} /></div></div><footer><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!ingredients.length} onClick={() => onSave({ id: uid(), date, type, ingredients, createdAt: new Date().toISOString() })}><Save /> Guardar refeição</Button></footer></section></div>;
}

function WorkoutPage({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [split, setSplit] = useState('full_body');
  const [level, setLevel] = useState('intermediate');
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completedSets, setCompletedSets] = useState<string[]>([]);
  const [rest, setRest] = useState(0);
  const latestPlan = state.workoutPlans.at(-1);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setRest((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  async function generate() {
    setGenerating(true);
    try {
      const response = await fetch('/api/workout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: state.goals.kind === 'lose_fat' ? 'fat_loss' : state.goals.kind === 'gain_muscle' ? 'muscle_gain' : 'general_fitness', level, split }) });
      const result = await response.json() as { source: WorkoutPlan['source']; exercises: WorkoutPlan['exercises'] };
      const plan: WorkoutPlan = { id: uid(), name: split === 'full_body' ? 'Corpo inteiro' : split === 'upper' ? 'Parte superior' : 'Pernas & glúteos', source: result.source, createdAt: new Date().toISOString(), exercises: result.exercises };
      setState((current) => ({ ...current, workoutPlans: [...current.workoutPlans, plan] }));
    } finally { setGenerating(false); }
  }

  function startWorkout(plan: WorkoutPlan) {
    setActivePlan(plan);
    setStartedAt(Date.now());
    setElapsed(0);
    setCompletedSets([]);
    setRest(0);
  }

  function finishWorkout() {
    if (!activePlan || !startedAt) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const calories = Math.round(5 * state.profile.currentWeightKg * (minutes / 60));
    setState((current) => ({ ...current, workoutSessions: [...current.workoutSessions, { id: uid(), date: localDateKey(), planName: activePlan.name, minutes, completedSets: completedSets.length, calories }] }));
    setActivePlan(null); setStartedAt(null); setElapsed(0); setCompletedSets([]); setRest(0);
  }

  if (activePlan) return <div className="content-page workout-live page-enter"><section className="live-header"><Button variant="ghost" onClick={() => setActivePlan(null)}><ArrowLeft /> Sair</Button><div><p className="eyebrow">TREINO EM CURSO</p><h2>{activePlan.name}</h2></div><div className="live-timer"><TimerReset /><strong>{formatDuration(elapsed)}</strong></div></section>{rest > 0 && <div className="rest-banner"><span><CirclePause /> Descanso</span><strong>{formatDuration(rest)}</strong><Button size="sm" variant="ghost" onClick={() => setRest(0)}>Saltar</Button></div>}<div className="live-exercises">{activePlan.exercises.map((exercise, exerciseIndex) => <Card key={exercise.id} className="live-exercise"><CardHeader><div className="exercise-number">{String(exerciseIndex + 1).padStart(2, '0')}</div><div><CardTitle>{exercise.name}</CardTitle><CardDescription>{exercise.target} · {exercise.equipment}</CardDescription></div><span>{exercise.sets} × {exercise.reps}</span></CardHeader><CardContent><div className="set-table"><div><span>Série</span><span>Carga (kg)</span><span>Reps</span><span>Feito</span></div>{Array.from({ length: exercise.sets }).map((_, setIndex) => { const key = `${exercise.id}-${setIndex}`; const done = completedSets.includes(key); return <div key={key} className={done ? 'done' : ''}><strong>{setIndex + 1}</strong><Input aria-label={`Carga da série ${setIndex + 1}`} type="number" placeholder="—" /><Input aria-label={`Repetições da série ${setIndex + 1}`} placeholder={exercise.reps} /><Button size="icon" variant={done ? 'default' : 'outline'} onClick={() => { if (done) setCompletedSets(completedSets.filter((item) => item !== key)); else { setCompletedSets([...completedSets, key]); setRest(exercise.restSeconds); } }}>{done ? <Check /> : <span />}</Button></div>; })}</div></CardContent></Card>)}</div><Button size="lg" className="finish-workout" onClick={finishWorkout}><Check /> Terminar treino</Button></div>;

  return <div className="content-page page-enter"><section className="page-intro"><div><p className="eyebrow">ACADEMIA</p><h2>Treino feito à tua medida</h2><p>Gera uma rotina a partir do teu objetivo e controla séries, cargas, tempo e descanso.</p></div>{latestPlan && <Button size="lg" onClick={() => startWorkout(latestPlan)}><CirclePlay /> Começar treino</Button>}</section><div className="workout-layout"><Card className="panel generator-card"><CardHeader><div className="round-icon"><Sparkles /></div><CardTitle>Sugerir nova rotina</CardTitle><CardDescription>A integração usa o WorkoutX quando a chave está configurada.</CardDescription></CardHeader><CardContent><Field label="Divisão"><select value={split} onChange={(e) => setSplit(e.target.value)}><option value="full_body">Corpo inteiro</option><option value="upper">Parte superior</option><option value="lower">Pernas & glúteos</option></select></Field><Field label="Nível"><select value={level} onChange={(e) => setLevel(e.target.value)}><option value="beginner">Iniciante</option><option value="intermediate">Intermédio</option><option value="advanced">Avançado</option></select></Field><Button size="lg" className="wide-button" onClick={generate} disabled={generating}>{generating ? <LoaderCircle className="spin" /> : <Sparkles />}{generating ? 'A gerar…' : 'Gerar rotina'}</Button></CardContent></Card><div>{latestPlan ? <PlanCard plan={latestPlan} onStart={() => startWorkout(latestPlan)} /> : <Card className="panel plan-empty"><CardContent><EmptyState icon={Dumbbell} title="Nenhuma rotina criada" text="Escolhe a divisão e o nível para receberes uma sugestão." /></CardContent></Card>}{state.workoutSessions.length > 0 && <Card className="panel history-card"><CardHeader><CardTitle>Últimos treinos</CardTitle></CardHeader><CardContent>{state.workoutSessions.slice(-4).reverse().map((session) => <div className="history-row" key={session.id}><Dumbbell /><div><strong>{session.planName}</strong><small>{new Date(`${session.date}T12:00:00`).toLocaleDateString('pt-PT')} · {session.completedSets} séries</small></div><span>{session.minutes} min</span></div>)}</CardContent></Card>}</div></div></div>;
}

function PlanCard({ plan, onStart }: { plan: WorkoutPlan; onStart: () => void }) {
  return <Card className="panel plan-card"><CardHeader className="panel-heading"><div><p className="eyebrow">PLANO MAIS RECENTE</p><CardTitle>{plan.name}</CardTitle></div><span className={`source-badge ${plan.source === 'WorkoutX' ? 'live' : ''}`}>{plan.source}</span></CardHeader><CardContent><div className="plan-list">{plan.exercises.map((exercise, index) => <div key={exercise.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{exercise.name}</strong><small>{exercise.target} · {exercise.equipment}</small></div><b>{exercise.sets} × {exercise.reps}</b></div>)}</div><Button size="lg" className="wide-button" onClick={onStart}><CirclePlay /> Começar este treino</Button></CardContent></Card>;
}

function CalendarPage({ state, selectedDate, setSelectedDate }: { state: AppState; selectedDate: string; setSelectedDate: (date: string) => void }) {
  const [month, setMonth] = useState(() => { const date = new Date(`${selectedDate}T12:00:00`); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const first = new Date(start); first.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(first); date.setDate(first.getDate() + index); return date; });
  const dayMeals = state.meals.filter((meal) => meal.date === selectedDate);
  const nutrients = roundNutrients(sumNutrients(dayMeals.flatMap((meal) => meal.ingredients)));
  const water = state.water.find((entry) => entry.date === selectedDate)?.liters ?? 0;
  const workout = state.workoutSessions.find((entry) => entry.date === selectedDate);
  const fast = state.fasts.find((entry) => localDateKey(new Date(entry.start)) === selectedDate);
  return <div className="content-page page-enter"><section className="page-intro"><div><p className="eyebrow">HISTÓRICO DIÁRIO</p><h2>O teu calendário</h2><p>Volta a qualquer dia para consultar ingestão, água, treino e jejum.</p></div></section><div className="calendar-layout"><Card className="panel calendar-card"><CardHeader className="calendar-head"><Button variant="ghost" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button><CardTitle>{month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</CardTitle><Button variant="ghost" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button></CardHeader><CardContent><div className="calendar-grid">{dayNames.map((day, index) => <span className="calendar-week" key={`${day}-${index}`}>{day}</span>)}{days.map((day) => { const key = localDateKey(day); const hasData = state.meals.some((meal) => meal.date === key) || state.water.some((entry) => entry.date === key) || state.workoutSessions.some((entry) => entry.date === key); return <button key={key} className={`${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${selectedDate === key ? 'selected' : ''}`} onClick={() => setSelectedDate(key)}><span>{day.getDate()}</span>{hasData && <i />}</button>; })}</div></CardContent></Card><Card className="panel day-detail"><CardHeader><p className="eyebrow">DIA SELECIONADO</p><CardTitle>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</CardTitle></CardHeader><CardContent><div className="day-stats"><MiniStat label="Ingestão" value={`${Math.round(nutrients.calories)} kcal`} /><MiniStat label="Água" value={`${water.toFixed(1)} L`} /><MiniStat label="Jejum" value={fast ? formatDuration(Math.floor((new Date(fast.end).getTime() - new Date(fast.start).getTime()) / 1000)) : '—'} /><MiniStat label="Treino" value={workout ? `${workout.minutes} min` : '—'} /></div><div className="day-meals"><strong>Refeições</strong>{dayMeals.length ? dayMeals.map((meal) => <MealRow meal={meal} key={meal.id} />) : <p>Sem refeições registadas.</p>}</div></CardContent></Card></div></div>;
}

function ProgressPage({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [weight, setWeight] = useState(state.profile.currentWeightKg);
  const [fat, setFat] = useState<number | ''>(state.profile.bodyFatPercent ?? '');
  const weightData = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => ({ ...entry, label: new Date(`${entry.date}T12:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }));
  const recentDates = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return localDateKey(date); });
  const historyData = recentDates.map((date) => { const nutrients = sumNutrients(state.meals.filter((meal) => meal.date === date).flatMap((meal) => meal.ingredients)); return { date, label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3), protein: Math.round(nutrients.protein), carbs: Math.round(nutrients.carbs), water: state.water.find((entry) => entry.date === date)?.liters ?? 0 }; });
  function addWeight(event: React.FormEvent) { event.preventDefault(); const date = localDateKey(); const entry = { id: uid(), date, weightKg: weight, bodyFatPercent: fat || undefined }; setState((current) => ({ ...current, profile: { ...current.profile, currentWeightKg: weight, bodyFatPercent: fat || undefined }, weights: [...current.weights.filter((item) => item.date !== date), entry] })); }
  return <div className="content-page page-enter"><section className="page-intro"><div><p className="eyebrow">EVOLUÇÃO</p><h2>Progresso sem ruído</h2><p>Observa tendências de peso, gordura, macros e hidratação ao longo do tempo.</p></div></section><div className="progress-stats"><MiniStat label="Peso atual" value={`${state.profile.currentWeightKg.toFixed(1)} kg`} /><MiniStat label="Objetivo" value={`${state.profile.targetWeightKg.toFixed(1)} kg`} /><MiniStat label="Variação" value={`${(state.profile.currentWeightKg - (state.weights[0]?.weightKg ?? state.profile.currentWeightKg)).toFixed(1)} kg`} /><MiniStat label="Gordura atual" value={state.profile.bodyFatPercent ? `${state.profile.bodyFatPercent}%` : 'Não registada'} /></div><div className="charts-grid"><Card className="panel chart-card wide"><CardHeader className="panel-heading"><div><p className="eyebrow">COMPOSIÇÃO</p><CardTitle>Peso e gordura corporal</CardTitle></div></CardHeader><CardContent>{weightData.length > 1 ? <ChartContainer className="h-[300px] w-full" config={{ weightKg: { label: 'Peso (kg)', color: '#6a3d5b' }, bodyFatPercent: { label: 'Gordura (%)', color: '#df8a43' } }}><AreaChart data={weightData} margin={{ left: -15, right: 12 }}><defs><linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-weightKg)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--color-weightKg)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Area dataKey="weightKg" type="monotone" stroke="var(--color-weightKg)" fill="url(#weightFill)" strokeWidth={3} /><Area dataKey="bodyFatPercent" type="monotone" stroke="var(--color-bodyFatPercent)" fill="transparent" strokeWidth={2} connectNulls /></AreaChart></ChartContainer> : <EmptyState icon={TrendingDown} title="A tendência aparece com 2 registos" text="Atualiza o peso sempre que quiseres." />}</CardContent></Card><Card className="panel weight-form"><CardHeader><CardTitle>Registar peso</CardTitle><CardDescription>O registo de hoje substitui outro feito na mesma data.</CardDescription></CardHeader><CardContent><form onSubmit={addWeight}><Field label="Peso (kg)"><NumberInput value={weight} step="0.1" onChange={setWeight} /></Field><Field label="Gordura corporal (%)"><NumberInput value={fat} step="0.1" onChange={(value) => setFat(value || '')} /></Field><Button className="wide-button" type="submit"><Save /> Guardar medição</Button></form></CardContent></Card><Card className="panel chart-card"><CardHeader><CardTitle>Macros · 7 dias</CardTitle></CardHeader><CardContent><ChartContainer className="h-[240px] w-full" config={{ protein: { label: 'Proteína', color: '#6a3d5b' }, carbs: { label: 'Hidratos', color: '#df8a43' } }}><BarChart data={historyData}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="protein" fill="var(--color-protein)" radius={[5,5,0,0]} /><Bar dataKey="carbs" fill="var(--color-carbs)" radius={[5,5,0,0]} /></BarChart></ChartContainer></CardContent></Card><Card className="panel chart-card"><CardHeader><CardTitle>Água · 7 dias</CardTitle></CardHeader><CardContent><ChartContainer className="h-[240px] w-full" config={{ water: { label: 'Água (L)', color: '#57849c' } }}><BarChart data={historyData}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="water" fill="var(--color-water)" radius={[7,7,0,0]} /></BarChart></ChartContainer></CardContent></Card></div></div>;
}

function SettingsPage({ state, setState, maintenance, estimate }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; maintenance: number; estimate: number | null }) {
  const [profile, setProfile] = useState(state.profile);
  const [goals, setGoals] = useState(state.goals);
  const [activityName, setActivityName] = useState('Musculação');
  const [minutes, setMinutes] = useState(60);
  const [met, setMet] = useState(5);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  function saveProfile(event: React.FormEvent) { event.preventDefault(); setState((current) => ({ ...current, profile, goals })); }
  function recalculate() { const next = suggestedGoals(profile, state.activities, goals.kind); setGoals(next); setState((current) => ({ ...current, profile, goals: next })); }
  function addActivity() { if (!activityName.trim() || !days.length) return; const activity: Activity = { id: uid(), name: activityName.trim(), days, minutes, met }; setState((current) => ({ ...current, activities: [...current.activities, activity] })); }
  return <div className="content-page page-enter"><section className="page-intro"><div><p className="eyebrow">PERSONALIZAÇÃO</p><h2>O teu plano, nas tuas mãos</h2><p>Edita os dados, aceita sugestões calculadas ou define cada meta manualmente.</p></div><Button size="lg" onClick={recalculate}><Sparkles /> Recalcular sugestões</Button></section><section className="calculation-strip"><div><span>TMB</span><strong>{bmr(profile)} kcal</strong><small>Mifflin–St Jeor</small></div><div><span>Gasto diário</span><strong>{maintenance} kcal</strong><small>rotina incluída</small></div><div><span>Objetivo</span><strong>{estimate === null ? '—' : `${estimate} semanas`}</strong><small>estimativa matemática</small></div><div><span>Água</span><strong>{goals.waterLiters} L</strong><small>35 ml/kg</small></div></section><form onSubmit={saveProfile} className="settings-grid"><Card className="panel"><CardHeader><CardTitle>Perfil e composição</CardTitle><CardDescription>Base dos cálculos metabólicos.</CardDescription></CardHeader><CardContent><Field label="Nome"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field><div className="form-grid three"><Field label="Idade"><NumberInput value={profile.age} onChange={(value) => setProfile({ ...profile, age: value })} /></Field><Field label="Altura (cm)"><NumberInput value={profile.heightCm} onChange={(value) => setProfile({ ...profile, heightCm: value })} /></Field><Field label="Sexo"><select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Profile['sex'] })}><option value="male">Masculino</option><option value="female">Feminino</option></select></Field></div><div className="form-grid two"><Field label="Peso atual (kg)"><NumberInput value={profile.currentWeightKg} step="0.1" onChange={(value) => setProfile({ ...profile, currentWeightKg: value })} /></Field><Field label="Peso objetivo (kg)"><NumberInput value={profile.targetWeightKg} step="0.1" onChange={(value) => setProfile({ ...profile, targetWeightKg: value })} /></Field></div><div className="form-grid three"><Field label="% gordura atual"><NumberInput value={profile.bodyFatPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, bodyFatPercent: value || undefined })} /></Field><Field label="% gordura objetivo"><NumberInput value={profile.targetBodyFatPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, targetBodyFatPercent: value || undefined })} /></Field><Field label="% massa magra"><NumberInput value={profile.leanMassPercent ?? ''} step="0.1" onChange={(value) => setProfile({ ...profile, leanMassPercent: value || undefined })} /></Field></div></CardContent></Card><Card className="panel"><CardHeader><CardTitle>Metas diárias</CardTitle><CardDescription>Todos os valores podem ser alterados manualmente.</CardDescription></CardHeader><CardContent><Field label="Objetivo"><select value={goals.kind} onChange={(e) => setGoals({ ...goals, kind: e.target.value as typeof goals.kind })}><option value="lose_fat">Perder gordura</option><option value="maintain">Manter peso</option><option value="gain_muscle">Ganhar músculo</option></select></Field><div className="form-grid two"><Field label="Calorias (kcal)"><NumberInput value={goals.calorieTarget} onChange={(value) => setGoals({ ...goals, calorieTarget: value })} /></Field><Field label="Água (L)"><NumberInput value={goals.waterLiters} step="0.1" onChange={(value) => setGoals({ ...goals, waterLiters: value })} /></Field><Field label="Proteína (g)"><NumberInput value={goals.proteinG} onChange={(value) => setGoals({ ...goals, proteinG: value })} /></Field><Field label="Hidratos (g)"><NumberInput value={goals.carbsG} onChange={(value) => setGoals({ ...goals, carbsG: value })} /></Field><Field label="Gordura (g)"><NumberInput value={goals.fatG} onChange={(value) => setGoals({ ...goals, fatG: value })} /></Field><Field label="Fibra (g)"><NumberInput value={goals.fiberG} onChange={(value) => setGoals({ ...goals, fiberG: value })} /></Field><Field label="Jejum (h)"><NumberInput value={goals.fastingHours} onChange={(value) => setGoals({ ...goals, fastingHours: value })} /></Field></div></CardContent></Card><Card className="panel activities-card"><CardHeader><CardTitle>Rotina semanal</CardTitle><CardDescription>O gasto diário combina a TMB com estas atividades.</CardDescription></CardHeader><CardContent><div className="activity-list">{state.activities.map((activity) => <div key={activity.id}><div className="round-icon soft"><ActivityIcon /></div><div><strong>{activity.name}</strong><small>{activity.days.map((day) => fullDayNames[day]).join(', ')} · {activity.minutes} min</small></div><span>MET {activity.met}</span><Button type="button" variant="ghost" size="icon" onClick={() => setState((current) => ({ ...current, activities: current.activities.filter((item) => item.id !== activity.id) }))}><Trash2 /></Button></div>)}</div><div className="activity-builder"><div className="form-grid three"><Field label="Atividade"><Input value={activityName} onChange={(e) => setActivityName(e.target.value)} /></Field><Field label="Minutos"><NumberInput value={minutes} onChange={setMinutes} /></Field><Field label="Intensidade MET"><NumberInput value={met} step="0.5" onChange={setMet} /></Field></div><Field label="Dias da semana"><div className="day-picker">{fullDayNames.map((day, index) => <button type="button" key={day} className={days.includes(index) ? 'selected' : ''} onClick={() => setDays(days.includes(index) ? days.filter((item) => item !== index) : [...days, index])}>{day}</button>)}</div></Field><Button type="button" variant="outline" onClick={addActivity}><Plus /> Adicionar atividade</Button></div></CardContent></Card><Card className="panel integration-card"><CardHeader><CardTitle>Integrações e referências</CardTitle></CardHeader><CardContent><div className="integration-row"><div className="round-icon"><Dumbbell /></div><div><strong>WorkoutX API</strong><p>Exercícios, GIFs, músculos e equipamentos. Sem chave, a app usa rotinas de demonstração.</p><a href="https://workoutxapp.com/" target="_blank" rel="noreferrer">Obter chave →</a></div></div><div className="integration-row"><div className="round-icon soft"><Apple /></div><div><strong>Tabela TACO</strong><p>Composição por 100 g para alimentos sem rótulo nutricional.</p><a href={TACO_URL} target="_blank" rel="noreferrer">Consultar referência →</a></div></div></CardContent></Card><div className="settings-actions"><Button size="lg" type="submit"><Save /> Guardar alterações</Button><p>As sugestões são estimativas e não substituem orientação médica ou nutricional.</p></div></form></div>;
}

function Metric({ label, value, unit, icon: Icon, tone }: { label: string; value: string; unit: string; icon: typeof Apple; tone: string }) { return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon /></div><p>{label}</p><strong>{value}</strong> <span>{unit}</span></article>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function NumberInput({ value, onChange, step = '1' }: { value: number | ''; onChange: (value: number) => void; step?: string }) { return <Input type="number" value={value} step={step} min="0" onChange={(event) => onChange(Number(event.target.value))} />; }
function EmptyState({ icon: Icon, title, text, action, onClick }: { icon: typeof Apple; title: string; text: string; action?: string; onClick?: () => void }) { return <div className="empty-state"><div><Icon /></div><strong>{title}</strong><p>{text}</p>{action && <Button variant="outline" onClick={onClick}>{action}</Button>}</div>; }
function MealRow({ meal, expanded = false }: { meal: Meal; expanded?: boolean }) { const total = roundNutrients(sumNutrients(meal.ingredients)); return <div className={`meal-row ${expanded ? 'expanded' : ''}`}><span className="meal-emoji">{meal.type === 'Pequeno-almoço' ? '☀️' : meal.type === 'Almoço' ? '🥗' : meal.type === 'Jantar' ? '🌙' : '🍎'}</span><div><strong>{meal.type}</strong><p>{meal.ingredients.map((item) => item.name).join(', ')}</p>{expanded && <small>P {total.protein} g · HC {total.carbs} g · G {total.fat} g · fibra {total.fiber} g</small>}</div><b>{Math.round(total.calories)} kcal</b></div>; }
function Macro({ name, current, target, color }: { name: string; current: number; target: number; color: string }) { const width = `${Math.min(100, (current / target) * 100)}%`; return <div className="macro-row"><div><strong>{name}</strong><span>{current.toFixed(1)} / {target} g</span></div><div className="bar"><span style={{ width, background: color }} /></div></div>; }
