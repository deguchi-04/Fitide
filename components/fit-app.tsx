'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  Apple,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Dumbbell,
  ExternalLink,
  Flame,
  HeartPulse,
  Home,
  CircleHelp,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings,
  Sparkles,
  TimerReset,
  Trash2,
  TrendingDown,
  Utensils,
  Waves,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
} from 'recharts';
import { Capacitor } from '@capacitor/core';
import { HealthFitness } from '@capacitor/health-fitness';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  bmr,
  calorieDeficit,
  fatEquivalentKg,
  roundNutrients,
  suggestedGoals,
  sumNutrients,
  tdee,
  weeksToGoal,
} from '@/lib/calculations';
import { defaultState } from '@/lib/default-state';
import type {
  Activity,
  AppState,
  IngredientEntry,
  Meal,
  Nutrients,
  Profile,
  HealthSnapshot,
  WorkoutPlan,
} from '@/lib/fit-types';
import {
  ijfTechniqueUrl,
  judoTechniques,
  KODOKAN_DEFINITIONS_URL,
  KODOKAN_TECHNIQUES_URL,
  type JudoCategory,
} from '@/lib/judo';
import { tacoFoods, TACO_URL } from '@/lib/taco';

type Page =
  | 'today'
  | 'meals'
  | 'workout'
  | 'judo'
  | 'calendar'
  | 'progress'
  | 'settings';
type ChartRange = 'week' | 'month' | 'year';
const pageLabels: Record<Page, string> = {
  today: 'Hoje',
  meals: 'Refeições',
  workout: 'Treino',
  judo: 'Judô',
  calendar: 'Calendário',
  progress: 'Progresso',
  settings: 'Definições',
};
const navItems = [
  { id: 'today' as Page, label: 'Hoje', icon: Home },
  { id: 'meals' as Page, label: 'Refeições', icon: Utensils },
  { id: 'workout' as Page, label: 'Treino', icon: Dumbbell },
  { id: 'judo' as Page, label: 'Judô', icon: BookOpen },
  { id: 'calendar' as Page, label: 'Calendário', icon: CalendarDays },
  { id: 'progress' as Page, label: 'Progresso', icon: Scale },
];
const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const fullDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const splitLabels: Record<string, string> = {
  full_body: 'Corpo inteiro',
  upper: 'Parte superior',
  lower: 'Parte inferior',
  push: 'Empurrar',
  pull: 'Puxar',
  legs: 'Pernas',
  core: 'Core',
};
const muscleOptions = [
  { value: 'chest', label: 'Peito' },
  { value: 'back', label: 'Costas' },
  { value: 'shoulders', label: 'Ombros' },
  { value: 'upper arms', label: 'Braços' },
  { value: 'lower arms', label: 'Antebraços' },
  { value: 'upper legs', label: 'Pernas' },
  { value: 'lower legs', label: 'Gémeos' },
  { value: 'waist', label: 'Abdominais' },
];
const activityPresets = [
  { name: 'Musculação', met: 5 },
  { name: 'Judô', met: 11.3 },
  { name: 'Futebol casual', met: 7 },
  { name: 'Futebol competitivo', met: 9.5 },
  { name: 'Corrida', met: 8 },
  { name: 'Caminhada rápida', met: 4.8 },
  { name: 'Bicicleta', met: 6.8 },
  { name: 'Natação', met: 6 },
  { name: 'Outro', met: 5 },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return row[b.length];
}

function foodMatchScore(query: string, name: string) {
  const cleanQuery = normalizeText(query);
  const cleanName = normalizeText(name);
  if (!cleanQuery) return 0;
  if (cleanName === cleanQuery) return 1000;
  if (cleanName.startsWith(cleanQuery)) return 900 - cleanName.length;
  if (cleanName.includes(cleanQuery))
    return 800 - cleanName.indexOf(cleanQuery);
  const nameTokens = cleanName.split(' ');
  return cleanQuery.split(' ').reduce((score, token) => {
    const best = Math.max(
      ...nameTokens.map((candidate) =>
        candidate.startsWith(token)
          ? 40
          : editDistance(token, candidate) <=
              Math.max(1, Math.floor(token.length / 3))
            ? 20
            : 0,
      ),
    );
    return score + best;
  }, 0);
}

function formatLiters(value: number) {
  return value.toFixed(3).replace('.', ',');
}

function FitideLogo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 7.5h17M7 15.5h12M7 7.5v17" />
      <path className="logo-accent" d="M17.5 24.5c3.7-1.2 6.2-3.9 7.5-8" />
    </svg>
  );
}

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
    intervalPresets: saved.intervalPresets ?? defaultState.intervalPresets,
    judoPractices: saved.judoPractices ?? [],
    healthSnapshots: saved.healthSnapshots ?? [],
  };
}

export default function FitApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [page, setPage] = useState<Page>('today');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<'loading' | 'saved' | 'saving' | 'error'>(
    'loading',
  );
  const [mealOpen, setMealOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch('/api/state')
      .then(
        (response) => response.json() as Promise<{ state: AppState | null }>,
      )
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
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
        .then((response) => {
          if (!response.ok) throw new Error('sync');
          setSync('saved');
        })
        .catch(() => setSync('error'));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [state, loaded]);

  const dayMeals = useMemo(
    () => state.meals.filter((meal) => meal.date === selectedDate),
    [state.meals, selectedDate],
  );
  const consumed = useMemo(
    () =>
      roundNutrients(
        sumNutrients(dayMeals.flatMap((meal) => meal.ingredients)),
      ),
    [dayMeals],
  );
  const water =
    state.water.find((entry) => entry.date === selectedDate)?.liters ?? 0;
  const remaining = Math.round(state.goals.calorieTarget - consumed.calories);
  const fastSeconds = state.activeFastStart
    ? Math.max(
        0,
        Math.floor((now - new Date(state.activeFastStart).getTime()) / 1000),
      )
    : 0;

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateWater(delta: number) {
    const liters = Math.max(0, Math.round((water + delta) * 1000) / 1000);
    patchState({
      water: [
        ...state.water.filter((entry) => entry.date !== selectedDate),
        { date: selectedDate, liters },
      ],
    });
  }

  function toggleFast() {
    if (state.activeFastStart) {
      patchState({
        fasts: [
          ...state.fasts,
          {
            id: uid(),
            start: state.activeFastStart,
            end: new Date().toISOString(),
          },
        ],
        activeFastStart: undefined,
      });
    } else {
      patchState({ activeFastStart: new Date().toISOString() });
    }
  }

  function addPastFast(startTime: string, endTime: string) {
    const start = new Date(`${selectedDate}T${startTime}:00`);
    const end = new Date(`${selectedDate}T${endTime}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);
    patchState({ fasts: [...state.fasts, { id: uid(), start: start.toISOString(), end: end.toISOString() }] });
  }

  async function resetProfile() {
    await fetch('/api/state', { method: 'DELETE' }).catch(() => undefined);
    setSelectedDate(localDateKey());
    setPage('today');
    setState({
      ...defaultState,
      profile: { ...defaultState.profile },
      goals: { ...defaultState.goals },
      activities: [], meals: [], weights: [], water: [], fasts: [], workoutPlans: [], workoutSessions: [],
      intervalPresets: [...defaultState.intervalPresets], judoPractices: [], healthSnapshots: [],
    });
  }

  if (!loaded) {
    return (
      <div className="loading-screen">
        <div className="brand-mark large">
          <span><FitideLogo /></span>
          <strong>Fitide</strong>
        </div>
        <LoaderCircle className="spin" />
        <p>A preparar o teu espaço pessoal…</p>
      </div>
    );
  }

  if (!state.profile.configured) {
    return <Onboarding state={state} onComplete={setState} />;
  }

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="brand-mark">
          <span><FitideLogo /></span>
          <strong>Fitide</strong>
        </div>
        <nav aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <button
          className={`nav-item settings ${page === 'settings' ? 'active' : ''}`}
          onClick={() => setPage('settings')}
        >
          <Settings />
          Definições
        </button>
      </aside>

      <section className="main-surface">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {new Date(`${selectedDate}T12:00:00`)
                .toLocaleDateString('pt-PT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
                .toUpperCase()}
            </p>
            <h1>
              {page === 'today'
                ? `Olá, ${state.profile.name.split(' ')[0]}!`
                : pageLabels[page]}
            </h1>
          </div>
          <div className="top-actions">
            <label className="date-pill">
              <CalendarDays />
              <input
                aria-label="Data selecionada"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <span
              className={`sync-dot ${sync}`}
              title={
                sync === 'saved'
                  ? 'Guardado'
                  : sync === 'saving'
                    ? 'A guardar'
                    : 'Não foi possível guardar'
              }
            />
            <button className="avatar" onClick={() => setPage('settings')}>
              {state.profile.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </button>
          </div>
        </header>

        {page === 'today' && (
          <TodayPage
            state={state}
            date={selectedDate}
            consumed={consumed}
            water={water}
            remaining={remaining}
            fastSeconds={fastSeconds}
            onWater={updateWater}
            onFast={toggleFast}
            onPastFast={addPastFast}
            onAddMeal={() => setMealOpen(true)}
            onGo={setPage}
          />
        )}
        {page === 'meals' && (
          <MealsPage
            meals={dayMeals}
            consumed={consumed}
            date={selectedDate}
            onAdd={() => setMealOpen(true)}
            onDelete={(id) =>
              patchState({
                meals: state.meals.filter((meal) => meal.id !== id),
              })
            }
          />
        )}
        {page === 'workout' && (
          <WorkoutPage state={state} setState={setState} date={selectedDate} onGoJudo={() => setPage('judo')} />
        )}
        {page === 'judo' && (
          <JudoPage state={state} setState={setState} date={selectedDate} />
        )}
        {page === 'calendar' && (
          <CalendarPage
            state={state}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onOpenDay={() => setPage('today')}
          />
        )}
        {page === 'progress' && (
          <ProgressPage state={state} setState={setState} />
        )}
        {page === 'settings' && (
          <SettingsPage
            state={state}
            setState={setState}
            onReset={resetProfile}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => setPage(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          className="add"
          aria-label="Adicionar refeição"
          onClick={() => setMealOpen(true)}
        >
          <Plus />
        </button>
        {navItems
          .filter((item) => item.id === 'workout' || item.id === 'progress')
          .map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
      </nav>

      {mealOpen && (
        <MealDialog
          date={selectedDate}
          onClose={() => setMealOpen(false)}
          onSave={(meal) => {
            patchState({ meals: [...state.meals, meal] });
            setMealOpen(false);
          }}
        />
      )}
    </main>
  );
}

function Onboarding({
  state,
  onComplete,
}: {
  state: AppState;
  onComplete: (state: AppState) => void;
}) {
  const [profile, setProfile] = useState<Profile>(state.profile);
  const [goal, setGoal] = useState(state.goals.kind);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextProfile = { ...profile, configured: true };
    onComplete({
      ...state,
      profile: nextProfile,
      goals: suggestedGoals(nextProfile, [], goal),
      weights: [
        {
          id: uid(),
          date: localDateKey(),
          weightKg: nextProfile.currentWeightKg,
          bodyFatPercent: nextProfile.bodyFatPercent,
        },
      ],
    });
  }
  return (
    <div className="onboarding-shell">
      <section className="onboarding-copy">
        <div className="brand-mark large">
          <span><FitideLogo /></span>
          <strong>Fitide</strong>
        </div>
        <div>
          <p className="eyebrow light">O TEU ESPAÇO PESSOAL</p>
          <h1>Um plano que começa em ti.</h1>
          <p>
            Nutrição, treino, jejum e progresso reunidos num painel privado e
            simples de usar.
          </p>
        </div>
        <div className="feature-notes">
          <span>
            <Check /> Metas calculadas e ajustáveis
          </span>
          <span>
            <Check /> Dados guardados com segurança
          </span>
          <span>
            <Check /> Treinos pensados para academia
          </span>
        </div>
      </section>
      <form className="onboarding-form" onSubmit={submit}>
        <div>
          <p className="eyebrow">COMEÇAR</p>
          <h2>Conta-me o essencial</h2>
          <p>
            Estes dados servem para calcular o metabolismo e as tuas metas
            iniciais.
          </p>
        </div>
        <Field label="Nome">
          <Input
            required
            value={profile.name}
            placeholder="Como te chamas?"
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </Field>
        <div className="form-grid three">
          <Field label="Idade">
            <NumberInput
              value={profile.age}
              min={13}
              max={100}
              onChange={(value) => setProfile({ ...profile, age: value })}
            />
          </Field>
          <Field label="Altura (cm)">
            <NumberInput
              value={profile.heightCm}
              min={120}
              max={230}
              onChange={(value) => setProfile({ ...profile, heightCm: value })}
            />
          </Field>
          <Field label="Sexo">
            <select
              value={profile.sex}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  sex: e.target.value as Profile['sex'],
                })
              }
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Peso atual (kg)">
            <NumberInput
              value={profile.currentWeightKg}
              min={30}
              max={250}
              step="0.1"
              onChange={(value) =>
                setProfile({ ...profile, currentWeightKg: value })
              }
            />
          </Field>
          <Field label="Peso objetivo (kg)">
            <NumberInput
              value={profile.targetWeightKg}
              min={30}
              max={250}
              step="0.1"
              onChange={(value) =>
                setProfile({ ...profile, targetWeightKg: value })
              }
            />
          </Field>
        </div>
        <div className="form-grid three optional-grid">
          <Field label="% gordura atual · opcional">
            <NumberInput
              value={profile.bodyFatPercent ?? ''}
              min={1}
              max={70}
              step="0.1"
              onChange={(value) =>
                setProfile({ ...profile, bodyFatPercent: value || undefined })
              }
            />
          </Field>
          <Field label="% gordura objetivo · opcional">
            <NumberInput
              value={profile.targetBodyFatPercent ?? ''}
              min={1}
              max={70}
              step="0.1"
              onChange={(value) =>
                setProfile({
                  ...profile,
                  targetBodyFatPercent: value || undefined,
                })
              }
            />
          </Field>
          <Field label="% massa magra · opcional">
            <NumberInput
              value={profile.leanMassPercent ?? ''}
              min={20}
              max={100}
              step="0.1"
              onChange={(value) =>
                setProfile({ ...profile, leanMassPercent: value || undefined })
              }
            />
          </Field>
        </div>
        <Field label="Objetivo principal">
          <div className="goal-options">
            {(['lose_fat', 'maintain', 'gain_muscle'] as const).map((item) => (
              <button
                type="button"
                className={goal === item ? 'selected' : ''}
                onClick={() => setGoal(item)}
                key={item}
              >
                {item === 'lose_fat'
                  ? 'Perder gordura'
                  : item === 'maintain'
                    ? 'Manter peso'
                    : 'Ganhar músculo'}
              </button>
            ))}
          </div>
        </Field>
        <Button size="lg" type="submit" className="wide-button">
          Criar o meu plano <ChevronRight />
        </Button>
        <small>
          Estimativas orientativas. Para necessidades clínicas, consulta um
          profissional de saúde.
        </small>
      </form>
    </div>
  );
}

function TodayPage({
  state,
  date,
  consumed,
  water,
  remaining,
  fastSeconds,
  onWater,
  onFast,
  onPastFast,
  onAddMeal,
  onGo,
}: {
  state: AppState;
  date: string;
  consumed: Nutrients;
  water: number;
  remaining: number;
  fastSeconds: number;
  onWater: (delta: number) => void;
  onFast: () => void;
  onPastFast: (startTime: string, endTime: string) => void;
  onAddMeal: () => void;
  onGo: (page: Page) => void;
}) {
  const caloriePercent = Math.min(
    100,
    Math.round((consumed.calories / state.goals.calorieTarget) * 100),
  );
  const selectedDay = new Date(`${date}T12:00:00`).getDay();
  const isToday = date === localDateKey();
  const activePlan = state.workoutPlans
    .filter((plan) => plan.days?.includes(selectedDay))
    .sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'))[0];
  const maintenance = tdee(state.profile, state.activities);
  const deficit = calorieDeficit(maintenance, state.goals.calorieTarget);
  const weeklyFat = fatEquivalentKg(deficit);
  const health = state.healthSnapshots.find((entry) => entry.date === date);
  const [pastFastStart, setPastFastStart] = useState('20:00');
  const [pastFastEnd, setPastFastEnd] = useState('12:00');
  const macroPie = [
    { name: 'Proteína', value: Math.round(consumed.protein * 4), fill: '#168fbd' },
    { name: 'Hidratos', value: Math.round(consumed.carbs * 4), fill: '#ef6f4c' },
    { name: 'Gordura', value: Math.round(consumed.fat * 9), fill: '#70463b' },
  ].filter((item) => item.value > 0);
  return (
    <div className="dashboard-grid page-enter">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="status-pill">
            <TrendingDown />{' '}
            {remaining >= 0 ? 'Dentro do objetivo' : 'Objetivo ultrapassado'}
          </span>
          <p className="eyebrow light">{isToday ? 'BALANÇO DE HOJE' : 'BALANÇO DO DIA'}</p>
          <h2>{Math.abs(remaining).toLocaleString('pt-PT')} kcal</h2>
          <p>
            {remaining >= 0
              ? 'ainda disponíveis no teu objetivo diário'
              : 'acima do teu objetivo diário'}
          </p>
          <div className="hero-progress">
            <span style={{ width: `${caloriePercent}%` }} />
          </div>
          <div className="hero-caption">
            <span>
              {Math.round(consumed.calories).toLocaleString('pt-PT')} consumidas
            </span>
            <span>
              {state.goals.calorieTarget.toLocaleString('pt-PT')} objetivo
            </span>
          </div>
        </div>
        <div
          className="goal-ring"
          style={{
            background: `conic-gradient(#ef6f4c 0 ${caloriePercent}%, rgba(255,255,255,.13) ${caloriePercent}% 100%)`,
          }}
        >
          <div>
            <strong>{caloriePercent}%</strong>
            <span>do dia</span>
          </div>
        </div>
      </section>
      <section className="metrics-grid">
        <Metric
          label="Consumidas"
          value={Math.round(consumed.calories).toLocaleString('pt-PT')}
          unit="kcal"
          icon={Apple}
          tone="plum"
        />
        <Metric
          label="Gasto diário estimado"
          value={maintenance.toLocaleString('pt-PT')}
          unit="kcal/dia"
          icon={Flame}
          tone="orange"
        />
        <Metric
          label="Défice planeado"
          value={deficit.toLocaleString('pt-PT')}
          unit={`kcal/dia · ≈ ${weeklyFat.toFixed(2).replace('.', ',')} kg gordura/semana`}
          icon={TrendingDown}
          tone="green"
        />
        <Metric
          label="Água"
          value={formatLiters(water)}
          unit={`de ${state.goals.waterLiters} L`}
          icon={Waves}
          tone="blue"
        />
      </section>
      {health && (
        <section className="health-strip">
          <div><HeartPulse /><span><small>Health Connect</small><strong>{health.steps?.toLocaleString('pt-PT') ?? '—'} passos</strong></span></div>
          <div><small>Calorias ativas</small><strong>{health.activeCalories === undefined ? '—' : `${Math.round(health.activeCalories)} kcal`}</strong></div>
          <div><small>Frequência média</small><strong>{health.averageHeartRate === undefined ? '—' : `${Math.round(health.averageHeartRate)} bpm`}</strong></div>
          <div><small>Sono</small><strong>{health.sleepMinutes === undefined ? '—' : `${Math.floor(health.sleepMinutes / 60)}h ${Math.round(health.sleepMinutes % 60)}m`}</strong></div>
        </section>
      )}
      <Card className="panel meals-panel">
        <CardHeader className="panel-heading">
          <div>
            <p className="eyebrow">ALIMENTAÇÃO</p>
            <CardTitle>{isToday ? 'Refeições de hoje' : 'Refeições deste dia'}</CardTitle>
          </div>
          <Button variant="ghost" onClick={onAddMeal}>
            <Plus /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {state.meals.filter((meal) => meal.date === date).length ? (
            state.meals
              .filter((meal) => meal.date === date)
              .slice(-3)
              .map((meal) => <MealRow meal={meal} key={meal.id} />)
          ) : (
            <EmptyState
              icon={Utensils}
              title="Ainda sem refeições"
              text="Adiciona a primeira refeição do dia."
              action="Registar refeição"
              onClick={onAddMeal}
            />
          )}
        </CardContent>
      </Card>
      <Card className="panel training-panel">
        <CardHeader className="panel-heading">
          <div>
            <p className="eyebrow">TREINO</p>
            <CardTitle>{activePlan?.name ?? 'Plano por criar'}</CardTitle>
          </div>
          <div className="round-icon">
            <Dumbbell />
          </div>
        </CardHeader>
        <CardContent>
          {activePlan ? (
            <>
              <div className="training-meta">
                <span>{activePlan.exercises.length} exercícios</span>
              <span>{activePlan.time ?? 'Sem hora'}</span>
                <span>{activePlan.source}</span>
              </div>
              <div className="exercise-stack">
                {activePlan.exercises.slice(0, 2).map((exercise, index) => (
                  <div key={exercise.id}>
                    <span>0{index + 1}</span>
                    <p>
                      <strong>{exercise.name}</strong>
                      <small>
                        {exercise.sets} × {exercise.reps} ·{' '}
                        {exercise.restSeconds} s
                      </small>
                    </p>
                  </div>
                ))}
              </div>
              <Button className="wide-button" onClick={() => onGo('workout')}>
                <Dumbbell /> Abrir treino
              </Button>
            </>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Cria o teu primeiro plano"
              text="Agenda uma rotina nos dias certos dentro das Definições."
              action="Configurar rotina"
              onClick={() => onGo('settings')}
            />
          )}
        </CardContent>
      </Card>
      <Card className="panel water-fast-panel">
        <CardHeader>
          <p className="eyebrow">HÁBITOS</p>
          <CardTitle>Água & jejum</CardTitle>
        </CardHeader>
        <CardContent className="habit-grid">
          <div>
            <div className="habit-heading">
              <Waves />
              <span>
                <strong>{formatLiters(water)} L</strong>
                <small>de {state.goals.waterLiters} L</small>
              </span>
            </div>
            <Progress value={(water / state.goals.waterLiters) * 100} />
            <div className="stepper">
              <Button
                variant="outline"
                size="icon"
                aria-label="Retirar 250 ml"
                onClick={() => onWater(-0.25)}
              >
                <Minus />
              </Button>
              <Button onClick={() => onWater(0.25)}>+ 250 ml</Button>
            </div>
          </div>
          <div>
            <div className="habit-heading">
              <TimerReset />
              <span>
                <strong>
                  {state.activeFastStart
                    ? formatDuration(fastSeconds)
                    : `${state.goals.fastingHours}:00 h`}
                </strong>
                <small>
                  {state.activeFastStart
                    ? 'jejum em curso'
                    : 'meta configurada'}
                </small>
              </span>
            </div>
            {isToday ? (
              <Button className="wide-button" variant={state.activeFastStart ? 'outline' : 'default'} onClick={onFast}>
                {state.activeFastStart ? <CirclePause /> : <CirclePlay />}
                {state.activeFastStart ? 'Terminar jejum' : 'Começar jejum'}
              </Button>
            ) : (
              <div className="past-fast-form">
                <label><span>Início</span><Input type="time" value={pastFastStart} onChange={(event) => setPastFastStart(event.target.value)} /></label>
                <label><span>Fim</span><Input type="time" value={pastFastEnd} onChange={(event) => setPastFastEnd(event.target.value)} /></label>
                <Button onClick={() => onPastFast(pastFastStart, pastFastEnd)}><Plus /> Registar jejum</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="panel macros-panel">
        <CardHeader className="panel-heading">
          <div>
            <p className="eyebrow">NUTRIÇÃO</p>
            <CardTitle>Macros do dia</CardTitle>
          </div>
          <Button variant="ghost" onClick={() => onGo('settings')}>
            Ajustar metas
          </Button>
        </CardHeader>
        <CardContent className="macro-overview">
          <div className="macro-pie">
            {macroPie.length ? (
              <ChartContainer className="h-[220px] w-full" config={{ protein: { label: 'Proteína', color: '#168fbd' } }}>
                <PieChart><ChartTooltip content={<ChartTooltipContent nameKey="name" />} /><Pie data={macroPie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} /></PieChart>
              </ChartContainer>
            ) : (
              <EmptyState icon={Apple} title="Ainda sem macros" text="Adiciona uma refeição para veres a distribuição." />
            )}
            <small>Distribuição calórica entre proteína, hidratos e gordura</small>
          </div>
          <div className="macro-bars">
            <Macro name="Proteína" current={consumed.protein} target={state.goals.proteinG} color="var(--plum)" />
            <Macro name="Hidratos" current={consumed.carbs} target={state.goals.carbsG} color="var(--orange)" />
            <Macro name="Gordura" current={consumed.fat} target={state.goals.fatG} color="var(--green)" />
            <Macro name="Fibra" current={consumed.fiber} target={state.goals.fiberG} color="var(--blue)" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MealsPage({
  meals,
  consumed,
  date,
  onAdd,
  onDelete,
}: {
  meals: Meal[];
  consumed: Nutrients;
  date: string;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">DIÁRIO ALIMENTAR</p>
          <h2>
            {new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', {
              day: 'numeric',
              month: 'long',
            })}
          </h2>
          <p>
            Regista por ingrediente; os totais são calculados automaticamente.
          </p>
        </div>
        <Button size="lg" onClick={onAdd}>
          <Plus /> Nova refeição
        </Button>
      </section>
      <section className="summary-strip">
        <MiniStat
          label="Energia"
          value={`${Math.round(consumed.calories)} kcal`}
        />
        <MiniStat label="Proteína" value={`${consumed.protein.toFixed(1)} g`} />
        <MiniStat label="Fibra" value={`${consumed.fiber.toFixed(1)} g`} />
        <MiniStat
          label="Vitamina C"
          value={`${consumed.vitaminC.toFixed(1)} mg`}
        />
      </section>
      <div className="meal-list">
        {meals.length ? (
          meals.map((meal) => (
            <Card key={meal.id} className="meal-card">
              <CardContent>
                <MealRow meal={meal} expanded />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar refeição"
                  onClick={() => onDelete(meal.id)}
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="panel">
            <CardContent>
              <EmptyState
                icon={Utensils}
                title="O diário está vazio"
                text="Usa a TACO ou informa os valores do rótulo para começar."
                action="Adicionar refeição"
                onClick={onAdd}
              />
            </CardContent>
          </Card>
        )}
      </div>
      <p className="source-note">
        Referência nutricional:{' '}
        <a href={TACO_URL} target="_blank" rel="noreferrer">
          TACO 4.ª edição, NEPA/UNICAMP
        </a>
        . Valores por 100 g e arredondados.
      </p>
    </div>
  );
}

function MealDialog({
  date,
  onClose,
  onSave,
}: {
  date: string;
  onClose: () => void;
  onSave: (meal: Meal) => void;
}) {
  const [type, setType] = useState('Almoço');
  const [mode, setMode] = useState<'TACO' | 'Rótulo'>('TACO');
  const [foodId, setFoodId] = useState(tacoFoods[0].id);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const [grams, setGrams] = useState(100);
  const [manualName, setManualName] = useState('');
  const [manual, setManual] = useState<Nutrients>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    calcium: 0,
    iron: 0,
    vitaminC: 0,
  });
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const total = roundNutrients(sumNutrients(ingredients));
  const selectedFood = tacoFoods.find((food) => food.id === foodId);
  const foodMatches = useMemo(() => {
    if (!foodQuery.trim()) return tacoFoods.slice(0, 8);
    return tacoFoods
      .map((food) => ({ food, score: foodMatchScore(foodQuery, food.name) }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.food.name.localeCompare(b.food.name, 'pt'),
      )
      .slice(0, 8)
      .map(({ food }) => food);
  }, [foodQuery]);

  function addIngredient() {
    if (mode === 'TACO') {
      const food =
        tacoFoods.find((item) => item.id === foodId) ?? foodMatches[0];
      if (!food) return;
      const factor = grams / 100;
      setIngredients([
        ...ingredients,
        {
          id: uid(),
          name: food.name,
          grams,
          source: 'TACO',
          ...roundNutrients({
            calories: food.calories * factor,
            protein: food.protein * factor,
            carbs: food.carbs * factor,
            fat: food.fat * factor,
            fiber: food.fiber * factor,
            calcium: food.calcium * factor,
            iron: food.iron * factor,
            vitaminC: food.vitaminC * factor,
          }),
        },
      ]);
      setFoodQuery('');
    } else if (manualName.trim()) {
      setIngredients([
        ...ingredients,
        {
          id: uid(),
          name: manualName.trim(),
          grams,
          source: 'Rótulo',
          ...manual,
        },
      ]);
      setManualName('');
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-title"
      >
        <header>
          <div>
            <p className="eyebrow">NOVA REFEIÇÃO</p>
            <h2 id="meal-title">O que comeste?</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        </header>
        <div className="dialog-scroll">
          <div className="form-grid two">
            <Field label="Tipo de refeição">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {['Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar', 'Ceia'].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Fonte">
              <div className="segmented">
                <button
                  className={mode === 'TACO' ? 'selected' : ''}
                  onClick={() => setMode('TACO')}
                  type="button"
                >
                  Tabela TACO
                </button>
                <button
                  className={mode === 'Rótulo' ? 'selected' : ''}
                  onClick={() => setMode('Rótulo')}
                  type="button"
                >
                  Rótulo
                </button>
              </div>
            </Field>
          </div>
          {mode === 'TACO' ? (
            <div className="form-grid ingredient-input">
              <Field label="Pesquisar alimento">
                <div className="food-search">
                  <Input
                    value={foodQuery}
                    autoComplete="off"
                    placeholder="Ex.: arroz integral, banana, frango…"
                    onFocus={() => setFoodSearchOpen(true)}
                    onChange={(event) => {
                      setFoodQuery(event.target.value);
                      setFoodSearchOpen(true);
                    }}
                  />
                  {foodSearchOpen && (
                    <div className="food-results">
                      {foodMatches.length ? (
                        foodMatches.map((food) => (
                          <button
                            type="button"
                            key={food.id}
                            onClick={() => {
                              setFoodId(food.id);
                              setFoodQuery(food.name);
                              setFoodSearchOpen(false);
                            }}
                          >
                            <strong>{food.name}</strong>
                            <small>{Math.round(food.calories)} kcal / 100 g</small>
                          </button>
                        ))
                      ) : (
                        <p>Não encontrei um alimento semelhante.</p>
                      )}
                    </div>
                  )}
                </div>
                <small className="field-hint">
                  {selectedFood
                    ? `Selecionado: ${selectedFood.name}`
                    : 'Escreve parte do nome para pesquisar nos 597 alimentos da TACO.'}
                </small>
              </Field>
              <Field label="Peso (g)">
                <NumberInput value={grams} min={1} max={2000} onChange={setGrams} />
              </Field>
              <Button type="button" onClick={addIngredient}>
                <Plus /> Adicionar
              </Button>
            </div>
          ) : (
            <div className="manual-food">
              <div className="form-grid two">
                <Field label="Nome">
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ex.: iogurte proteico"
                  />
                </Field>
                <Field label="Peso da porção (g)">
                  <NumberInput value={grams} min={1} max={2000} onChange={setGrams} />
                </Field>
              </div>
              <p className="field-hint">Valores para a porção consumida</p>
              <div className="form-grid four">
                {(
                  [
                    'calories',
                    'protein',
                    'carbs',
                    'fat',
                    'fiber',
                    'calcium',
                    'iron',
                    'vitaminC',
                  ] as const
                ).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === 'calories'
                        ? 'kcal'
                        : key === 'protein'
                          ? 'Proteína g'
                          : key === 'carbs'
                            ? 'Hidratos g'
                            : key === 'fat'
                              ? 'Gordura g'
                              : key === 'fiber'
                                ? 'Fibra g'
                                : key === 'calcium'
                                  ? 'Cálcio mg'
                                  : key === 'iron'
                                    ? 'Ferro mg'
                                    : 'Vit. C mg'
                    }
                  >
                    <NumberInput
                      value={manual[key]}
                      max={key === 'calories' || key === 'calcium' ? 3000 : key === 'vitaminC' ? 1000 : 500}
                      step={key === 'calories' || key === 'calcium' ? '1' : '0.1'}
                      onChange={(value) =>
                        setManual({ ...manual, [key]: value })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Button type="button" onClick={addIngredient}>
                <Plus /> Adicionar ingrediente
              </Button>
            </div>
          )}
          <div className="ingredient-list">
            <div className="ingredient-head">
              <strong>Ingredientes</strong>
              <span>{ingredients.length}</span>
            </div>
            {ingredients.map((item) => (
              <div className="ingredient-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.grams} g · {item.source}
                  </small>
                </div>
                <span>{Math.round(item.calories)} kcal</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${item.name}`}
                  onClick={() =>
                    setIngredients(
                      ingredients.filter((entry) => entry.id !== item.id),
                    )
                  }
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
          <div className="nutrition-total">
            <MiniStat
              label="Total"
              value={`${Math.round(total.calories)} kcal`}
            />
            <MiniStat label="Proteína" value={`${total.protein} g`} />
            <MiniStat label="Hidratos" value={`${total.carbs} g`} />
            <MiniStat label="Fibra" value={`${total.fiber} g`} />
          </div>
        </div>
        <footer>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!ingredients.length}
            onClick={() =>
              onSave({
                id: uid(),
                date,
                type,
                ingredients,
                createdAt: new Date().toISOString(),
              })
            }
          >
            <Save /> Guardar refeição
          </Button>
        </footer>
      </section>
    </div>
  );
}

function WorkoutPage({
  state,
  setState,
  date,
  onGoJudo,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  date: string;
  onGoJudo: () => void;
}) {
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completedSets, setCompletedSets] = useState<string[]>([]);
  const [rest, setRest] = useState(0);
  const [setValues, setSetValues] = useState<Record<string, { load: number | ''; reps: number | '' }>>({});
  const selectedDay = new Date(`${date}T12:00:00`).getDay();
  const duePlans = state.workoutPlans
    .filter((plan) => plan.days?.includes(selectedDay))
    .sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'));

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setRest((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  function startWorkout(plan: WorkoutPlan) {
    setActivePlan(plan);
    setStartedAt(Date.now());
    setElapsed(0);
    setCompletedSets([]);
    setRest(0);
    setSetValues({});
  }

  function finishWorkout() {
    if (!activePlan || !startedAt) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const calories = Math.round(
      5 * state.profile.currentWeightKg * (minutes / 60),
    );
    setState((current) => ({
      ...current,
      workoutSessions: [
        ...current.workoutSessions,
        {
          id: uid(),
          date,
          planName: activePlan.name,
          minutes,
          completedSets: completedSets.length,
          calories,
        },
      ],
    }));
    setActivePlan(null);
    setStartedAt(null);
    setElapsed(0);
    setCompletedSets([]);
    setRest(0);
  }

  if (activePlan)
    return (
      <div className="content-page workout-live page-enter">
        <section className="live-header">
          <Button variant="ghost" onClick={() => setActivePlan(null)}>
            <ArrowLeft /> Sair
          </Button>
          <div>
            <p className="eyebrow">TREINO EM CURSO</p>
            <h2>{activePlan.name}</h2>
          </div>
          <div className="live-timer">
            <TimerReset />
            <strong>{formatDuration(elapsed)}</strong>
          </div>
        </section>
        {rest > 0 && (
          <div className="rest-banner">
            <span>
              <CirclePause /> Descanso
            </span>
            <strong>{formatDuration(rest)}</strong>
            <Button size="sm" variant="ghost" onClick={() => setRest(0)}>
              Saltar
            </Button>
          </div>
        )}
        <div className="live-exercises">
          {activePlan.exercises.map((exercise, exerciseIndex) => (
            <Card key={exercise.id} className="live-exercise">
              <CardHeader>
                <div className="exercise-number">
                  {String(exerciseIndex + 1).padStart(2, '0')}
                </div>
                <div>
                  <CardTitle>{exercise.name}</CardTitle>
                  <CardDescription>
                    {exercise.target} · {exercise.equipment}
                  </CardDescription>
                </div>
                <span>
                  {exercise.sets} × {exercise.reps}
                </span>
              </CardHeader>
              <CardContent>
                {exercise.gifUrl && (
                  <div className="exercise-gif">
                    <img
                      src={exercise.gifUrl}
                      alt={`Demonstração de ${exercise.name}`}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="set-table">
                  <div>
                    <span>Série</span>
                    <span>Carga (kg)</span>
                    <span>Reps</span>
                    <span>Feito</span>
                  </div>
                  {Array.from({ length: exercise.sets }).map((_, setIndex) => {
                    const key = `${exercise.id}-${setIndex}`;
                    const done = completedSets.includes(key);
                    const values = setValues[key] ?? { load: '', reps: '' };
                    return (
                      <div key={key} className={done ? 'done' : ''}>
                        <strong>{setIndex + 1}</strong>
                        <NumberInput
                          ariaLabel={`Carga da série ${setIndex + 1}`}
                          value={values.load}
                          min={0}
                          max={400}
                          step="0.5"
                          onChange={(load) =>
                            setSetValues((current) => ({
                              ...current,
                              [key]: { ...values, load },
                            }))
                          }
                        />
                        <NumberInput
                          ariaLabel={`Repetições da série ${setIndex + 1}`}
                          value={values.reps}
                          min={1}
                          max={50}
                          onChange={(reps) =>
                            setSetValues((current) => ({
                              ...current,
                              [key]: { ...values, reps },
                            }))
                          }
                        />
                        <Button
                          size="icon"
                          aria-label={done ? 'Desmarcar série' : 'Concluir série'}
                          variant={done ? 'default' : 'outline'}
                          onClick={() => {
                            if (done)
                              setCompletedSets(
                                completedSets.filter((item) => item !== key),
                              );
                            else {
                              setCompletedSets([...completedSets, key]);
                              setRest(exercise.restSeconds);
                            }
                          }}
                        >
                          {done ? <Check /> : <span />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button size="lg" className="finish-workout" onClick={finishWorkout}>
          <Check /> Terminar treino
        </Button>
      </div>
    );

  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">TREINO DO DIA</p>
          <h2>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <p>As sessões agendadas aparecem por ordem de hora.</p>
        </div>
        <div className="page-intro-actions">
          <Button variant="outline" size="lg" onClick={onGoJudo}>
            <BookOpen /> Área de judô
          </Button>
          {duePlans[0] && (
            <Button size="lg" onClick={() => startWorkout(duePlans[0])}>
              <CirclePlay /> Começar treino
            </Button>
          )}
        </div>
      </section>
      <div className="workout-day-list">
          <TrainingTimer state={state} setState={setState} />
          {duePlans.length ? (
            duePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onStart={() => startWorkout(plan)}
              />
            ))
          ) : (
            <Card className="panel plan-empty">
              <CardContent>
                <EmptyState
                  icon={Dumbbell}
                  title="Sem treino agendado"
                  text="Adiciona uma rotina semanal nas Definições e escolhe os dias e a hora."
                />
              </CardContent>
            </Card>
          )}
          {state.workoutSessions.length > 0 && (
            <Card className="panel history-card">
              <CardHeader>
                <CardTitle>Últimos treinos</CardTitle>
              </CardHeader>
              <CardContent>
                {state.workoutSessions
                  .slice(-4)
                  .reverse()
                  .map((session) => (
                    <div className="history-row" key={session.id}>
                      <Dumbbell />
                      <div>
                        <strong>{session.planName}</strong>
                        <small>
                          {new Date(
                            `${session.date}T12:00:00`,
                          ).toLocaleDateString('pt-PT')}{' '}
                          · {session.completedSets} séries
                        </small>
                      </div>
                      <span>{session.minutes} min</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onStart,
  onDelete,
}: {
  plan: WorkoutPlan;
  onStart: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className="panel plan-card">
      <CardHeader className="panel-heading">
        <div>
          <p className="eyebrow">ROTINA SUGERIDA</p>
          <CardTitle>{plan.name}</CardTitle>
        </div>
        <div className="plan-actions">
          {plan.time && <span className="time-badge">{plan.time}</span>}
          <span className={`source-badge ${plan.source === 'WorkoutX' ? 'live' : ''}`}>
            {plan.source}
          </span>
          {onDelete && (
            <Button type="button" variant="ghost" size="icon" aria-label={`Apagar rotina ${plan.name}`} onClick={onDelete}>
              <Trash2 />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="plan-list">
          {plan.exercises.map((exercise, index) => (
            <div key={exercise.id}>
              {exercise.gifUrl ? (
                <img className="plan-exercise-gif" src={exercise.gifUrl} alt={`Demonstração de ${exercise.name}`} loading="lazy" />
              ) : (
                <span>{String(index + 1).padStart(2, '0')}</span>
              )}
              <div>
                <strong>{exercise.name}</strong>
                <small>
                  {exercise.target} · {exercise.equipment}
                </small>
              </div>
              <b>
                {exercise.sets} × {exercise.reps}
              </b>
            </div>
          ))}
        </div>
        <Button size="lg" className="wide-button" onClick={onStart}>
          <CirclePlay /> Começar este treino
        </Button>
      </CardContent>
    </Card>
  );
}

function TrainingTimer({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [mode, setMode] = useState<'interval' | 'free'>('interval');
  const [name, setName] = useState('Novo intervalado');
  const [workSeconds, setWorkSeconds] = useState(120);
  const [restSeconds, setRestSeconds] = useState(60);
  const [rounds, setRounds] = useState(7);
  const [phase, setPhase] = useState<'work' | 'rest' | 'done'>('work');
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(120);
  const [freeElapsed, setFreeElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  function resetTimer() {
    setRunning(false);
    setPhase('work');
    setRound(1);
    setRemaining(workSeconds);
    setFreeElapsed(0);
  }

  function nextPhase() {
    if (phase === 'work') {
      if (round >= rounds) {
        setPhase('done');
        setRemaining(0);
        setRunning(false);
      } else if (restSeconds > 0) {
        setPhase('rest');
        setRemaining(restSeconds);
      } else {
        setRound((value) => value + 1);
        setRemaining(workSeconds);
      }
    } else if (phase === 'rest') {
      setRound((value) => value + 1);
      setPhase('work');
      setRemaining(workSeconds);
    }
  }

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (mode === 'free') {
        setFreeElapsed((value) => value + 1);
        return;
      }
      setRemaining((value) => {
        if (value > 1) return value - 1;
        window.setTimeout(nextPhase, 0);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, mode, phase, round, rounds, restSeconds, workSeconds]);

  function loadPreset(id: string) {
    const preset = state.intervalPresets.find((item) => item.id === id);
    if (!preset) return;
    setName(preset.name);
    setWorkSeconds(preset.workSeconds);
    setRestSeconds(preset.restSeconds);
    setRounds(preset.rounds);
    setRunning(false);
    setPhase('work');
    setRound(1);
    setRemaining(preset.workSeconds);
  }

  function savePreset() {
    const preset = {
      id: uid(),
      name: name.trim() || 'Treino intervalado',
      workSeconds,
      restSeconds,
      rounds,
    };
    setState((current) => ({
      ...current,
      intervalPresets: [...current.intervalPresets, preset],
    }));
  }

  return (
    <Card className="panel interval-card">
      <CardHeader className="panel-heading">
        <div>
          <p className="eyebrow">CRONÓMETRO</p>
          <CardTitle>Timer de treino</CardTitle>
          <CardDescription>Intervalos personalizados ou treino livre.</CardDescription>
        </div>
        <div className="segmented compact">
          <button type="button" className={mode === 'interval' ? 'selected' : ''} onClick={() => { setMode('interval'); resetTimer(); }}>Intervalado</button>
          <button type="button" className={mode === 'free' ? 'selected' : ''} onClick={() => { setMode('free'); resetTimer(); }}>Livre</button>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'interval' ? (
          <>
            <div className={`timer-stage ${phase}`}>
              <span>{phase === 'work' ? 'TRABALHO' : phase === 'rest' ? 'DESCANSO' : 'CONCLUÍDO'}</span>
              <strong>{formatDuration(remaining)}</strong>
              <small>Ronda {round} de {rounds}</small>
            </div>
            <div className="timer-actions">
              <Button type="button" size="lg" onClick={() => { if (phase === 'done') resetTimer(); setRunning((value) => !value); }}>
                {running ? <CirclePause /> : <CirclePlay />}{running ? 'Pausar' : phase === 'done' ? 'Recomeçar' : 'Iniciar'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={nextPhase}>Saltar fase</Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Repor timer" onClick={resetTimer}><RotateCcw /></Button>
            </div>
            <div className="interval-builder">
              <Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="Trabalho (seg)"><NumberInput value={workSeconds} min={5} max={3600} step="5" onChange={(value) => { setWorkSeconds(value); if (!running) setRemaining(value); }} /></Field>
              <Field label="Descanso (seg)"><NumberInput value={restSeconds} min={0} max={1800} step="5" onChange={setRestSeconds} /></Field>
              <Field label="Repetições"><NumberInput value={rounds} min={1} max={100} onChange={setRounds} /></Field>
              <Button type="button" variant="outline" onClick={savePreset}><Save /> Guardar predefinição</Button>
            </div>
            {!!state.intervalPresets.length && (
              <div className="preset-list">
                {state.intervalPresets.map((preset) => (
                  <div key={preset.id}>
                    <button type="button" onClick={() => loadPreset(preset.id)}><strong>{preset.name}</strong><small>{formatDuration(preset.workSeconds)} / {formatDuration(preset.restSeconds)} · {preset.rounds}×</small></button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${preset.name}`} onClick={() => setState((current) => ({ ...current, intervalPresets: current.intervalPresets.filter((item) => item.id !== preset.id) }))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="timer-stage free"><span>TREINO LIVRE</span><strong>{formatDuration(freeElapsed)}</strong><small>Conta o tempo sem limite</small></div>
            <div className="timer-actions">
              <Button type="button" size="lg" onClick={() => setRunning((value) => !value)}>{running ? <CirclePause /> : <CirclePlay />}{running ? 'Pausar' : 'Iniciar'}</Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Repor cronómetro" onClick={resetTimer}><RotateCcw /></Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const judoCategoryLabels: Record<JudoCategory | 'Todas', string> = {
  Todas: 'Todas',
  'Te-waza': 'Braços',
  'Koshi-waza': 'Anca',
  'Ashi-waza': 'Pernas',
  'Sutemi-waza': 'Sacrifício',
  'Osaekomi-waza': 'Imobilizações',
  'Shime-waza': 'Estrangulamentos',
  'Kansetsu-waza': 'Chaves',
};

function JudoPage({
  state,
  setState,
  date,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  date: string;
}) {
  const [category, setCategory] = useState<JudoCategory | 'Todas'>('Todas');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(90);
  const [uchikomi, setUchikomi] = useState(0);
  const [randoriRounds, setRandoriRounds] = useState(0);
  const [randoriMinutes, setRandoriMinutes] = useState(4);
  const [notes, setNotes] = useState('');
  const filteredTechniques = judoTechniques.filter((item) =>
    (category === 'Todas' || item.category === category) &&
    normalizeText(`${item.name} ${item.japanese}`).includes(normalizeText(query)),
  );
  const totalRandori = state.judoPractices.reduce((sum, item) => sum + item.randoriRounds * item.randoriMinutes, 0);
  const uniqueTechniques = new Set(state.judoPractices.flatMap((item) => item.techniqueIds)).size;

  function savePractice() {
    setState((current) => ({
      ...current,
      judoPractices: [
        ...current.judoPractices,
        {
          id: uid(), date, durationMinutes: duration, techniqueIds: selected,
          uchikomiReps: uchikomi, randoriRounds, randoriMinutes, notes: notes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setSelected([]);
    setNotes('');
  }

  return (
    <div className="content-page page-enter judo-page">
      <section className="page-intro">
        <div><p className="eyebrow">DOJO PESSOAL</p><h2>Judô, técnica por técnica</h2><p>Regista o treino, revê o teu repertório e abre demonstrações oficiais.</p></div>
        <div className="judo-source-actions">
          <a className="button-link outline" href={KODOKAN_DEFINITIONS_URL} target="_blank" rel="noreferrer"><BookOpen /> Definições Kodokan</a>
          <a className="button-link" href={KODOKAN_TECHNIQUES_URL} target="_blank" rel="noreferrer"><ExternalLink /> 100 técnicas oficiais</a>
        </div>
      </section>
      <section className="judo-summary">
        <MiniStat label="Treinos registados" value={String(state.judoPractices.length)} />
        <MiniStat label="Técnicas praticadas" value={String(uniqueTechniques)} />
        <MiniStat label="Randori acumulado" value={`${totalRandori} min`} />
      </section>
      <div className="judo-layout">
        <Card className="panel judo-log-card">
          <CardHeader><CardTitle>Registar treino de {new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT')}</CardTitle><CardDescription>Um diário curto para orientar a próxima sessão.</CardDescription></CardHeader>
          <CardContent>
            <div className="form-grid four">
              <Field label="Duração (min)"><NumberInput value={duration} min={5} max={360} step="5" onChange={setDuration} /></Field>
              <Field label="Uchikomi (reps)"><NumberInput value={uchikomi} min={0} max={2000} step="10" onChange={setUchikomi} /></Field>
              <Field label="Rondas randori"><NumberInput value={randoriRounds} min={0} max={50} onChange={setRandoriRounds} /></Field>
              <Field label="Min/ronda"><NumberInput value={randoriMinutes} min={1} max={20} onChange={setRandoriMinutes} /></Field>
            </div>
            <Field label="Técnicas trabalhadas"><div className="selected-techniques">{selected.length ? selected.map((id) => { const item = judoTechniques.find((technique) => technique.id === id)!; return <button type="button" key={id} onClick={() => setSelected(selected.filter((value) => value !== id))}>{item.name} <X /></button>; }) : <small>Escolhe técnicas no catálogo abaixo.</small>}</div></Field>
            <Field label="Notas, correções do treinador e próximo foco"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: entrar mais perto no uchi-mata; repetir a saída de pegada…" rows={4} /></Field>
            <Button type="button" size="lg" className="wide-button" onClick={savePractice}><Save /> Guardar treino de judô</Button>
          </CardContent>
        </Card>
        <Card className="panel judo-history-card">
          <CardHeader><CardTitle>Histórico recente</CardTitle></CardHeader>
          <CardContent>{state.judoPractices.length ? state.judoPractices.slice(-5).reverse().map((practice) => <div className="judo-history-row" key={practice.id}><div><strong>{new Date(`${practice.date}T12:00:00`).toLocaleDateString('pt-PT')}</strong><small>{practice.durationMinutes} min · {practice.techniqueIds.length} técnicas · {practice.randoriRounds} randori</small></div><Button type="button" variant="ghost" size="icon" aria-label="Apagar registo" onClick={() => setState((current) => ({ ...current, judoPractices: current.judoPractices.filter((item) => item.id !== practice.id) }))}><Trash2 /></Button></div>) : <p className="muted-copy">Ainda não há treinos registados.</p>}</CardContent>
        </Card>
      </div>
      <Card className="panel technique-library">
        <CardHeader><div><p className="eyebrow">KODOKAN + IJF</p><CardTitle>Biblioteca técnica</CardTitle><CardDescription>Classificação oficial e ligação para vídeo/3D e exemplos de competição da IJF.</CardDescription></div><Input aria-label="Procurar técnica" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procurar uchi-mata…" /></CardHeader>
        <CardContent>
          <div className="technique-filters">{(Object.keys(judoCategoryLabels) as Array<JudoCategory | 'Todas'>).map((item) => <button type="button" key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{judoCategoryLabels[item]}</button>)}</div>
          <div className="technique-grid">{filteredTechniques.map((item) => <article key={item.id} className={selected.includes(item.id) ? 'selected' : ''}><button type="button" className="technique-select" onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}><span>{item.japanese}</span><strong>{item.name}</strong><small>{judoCategoryLabels[item.category]}</small></button><a href={ijfTechniqueUrl(item.id)} target="_blank" rel="noreferrer">Vídeo oficial IJF <ExternalLink /></a></article>)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarPage({
  state,
  selectedDate,
  setSelectedDate,
  onOpenDay,
}: {
  state: AppState;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onOpenDay: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const first = new Date(start);
  first.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
  const dayMeals = state.meals.filter((meal) => meal.date === selectedDate);
  const nutrients = roundNutrients(
    sumNutrients(dayMeals.flatMap((meal) => meal.ingredients)),
  );
  const water =
    state.water.find((entry) => entry.date === selectedDate)?.liters ?? 0;
  const workout = state.workoutSessions.find(
    (entry) => entry.date === selectedDate,
  );
  const fast = state.fasts.find(
    (entry) => localDateKey(new Date(entry.start)) === selectedDate,
  );
  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">HISTÓRICO DIÁRIO</p>
          <h2>O teu calendário</h2>
          <p>
            Volta a qualquer dia para consultar ingestão, água, treino e jejum.
          </p>
        </div>
      </section>
      <div className="calendar-layout">
        <Card className="panel calendar-card">
          <CardHeader className="calendar-head">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft />
            </Button>
            <CardTitle>
              {month.toLocaleDateString('pt-PT', {
                month: 'long',
                year: 'numeric',
              })}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="calendar-grid">
              {dayNames.map((day, index) => (
                <span className="calendar-week" key={`${day}-${index}`}>
                  {day}
                </span>
              ))}
              {days.map((day) => {
                const key = localDateKey(day);
                const hasData =
                  state.meals.some((meal) => meal.date === key) ||
                  state.water.some((entry) => entry.date === key) ||
                  state.workoutSessions.some((entry) => entry.date === key);
                return (
                  <button
                    key={key}
                    className={`${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${selectedDate === key ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(key)}
                  >
                    <span>{day.getDate()}</span>
                    {hasData && <i />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="panel day-detail">
          <CardHeader>
            <p className="eyebrow">DIA SELECIONADO</p>
            <CardTitle>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                'pt-PT',
                { weekday: 'long', day: 'numeric', month: 'long' },
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="day-stats">
              <MiniStat
                label="Ingestão"
                value={`${Math.round(nutrients.calories)} kcal`}
              />
              <MiniStat label="Água" value={`${formatLiters(water)} L`} />
              <MiniStat
                label="Jejum"
                value={
                  fast
                    ? formatDuration(
                        Math.floor(
                          (new Date(fast.end).getTime() -
                            new Date(fast.start).getTime()) /
                            1000,
                        ),
                      )
                    : '—'
                }
              />
              <MiniStat
                label="Treino"
                value={workout ? `${workout.minutes} min` : '—'}
              />
            </div>
            <div className="day-meals">
              <strong>Refeições</strong>
              {dayMeals.length ? (
                dayMeals.map((meal) => <MealRow meal={meal} key={meal.id} />)
              ) : (
                <p>Sem refeições registadas.</p>
              )}
            </div>
            <Button className="wide-button open-day-button" onClick={onOpenDay}>
              <Plus /> Adicionar ou corrigir registos deste dia
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressPage({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [weight, setWeight] = useState(state.profile.currentWeightKg);
  const [range, setRange] = useState<ChartRange>('week');
  const [entryDate, setEntryDate] = useState(localDateKey());
  const [fat, setFat] = useState<number | ''>(
    state.profile.bodyFatPercent ?? '',
  );
  const rangeDays = range === 'week' ? 7 : range === 'month' ? 30 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
  const cutoffKey = localDateKey(cutoff);
  const weightData = [...state.weights]
    .filter((entry) => entry.date >= cutoffKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      label: new Date(`${entry.date}T12:00:00`).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
      }),
    }));
  const recentDates = Array.from({ length: range === 'week' ? 7 : 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - ((range === 'week' ? 6 : 29) - index));
    return localDateKey(date);
  });
  const dailyHistory = recentDates.map((date) => {
    const nutrients = sumNutrients(
      state.meals
        .filter((meal) => meal.date === date)
        .flatMap((meal) => meal.ingredients),
    );
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', range === 'week' ? { weekday: 'short' } : { day: '2-digit', month: '2-digit' }).slice(0, range === 'week' ? 3 : undefined),
      protein: Math.round(nutrients.protein),
      carbs: Math.round(nutrients.carbs),
      water: state.water.find((entry) => entry.date === date)?.liters ?? 0,
    };
  });
  const historyData = range === 'year'
    ? Array.from({ length: 12 }, (_, index) => {
        const month = new Date();
        month.setDate(1);
        month.setMonth(month.getMonth() - (11 - index));
        const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        const nutrients = sumNutrients(state.meals.filter((meal) => meal.date.startsWith(prefix)).flatMap((meal) => meal.ingredients));
        return {
          date: prefix,
          label: month.toLocaleDateString('pt-PT', { month: 'short' }).slice(0, 3),
          protein: Math.round(nutrients.protein),
          carbs: Math.round(nutrients.carbs),
          water: Math.round(state.water.filter((entry) => entry.date.startsWith(prefix)).reduce((sum, entry) => sum + entry.liters, 0) * 1000) / 1000,
        };
      })
    : dailyHistory;
  const periodLabel = range === 'week' ? 'semana' : range === 'month' ? 'mês' : 'ano';
  function addWeight(event: React.FormEvent) {
    event.preventDefault();
    const date = entryDate;
    const entry = {
      id: uid(),
      date,
      weightKg: weight,
      bodyFatPercent: fat || undefined,
    };
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentWeightKg: weight,
        bodyFatPercent: fat || undefined,
      },
      weights: [...current.weights.filter((item) => item.date !== date), entry],
    }));
  }
  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">EVOLUÇÃO</p>
          <h2>Progresso sem ruído</h2>
          <p>
            Observa tendências de peso, gordura, macros e hidratação ao longo do
            tempo.
          </p>
        </div>
      </section>
      <div className="progress-stats">
        <MiniStat
          label="Peso atual"
          value={`${state.profile.currentWeightKg.toFixed(1)} kg`}
        />
        <MiniStat
          label="Objetivo"
          value={`${state.profile.targetWeightKg.toFixed(1)} kg`}
        />
        <MiniStat
          label="Variação"
          value={`${(state.profile.currentWeightKg - (state.weights[0]?.weightKg ?? state.profile.currentWeightKg)).toFixed(1)} kg`}
        />
        <MiniStat
          label="Gordura atual"
          value={
            state.profile.bodyFatPercent
              ? `${state.profile.bodyFatPercent}%`
              : 'Não registada'
          }
        />
      </div>
      <div className="charts-grid">
        <div className="chart-controls">
          <span>Período dos gráficos</span>
          <ChartRangePicker value={range} onChange={setRange} />
        </div>
        <Card className="panel chart-card wide">
          <CardHeader className="panel-heading">
            <div>
              <p className="eyebrow">COMPOSIÇÃO</p>
              <CardTitle>Peso e gordura corporal</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {weightData.length > 1 ? (
              <ChartContainer
                className="h-[300px] w-full"
                config={{
                  weightKg: { label: 'Peso (kg)', color: '#168fbd' },
                  bodyFatPercent: { label: 'Gordura (%)', color: '#ef6f4c' },
                }}
              >
                <AreaChart data={weightData} margin={{ left: -15, right: 12 }}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-weightKg)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-weightKg)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="weightKg"
                    type="monotone"
                    stroke="var(--color-weightKg)"
                    fill="url(#weightFill)"
                    strokeWidth={3}
                  />
                  <Area
                    dataKey="bodyFatPercent"
                    type="monotone"
                    stroke="var(--color-bodyFatPercent)"
                    fill="transparent"
                    strokeWidth={2}
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState
                icon={TrendingDown}
                title="A tendência aparece com 2 registos"
                text="Atualiza o peso sempre que quiseres."
              />
            )}
          </CardContent>
        </Card>
        <Card className="panel weight-form">
          <CardHeader>
            <CardTitle>Registar peso</CardTitle>
            <CardDescription>
              O registo de hoje substitui outro feito na mesma data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addWeight}>
              <Field label="Data da medição">
                <Input type="date" value={entryDate} max={localDateKey()} onChange={(event) => setEntryDate(event.target.value)} />
              </Field>
              <Field label="Peso (kg)">
                <NumberInput value={weight} min={30} max={250} step="0.1" onChange={setWeight} />
              </Field>
              <Field label="Gordura corporal (%)">
                <NumberInput
                  value={fat}
                  min={1}
                  max={70}
                  step="0.1"
                  onChange={(value) => setFat(value || '')}
                />
              </Field>
              <Button className="wide-button" type="submit">
                <Save /> Guardar medição
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="panel chart-card">
          <CardHeader>
            <CardTitle>Macros · {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[240px] w-full"
              config={{
                protein: { label: 'Proteína', color: '#168fbd' },
                carbs: { label: 'Hidratos', color: '#ef6f4c' },
              }}
            >
              <BarChart data={historyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="protein"
                  fill="var(--color-protein)"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="carbs"
                  fill="var(--color-carbs)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="panel chart-card">
          <CardHeader>
            <CardTitle>Água · {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[240px] w-full"
              config={{ water: { label: 'Água (L)', color: '#65a9c7' } }}
            >
              <BarChart data={historyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="water"
                  fill="var(--color-water)"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function pickHealthValues(payload: string | undefined): number[] {
  if (!payload) return [];
  try {
    const parsed: unknown = JSON.parse(payload);
    const values: number[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      const preferred = ['y', 'value', 'Value', 'sum', 'Sum', 'average', 'Average', 'total', 'Total'];
      const key = preferred.find((candidate) => typeof record[candidate] === 'number');
      if (key) values.push(record[key] as number);
      else Object.values(record).forEach(visit);
    };
    if (typeof parsed === 'number') return [parsed];
    visit(parsed);
    return values;
  } catch {
    return [];
  }
}

function HealthConnectPanel({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const native = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const latest = state.healthSnapshots.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  async function queryMetric(variable: string, operation: 'SUM' | 'AVERAGE', start: Date, end: Date) {
    const isoDate = (value: Date) => `${value.toISOString().split('.')[0]}Z`;
    const result = await HealthFitness.getData({
      parameters: JSON.stringify({
        Variable: variable,
        StartDate: isoDate(start),
        EndDate: isoDate(end),
        TimeUnit: 'DAY',
        OperationType: operation,
        TimeUnitLength: 1,
        AdvancedQueryReturnType: 'ALL_DATA',
        AdvancedQueryResultType: 'RAW_DATA',
      }),
    });
    const values = pickHealthValues(result.resultDataPoints).length
      ? pickHealthValues(result.resultDataPoints)
      : pickHealthValues(result.results);
    if (!values.length) return undefined;
    return operation === 'SUM'
      ? values.reduce((sum, value) => sum + value, 0)
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  async function connectAndSync() {
    setStatus('syncing');
    setMessage('A pedir autorização no Health Connect…');
    try {
      const inactive = JSON.stringify({ IsActive: false, AccessType: 'READ' });
      await HealthFitness.requestHealthPermissions({
        customPermissions: JSON.stringify([
          { Variable: 'STEPS', AccessType: 'READ' },
          { Variable: 'CALORIES_BURNED', AccessType: 'READ' },
          { Variable: 'HEART_RATE', AccessType: 'READ' },
          { Variable: 'SLEEP', AccessType: 'READ' },
          { Variable: 'BODY_FAT_PERCENTAGE', AccessType: 'READ' },
        ]),
        allVariables: inactive,
        fitnessVariables: inactive,
        healthVariables: inactive,
        profileVariables: inactive,
        workoutVariables: inactive,
      });
      setMessage('A importar os dados de hoje…');
      const date = localDateKey();
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [steps, activeCalories, averageHeartRate, sleepMinutes, bodyFatPercent] = await Promise.all([
        queryMetric('STEPS', 'SUM', start, end),
        queryMetric('CALORIES_BURNED', 'SUM', start, end),
        queryMetric('HEART_RATE', 'AVERAGE', start, end),
        queryMetric('SLEEP', 'SUM', start, end),
        queryMetric('BODY_FAT_PERCENTAGE', 'AVERAGE', start, end),
      ]);
      const snapshot: HealthSnapshot = {
        date,
        steps: steps === undefined ? undefined : Math.round(steps),
        activeCalories,
        averageHeartRate,
        sleepMinutes,
        bodyFatPercent,
        syncedAt: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        healthSnapshots: [...current.healthSnapshots.filter((item) => item.date !== date), snapshot],
      }));
      setStatus('done');
      setMessage('Dados de hoje sincronizados.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível ligar ao Health Connect.');
    }
  }

  return (
    <div className="health-connect-panel">
      <div className="integration-row">
        <div className="round-icon health"><HeartPulse /></div>
        <div>
          <strong>Health Connect</strong>
          <p>Importa do relógio passos, calorias ativas, ritmo cardíaco, sono e gordura corporal. Os dados só são lidos depois da tua autorização no Android.</p>
          {latest && <small>Última sincronização: {new Date(latest.syncedAt).toLocaleString('pt-PT')} · {latest.steps?.toLocaleString('pt-PT') ?? '—'} passos</small>}
          {message && <small className={status === 'error' ? 'health-error' : ''}>{message}</small>}
          <div className="health-actions">
            <Button type="button" onClick={connectAndSync} disabled={!native || status === 'syncing'}>{status === 'syncing' ? <LoaderCircle className="spin" /> : <HeartPulse />}{native ? 'Ligar e sincronizar' : 'Disponível no APK 2.0'}</Button>
            {native && <Button type="button" variant="outline" onClick={() => HealthFitness.openHealthConnect().catch(() => setMessage('Health Connect não está disponível neste dispositivo.'))}>Abrir Health Connect</Button>}
          </div>
        </div>
      </div>
      <p className="privacy-note">No site, os dados do relógio são apenas visualizados depois de sincronizados pelo APK. <a href="/privacy" target="_blank">Política de privacidade</a>.</p>
    </div>
  );
}

function SettingsPage({
  state,
  setState,
  onReset,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onReset: () => Promise<void>;
}) {
  const [profile, setProfile] = useState(state.profile);
  const [goals, setGoals] = useState(state.goals);
  const [activityPreset, setActivityPreset] = useState('Musculação');
  const [activityName, setActivityName] = useState('Musculação');
  const [minutes, setMinutes] = useState(60);
  const [met, setMet] = useState(5);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [split, setSplit] = useState('full_body');
  const [bodyFocus, setBodyFocus] = useState<string[]>([]);
  const [level, setLevel] = useState('intermediate');
  const [workoutDays, setWorkoutDays] = useState<number[]>([1, 3, 5]);
  const [workoutTime, setWorkoutTime] = useState('18:00');
  const [generating, setGenerating] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const draftMaintenance = tdee(profile, state.activities);
  const draftEstimate = weeksToGoal(profile, goals.calorieTarget, draftMaintenance);
  function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setState((current) => ({ ...current, profile, goals }));
  }
  function recalculate() {
    const next = suggestedGoals(profile, state.activities, goals.kind);
    setGoals(next);
    setState((current) => ({ ...current, profile, goals: next }));
  }
  function addActivity() {
    if (!activityName.trim() || !days.length) return;
    const activity: Activity = {
      id: uid(),
      name: activityName.trim(),
      days,
      minutes,
      met,
    };
    setState((current) => ({
      ...current,
      activities: [...current.activities, activity],
    }));
  }
  async function generateWorkout() {
    if (!workoutDays.length) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goals.kind === 'lose_fat' ? 'fat_loss' : goals.kind === 'gain_muscle' ? 'muscle_gain' : 'general_fitness',
          level,
          split,
          bodyFocus,
        }),
      });
      if (!response.ok) throw new Error('workout');
      const result = (await response.json()) as { source: WorkoutPlan['source']; exercises: WorkoutPlan['exercises'] };
      const plan: WorkoutPlan = {
        id: uid(),
        name: bodyFocus.length
          ? `Mistura: ${bodyFocus.map((value) => muscleOptions.find((item) => item.value === value)?.label).filter(Boolean).join(', ')}`
          : splitLabels[split],
        source: result.source,
        createdAt: new Date().toISOString(),
        days: workoutDays,
        time: workoutTime,
        exercises: result.exercises,
      };
      setState((current) => ({ ...current, workoutPlans: [...current.workoutPlans, plan] }));
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PERSONALIZAÇÃO</p>
          <h2>O teu plano, nas tuas mãos</h2>
          <p>
            Edita os dados, aceita sugestões calculadas ou define cada meta
            manualmente.
          </p>
        </div>
        <Button size="lg" onClick={recalculate}>
          <Sparkles /> Recalcular sugestões
        </Button>
      </section>
      <section className="calculation-strip">
        <div>
          <span>TMB</span>
          <strong>{bmr(profile)} kcal</strong>
          <small>Mifflin–St Jeor</small>
        </div>
        <div>
          <span>Gasto diário</span>
          <strong>{draftMaintenance} kcal</strong>
          <small>base + atividades MET</small>
        </div>
        <div>
          <span>Objetivo</span>
          <strong>{draftEstimate === null ? '—' : `${draftEstimate} semanas`}</strong>
          <small>estimativa matemática</small>
        </div>
        <div>
          <span>Água</span>
          <strong>{goals.waterLiters} L</strong>
          <small>35 ml/kg</small>
        </div>
      </section>
      <form onSubmit={saveProfile} className="settings-grid">
        <Card className="panel">
          <CardHeader>
            <CardTitle>Perfil e composição</CardTitle>
            <CardDescription>Base dos cálculos metabólicos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Nome">
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <div className="form-grid three">
              <Field label="Idade">
                <NumberInput
                  value={profile.age}
                  min={13}
                  max={100}
                  onChange={(value) => setProfile({ ...profile, age: value })}
                />
              </Field>
              <Field label="Altura (cm)">
                <NumberInput
                  value={profile.heightCm}
                  min={120}
                  max={230}
                  onChange={(value) =>
                    setProfile({ ...profile, heightCm: value })
                  }
                />
              </Field>
              <Field label="Sexo">
                <select
                  value={profile.sex}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      sex: e.target.value as Profile['sex'],
                    })
                  }
                >
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </Field>
            </div>
            <div className="form-grid two">
              <Field label="Peso atual (kg)">
                <NumberInput
                  value={profile.currentWeightKg}
                  min={30}
                  max={250}
                  step="0.1"
                  onChange={(value) =>
                    setProfile({ ...profile, currentWeightKg: value })
                  }
                />
              </Field>
              <Field label="Peso objetivo (kg)">
                <NumberInput
                  value={profile.targetWeightKg}
                  min={30}
                  max={250}
                  step="0.1"
                  onChange={(value) =>
                    setProfile({ ...profile, targetWeightKg: value })
                  }
                />
              </Field>
            </div>
            <div className="form-grid three">
              <Field label="% gordura atual">
                <NumberInput
                  value={profile.bodyFatPercent ?? ''}
                  min={1}
                  max={70}
                  step="0.1"
                  onChange={(value) =>
                    setProfile({
                      ...profile,
                      bodyFatPercent: value || undefined,
                    })
                  }
                />
              </Field>
              <Field label="% gordura objetivo">
                <NumberInput
                  value={profile.targetBodyFatPercent ?? ''}
                  min={1}
                  max={70}
                  step="0.1"
                  onChange={(value) =>
                    setProfile({
                      ...profile,
                      targetBodyFatPercent: value || undefined,
                    })
                  }
                />
              </Field>
              <Field label="% massa magra">
                <NumberInput
                  value={profile.leanMassPercent ?? ''}
                  min={20}
                  max={100}
                  step="0.1"
                  onChange={(value) =>
                    setProfile({
                      ...profile,
                      leanMassPercent: value || undefined,
                    })
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card className="panel">
          <CardHeader>
            <CardTitle>Metas diárias</CardTitle>
            <CardDescription>
              Todos os valores podem ser alterados manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Objetivo">
              <select
                value={goals.kind}
                onChange={(e) => {
                  const kind = e.target.value as typeof goals.kind;
                  const suggested = suggestedGoals(profile, state.activities, kind);
                  setGoals({ ...goals, kind, calorieDeficit: suggested.calorieDeficit, calorieTarget: suggested.calorieTarget });
                }}
              >
                <option value="lose_fat">Perder gordura</option>
                <option value="maintain">Manter peso</option>
                <option value="gain_muscle">Ganhar músculo</option>
              </select>
            </Field>
            <div className="form-grid two">
              {goals.kind === 'lose_fat' && (
                <Field label="Défice pretendido (kcal/dia)">
                  <NumberInput
                    value={goals.calorieDeficit}
                    min={0}
                    max={1000}
                    step="25"
                    onChange={(value) => setGoals({ ...goals, calorieDeficit: value, calorieTarget: Math.max(1000, draftMaintenance - value) })}
                  />
                </Field>
              )}
              <Field label="Calorias (kcal)">
                <NumberInput
                  value={goals.calorieTarget}
                  min={1000}
                  max={5000}
                  step="10"
                  onChange={(value) => setGoals({ ...goals, calorieTarget: value, calorieDeficit: Math.max(0, draftMaintenance - value) })}
                />
              </Field>
              <Field label="Água (L)">
                <NumberInput
                  value={goals.waterLiters}
                  min={0.5}
                  max={8}
                  step="0.25"
                  onChange={(value) =>
                    setGoals({ ...goals, waterLiters: value })
                  }
                />
              </Field>
              <Field label="Proteína (g)">
                <NumberInput
                  value={goals.proteinG}
                  onChange={(value) => setGoals({ ...goals, proteinG: value })}
                />
              </Field>
              <Field label="Hidratos (g)">
                <NumberInput
                  value={goals.carbsG}
                  onChange={(value) => setGoals({ ...goals, carbsG: value })}
                />
              </Field>
              <Field label="Gordura (g)">
                <NumberInput
                  value={goals.fatG}
                  onChange={(value) => setGoals({ ...goals, fatG: value })}
                />
              </Field>
              <Field label="Fibra (g)">
                <NumberInput
                  value={goals.fiberG}
                  onChange={(value) => setGoals({ ...goals, fiberG: value })}
                />
              </Field>
              <Field label="Jejum (h)">
                <NumberInput
                  value={goals.fastingHours}
                  min={0}
                  max={24}
                  onChange={(value) =>
                    setGoals({ ...goals, fastingHours: value })
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card className="panel activities-card">
          <CardHeader>
            <CardTitle>Rotina semanal</CardTitle>
            <CardDescription>
              O gasto diário inclui todas estas atividades e desconta o repouso já incluído na base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="activity-list">
              {state.activities.map((activity) => (
                <div key={activity.id}>
                  <div className="round-icon soft">
                    <ActivityIcon />
                  </div>
                  <div>
                    <strong>{activity.name}</strong>
                    <small>
                      {activity.days.map((day) => fullDayNames[day]).join(', ')}{' '}
                      · {activity.minutes} min
                    </small>
                  </div>
                  <span>MET {activity.met}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Apagar atividade ${activity.name}`}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        activities: current.activities.filter(
                          (item) => item.id !== activity.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="activity-builder">
              <div className="form-grid three">
                <Field label="Atividade">
                  <select
                    value={activityPreset}
                    onChange={(event) => {
                      const preset = activityPresets.find((item) => item.name === event.target.value)!;
                      setActivityPreset(preset.name);
                      setActivityName(preset.name === 'Outro' ? '' : preset.name);
                      setMet(preset.met);
                    }}
                  >
                    {activityPresets.map((preset) => <option key={preset.name}>{preset.name}</option>)}
                  </select>
                </Field>
                <Field label="Minutos">
                  <NumberInput value={minutes} min={5} max={240} step="5" onChange={setMinutes} />
                </Field>
                <Field label={<span className="label-help">Intensidade MET <span className="help-tip" tabIndex={0}><CircleHelp /><span role="tooltip">MET compara o gasto da atividade com o repouso: 1 MET ≈ estar sentado; quanto maior, mais intensa a atividade.</span></span></span>}>
                  <NumberInput value={met} min={1} max={18} step="0.5" onChange={setMet} />
                </Field>
              </div>
              {activityPreset === 'Outro' && (
                <Field label="Nome da atividade">
                  <Input value={activityName} onChange={(event) => setActivityName(event.target.value)} placeholder="Ex.: padel" />
                </Field>
              )}
              <Field label="Dias da semana">
                <div className="day-picker">
                  {fullDayNames.map((day, index) => (
                    <button
                      type="button"
                      key={day}
                      className={days.includes(index) ? 'selected' : ''}
                      onClick={() =>
                        setDays(
                          days.includes(index)
                            ? days.filter((item) => item !== index)
                            : [...days, index],
                        )
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </Field>
              <Button type="button" variant="outline" onClick={addActivity}>
                <Plus /> Adicionar atividade
              </Button>
            </div>
            <div className="routine-divider" />
            <section className="workout-settings-builder">
              <div>
                <p className="eyebrow">MUSCULAÇÃO</p>
                <h3>Sugerir nova rotina</h3>
                <p>A rotina ficará agendada nos dias e hora escolhidos e aparecerá no ecrã Treino.</p>
              </div>
              <div className="form-grid three">
                <Field label="Divisão">
                  <select value={split} onChange={(event) => { setSplit(event.target.value); setBodyFocus([]); }}>
                    {Object.entries(splitLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Nível">
                  <select value={level} onChange={(event) => setLevel(event.target.value)}>
                    <option value="beginner">Iniciante</option><option value="intermediate">Intermédio</option><option value="advanced">Avançado</option>
                  </select>
                </Field>
                <Field label="Hora">
                  <Input type="time" value={workoutTime} onChange={(event) => setWorkoutTime(event.target.value)} />
                </Field>
              </div>
              <Field label="Misturar grupos (opcional)">
                <div className="muscle-picker">
                  {muscleOptions.map((muscle) => <button type="button" key={muscle.value} className={bodyFocus.includes(muscle.value) ? 'selected' : ''} onClick={() => setBodyFocus((current) => current.includes(muscle.value) ? current.filter((value) => value !== muscle.value) : [...current, muscle.value])}>{muscle.label}</button>)}
                </div>
              </Field>
              <Field label="Dias do treino">
                <div className="day-picker">
                  {fullDayNames.map((day, index) => <button type="button" key={day} className={workoutDays.includes(index) ? 'selected' : ''} onClick={() => setWorkoutDays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])}>{day}</button>)}
                </div>
              </Field>
              <Button type="button" onClick={generateWorkout} disabled={generating || !workoutDays.length}>
                {generating ? <LoaderCircle className="spin" /> : <Sparkles />}{generating ? 'A gerar…' : 'Gerar e agendar rotina'}
              </Button>
              <div className="scheduled-plans">
                {state.workoutPlans.map((plan) => (
                  <div key={plan.id}>
                    <Dumbbell />
                    <div><strong>{plan.name}</strong><small>{plan.days?.length ? plan.days.map((day) => fullDayNames[day]).join(', ') : 'Sem dias agendados'} · {plan.time ?? 'Sem hora'} · {plan.exercises.length} exercícios</small></div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Apagar rotina ${plan.name}`} onClick={() => setState((current) => ({ ...current, workoutPlans: current.workoutPlans.filter((item) => item.id !== plan.id) }))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
        <Card className="panel integration-card">
          <CardHeader>
            <CardTitle>Integrações e referências</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthConnectPanel state={state} setState={setState} />
            <div className="integration-row">
              <div className="round-icon">
                <Dumbbell />
              </div>
              <div>
                <strong>WorkoutX API</strong>
                <p>
                  Exercícios, GIFs, músculos e equipamentos. Sem chave, a app
                  usa rotinas de demonstração.
                </p>
                <a
                  href="https://workoutxapp.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Obter chave →
                </a>
              </div>
            </div>
            <div className="integration-row">
              <div className="round-icon soft">
                <Apple />
              </div>
              <div>
                <strong>Tabela TACO</strong>
                <p>
                  Composição por 100 g para alimentos sem rótulo nutricional.
                </p>
                <a href={TACO_URL} target="_blank" rel="noreferrer">
                  Consultar referência →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="panel danger-card">
          <CardHeader>
            <CardTitle>Recomeçar do zero</CardTitle>
            <CardDescription>Apaga perfil, refeições, medições, água, jejuns, atividades e rotinas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="danger-button" onClick={() => setConfirmReset(true)}><Trash2 /> Apagar perfil e todos os dados</Button>
          </CardContent>
        </Card>
        <div className="settings-actions">
          <Button size="lg" type="submit">
            <Save /> Guardar alterações
          </Button>
          <p>
            As sugestões são estimativas e não substituem orientação médica ou
            nutricional.
          </p>
        </div>
      </form>
      {confirmReset && (
        <div className="dialog-backdrop" role="presentation">
          <section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <h3 id="reset-title">Apagar todo o perfil?</h3>
            <p>Esta ação remove permanentemente todos os registos da Fitide e volta ao ecrã inicial.</p>
            <div><Button variant="outline" onClick={() => setConfirmReset(false)}>Cancelar</Button><Button className="danger-button solid" onClick={async () => { setConfirmReset(false); await onReset(); }}>Sim, apagar tudo</Button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Apple;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon />
      </div>
      <p>{label}</p>
      <strong>{value}</strong> <span>{unit}</span>
    </article>
  );
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ChartRangePicker({ value, onChange }: { value: ChartRange; onChange: (value: ChartRange) => void }) {
  return (
    <div className="chart-range" aria-label="Período dos gráficos">
      {([['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']] as const).map(([range, label]) => (
        <button type="button" key={range} className={value === range ? 'selected' : ''} onClick={() => onChange(range)}>
          {label}
        </button>
      ))}
    </div>
  );
}
function NumberInput({
  value,
  onChange,
  step = '1',
  min = 0,
  max = 500,
  ariaLabel,
}: {
  value: number | '';
  onChange: (value: number) => void;
  step?: string;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const increment = Number(step);
  const precision = step.includes('.') ? step.split('.')[1].length : 0;
  const options = useMemo(() => {
    const values: number[] = [];
    const count = Math.floor((max - min) / increment);
    for (let index = 0; index <= count; index += 1) {
      values.push(Number((min + index * increment).toFixed(precision)));
    }
    if (value !== '' && !values.includes(value)) values.push(value);
    return values.sort((a, b) => a - b);
  }, [increment, max, min, precision, value]);
  const initialValue = value === '' ? options[0] : value;
  const [draft, setDraft] = useState(initialValue);
  const wheelRef = useRef<HTMLDivElement>(null);
  const itemHeight = 56;

  function formatOption(option: number) {
    return option.toLocaleString('pt-PT', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }

  useEffect(() => {
    if (!open) return;
    setDraft(initialValue);
    const index = Math.max(0, options.indexOf(initialValue));
    const frame = window.requestAnimationFrame(() => {
      wheelRef.current?.scrollTo({ top: index * itemHeight });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialValue, open, options]);

  function selectAtScroll() {
    const index = Math.min(
      options.length - 1,
      Math.max(0, Math.round((wheelRef.current?.scrollTop ?? 0) / itemHeight)),
    );
    setDraft(options[index]);
  }

  return (
    <>
      <button
        type="button"
        className="number-picker-trigger"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        <span>{value === '' ? '—' : formatOption(value)}</span>
        <small>deslizar para escolher</small>
      </button>
      {open && (
        <div
          className="number-wheel-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="number-wheel-card" role="dialog" aria-modal="true" aria-label={ariaLabel ?? 'Selecionar valor'}>
            <header>
              <div>
                <p className="eyebrow">SELECIONAR VALOR</p>
                <h3>{ariaLabel ?? 'Escolha o valor'}</h3>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar seletor" onClick={() => setOpen(false)}><X /></Button>
            </header>
            <div className="number-wheel-shell">
              <div className="number-wheel-highlight" />
              <div className="number-wheel" ref={wheelRef} role="listbox" onScroll={selectAtScroll}>
                {options.map((option) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={draft === option}
                    className={draft === option ? 'selected' : ''}
                    key={option}
                    onClick={() => {
                      setDraft(option);
                      wheelRef.current?.scrollTo({ top: options.indexOf(option) * itemHeight, behavior: 'smooth' });
                    }}
                  >
                    {formatOption(option)}
                  </button>
                ))}
              </div>
            </div>
            <footer>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={() => { onChange(draft); setOpen(false); }}>Confirmar</Button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: typeof Apple;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <Icon />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && (
        <Button variant="outline" onClick={onClick}>
          {action}
        </Button>
      )}
    </div>
  );
}
function MealRow({
  meal,
  expanded = false,
}: {
  meal: Meal;
  expanded?: boolean;
}) {
  const total = roundNutrients(sumNutrients(meal.ingredients));
  return (
    <div className={`meal-row ${expanded ? 'expanded' : ''}`}>
      <span className="meal-emoji">
        {meal.type === 'Pequeno-almoço'
          ? '☀️'
          : meal.type === 'Almoço'
            ? '🥗'
            : meal.type === 'Jantar'
              ? '🌙'
              : '🍎'}
      </span>
      <div>
        <strong>{meal.type}</strong>
        <p>{meal.ingredients.map((item) => item.name).join(', ')}</p>
        {expanded && (
          <small>
            P {total.protein} g · HC {total.carbs} g · G {total.fat} g · fibra{' '}
            {total.fiber} g
          </small>
        )}
      </div>
      <b>{Math.round(total.calories)} kcal</b>
    </div>
  );
}
function Macro({
  name,
  current,
  target,
  color,
}: {
  name: string;
  current: number;
  target: number;
  color: string;
}) {
  const width = `${Math.min(100, (current / target) * 100)}%`;
  return (
    <div className="macro-row">
      <div>
        <strong>{name}</strong>
        <span>
          {current.toFixed(1)} / {target} g
        </span>
      </div>
      <div className="bar">
        <span style={{ width, background: color }} />
      </div>
    </div>
  );
}
