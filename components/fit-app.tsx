'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseCatalog } from '@/components/exercise-catalog';
import { FoodPhotoTools } from '@/components/food-photo-tools';
import { ProgressCharts } from '@/components/progress-charts';
import { WorkoutProgression } from '@/components/workout-progression';
import { adaptExercise, exerciseKey, frequentIngredients, ingredientKey, latestExerciseSets } from '@/lib/personal-tracking';
import { readNutritionLabel } from '@/lib/nutrition-label';
import { WidgetReorderButton } from '@/components/widget-reorder';
import ReactCrop, { type PercentCrop, type PixelCrop } from 'react-image-crop';
import {
  Star, StarOutline, Barcode,
  Activity as ActivityIcon,
  Apple,
  ArrowLeft,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
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
  Moon,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings,
  Sparkles,
  Sun,
  TimerReset,
  Trash2,
  TrendingDown,
  Utensils,
  Waves,
  X,
} from '@/components/material-icons';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
} from 'recharts';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
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
  activityIntensity,
  bmr,
  calorieDeficit,
  exerciseCaloriesForDay,
  exerciseCaloriesPerWeek,
  fatEquivalentKg,
  roundNutrients,
  sedentaryTdee,
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
  SavedFood,
  HealthSnapshot,
  WorkoutExercise,
  WorkoutPlan,
} from '@/lib/fit-types';
import {
  judoTechniques,
  KODOKAN_DEFINITIONS_URL,
  KODOKAN_TECHNIQUES_URL,
  type JudoCategory,
} from '@/lib/judo';
import { foodCatalog, type FoodCatalogItem } from '@/lib/food-catalog';
import { parseMealDescription } from '@/lib/meal-parser';
import { updateIngredientWeight } from '@/lib/ingredient-weight';

interface WorkoutTimerNativePlugin {
  start(options: { name: string; mode: 'interval' | 'free'; workSeconds: number; restSeconds: number; rounds: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skip(): Promise<void>;
  stop(): Promise<void>;
}

interface FitideHealthNativePlugin {
  readToday(): Promise<{
    steps?: number;
    activeCalories?: number;
    averageHeartRate?: number;
    sleepMinutes?: number;
    bodyFatPercent?: number;
    missingMetrics?: string[];
  }>;
}

interface NativeLabelPhotoResult {
  path?: string;
  webPath?: string;
  thumbnail?: string;
  metadata?: {
    format?: string;
  };
}

const NativeWorkoutTimer = registerPlugin<WorkoutTimerNativePlugin>('WorkoutTimer');
const NativeNutritionReader = registerPlugin<{ recognize(options: { image: string }): Promise<{ text: string }> }>('NutritionReader');
const NativeFitideHealth = registerPlugin<FitideHealthNativePlugin>('FitideHealth');

type Page =
  | 'today'
  | 'meals'
  | 'workout'
  | 'judo'
  | 'calendar'
  | 'progress'
  | 'settings';
type ChartRange = 'week' | 'month' | 'year';
function mealOrder(a: Meal, b: Meal) { const order = ['Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar', 'Ceia']; return (order.indexOf(a.type) < 0 ? 99 : order.indexOf(a.type)) - (order.indexOf(b.type) < 0 ? 99 : order.indexOf(b.type)) || a.createdAt.localeCompare(b.createdAt); }
const pageLabels: Record<Page, string> = {
  today: 'Home',
  meals: 'Refeições',
  workout: 'Treino',
  judo: 'Judô',
  calendar: 'Calendário',
  progress: 'Progresso',
  settings: 'Definições',
};
const navItems = [
  { id: 'today' as Page, label: 'Home', icon: Home },
  { id: 'meals' as Page, label: 'Refeições', icon: Utensils },
  { id: 'workout' as Page, label: 'Treino', icon: Dumbbell },
  { id: 'judo' as Page, label: 'Judô', icon: BookOpen },
  { id: 'calendar' as Page, label: 'Calendário', icon: CalendarDays },
  { id: 'progress' as Page, label: 'Progresso', icon: Scale },
];
const mobileNavItems = [
  { id: 'calendar' as Page, label: 'Calendário', icon: CalendarDays },
  { id: 'today' as Page, label: 'Home', icon: Home },
  { id: 'meals' as Page, label: 'Refeições', icon: Utensils },
  { id: 'workout' as Page, label: 'Treino', icon: Dumbbell },
  { id: 'progress' as Page, label: 'Progresso', icon: Scale },
  { id: 'settings' as Page, label: 'Definições', icon: Settings },
];
const swipePageOrder = mobileNavItems.map((item) => item.id);
const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const fullDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const muscleOptions = [
  { value: 'biceps', label: 'Bíceps' },
  { value: 'triceps', label: 'Tríceps' },
  { value: 'back', label: 'Costas' },
  { value: 'shoulders', label: 'Ombro' },
  { value: 'upper legs', label: 'Perna' },
  { value: 'abs', label: 'Abdominais' },
  { value: 'traps', label: 'Trapézio' },
  { value: 'forearms', label: 'Antebraço' },
  { value: 'core', label: 'Core' },
  { value: 'calves', label: 'Gémeos' },
];
const workoutEquipmentOptions = [
  { value: 'free_weights', label: 'Pesos livres' },
  { value: 'dumbbell', label: 'Halteres' },
  { value: 'barbell', label: 'Barra' },
  { value: 'body weight', label: 'Livre / peso corporal' },
  { value: 'cable', label: 'Cabos' },
  { value: 'leverage machine', label: 'Máquinas' },
  { value: 'smith machine', label: 'Máquina Smith' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance band', label: 'Bandas' },
];
const defaultWorkoutEquipment = ['dumbbell', 'barbell', 'body weight', 'cable', 'leverage machine'];
const storedWorkoutFieldTranslations: Record<string, string> = {
  pecho: 'Peito', espalda: 'Costas', hombros: 'Ombros', brazos: 'Braços', antebrazos: 'Antebraços',
  piernas: 'Pernas', pantorrillas: 'Gémeos', gemelos: 'Gémeos', cintura: 'Abdominais', abdominales: 'Abdominais',
  gluteos: 'Glúteos', isquiotibiales: 'Posteriores da coxa', cuadriceps: 'Quadríceps', dorsales: 'Dorsais',
  pectorales: 'Peitoral', biceps: 'Bíceps', triceps: 'Tríceps', mancuerna: 'Halteres', mancuernas: 'Halteres',
  barra: 'Barra', cable: 'Cabo', 'peso corporal': 'Peso corporal', maquina: 'Máquina',
  'maquina smith': 'Máquina Smith', banda: 'Banda elástica', 'banda de resistencia': 'Banda de resistência',
  'pesa rusa': 'Kettlebell', kettlebell: 'Kettlebell',
};
const storedWorkoutNameTranslations: Array<[string, string]> = [
  ['peso muerto rumano', 'peso morto romeno'], ['peso muerto', 'peso morto'],
  ['press de banca', 'supino'], ['press de pecho', 'press de peito'], ['press de hombros', 'press de ombros'],
  ['jalon al pecho', 'puxada ao peito'], ['jalon', 'puxada'], ['remo sentado', 'remada sentada'],
  ['remo inclinado', 'remada inclinada'], ['remo', 'remada'], ['sentadilla dividida', 'agachamento unilateral'],
  ['sentadilla', 'agachamento'], ['zancada', 'afundo'], ['extension de piernas', 'extensão de pernas'],
  ['curl de piernas', 'flexão de pernas'], ['elevacion de talones', 'elevação de gémeos'],
  ['elevacion lateral', 'elevação lateral'], ['elevacion frontal', 'elevação frontal'],
  ['extension de triceps', 'extensão de tríceps'], ['curl de biceps', 'rosca de bíceps'],
  ['curl martillo', 'rosca martelo'], ['dominada', 'elevação na barra'], ['flexion', 'flexão'],
  ['plancha', 'prancha'], ['encogimiento', 'encolhimento'], ['con mancuernas', 'com halteres'],
  ['con mancuerna', 'com halteres'], ['con barra', 'com barra'], ['en maquina', 'na máquina'],
  ['sentado', 'sentado'], ['de pie', 'em pé'], ['acostado', 'deitado'], ['inclinado', 'inclinado'],
];

function localizeStoredWorkoutExercise(exercise: WorkoutExercise): WorkoutExercise {
  const translateField = (value: string) => storedWorkoutFieldTranslations[normalizeText(value)] ?? value;
  let name = normalizeText(exercise.name);
  const looksSpanish = /\b(sentadilla|zancada|jalon|dominada|encogimiento|mancuerna|mancuernas|maquina|acostado|talones|piernas|hombros)\b/.test(name)
    || /\bpress de (banca|pecho)\b/.test(name)
    || /\b(con barra|de pie)\b/.test(name);
  if (!looksSpanish) return exercise;
  for (const [spanish, portuguese] of storedWorkoutNameTranslations) {
    name = name.replace(new RegExp(`\\b${spanish}\\b`, 'g'), portuguese);
  }
  name = name ? name[0].toLocaleUpperCase('pt-PT') + name.slice(1) : exercise.name;
  return { ...exercise, name, target: translateField(exercise.target), equipment: translateField(exercise.equipment) };
}
const activityPresets = [
  { name: 'Musculação', intensity: 2 },
  { name: 'Judô', intensity: 3 },
  { name: 'Futebol casual', intensity: 3 },
  { name: 'Futebol competitivo', intensity: 4 },
  { name: 'Corrida', intensity: 3 },
  { name: 'Caminhada rápida', intensity: 1 },
  { name: 'Bicicleta', intensity: 2 },
  { name: 'Natação', intensity: 3 },
  { name: 'Outro', intensity: 2 },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function suggestedWorkoutWeight(level: string, equipment = '') {
  const normalized = normalizeText(equipment);
  if (normalized.includes('peso corporal') || normalized.includes('body weight') || normalized.includes('assist')) return 0;
  const index = level === 'beginner' ? 0 : level === 'advanced' ? 2 : 1;
  if (/barra|maquina|smith|sled/.test(normalized)) return [10, 20, 30][index];
  if (/halter|dumbbell|kettlebell/.test(normalized)) return [4, 8, 12][index];
  return [5, 10, 15][index];
}

let workoutAudioContext: AudioContext | null = null;

function prepareWorkoutSound() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  workoutAudioContext ??= new AudioContextClass();
  if (workoutAudioContext.state === 'suspended') void workoutAudioContext.resume();
}

function playWorkoutSound(kind: 'phase' | 'done' = 'phase') {
  prepareWorkoutSound();
  if (!workoutAudioContext) return;
  const start = workoutAudioContext.currentTime;
  const tones = kind === 'done' ? [660, 880, 1040] : [760, 940];
  tones.forEach((frequency, index) => {
    const oscillator = workoutAudioContext!.createOscillator();
    const gain = workoutAudioContext!.createGain();
    const toneStart = start + index * 0.17;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.2, toneStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.13);
    oscillator.connect(gain);
    gain.connect(workoutAudioContext!.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + 0.15);
  });
  if ('vibrate' in navigator) navigator.vibrate(kind === 'done' ? [180, 80, 180] : 120);
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

const foodSynonymGroups = [
  ['abacaxi', 'ananas'],
  ['abobrinha', 'courgette'],
  ['aipim', 'macaxeira', 'mandioca'],
  ['alho poro', 'alho frances'],
  ['beringela', 'berinjela'],
  ['carne moida', 'carne picada'],
  ['creme de leite', 'natas'],
  ['gelado', 'sorvete'],
  ['leite desnatado', 'leite magro'],
  ['leite semidesnatado', 'leite meio gordo'],
  ['pao frances', 'pao de sal', 'cacetinho'],
  ['pimentao', 'pimento'],
  ['porco', 'suino'],
  ['suco', 'sumo'],
  ['vaca', 'boi', 'bovino'],
  ['konbu', 'kombu'],
  ['proteina de soro', 'whey protein', 'whey'],
  ['wrap', 'wraps', 'wrpas', 'tortilha', 'tortilla'],
  ['cream cheese', 'queijo creme', 'queijo cremoso'],
  ['salmao', 'salmon'],
  ['fumado', 'defumado', 'smoked'],
  ['couscous', 'cuscuz', 'cuscus'],
];

type QuantityMode = 'g' | 'unit' | 'ml';

interface NumberUnitOption {
  value: QuantityMode;
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: string;
  defaultValue: number;
}

const foodQuantityOptions: NumberUnitOption[] = [
  { value: 'g', label: 'gramas', suffix: 'g', min: 1, max: 2000, step: '1', defaultValue: 100 },
  { value: 'unit', label: 'unid.', suffix: 'unid.', min: 0.5, max: 30, step: '0.5', defaultValue: 1 },
  { value: 'ml', label: 'ml', suffix: 'ml', min: 1, max: 2000, step: '1', defaultValue: 250 },
];

interface MealAssistantDraft {
  id: string;
  original: string;
  query: string;
  amount: number;
  unit: QuantityMode;
  foodId: string;
  candidateIds: string[];
  score: number;
}

const unitWeightRules: Array<[RegExp, number]> = [
  [/ovo/, 55], [/banana/, 120], [/(laranja|orange)/, 180], [/(maca|apple)/, 160],
  [/(pera|pear)/, 170], [/(kiwi)/, 75], [/(tangerina|mandarina)/, 120], [/(pessego|peach)/, 150],
  [/(tomate|tomato)/, 120], [/(cebola|onion)/, 110], [/(batata|potato)/, 150], [/(pao|bread)/, 50],
  [/(wrap|tortilha|tortilla)/, 49],
];

function averageUnitGrams(foodName: string) {
  const clean = normalizeText(foodName);
  return unitWeightRules.find(([pattern]) => pattern.test(clean))?.[1] ?? 100;
}

function liquidDensity(foodName: string) {
  const clean = normalizeText(foodName);
  if (/(azeite|oleo|oil)/.test(clean)) return 0.92;
  if (/(mel|honey)/.test(clean)) return 1.42;
  if (/(leite|milk|iogurte|yogurt)/.test(clean)) return 1.03;
  return 1;
}

function foodQueryVariants(value: string) {
  const clean = normalizeText(value);
  const variants = new Set([clean]);
  for (const group of foodSynonymGroups) {
    for (const variant of [...variants]) {
      for (const term of group) {
        if (!variant.includes(term)) continue;
        for (const alternative of group) variants.add(variant.replace(term, alternative));
      }
    }
  }
  return [...variants];
}

const foodStopWords = new Set(['a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em']);

function directFoodMatchScore(cleanQuery: string, cleanName: string) {
  if (!cleanQuery) return 0;
  if (cleanName === cleanQuery) return 2400;
  if (cleanName.startsWith(cleanQuery)) return 1900 - cleanName.length;
  if (cleanName.includes(cleanQuery)) return 1600 - cleanName.indexOf(cleanQuery);
  const queryTokens = cleanQuery.split(' ').filter((token) => token && !foodStopWords.has(token));
  const nameTokens = cleanName.split(' ').filter((token) => token && !foodStopWords.has(token));
  if (!queryTokens.length) return 0;
  let score = 350;
  for (const token of queryTokens) {
    const best = Math.max(
      0,
      ...nameTokens.map((candidate) => {
        if (candidate === token) return 150;
        if (candidate.startsWith(token) || token.startsWith(candidate)) return 105;
        if (candidate.includes(token) || token.includes(candidate)) return 80;
        const tolerance = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
        return tolerance && editDistance(token, candidate) <= tolerance ? 65 : 0;
      }),
    );
    if (!best) return 0;
    score += best;
  }
  return score - Math.max(0, nameTokens.length - queryTokens.length) * 4;
}

function foodMatchScore(query: string, name: string) {
  const cleanName = normalizeText(name);
  return Math.max(...foodQueryVariants(query).map((variant) => directFoodMatchScore(variant, cleanName)));
}

function foodMatchLabel(query: string, food: FoodCatalogItem, score: number) {
  if (normalizeText(query) === normalizeText(food.name)) return 'Correspondência exata';
  if (score >= 1500) return 'Correspondência próxima';
  return 'Alimento semelhante';
}

function formatLiters(value: number) {
  return value.toFixed(3).replace('.', ',');
}

function FitideLogo() {
  return <img src="/fitide-logo-v2.png" alt="" aria-hidden="true" />;
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function isScheduledForDate(
  item: { days?: number[]; specificDate?: string },
  date: string,
  unscheduledIsDaily = false,
) {
  if (item.specificDate) return item.specificDate === date;
  if (!item.days?.length) return unscheduledIsDaily;
  return item.days.includes(new Date(`${date}T12:00:00`).getDay());
}

function scheduleLabel(item: { days?: number[]; specificDate?: string }) {
  if (item.specificDate) {
    return `1 dia · ${new Date(`${item.specificDate}T12:00:00`).toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }
  return item.days?.length ? item.days.map((day) => fullDayNames[day]).join(', ') : 'Sem dias agendados';
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function useViewportLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [active]);
}

function OverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatFastDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}


async function prepareNutritionCrop(image: HTMLImageElement, crop: PixelCrop) {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sourceX = Math.max(0, Math.round(crop.x * scaleX));
  const sourceY = Math.max(0, Math.round(crop.y * scaleY));
  const sourceWidth = Math.min(image.naturalWidth - sourceX, Math.max(1, Math.round(crop.width * scaleX)));
  const sourceHeight = Math.min(image.naturalHeight - sourceY, Math.max(1, Math.round(crop.height * scaleY)));
  const outputScale = Math.min(1.5, 1600 / sourceWidth, 1600 / sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
  canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) throw new Error('canvas-unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = 'grayscale(100%)';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('crop-failed'))), 'image/jpeg', 0.9);
  });
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

async function prepareNutritionPreview(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error('image-too-large');
  if (typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
    resizeWidth: 1200,
    resizeQuality: 'high',
  });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas-unavailable');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('preview-failed'))), 'image/jpeg', 0.76);
    });
    canvas.width = 1;
    canvas.height = 1;
    return blob;
  } finally {
    bitmap.close();
  }
}

function nativeLabelPhotoBlob(photo: NativeLabelPhotoResult) {
  if (!photo.thumbnail) return undefined;
  const encoded = photo.thumbnail.includes(',')
    ? photo.thumbnail.slice(photo.thumbnail.indexOf(',') + 1)
    : photo.thumbnail;
  const binary = window.atob(encoded.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'image/jpeg' });
}

function nativeLabelPhotoUrl(photo: NativeLabelPhotoResult) {
  if (photo.webPath) return photo.webPath;
  if (photo.path) return Capacitor.convertFileSrc(photo.path);
  const thumbnail = nativeLabelPhotoBlob(photo);
  if (thumbnail) return URL.createObjectURL(thumbnail);
  throw new Error('photo-unavailable');
}

function youtubeIdFromUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return match?.[1];
}

function alignCalorieGoal(goals: AppState['goals'], profile: Profile, activities: Activity[]) {
  if (goals.kind !== 'lose_fat') return goals;
  return {
    ...goals,
    calorieTarget: Math.max(1000, tdee(profile, activities) - goals.calorieDeficit),
  };
}

function mergeState(saved: Partial<AppState>): AppState {
  const savedScores = saved.judoProfile?.scores as
    | (Partial<AppState['judoProfile']['scores']> & {
        technique?: number;
        physical?: number;
        conditioning?: number;
      })
    | undefined;
  const legacyPhysical = [savedScores?.physical, savedScores?.conditioning]
    .filter((value): value is number => typeof value === 'number');
  const merged: AppState = {
    ...defaultState,
    ...saved,
    profile: { ...defaultState.profile, ...saved.profile },
    goals: { ...defaultState.goals, ...saved.goals },
    activities: (saved.activities ?? []).map((activity) => ({
      ...activity,
      intensity: activityIntensity(activity),
    })),
    activityCheckIns: saved.activityCheckIns ?? [],
    meals: saved.meals ?? [],
    mealDraft: saved.mealDraft,
    customFoods: saved.customFoods ?? [],
    weights: saved.weights ?? [],
    water: saved.water ?? [],
    fasts: saved.fasts ?? [],
    workoutPlans: (saved.workoutPlans ?? []).map((plan) => ({
      ...plan,
      exercises: plan.exercises.map((exercise) => localizeStoredWorkoutExercise({
        ...exercise,
        weightKg: exercise.weightKg ?? 0,
      })),
    })),
    workoutSessions: saved.workoutSessions ?? [],
    intervalPresets: saved.intervalPresets ?? defaultState.intervalPresets,
    judoPractices: saved.judoPractices ?? [],
    judoProfile: {
      ...defaultState.judoProfile,
      ...saved.judoProfile,
      scores: {
        tachiWaza: savedScores?.tachiWaza ?? savedScores?.technique ?? defaultState.judoProfile.scores.tachiWaza,
        neWaza: savedScores?.neWaza ?? savedScores?.technique ?? defaultState.judoProfile.scores.neWaza,
        physicalCondition: savedScores?.physicalCondition
          ?? (legacyPhysical.length ? Math.round(legacyPhysical.reduce((sum, value) => sum + value, 0) / legacyPhysical.length) : defaultState.judoProfile.scores.physicalCondition),
        mental: savedScores?.mental ?? defaultState.judoProfile.scores.mental,
        knowledge: savedScores?.knowledge ?? defaultState.judoProfile.scores.knowledge,
        matchPrep: savedScores?.matchPrep ?? defaultState.judoProfile.scores.matchPrep,
      },
      tokuiWazaIds: saved.judoProfile?.tokuiWazaIds ?? [],
      learningGoals: saved.judoProfile?.learningGoals ?? [],
    },
    healthSnapshots: saved.healthSnapshots ?? [],
    healthSyncEnabled: saved.healthSyncEnabled ?? false,
    widgetOrders: saved.widgetOrders ?? {},
  };
  merged.goals = alignCalorieGoal(merged.goals, merged.profile, merged.activities);
  return merged;
}

export default function FitApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [page, setPage] = useState<Page>('today');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<'loading' | 'saved' | 'saving' | 'error'>(
    'loading',
  );
  const [mealOpen, setMealOpen] = useState(false);
  const [planningMeal, setPlanningMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [restoredLabelPhoto, setRestoredLabelPhoto] = useState<NativeLabelPhotoResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeAxis = useRef<'x' | 'y' | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeNeighbor, setSwipeNeighbor] = useState<Page | null>(null);
  const [swipeAnimating, setSwipeAnimating] = useState(false);
  const [healthSyncStatus, setHealthSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [healthSyncMessage, setHealthSyncMessage] = useState('');
  const healthSyncInFlight = useRef(false);
  const healthLastSyncRef = useRef(0);

  const syncHealthConnect = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!Capacitor.isNativePlatform() || healthSyncInFlight.current) return false;
    healthSyncInFlight.current = true;
    if (!silent) {
      setHealthSyncStatus('syncing');
      setHealthSyncMessage('A sincronizar os dados de hoje…');
    }
    try {
      const date = localDateKey();
      const readNativeHealth = () => Promise.race([
        NativeFitideHealth.readToday(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('A leitura nativa do Health Connect excedeu 15 segundos.')), 15_000)),
      ]);
      let reading: Awaited<ReturnType<FitideHealthNativePlugin['readToday']>>;
      try {
        reading = await readNativeHealth();
      } catch (readError) {
        const errorCode = readError && typeof readError === 'object' && 'code' in readError
          ? String((readError as { code?: unknown }).code ?? '')
          : '';
        if (errorCode !== 'HEALTH_PERMISSIONS' || silent) throw readError;
        setHealthSyncMessage('Autoriza a Fitide no ecrã do Health Connect para continuar.');
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
        reading = await readNativeHealth();
      }
      const { steps, activeCalories, averageHeartRate, sleepMinutes, bodyFatPercent } = reading;
      const metricValues = [steps, activeCalories, averageHeartRate, sleepMinutes, bodyFatPercent];
      const snapshot: HealthSnapshot = {
        date,
        steps: steps === undefined ? undefined : Math.round(steps),
        activeCalories,
        averageHeartRate,
        sleepMinutes,
        bodyFatPercent,
        syncedAt: new Date().toISOString(),
      };
      healthLastSyncRef.current = Date.now();
      setState((current) => ({
        ...current,
        healthSyncEnabled: true,
        healthSnapshots: [...current.healthSnapshots.filter((item) => item.date !== date), snapshot],
      }));
      setHealthSyncStatus('done');
      setHealthSyncMessage(metricValues.some((metric) => metric !== undefined)
        ? 'Dados de hoje sincronizados.'
        : 'Sincronização concluída. Ainda não há registos de hoje no Health Connect.');
      return true;
    } catch (error) {
      if (!silent) {
        setHealthSyncStatus('error');
        const message = error instanceof Error ? error.message : 'Não foi possível ligar ao Health Connect.';
        setHealthSyncMessage(/not implemented|unimplemented|FitideHealth/i.test(message)
          ? 'Esta instalação ainda não tem o leitor nativo. Instala o APK Fitide 3.3.4.'
          : message);
      }
      return false;
    } finally {
      healthSyncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    fetch('/api/state')
      .then(
        (response) => response.json() as Promise<{ state: AppState | null }>,
      )
      .then(({ state: saved }) => {
        if (saved) {
          try { const localDraft = localStorage.getItem('fitide-meal-draft'); if (localDraft) saved.mealDraft = JSON.parse(localDraft); } catch { /* Recover from the server instead. */ }
          let pending: { activeWorkout?: AppState['activeWorkout'] } | null = null;
          try { pending = JSON.parse(localStorage.getItem('fitide-workout-pending') ?? 'null'); } catch { /* Server remains authoritative when cache is unavailable. */ }
          setState(mergeState(pending ? { ...saved, activeWorkout: pending.activeWorkout } : saved));
          if (saved.mealDraft) { setSelectedDate(saved.mealDraft.date); setPlanningMeal(Boolean(saved.mealDraft.planned)); setEditingMeal((saved.mealDraft.planned ? saved.plannedMeals ?? [] : saved.meals).find(item => item.id === saved.mealDraft?.mealId) ?? null); setMealOpen(true); }
        }
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
    const theme = state.theme ?? 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [state.theme]);

  useEffect(() => {
    if (!loaded || !Capacitor.isNativePlatform()) return;
    const syncIfStale = () => {
      if (state.healthSyncEnabled && Date.now() - healthLastSyncRef.current >= 14 * 60 * 1000) {
        void syncHealthConnect({ silent: true });
      }
    };
    syncIfStale();
    const interval = window.setInterval(syncIfStale, 15 * 60 * 1000);
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      syncIfStale();
    }).then((handle) => { removeListener = () => handle.remove(); });
    return () => {
      window.clearInterval(interval);
      void removeListener?.();
    };
  }, [loaded, state.healthSyncEnabled, syncHealthConnect]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('backButton', () => {
      const overlayBack = new Event('fitide-back', { cancelable: true });
      window.dispatchEvent(overlayBack);
      if (overlayBack.defaultPrevented) return;
      if (mealOpen) {
        setMealOpen(false);
        setEditingMeal(null);
      } else if (page === 'judo') setPage('workout');
      else if (page !== 'today') setPage('today');
    }).then((handle) => { removeListener = () => handle.remove(); });
    return () => { void removeListener?.(); };
  }, [mealOpen, page]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appRestoredResult', (event) => {
      if (event.pluginId !== 'Camera' || !['takePhoto', 'getPhoto'].includes(event.methodName)) return;
      if (!event.success || !event.data) return;
      setEditingMeal(null);
      setRestoredLabelPhoto(event.data as NativeLabelPhotoResult);
      setMealOpen(true);
    }).then((handle) => { removeListener = () => handle.remove(); });
    return () => { void removeListener?.(); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSync('saving');
    const workoutDraft = JSON.stringify({ activeWorkout: state.activeWorkout });
    try { localStorage.setItem('fitide-workout-pending', workoutDraft); } catch { /* Remote save still runs. */ }
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }))
        .then((response) => {
          if (!response.ok) throw new Error('sync');
          setSync('saved');
          try {
            if (localStorage.getItem('fitide-workout-pending') === workoutDraft) localStorage.removeItem('fitide-workout-pending');
          } catch { /* Optional recovery cache. */ }
        })
        .catch(() => setSync('error'));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [state, loaded]);

  const dayMeals = useMemo(
    () => state.meals.filter((meal) => meal.date === selectedDate).sort(mealOrder),
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

  function toggleFast(startAt?: string) {
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
      patchState({ activeFastStart: startAt ?? new Date().toISOString() });
    }
  }

  function addPastFast(startTime: string, endTime: string) {
    if (!startTime || !endTime) return false;
    const start = new Date(`${selectedDate}T${startTime}:00`);
    const end = new Date(`${selectedDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > Date.now()) return false;
    if (end <= start) end.setDate(end.getDate() + 1);
    setState((current) => ({
      ...current,
      fasts: [
        ...current.fasts.filter((entry) => localDateKey(new Date(entry.start)) !== selectedDate),
        { id: uid(), start: start.toISOString(), end: end.toISOString() },
      ],
    }));
    return true;
  }

  async function resetProfile() {
    try { localStorage.setItem('fitide-meal-draft', 'null'); } catch { /* Optional draft journal. */ }
    await fetch('/api/state', { method: 'DELETE' }).catch(() => undefined);
    setSelectedDate(localDateKey());
    setPage('today');
    setState({
      ...defaultState,
      profile: { ...defaultState.profile },
      goals: { ...defaultState.goals },
      activities: [], activityCheckIns: [], meals: [], customFoods: [], weights: [], water: [], fasts: [], workoutPlans: [], workoutSessions: [],
      intervalPresets: [...defaultState.intervalPresets], judoPractices: [],
      judoProfile: { ...defaultState.judoProfile, scores: { ...defaultState.judoProfile.scores }, tokuiWazaIds: [], learningGoals: [] },
      healthSnapshots: [], healthSyncEnabled: false,
      widgetOrders: {},
    });
  }

  function resetSwipe() {
    swipeStart.current = null;
    swipeAxis.current = null;
    setSwipeAnimating(false);
    setSwipeOffset(0);
    setSwipeNeighbor(null);
  }

  function handleSwipeStart(event: React.TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (!swipePageOrder.includes(page) || event.touches.length !== 1 || target.closest('input, textarea, select, [role="dialog"], .number-wheel-card, .chart-range, .widgets-editing, .widget-reorder-footer')) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    swipeAxis.current = null;
    setSwipeAnimating(false);
    setSwipeOffset(0);
    setSwipeNeighbor(null);
  }

  function handleSwipeMove(event: React.TouchEvent<HTMLElement>) {
    const start = swipeStart.current;
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (!swipeAxis.current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return;
      swipeAxis.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
    }
    if (swipeAxis.current !== 'x') return;
    event.preventDefault();
    const index = swipePageOrder.indexOf(page);
    const neighborIndex = dx < 0 ? index + 1 : index - 1;
    if (neighborIndex < 0 || neighborIndex >= swipePageOrder.length) {
      setSwipeNeighbor(null);
      setSwipeOffset(dx * 0.18);
      return;
    }
    setSwipeNeighbor(swipePageOrder[neighborIndex]);
    setSwipeOffset(dx);
  }

  function handleSwipeEnd(event: React.TouchEvent<HTMLElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1 || swipeAxis.current !== 'x') {
      resetSwipe();
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const index = swipePageOrder.indexOf(page);
    const nextIndex = dx < 0 ? Math.min(swipePageOrder.length - 1, index + 1) : Math.max(0, index - 1);
    const nextPage = swipePageOrder[nextIndex];
    const shouldChange = nextIndex !== index && Math.abs(dx) >= Math.min(92, event.currentTarget.clientWidth * 0.22);
    setSwipeAnimating(true);
    setSwipeOffset(shouldChange ? (dx < 0 ? -event.currentTarget.clientWidth : event.currentTarget.clientWidth) : 0);
    window.setTimeout(() => {
      if (shouldChange) setPage(nextPage);
      resetSwipe();
    }, 320);
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

  function renderPage(targetPage: Page) {
    let content: React.ReactNode;
    if (targetPage === 'today') content = (
      <TodayPage
        state={state}
        setState={setState}
        date={selectedDate}
        consumed={consumed}
        water={water}
        remaining={remaining}
        fastSeconds={fastSeconds}
        onWater={updateWater}
        onFast={toggleFast}
        onPastFast={addPastFast}
        onAddMeal={() => { setEditingMeal(null); setPlanningMeal(false); setMealOpen(true); }}
        onEditMeal={(meal) => { setEditingMeal(meal); setPlanningMeal(false); setMealOpen(true); }}
        onGo={setPage}
        healthSyncStatus={healthSyncStatus}
        healthSyncMessage={healthSyncMessage}
        onHealthSync={() => syncHealthConnect()}
      />
    );
    else if (targetPage === 'meals') content = (
      <MealsPage
        state={state}
        setState={setState}
        onPlan={(planDate) => { setSelectedDate(planDate); setPlanningMeal(true); setEditingMeal(null); setMealOpen(true); }}
        onEditPlan={(meal) => { setSelectedDate(meal.date); setPlanningMeal(true); setEditingMeal(meal); setMealOpen(true); }}
        meals={dayMeals}
        consumed={consumed}
        date={selectedDate}
        onAdd={() => { setEditingMeal(null); setPlanningMeal(false); setMealOpen(true); }}
        onEdit={(meal) => { setEditingMeal(meal); setPlanningMeal(false); setMealOpen(true); }}
        onDelete={(id) => patchState({ meals: state.meals.filter((meal) => meal.id !== id) })}
      />
    );
    else if (targetPage === 'workout') content = <WorkoutPage state={state} setState={setState} date={selectedDate} onGoJudo={() => setPage('judo')} />;
    else if (targetPage === 'judo') content = <JudoPage state={state} setState={setState} date={selectedDate} onBack={() => setPage('workout')} />;
    else if (targetPage === 'calendar') content = (
      <CalendarPage
        state={state}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        onOpenDay={() => setPage('today')}
        onEditMeal={(meal) => { setEditingMeal(meal); setPlanningMeal(false); setMealOpen(true); }}
      />
    );
    else if (targetPage === 'progress') content = <ProgressPage state={state} setState={setState} />;
    else content = <SettingsPage state={state} setState={setState} onReset={resetProfile} healthSyncStatus={healthSyncStatus} healthSyncMessage={healthSyncMessage} onHealthSync={() => syncHealthConnect()} />;
    return (
      <div className="page-composition" data-widget-page={targetPage}>
        {content}
        <WidgetReorderButton
          page={targetPage}
          label={pageLabels[targetPage]}
          order={state.widgetOrders[targetPage] ?? []}
          onChange={(order) => setState((current) => ({
            ...current,
            widgetOrders: { ...current.widgetOrders, [targetPage]: order },
          }))}
        />
      </div>
    );
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

      <section
        className="main-surface"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={resetSwipe}
      >
        <header className="topbar"><div className="topbar-inner">
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
        </div></header>

        <div className="page-swipe-layer">
          <div
            className={`page-swipe-current ${swipeAnimating ? 'animating' : ''}`}
            style={{ transform: `translate3d(${swipeOffset}px,0,0)` }}
          >
            {renderPage(page)}
          </div>
          {swipeNeighbor && (
            <div
              className={`page-swipe-neighbor ${swipeAnimating ? 'animating' : ''}`}
              aria-hidden="true"
              style={{
                transform: `translate3d(calc(${swipeNeighbor === swipePageOrder[swipePageOrder.indexOf(page) + 1] ? '100%' : '-100%'} + ${swipeOffset}px),0,0)`,
              }}
            >
              {renderPage(swipeNeighbor)}
            </div>
          )}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {mobileNavItems.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            className={`${page === id ? 'active' : ''} ${index === 3 ? 'after-add' : ''}`}
            onClick={() => setPage(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          className="add"
          aria-label="Adicionar refeição"
          onClick={() => { setEditingMeal(null); setPlanningMeal(false); setMealOpen(true); }}
        >
          <Plus />
        </button>
      </nav>

      {mealOpen && (
        <MealDialog
          key={editingMeal?.id ?? 'new-meal'}
          date={selectedDate}
          meal={editingMeal ?? undefined}
          customFoods={state.customFoods}
          history={state.meals}
          favorites={state.favoriteIngredients ?? []}
          onFavorites={(favoriteIngredients) => patchState({ favoriteIngredients })}
          planned={planningMeal}
          draft={state.mealDraft}
          onDraft={(mealDraft) => { try { localStorage.setItem('fitide-meal-draft', JSON.stringify(mealDraft)); } catch { /* Server save remains available. */ } setState(current => ({ ...current, mealDraft })); }}
          restoredLabelPhoto={restoredLabelPhoto}
          onRestoredLabelPhotoConsumed={() => setRestoredLabelPhoto(null)}
          onCustomFoodsChange={(customFoods) => patchState({ customFoods })}
          onClose={() => { setMealOpen(false); setEditingMeal(null); }}
          onSave={(meal) => {
            try { localStorage.setItem('fitide-meal-draft', 'null'); } catch { /* Optional local journal. */ }
            if (planningMeal) patchState({ mealDraft: undefined, plannedMeals: editingMeal ? (state.plannedMeals ?? []).map(item => item.id === meal.id ? meal : item) : [...(state.plannedMeals ?? []), meal] });
            else patchState({ mealDraft: undefined, meals: editingMeal ? state.meals.map((item) => item.id === meal.id ? meal : item) : [...state.meals, meal] });
            setMealOpen(false);
            setPlanningMeal(false);
            setEditingMeal(null);
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
  setState,
  date,
  consumed,
  water,
  remaining,
  fastSeconds,
  onWater,
  onFast,
  onPastFast,
  onAddMeal,
  onEditMeal,
  onGo,
  healthSyncStatus,
  healthSyncMessage,
  onHealthSync,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  date: string;
  consumed: Nutrients;
  water: number;
  remaining: number;
  fastSeconds: number;
  onWater: (delta: number) => void;
  onFast: (startAt?: string) => void;
  onPastFast: (startTime: string, endTime: string) => boolean;
  onAddMeal: () => void;
  onEditMeal: (meal: Meal) => void;
  onGo: (page: Page) => void;
  healthSyncStatus: 'idle' | 'syncing' | 'done' | 'error';
  healthSyncMessage: string;
  onHealthSync: () => Promise<boolean>;
}) {
  const caloriePercent = Math.min(
    100,
    Math.round((consumed.calories / state.goals.calorieTarget) * 100),
  );
  const selectedDay = new Date(`${date}T12:00:00`).getDay();
  const isToday = date === localDateKey();
  const activePlan = state.workoutPlans
    .filter((plan) => isScheduledForDate(plan, date, true))
    .sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'))[0];
  const scheduledActivities = state.activities
    .filter((activity) => isScheduledForDate(activity, date))
    .sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'));
  const checkInFor = (activityId: string, dateKey: string) =>
    state.activityCheckIns.find((entry) => entry.activityId === activityId && entry.date === dateKey);
  const effectiveActivitiesForDate = (dateKey: string) => {
    return state.activities.filter((activity) =>
      isScheduledForDate(activity, dateKey) && checkInFor(activity.id, dateKey)?.status !== 'skipped',
    );
  };
  const selectedDateValue = new Date(`${date}T12:00:00`);
  const weekStart = new Date(selectedDateValue);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weeklyExercise = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const dayKey = localDateKey(day);
    return exerciseCaloriesForDay(state.profile, effectiveActivitiesForDate(dayKey), day.getDay(), dayKey);
  }).reduce((sum, value) => sum + value, 0);
  const baseMaintenance = sedentaryTdee(state.profile);
  const exerciseToday = Math.round(exerciseCaloriesForDay(state.profile, effectiveActivitiesForDate(date), selectedDay, date));
  const weeklyMaintenance = Math.round(baseMaintenance + weeklyExercise / 7);
  const maintenance = Math.round(baseMaintenance + exerciseToday);
  const deficit = calorieDeficit(weeklyMaintenance, state.goals.calorieTarget);
  const weeklyFat = fatEquivalentKg(deficit);
  const health = state.healthSnapshots.find((entry) => entry.date === date);
  const recordedFast = state.fasts.find((entry) => localDateKey(new Date(entry.start)) === date);
  const latestMealTime = useMemo(() => {
    const nowTime = Date.now();
    const timestamps = state.meals
      .map((meal) => new Date(meal.createdAt).getTime())
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= nowTime);
    return timestamps.length ? new Date(Math.max(...timestamps)) : new Date();
  }, [state.meals]);
  const [pastFastStart, setPastFastStart] = useState('20:00');
  const [pastFastEnd, setPastFastEnd] = useState('12:00');
  const [pastFastMessage, setPastFastMessage] = useState('');
  const [pastFastEditing, setPastFastEditing] = useState(!recordedFast);
  const [fastStartDate, setFastStartDate] = useState(localDateKey());
  const [fastStartTime, setFastStartTime] = useState(localTimeValue());
  const [fastStartError, setFastStartError] = useState('');
  const [fastStartOpen, setFastStartOpen] = useState(false);
  const [waterMl, setWaterMl] = useState(250);
  const macroPie = [
    { name: 'Proteína', value: Math.round(consumed.protein * 4), fill: '#087fb7' },
    { name: 'Hidratos', value: Math.round(consumed.carbs * 4), fill: '#f06742' },
    { name: 'Gordura', value: Math.round(consumed.fat * 9), fill: '#13805f' },
    { name: 'Fibra', value: Math.round(consumed.fiber * 2), fill: '#35a6d1' },
  ].filter((item) => item.value > 0);
  const macroPieTotal = macroPie.reduce((total, item) => total + item.value, 0);
  let macroPieCursor = 0;
  const macroPieBackground = macroPieTotal
    ? `conic-gradient(${macroPie.map((item) => {
        const start = macroPieCursor;
        macroPieCursor += item.value / macroPieTotal * 100;
        return `${item.fill} ${start}% ${macroPieCursor}%`;
      }).join(',')})`
    : undefined;
  const recordedFastMinutes = recordedFast
    ? Math.max(0, Math.round((new Date(recordedFast.end).getTime() - new Date(recordedFast.start).getTime()) / 60_000))
    : 0;
  const recordedFastDuration = `${Math.floor(recordedFastMinutes / 60)} h${recordedFastMinutes % 60 ? ` ${recordedFastMinutes % 60} min` : ''}`;
  const fastingGoalSeconds = Math.max(1, state.goals.fastingHours * 3600);
  const fastingProgress = Math.min(100, Math.round((fastSeconds / fastingGoalSeconds) * 100));
  const fastStart = state.activeFastStart ? new Date(state.activeFastStart) : null;
  const fastTarget = fastStart ? new Date(fastStart.getTime() + fastingGoalSeconds * 1000) : null;
  const fastingGoalMet = Boolean(state.activeFastStart && fastSeconds >= fastingGoalSeconds);
  const nativeHealth = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  function setActivityCheckIn(activityId: string, status: 'completed' | 'skipped') {
    setState((current) => {
      const existing = current.activityCheckIns.find((entry) => entry.activityId === activityId && entry.date === date);
      const withoutCurrent = current.activityCheckIns.filter((entry) => !(entry.activityId === activityId && entry.date === date));
      return {
        ...current,
        activityCheckIns: existing?.status === status
          ? withoutCurrent
          : [...withoutCurrent, { activityId, date, status }],
      };
    });
  }

  useViewportLock(fastStartOpen);

  useEffect(() => {
    if (!fastStartOpen) return;
    const close = (event: Event) => {
      event.preventDefault();
      setFastStartOpen(false);
    };
    window.addEventListener('fitide-back', close);
    return () => window.removeEventListener('fitide-back', close);
  }, [fastStartOpen]);

  useEffect(() => {
    if (isToday) return;
    setPastFastStart(recordedFast ? localTimeValue(new Date(recordedFast.start)) : '20:00');
    setPastFastEnd(recordedFast ? localTimeValue(new Date(recordedFast.end)) : '12:00');
    setPastFastEditing(!recordedFast);
    setPastFastMessage('');
  }, [date, isToday]);

  function startFastFromSelection() {
    const selectedStart = new Date(`${fastStartDate}T${fastStartTime}:00`);
    if (Number.isNaN(selectedStart.getTime())) {
      setFastStartError('Escolhe uma data e uma hora válidas.');
      return;
    }
    if (selectedStart.getTime() > Date.now()) {
      setFastStartError('O início do jejum não pode estar no futuro.');
      return;
    }
    setFastStartError('');
    onFast(selectedStart.toISOString());
    setFastStartOpen(false);
  }

  function openFastStartDialog() {
    setFastStartDate(localDateKey(latestMealTime));
    setFastStartTime(localTimeValue(latestMealTime));
    setFastStartError('');
    setFastStartOpen(true);
  }
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
          label="Gasto estimado neste dia"
          value={maintenance.toLocaleString('pt-PT')}
          unit={`kcal · base ${baseMaintenance.toLocaleString('pt-PT')} + treino ${exerciseToday.toLocaleString('pt-PT')} · média semanal ${weeklyMaintenance.toLocaleString('pt-PT')}`}
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
      {(health || nativeHealth) && (
        <section className="health-strip">
          <div><HeartPulse /><span><small>Health Connect</small><strong>{health?.steps?.toLocaleString('pt-PT') ?? '—'} passos</strong>{healthSyncStatus === 'syncing' ? <em>A atualizar…</em> : healthSyncMessage ? <em className={healthSyncStatus === 'error' ? 'error' : ''}>{healthSyncMessage}</em> : health ? <em>Atualizado {new Date(health.syncedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</em> : <em>Toca para sincronizar</em>}</span><button type="button" className="health-refresh" aria-label="Sincronizar Health Connect agora" disabled={!nativeHealth || healthSyncStatus === 'syncing'} onClick={() => void onHealthSync()}><RotateCcw className={healthSyncStatus === 'syncing' ? 'spin' : ''} /></button></div>
          <div><small>Calorias ativas</small><strong>{health?.activeCalories === undefined ? '—' : `${Math.round(health.activeCalories)} kcal`}</strong></div>
          <div><small>Frequência média</small><strong>{health?.averageHeartRate === undefined ? '—' : `${Math.round(health.averageHeartRate)} bpm`}</strong></div>
          <div><small>Sono</small><strong>{health?.sleepMinutes === undefined ? '—' : `${Math.floor(health.sleepMinutes / 60)}h ${Math.round(health.sleepMinutes % 60)}m`}</strong></div>
        </section>
      )}
      {scheduledActivities.length > 0 && (
        <Card className="panel attendance-panel">
          <CardHeader>
            <p className="eyebrow">PRESENÇA NOS TREINOS</p>
            <CardTitle>Confirmar atividades deste dia</CardTitle>
            <CardDescription>“Não fui” retira essa sessão do gasto estimado diário e da média desta semana.</CardDescription>
          </CardHeader>
          <CardContent className="attendance-list">
            {scheduledActivities.map((activity) => {
              const checkIn = checkInFor(activity.id, date);
              return (
                <div key={activity.id} className="attendance-row">
                  <div><ActivityIcon /><span><strong>{activity.name}</strong><small>{activity.time ?? 'Hora por definir'} · {activity.minutes} min · intensidade {activityIntensity(activity)}/5</small></span></div>
                  <div className="attendance-actions">
                    <button type="button" className={checkIn?.status === 'completed' ? 'selected completed' : ''} onClick={() => setActivityCheckIn(activity.id, 'completed')}><Check /> Fui</button>
                    <button type="button" className={checkIn?.status === 'skipped' ? 'selected skipped' : ''} onClick={() => setActivityCheckIn(activity.id, 'skipped')}><X /> Não fui</button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
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
              .filter((meal) => meal.date === date).sort(mealOrder)
              .map((meal) => <button type="button" className="meal-edit-button" onClick={() => onEditMeal(meal)} key={meal.id}><MealRow meal={meal} /></button>)
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
            <CardTitle>{activePlan?.name ?? scheduledActivities[0]?.name ?? 'Plano por criar'}</CardTitle>
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
          ) : scheduledActivities[0] ? (
            <>
              <div className="training-meta">
                <span>{scheduledActivities[0].minutes} min</span>
                <span>{scheduledActivities[0].time ?? 'Sem hora'}</span>
                <span>Intensidade {activityIntensity(scheduledActivities[0])}/5</span>
              </div>
              <Button className="wide-button" onClick={() => onGo('workout')}>
                <Dumbbell /> Ver treinos do dia
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
          <div className="habit-tile water-habit">
            <div className="habit-heading">
              <span className="habit-icon"><Waves /></span>
              <span className="habit-copy">
                <small className="habit-label">Água diária</small>
                <strong>{formatLiters(water)} L</strong>
                <small>de {state.goals.waterLiters} L</small>
              </span>
              <span className="habit-badge">{Math.min(100, Math.round((water / state.goals.waterLiters) * 100))}%</span>
            </div>
            <Progress className="water-progress" value={(water / state.goals.waterLiters) * 100} />
            <div className="water-custom">
              <Field label="Quantidade (ml)">
                <NumberInput
                  value={waterMl}
                  min={50}
                  max={2000}
                  step="50"
                  ariaLabel="Quantidade de água"
                  onChange={setWaterMl}
                  onConfirm={(value) => onWater(value / 1000)}
                />
              </Field>
              <div className="stepper">
              <Button
                variant="outline"
                size="icon"
                aria-label={`Retirar ${waterMl} ml`}
                onClick={() => onWater(-waterMl / 1000)}
              >
                <Minus />
              </Button>
              <Button onClick={() => onWater(waterMl / 1000)}>+ {waterMl} ml</Button>
              </div>
            </div>
          </div>
          <div className="habit-tile fast-habit">
            <div className="fasting-card-head">
              <span className="habit-icon"><TimerReset /></span>
              <div><small className="habit-label">Jejum intermitente</small><strong>{state.activeFastStart ? 'Em curso' : 'Pronto para começar'}</strong></div>
              <span className={`habit-badge ${state.activeFastStart ? 'active' : ''}`}>{state.goals.fastingHours} h</span>
            </div>
            {isToday ? (
              <div className={`fasting-live ${state.activeFastStart ? 'is-active' : ''}`}>
                <div className="fasting-main-row">
                  <div className="fasting-clock">
                    <span>Tempo de jejum</span>
                    <strong>{formatFastDuration(fastSeconds)}</strong>
                    {!state.activeFastStart && recordedFast && <small>Último jejum: {recordedFastDuration}</small>}
                  </div>
                  <button
                    type="button"
                    className={`fasting-action ${state.activeFastStart ? 'stop' : 'start'}`}
                    style={{ '--fast-progress': `${fastingProgress * 3.6}deg` } as React.CSSProperties}
                    onClick={() => state.activeFastStart ? onFast() : openFastStartDialog()}
                    aria-label={state.activeFastStart ? 'Terminar jejum' : 'Iniciar jejum'}
                  >
                    {state.activeFastStart ? <><CirclePause /><span>FIM</span></> : <><CirclePlay /><span>INICIAR</span></>}
                  </button>
                </div>
                {fastStart && fastTarget && (
                  <>
                    <div className="fasting-times">
                      <div><span>Começou</span><strong>{fastStart.toLocaleDateString('pt-PT', { weekday: 'short' })}, {localTimeValue(fastStart)}</strong></div>
                      <div><span>Meta</span><strong>{fastTarget.toLocaleDateString('pt-PT', { weekday: 'short' })}, {localTimeValue(fastTarget)}</strong></div>
                    </div>
                    <div className={`fasting-status ${fastingGoalMet ? 'met' : ''}`}>
                      <Check />
                      <span>{fastingGoalMet ? `Meta alcançada: ${state.goals.fastingHours} h` : `${fastingProgress}% da meta`}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="past-fast-area">
                {recordedFast && !pastFastEditing ? (
                  <div className="past-fast-record">
                    <span><small>Jejum registado</small><strong>{recordedFastDuration}</strong><em>{localTimeValue(new Date(recordedFast.start))} → {localTimeValue(new Date(recordedFast.end))}</em></span>
                    <Button variant="outline" onClick={() => { setPastFastEditing(true); setPastFastMessage(''); }}>Editar</Button>
                  </div>
                ) : (
                  <div className="past-fast-form">
                    <label><span>Início</span><Input type="time" value={pastFastStart} onChange={(event) => setPastFastStart(event.target.value)} /></label>
                    <label><span>Fim</span><Input type="time" value={pastFastEnd} onChange={(event) => setPastFastEnd(event.target.value)} /></label>
                    <Button onClick={() => {
                      const wasCorrection = Boolean(recordedFast);
                      const saved = onPastFast(pastFastStart, pastFastEnd);
                      setPastFastMessage(saved ? (wasCorrection ? 'Jejum corrigido com sucesso.' : 'Jejum registado com sucesso.') : 'Não foi possível guardar estas horas.');
                      if (saved) setPastFastEditing(false);
                    }}><Save /> Guardar {recordedFast ? 'correção' : 'jejum'}</Button>
                    {recordedFast && <Button variant="ghost" onClick={() => { setPastFastEditing(false); setPastFastMessage(''); }}>Cancelar</Button>}
                  </div>
                )}
                {pastFastMessage && <small className={pastFastMessage.startsWith('Não') ? 'fast-start-error' : 'fast-save-success'}>{pastFastMessage}</small>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {fastStartOpen && (
        <OverlayPortal>
          <div className="dialog-backdrop fast-dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setFastStartOpen(false); }}>
            <section className="fast-dialog" role="dialog" aria-modal="true" aria-labelledby="fast-start-title">
              <header>
                <div><p className="eyebrow">NOVO JEJUM</p><h2 id="fast-start-title">Quando começaste?</h2></div>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={() => setFastStartOpen(false)}><X /></Button>
              </header>
              <p className="fast-dialog-suggestion"><Utensils /> Preenchido com a hora da última refeição registada.</p>
              <div className="fast-dialog-fields">
                <label><span>Data</span><Input type="date" max={localDateKey()} value={fastStartDate} onChange={(event) => { setFastStartDate(event.target.value); setFastStartError(''); }} /></label>
                <label><span>Hora</span><Input type="time" value={fastStartTime} onChange={(event) => { setFastStartTime(event.target.value); setFastStartError(''); }} /></label>
              </div>
              {fastStartError && <small className="fast-start-error">{fastStartError}</small>}
              <footer><Button type="button" variant="outline" onClick={() => setFastStartOpen(false)}>Cancelar</Button><Button type="button" onClick={startFastFromSelection}><CirclePlay /> Começar jejum</Button></footer>
            </section>
          </div>
        </OverlayPortal>
      )}
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
              <>
                <div className="macro-pie-chart" style={{ background: macroPieBackground }} role="img" aria-label="Distribuição dos macronutrientes">
                  <span><strong>{Math.round(consumed.calories)}</strong><small>kcal</small></span>
                </div>
                <div className="macro-pie-legend" aria-label="Legenda dos macronutrientes">
                  {macroPie.map((item) => <span key={item.name}><i style={{ backgroundColor: item.fill }} />{item.name}</span>)}
                </div>
              </>
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
  state, setState, onPlan, onEditPlan,
  meals,
  consumed,
  date,
  onAdd,
  onEdit,
  onDelete,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPlan: (date: string) => void;
  onEditPlan: (meal: Meal) => void;
  meals: Meal[];
  consumed: Nutrients;
  date: string;
  onAdd: () => void;
  onEdit: (meal: Meal) => void;
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
          label="Total"
          value={`${Math.round(consumed.calories)} kcal`}
        />
        <MiniStat label="Proteína" value={`${consumed.protein.toFixed(1)} g`} />
        <MiniStat label="Gordura" value={`${consumed.fat.toFixed(1)} g`} />
        <MiniStat
          label="Hidratos"
          value={`${consumed.carbs.toFixed(1)} g`}
        />
      </section>
      <div className="meal-list">
        {meals.length ? (
          meals.map((meal) => (
            <Card key={meal.id} className="meal-card">
              <CardContent>
                <button type="button" className="meal-edit-button" onClick={() => onEdit(meal)} aria-label={`Editar ${meal.type}`}>
                  <MealRow meal={meal} expanded />
                </button>
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
                text="Pesquisa no catálogo alimentar ou informa os valores do rótulo para começar."
                action="Adicionar refeição"
                onClick={onAdd}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MealDialog({
  history, favorites, onFavorites, planned = false,
  draft,
  onDraft,
  date,
  meal,
  customFoods,
  restoredLabelPhoto,
  onRestoredLabelPhotoConsumed,
  onCustomFoodsChange,
  onClose,
  onSave,
}: {
  history: Meal[];
  favorites: IngredientEntry[];
  onFavorites: (items: IngredientEntry[]) => void;
  planned?: boolean;
  draft?: AppState['mealDraft'];
  onDraft: (draft: AppState['mealDraft']) => void;
  date: string;
  meal?: Meal;
  customFoods: SavedFood[];
  restoredLabelPhoto?: NativeLabelPhotoResult | null;
  onRestoredLabelPhotoConsumed: () => void;
  onCustomFoodsChange: (foods: SavedFood[]) => void;
  onClose: () => void;
  onSave: (meal: Meal) => void;
}) {
  const restoredDraft = useRef(draft?.date === date && draft?.mealId === meal?.id && Boolean(draft?.planned) === planned ? draft : undefined).current;
  const [type, setType] = useState(restoredDraft?.type ?? meal?.type ?? 'Almoço');
  const [mode, setMode] = useState<'Catálogo' | 'Rótulo'>(restoredDraft?.mode ?? 'Catálogo');
  const [foodId, setFoodId] = useState(restoredDraft?.foodId ?? foodCatalog[0].id);
  const [foodQuery, setFoodQuery] = useState(restoredDraft?.foodQuery ?? '');
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const foodSearchRef = useRef<HTMLDivElement>(null);
  const [grams, setGrams] = useState(restoredDraft?.grams ?? 100);
  const [quantityMode, setQuantityMode] = useState<QuantityMode>(restoredDraft?.quantityMode ?? 'g');
  const [manualName, setManualName] = useState(restoredDraft?.manualName ?? '');
  const mealScrollRef = useRef<HTMLDivElement>(null);
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [assistantText, setAssistantText] = useState(restoredDraft?.assistantText ?? '');
  const [assistantDrafts, setAssistantDrafts] = useState<MealAssistantDraft[]>([]);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [entryMode, setEntryMode] = useState<'barcode' | 'catalog' | 'assistant' | 'food'>(restoredDraft?.entryMode ?? 'catalog');
  const labelPhotoInput = useRef<HTMLInputElement>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const assistantCache = useRef(new Map<string, string>());
  const labelCropImage = useRef<HTMLImageElement>(null);
  const labelWorker = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const labelScanRun = useRef(0);
  const restoredLabelPhotoHandled = useRef(false);
  const [labelPhotoUrl, setLabelPhotoUrl] = useState('');
  const [labelCrop, setLabelCrop] = useState<PercentCrop>({ unit: '%', x: 7, y: 18, width: 86, height: 62 });
  const [completedLabelCrop, setCompletedLabelCrop] = useState<PixelCrop>();
  const [labelScanStatus, setLabelScanStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [labelScanProgress, setLabelScanProgress] = useState(0);
  const [labelScanMessage, setLabelScanMessage] = useState('');
  const [manual, setManual] = useState<Record<keyof Nutrients, number | ''>>(restoredDraft?.manual ?? {
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    calcium: '',
    iron: '',
    vitaminC: '',
  });
  const [ingredients, setIngredients] = useState<IngredientEntry[]>(restoredDraft?.ingredients ?? meal?.ingredients ?? []);
  const draftCallback = useRef(onDraft); draftCallback.current = onDraft;
  useEffect(() => { draftCallback.current({ date, mealId: meal?.id, planned, type, ingredients, manualName, manual, grams, foodId, quantityMode, foodQuery, mode, entryMode, assistantText }); }, [date, meal?.id, planned, type, ingredients, manualName, manual, grams, foodId, quantityMode, foodQuery, mode, entryMode, assistantText]);
  const total = roundNutrients(sumNutrients(ingredients));
  const availableFoods = useMemo<FoodCatalogItem[]>(() => [
    ...customFoods.map((food) => ({ id: food.id, name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber, calcium: food.calcium, iron: food.iron, vitaminC: food.vitaminC })),
    ...foodCatalog,
  ], [customFoods]);
  const selectedFood = availableFoods.find((food) => food.id === foodId);
  const foodUsage = useMemo(() => new Map(frequentIngredients(history).map(item => [ingredientKey(item.ingredient.name), item.count])), [history]);
  const foodPriority = (name: string) => foodUsage.get(ingredientKey(name)) ?? 0;
  const foodMatches = useMemo(() => {
    if (!foodQuery.trim()) return [...availableFoods].sort((a,b) => foodPriority(b.name)-foodPriority(a.name)).slice(0, 8).map((food) => ({ food, score: 0 }));
    return availableFoods
      .map((food) => ({ food, score: foodMatchScore(foodQuery, food.name) }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          foodPriority(b.food.name)-foodPriority(a.food.name) || b.score - a.score || a.food.name.localeCompare(b.food.name, 'pt'),
      )
      .slice(0, 10);
  }, [availableFoods, foodQuery, foodUsage, favorites]);
  const resolvedFood = foodQuery.trim()
    ? normalizeText(selectedFood?.name ?? '') === normalizeText(foodQuery)
      ? selectedFood
      : foodMatches[0]?.food
    : selectedFood;
  const requiredManualKeys: Array<keyof Nutrients> = ['protein', 'carbs', 'fat', 'fiber'];
  const manualComplete = requiredManualKeys.every((key) => manual[key] !== '');
  const catalogGrams = resolvedFood
    ? quantityMode === 'unit'
      ? grams * averageUnitGrams(resolvedFood.name)
      : quantityMode === 'ml'
        ? grams * liquidDensity(resolvedFood.name)
        : grams
    : grams;

  useViewportLock(Boolean(labelPhotoUrl));

  useEffect(() => () => {
    if (labelPhotoUrl.startsWith('blob:')) URL.revokeObjectURL(labelPhotoUrl);
  }, [labelPhotoUrl]);

  useEffect(() => () => {
    labelScanRun.current += 1;
    const worker = labelWorker.current;
    labelWorker.current = null;
    void worker?.terminate().catch(() => undefined);
  }, []);

  function catalogAmountToGrams(food: FoodCatalogItem, amount: number, amountUnit: QuantityMode) {
    if (amountUnit === 'unit') return amount * averageUnitGrams(food.name);
    if (amountUnit === 'ml') return amount * liquidDensity(food.name);
    return amount;
  }

  function addCatalogIngredient(food: FoodCatalogItem, amount: number, amountUnit: QuantityMode) {
    const convertedGrams = catalogAmountToGrams(food, amount, amountUnit);
    const factor = convertedGrams / 100;
    setIngredients((current) => [
      ...current,
      {
        id: uid(),
        name: food.name,
        grams: Math.round(convertedGrams * 10) / 10,
        source: 'Catálogo',
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
    setGrams(100);
    setQuantityMode('g');
  }

  useEffect(() => {
    if (!foodSearchOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!foodSearchRef.current?.contains(event.target as Node)) setFoodSearchOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFoodSearchOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [foodSearchOpen]);

  function addIngredient() {
    if (mode === 'Catálogo') {
      const food = resolvedFood;
      if (!food) return;
      addCatalogIngredient(food, grams, quantityMode);
    } else if (manualName.trim() && manualComplete) {
      const per100 = {
        calories: manual.calories === ''
          ? Number(manual.protein) * 4 + Number(manual.carbs) * 4 + Number(manual.fat) * 9
          : Number(manual.calories),
        protein: Number(manual.protein),
        carbs: Number(manual.carbs),
        fat: Number(manual.fat),
        fiber: Number(manual.fiber),
        calcium: Number(manual.calcium || 0),
        iron: Number(manual.iron || 0),
        vitaminC: Number(manual.vitaminC || 0),
      };
      const factor = grams / 100;
      setIngredients([
        ...ingredients,
        {
          id: uid(),
          name: manualName.trim(),
          grams,
          source: 'Rótulo',
          ...roundNutrients({
            calories: per100.calories * factor,
            protein: per100.protein * factor,
            carbs: per100.carbs * factor,
            fat: per100.fat * factor,
            fiber: per100.fiber * factor,
            calcium: per100.calcium * factor,
            iron: per100.iron * factor,
            vitaminC: per100.vitaminC * factor,
          }),
        },
      ]);
      if (saveToCatalog) {
        const sameName = customFoods.find((food) => normalizeText(food.name) === normalizeText(manualName));
        const savedId = editingFoodId ?? sameName?.id ?? uid();
        const savedFood: SavedFood = {
          id: savedId,
          name: manualName.trim(),
          ...roundNutrients(per100),
          updatedAt: new Date().toISOString(),
        };
        onCustomFoodsChange(editingFoodId || sameName
          ? customFoods.map((food) => food.id === savedId ? savedFood : food)
          : [savedFood, ...customFoods]);
      }
      setManualName('');
      setManual({
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        calcium: '',
        iron: '',
        vitaminC: '',
      });
      setGrams(100);
      setSaveToCatalog(false);
      setEditingFoodId(null);
      setMode('Catálogo');
      setQuantityMode('g');
      setFoodId('');
      setFoodQuery('');
      setLabelScanStatus('idle');
      setLabelScanMessage('');
      requestAnimationFrame(() => mealScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }

  function editSavedFood(food: SavedFood) {
    setMode('Rótulo');
    setEditingFoodId(food.id);
    setManualName(food.name);
    setManual({
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      calcium: food.calcium,
      iron: food.iron,
      vitaminC: food.vitaminC,
    });
    setGrams(100);
    setSaveToCatalog(true);
  }

  function closeLabelCrop() {
    setLabelPhotoUrl('');
    setCompletedLabelCrop(undefined);
    if (labelPhotoInput.current) labelPhotoInput.current.value = '';
  }

  async function openLabelCrop(file: File) {
    const runId = labelScanRun.current + 1;
    labelScanRun.current = runId;
    setLabelScanStatus('reading');
    setLabelScanProgress(0);
    setLabelScanMessage('A otimizar a foto para não sobrecarregar a app…');
    setLabelCrop({ unit: '%', x: 7, y: 18, width: 86, height: 62 });
    setCompletedLabelCrop(undefined);
    try {
      const preview = await prepareNutritionPreview(file);
      if (labelScanRun.current !== runId) return;
      setLabelPhotoUrl(URL.createObjectURL(preview));
      setLabelScanStatus('idle');
      setLabelScanMessage('Recorta a tabela e deixa a coluna “por porção” fora da seleção.');
    } catch {
      if (labelScanRun.current !== runId) return;
      setLabelScanStatus('error');
      setLabelScanMessage('Não consegui preparar esta foto. Tenta novamente com a câmara mais próxima da tabela.');
      if (labelPhotoInput.current) labelPhotoInput.current.value = '';
    }
  }

  function openNativeLabelCrop(photo: NativeLabelPhotoResult) {
    const runId = labelScanRun.current + 1;
    labelScanRun.current = runId;
    setLabelScanProgress(0);
    setLabelCrop({ unit: '%', x: 7, y: 18, width: 86, height: 62 });
    setCompletedLabelCrop(undefined);
    try {
      setLabelPhotoUrl(nativeLabelPhotoUrl(photo));
      setLabelScanStatus('idle');
      setLabelScanMessage('Recorta a tabela e deixa a coluna “por porção” fora da seleção.');
    } catch {
      setLabelScanStatus('error');
      setLabelScanMessage('A câmara não conseguiu devolver uma imagem utilizável. Tenta novamente.');
    }
  }

  useEffect(() => {
    if (!restoredLabelPhoto || restoredLabelPhotoHandled.current) return;
    restoredLabelPhotoHandled.current = true;
    setEntryMode('catalog');
    setMode('Rótulo');
    setLabelScanStatus('reading');
    setLabelScanMessage('A recuperar a fotografia da câmara…');
    openNativeLabelCrop(restoredLabelPhoto);
    onRestoredLabelPhotoConsumed();
  }, [restoredLabelPhoto]);


  async function scanNutritionLabel(image: Blob) {
    const runId = labelScanRun.current + 1;
    labelScanRun.current = runId;
    setLabelScanStatus('reading');
    setLabelScanProgress(0);
    setLabelScanMessage('A preparar a leitura…');
    let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | undefined;
    try {
      let text: string;
      const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('image-read'));
          reader.readAsDataURL(image);
        });
      setLabelScanMessage('A ler com Gemini…');
      const remote = await fetch('/api/food-vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'label', image: encoded }), signal: AbortSignal.timeout(35000) }).catch(() => null);
      if (remote?.ok) { text = ((await remote.json()) as { text: string }).text; }
      else if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NutritionReader')) {
        setLabelScanMessage('Gemini indisponível; a usar o leitor local…');
        text = (await NativeNutritionReader.recognize({ image: encoded })).text;
      } else {
      const { createWorker, PSM } = await import('tesseract.js');
      worker = await createWorker('por', undefined, {
        logger: ({ status, progress }: { status: string; progress: number }) => {
          if (labelScanRun.current !== runId) return;
          const percent = Math.round((progress || 0) * 100);
          setLabelScanProgress(percent);
          setLabelScanMessage(status === 'recognizing text' ? `A ler o rótulo… ${percent}%` : 'A preparar o leitor…');
        },
      });
      labelWorker.current = worker;
      if (labelScanRun.current !== runId) return;
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      const { data } = await worker.recognize(image);
      text = data.text;
      }
      if (labelScanRun.current !== runId) return;
      const { values: recognized, basis } = readNutritionLabel(text);
      if (basis === 'ml') throw new Error('per-100ml');
      const entries = Object.entries(recognized) as Array<[keyof Nutrients, number]>;
      const macroEntries = entries.filter(([key]) => ['protein', 'carbs', 'fat', 'fiber'].includes(key));
      if (macroEntries.length === 0) throw new Error('no-values');
      setManual({ calories: '', protein: '', carbs: '', fat: '', fiber: '', calcium: '', iron: '', vitaminC: '', ...recognized });
      setLabelScanStatus('done');
      setLabelScanProgress(100);
      setLabelScanMessage(`${entries.length} valores por 100 g preenchidos. ${recognized.fiber === undefined ? 'Fibras não identificadas: confirma se aparecem no rótulo e preenche esse campo manualmente. ' : ''}Confere os valores antes de adicionar.`);
    } catch (error) {
      if (labelScanRun.current !== runId) return;
      setLabelScanStatus('error');
      setLabelScanMessage(
        error instanceof Error && error.message === 'per-100ml'
          ? 'Este rótulo tem valores por 100 ml, não por 100 g. Não preenchi automaticamente: é necessária a densidade do produto para converter para gramas.'
          : error instanceof Error && error.message === 'missing-per-100'
          ? 'Não consegui confirmar a referência por 100 g/ml. Inclui esse cabeçalho no recorte e exclui a coluna por porção.'
          : 'Não consegui ler os valores por 100 g/ml. Aproxima a câmara e recorta apenas essa informação.',
      );
    } finally {
      await worker?.terminate().catch(() => undefined);
      if (labelWorker.current === worker) labelWorker.current = null;
      if (labelPhotoInput.current) labelPhotoInput.current.value = '';
    }
  }

  async function scanSelectedLabelArea(useWholePhoto = false) {
    const image = labelCropImage.current;
    if (!image) return;
    const crop = useWholePhoto
      ? { unit: 'px' as const, x: 0, y: 0, width: image.width, height: image.height }
      : completedLabelCrop;
    if (!crop || crop.width < 40 || crop.height < 40) {
      setLabelScanStatus('error');
      setLabelScanMessage('Seleciona uma área maior da tabela nutricional.');
      return;
    }
    try {
      setLabelScanStatus('reading');
      setLabelScanMessage('A preparar a área selecionada…');
      const prepared = await prepareNutritionCrop(image, crop);
      closeLabelCrop();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await scanNutritionLabel(prepared);
    } catch {
      setLabelScanStatus('error');
      setLabelScanMessage('Não consegui preparar o recorte. Tenta tirar a foto novamente.');
    }
  }

  async function analyzeMealDescription() {
    if (assistantBusy || !assistantText.trim()) return;
    setAssistantBusy(true); setAssistantMessage('A interpretar com Gemini…');
    try {
      const original = assistantText.trim();
      let result = assistantCache.current.get(original);
      if (!result) {
        const response = await fetch('/api/food-vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'text', text: original }), signal: AbortSignal.timeout(35000) });
        const data = await response.json() as { text?: string; error?: string };
        if (!response.ok || !data.text) throw new Error(data.error ?? 'Não foi possível interpretar.');
        result = data.text; assistantCache.current.set(original, result);
      }
      buildAssistantDrafts(result);
    } catch (error) { setAssistantMessage(error instanceof Error ? error.message : 'Gemini indisponível. Tenta novamente.'); }
    finally { setAssistantBusy(false); }
  }
  function buildAssistantDrafts(text: string) {
    const parsed = parseMealDescription(text);
    if (!parsed.length) {
      setAssistantDrafts([]);
      setAssistantMessage('Escreve pelo menos um alimento e a respetiva quantidade.');
      return;
    }

    const drafts = parsed.map((part) => {
      const ranked = availableFoods
        .map((food) => ({ food, score: foodMatchScore(part.query, food.name) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'pt'))
        .slice(0, 5);
      return {
        id: uid(),
        ...part,
        foodId: ranked[0]?.food.id ?? '',
        candidateIds: ranked.map(({ food }) => food.id),
        score: ranked[0]?.score ?? 0,
      };
    });

    setAssistantDrafts(drafts);
    const unresolved = drafts.filter((draft) => !draft.foodId).length;
    setAssistantMessage(unresolved
      ? `${drafts.length - unresolved} de ${drafts.length} ingredientes reconhecidos. Corrige os restantes antes de adicionar.`
      : `${drafts.length} ingredientes reconhecidos. Confirma as sugestões abaixo.`);
  }

  function assistantDraftGrams(draft: MealAssistantDraft) {
    const food = availableFoods.find((item) => item.id === draft.foodId);
    if (!food) return 0;
    if (draft.unit === 'unit') return draft.amount * averageUnitGrams(food.name);
    if (draft.unit === 'ml') return draft.amount * liquidDensity(food.name);
    return draft.amount;
  }

  function addAssistantIngredients() {
    const recognized = assistantDrafts.flatMap((draft) => {
      const food = availableFoods.find((item) => item.id === draft.foodId);
      const convertedGrams = assistantDraftGrams(draft);
      if (!food || !convertedGrams) return [];
      const factor = convertedGrams / 100;
      return [{
        id: uid(),
        name: food.name,
        grams: Math.round(convertedGrams * 10) / 10,
        source: 'Catálogo' as const,
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
      }];
    });
    if (!recognized.length) return;
    setIngredients((current) => [...current, ...recognized]);
    setAssistantText('');
    setAssistantDrafts([]);
    setAssistantMessage(`${recognized.length} ingredientes adicionados à refeição.`);
    setEntryMode('catalog');
    setMode('Catálogo');
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
            <p className="eyebrow">{planned ? 'PLANEAR REFEIÇÃO' : meal ? 'EDITAR REFEIÇÃO' : 'NOVA REFEIÇÃO'}</p>
            <h2 id="meal-title">{meal ? 'Corrige os dados da refeição' : 'O que comeste?'}</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        </header>
        <div className="dialog-scroll" ref={mealScrollRef}>
          {planned && <p>Planeada para {date}. Não será contada no consumo até marcares «Já comi».</p>}
          <div className="meal-entry-options">
            <div className="field" role="group" aria-label="Tipo de refeição"><span>Tipo de refeição</span>
              <div className="meal-type-cards">{['Pequeno-almoço', 'Almoço', 'Lanche', 'Jantar', 'Ceia'].map((item, index) => <button type="button" key={item} aria-pressed={type === item} onClick={() => setType(item)}><span>{['☕', '🍽️', '🍎', '🍲', '🌙'][index]}</span>{item}</button>)}</div>
            </div>
            <div className="field" role="group" aria-label="Como queres adicionar?"><span>Como queres adicionar?</span>
              <div className="meal-entry-modes">
                {([['barcode', Barcode, 'Código de barras'], ['catalog', BookOpen, 'Catálogo'], ['assistant', Sparkles, 'Assistente'], ['food', Camera, 'Fotografar prato']] as const).map(([value, Icon, label]) => <button type="button" key={value} aria-pressed={entryMode === value} onClick={() => { setEntryMode(value); setFoodSearchOpen(false); }}><span aria-hidden="true"><Icon /></span>{label}</button>)}
              </div>
            </div>
          </div>
          {(entryMode === 'barcode' || entryMode === 'food') && <FoodPhotoTools key={entryMode} mode={entryMode} onLabelPhoto={file => { setMode('Rótulo'); void openLabelCrop(file); }} onText={(text, kind) => {
            if (kind === 'food') { setAssistantText(text); setEntryMode('assistant'); buildAssistantDrafts(text); }
            else { const result = readNutritionLabel(text); if (result.basis !== 'g') throw new Error('Não consegui confirmar valores por 100 g.'); setMode('Rótulo'); setManual({ calories: '', protein: '', carbs: '', fat: '', fiber: '', calcium: '', iron: '', vitaminC: '', ...result.values }); }
          }} onProduct={(name, values) => { setManualName(name); setEntryMode('catalog'); setMode('Rótulo'); setManual({ calories: '', protein: '', carbs: '', fat: '', fiber: '', calcium: '', iron: '', vitaminC: '', ...values }); }} />}
          {entryMode === 'assistant' && <section className="meal-assistant is-open" aria-label="Assistente de refeições">
            <div className="meal-assistant-body">
              <textarea
                value={assistantText}
                rows={3}
                placeholder="Ex.: 1 maçã, 50 g de lentilhas, 2 wraps e 250 ml de leite"
                onChange={(event) => {
                  setAssistantText(event.target.value);
                  setAssistantMessage('');
                }}
              />
              <div className="meal-assistant-actions">
                <small>{assistantMessage || 'Gemini interpreta a descrição; os macros vêm do catálogo. Revê as quantidades: quando omitidas, são estimadas.'}</small>
                <Button type="button" disabled={assistantBusy || !assistantText.trim()} onClick={() => void analyzeMealDescription()}>
                  <Sparkles /> Interpretar prato
                </Button>
              </div>
              {assistantDrafts.length > 0 && (
                <div className="meal-assistant-results">
                {assistantDrafts.map((draft) => {
                  const food = availableFoods.find((item) => item.id === draft.foodId);
                  const convertedGrams = assistantDraftGrams(draft);
                  return (
                    <article key={draft.id} className={!food ? 'unresolved' : ''}>
                      <div className="assistant-food-match">
                        <small>{draft.original}</small>
                        {draft.candidateIds.length ? (
                          <select
                            aria-label={`Alimento correspondente a ${draft.original}`}
                            value={draft.foodId}
                            onChange={(event) => setAssistantDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, foodId: event.target.value } : item))}
                          >
                            {draft.candidateIds.map((candidateId) => {
                              const candidate = availableFoods.find((item) => item.id === candidateId);
                              return candidate ? <option key={candidate.id} value={candidate.id}>{candidate.name}</option> : null;
                            })}
                          </select>
                        ) : (
                          <strong>Alimento não encontrado</strong>
                        )}
                      </div>
                      <NumberInput
                        value={draft.amount}
                        ariaLabel={`Quantidade de ${draft.query}`}
                        unit={draft.unit}
                        unitOptions={foodQuantityOptions}
                        onUnitChange={(unit) => setAssistantDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, unit } : item))}
                        onChange={(value) => setAssistantDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, amount: Number(value) } : item))}
                      />
                      <div className="assistant-estimate">
                        <strong>{food ? `${Math.round(food.calories * convertedGrams / 100)} kcal` : '—'}</strong>
                        <small>{food ? `${Math.round(convertedGrams)} g estimados` : 'Pesquisa manual necessária'}</small>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="assistant-delete"
                        aria-label={`Remover ${draft.original}`}
                        onClick={() => setAssistantDrafts((current) => current.filter((item) => item.id !== draft.id))}
                      >
                        <X />
                      </Button>
                    </article>
                  );
                })}
                <Button type="button" disabled={!assistantDrafts.some((draft) => draft.foodId)} onClick={addAssistantIngredients}>
                  <Plus /> Adicionar ingredientes reconhecidos
                </Button>
                </div>
              )}
            </div>
          </section>}
          {entryMode === 'catalog' && <>
            <Field label="Catálogo ou rótulo">
              <div className="segmented">
                <button
                  className={mode === 'Catálogo' ? 'selected' : ''}
                  onClick={() => {
                    setMode('Catálogo');
                    setGrams(100);
                    setQuantityMode('g');
                  }}
                  type="button"
                >
                  Catálogo
                </button>
                <button
                  className={mode === 'Rótulo' ? 'selected' : ''}
                  onClick={() => {
                    setMode('Rótulo');
                    setGrams(100);
                    setQuantityMode('g');
                    setFoodSearchOpen(false);
                  }}
                  type="button"
                >
                  Rótulo
                </button>
              </div>
            </Field>

          {mode === 'Catálogo' ? (
            <div className="ingredient-input">
              <Field label="Pesquisar alimento">
                <div className="food-search" ref={foodSearchRef}>
                  <Input
                    value={foodQuery}
                    autoComplete="off"
                    placeholder="Ex.: arroz integral, banana, frango…"
                    onFocus={() => setFoodSearchOpen(true)}
                    onChange={(event) => {
                      setFoodQuery(event.target.value);
                      setGrams(100);
                      setQuantityMode('g');
                      setFoodSearchOpen(true);
                    }}
                  />
                  {foodSearchOpen && (
                    <div className="food-results">
                      {foodMatches.length ? (
                        foodMatches.map(({ food, score }) => (
                          <button
                            type="button"
                            key={food.id}
                            onClick={() => {
                              setFoodId(food.id);
                              setFoodQuery(food.name);
                              setGrams(100);
                              setQuantityMode('g');
                              setFoodSearchOpen(false);
                            }}
                          >
                            <strong>{food.name}</strong>
                            <small><span>{Math.round(food.calories)} kcal / 100 g</span><em>{score ? foodMatchLabel(foodQuery, food, score) : 'Sugestão'}</em></small>
                          </button>
                        ))
                      ) : (
                        <p>Não encontrei um alimento semelhante.</p>
                      )}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Quantidade">
                <NumberInput
                  value={grams}
                  ariaLabel="Quantidade do alimento"
                  unit={quantityMode}
                  unitOptions={foodQuantityOptions}
                  onUnitChange={setQuantityMode}
                  onChange={(value, selectedUnit) => {
                    const nextUnit = selectedUnit ?? quantityMode;
                    const explicitlySelectedFood = selectedFood
                      && normalizeText(selectedFood.name) === normalizeText(foodQuery)
                      ? selectedFood
                      : undefined;
                    if (explicitlySelectedFood) {
                      addCatalogIngredient(explicitlySelectedFood, value, nextUnit);
                    } else {
                      setGrams(value);
                    }
                  }}
                />
              </Field>
              <Button type="button" onClick={() => addIngredient()}>
                <Plus /> Adicionar
              </Button>
              <small className="field-hint food-match-hint">
                {resolvedFood
                  ? `${resolvedFood.name} · ${quantityMode === 'g' ? `${grams} g` : `estimativa de ${Math.round(catalogGrams)} g`}`
                  : `Escreve o nome ou uma descrição aproximada para pesquisar nos ${availableFoods.length.toLocaleString('pt-PT')} alimentos.`}
              </small>
            </div>
          ) : (
            <div className="manual-food">
              <section className={`label-scanner ${labelScanStatus}`} aria-live="polite">
                <FoodPhotoTools mode="label" onLabelPhoto={file => void openLabelCrop(file)} onText={() => undefined} onProduct={() => undefined} />
                <small>Apenas valores por 100 g. Também podes preencher os campos manualmente.</small>
                {labelScanStatus === 'reading' && <Progress value={labelScanProgress} />}
                {labelScanMessage && <small className="label-scan-message">{labelScanMessage}</small>}
              </section>
              {labelPhotoUrl && (
                <OverlayPortal>
                  <div className="label-crop-backdrop" role="presentation">
                    <section className="label-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="label-crop-title">
                      <header>
                        <div>
                          <p className="eyebrow">RECORTAR RÓTULO</p>
                          <h2 id="label-crop-title">Seleciona só a tabela nutricional</h2>
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar recorte" onClick={closeLabelCrop}><X /></Button>
                      </header>
                      <p className="label-crop-help">Inclui os nomes, “100 g/ml” e a primeira coluna de valores. Deixa “por porção” e “%DR” fora da caixa.</p>
                      <div className="label-crop-stage">
                        <ReactCrop
                          crop={labelCrop}
                          onChange={(_, percentCrop) => setLabelCrop(percentCrop)}
                          onComplete={(pixelCrop) => setCompletedLabelCrop(pixelCrop)}
                          keepSelection
                          ruleOfThirds
                          minWidth={70}
                          minHeight={70}
                          ariaLabels={{
                            cropArea: 'Área da tabela nutricional',
                            nwDragHandle: 'Canto superior esquerdo',
                            nDragHandle: 'Lado superior',
                            neDragHandle: 'Canto superior direito',
                            eDragHandle: 'Lado direito',
                            seDragHandle: 'Canto inferior direito',
                            sDragHandle: 'Lado inferior',
                            swDragHandle: 'Canto inferior esquerdo',
                            wDragHandle: 'Lado esquerdo',
                          }}
                        >
                           <img
                            ref={labelCropImage}
                            src={labelPhotoUrl}
                            alt="Foto do rótulo para recortar"
                             onLoad={(event) => {
                              const image = event.currentTarget;
                              setCompletedLabelCrop({
                                unit: 'px',
                                x: image.width * 0.07,
                                y: image.height * 0.18,
                                width: image.width * 0.86,
                                height: image.height * 0.62,
                               });
                             }}
                             onError={() => {
                               closeLabelCrop();
                               setLabelScanStatus('error');
                               setLabelScanMessage('Não consegui abrir esta fotografia. Tenta novamente mais perto da tabela.');
                             }}
                           />
                        </ReactCrop>
                      </div>
                      <footer>
                        <Button type="button" variant="ghost" disabled={labelScanStatus === 'reading'} onClick={() => void scanSelectedLabelArea(true)}>Usar foto inteira</Button>
                        <Button type="button" disabled={labelScanStatus === 'reading'} onClick={() => void scanSelectedLabelArea()}>
                          {labelScanStatus === 'reading' ? <LoaderCircle className="spin" /> : <Camera />}
                          {labelScanStatus === 'reading' ? 'A preparar…' : 'Ler esta área'}
                        </Button>
                      </footer>
                    </section>
                  </div>
                </OverlayPortal>
              )}
              <div className="form-grid two">
                <Field label="Nome">
                  <Input
                    value={manualName}
                    onChange={(e) => {
                      setManualName(e.target.value);
                      setGrams(100);
                    }}
                    placeholder="Ex.: iogurte proteico"
                  />
                </Field>
                <Field label="Peso da porção (g)">
                  <NumberInput value={grams} min={1} max={2000} ariaLabel="Peso da porção consumida em gramas" onChange={setGrams} />
                </Field>
              </div>
              <p className="field-hint">Indica os valores do rótulo por 100 g. Proteína, hidratos, gordura e fibra são obrigatórios; a energia é calculada se ficar vazia.</p>
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
                        ? 'kcal (opcional)'
                        : key === 'protein'
                          ? 'Proteína g *'
                          : key === 'carbs'
                            ? 'Hidratos g *'
                            : key === 'fat'
                              ? 'Gordura g *'
                              : key === 'fiber'
                                ? 'Fibra g *'
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
              <label className="save-food-option">
                <input type="checkbox" checked={saveToCatalog} onChange={(event) => setSaveToCatalog(event.target.checked)} />
                <span>{editingFoodId ? 'Atualizar este alimento no meu catálogo' : 'Guardar este ingrediente no meu catálogo'}</span>
              </label>
              <Button type="button" disabled={!manualName.trim() || !manualComplete} onClick={addIngredient}>
                <Plus /> {editingFoodId ? 'Atualizar e adicionar' : 'Adicionar ingrediente'}
              </Button>
              {customFoods.length > 0 && (
                <details className="saved-foods">
                  <summary>Os meus alimentos ({customFoods.length})</summary>
                  {customFoods.map((food) => (
                    <div key={food.id}>
                      <span>{food.name}</span>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${food.name}`} onClick={() => editSavedFood(food)}><Settings /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${food.name}`} onClick={() => onCustomFoodsChange(customFoods.filter((item) => item.id !== food.id))}><Trash2 /></Button>
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}
          </>}
          <details className="ingredient-list" open>
            <summary className="ingredient-head">
              <strong>Ingredientes</strong>
              <span>{ingredients.length}</span>
            </summary>
            {ingredients.map((item) => (
              <div className="ingredient-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <Button type="button" variant="ghost" className="ingredient-favorite" size="icon" title="Guardar favorito" aria-label={`Favorito ${item.name}`} aria-pressed={favorites.some(f => ingredientKey(f.name) === ingredientKey(item.name))} onClick={() => onFavorites(favorites.some(f => ingredientKey(f.name) === ingredientKey(item.name)) ? favorites.filter(f => ingredientKey(f.name) !== ingredientKey(item.name)) : [...favorites, item])}>{favorites.some(f => ingredientKey(f.name) === ingredientKey(item.name)) ? <Star /> : <StarOutline />}</Button>
                  <div className="ingredient-weight-edit">
                    <NumberInput
                      compact
                      value={item.grams}
                      min={0}
                      max={Math.max(5000, item.grams)}
                      decimalPlaces={1}
                      ariaLabel={`Peso de ${item.name} (g)`}
                      onChange={(grams) => setIngredients((current) => current.map((entry) => entry.id === item.id ? updateIngredientWeight(entry, grams) : entry))}
                    />

                  </div>
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
          </details>
          <div className="nutrition-total">
            <MiniStat
              label="Total"
              value={`${Math.round(total.calories)} kcal`}
            />
            <MiniStat label="Proteína" value={`${total.protein} g`} />
            <MiniStat label="Gorduras" value={`${total.fat} g`} />
            <MiniStat label="Hidratos" value={`${total.carbs} g`} />
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
                id: meal?.id ?? uid(),
                date: meal?.date ?? date,
                type,
                ingredients,
                createdAt: meal?.createdAt ?? new Date().toISOString(),
              })
            }
          >
            <Save /> {planned ? 'Guardar planeamento' : meal ? 'Guardar alterações' : 'Guardar refeição'}
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
  const activePlan = state.activeWorkout?.plan ?? null;
  const startedAt = state.activeWorkout?.startedAt ?? null;
  const completedSets = state.activeWorkout?.completedSets ?? [];
  const setValues = state.activeWorkout?.setValues ?? {};
  const restEndAt = state.activeWorkout?.restEndAt ?? 0;
  const [minimized, setMinimized] = useState(false);
  function updateWorkout(patch: Partial<NonNullable<AppState['activeWorkout']>>) {
    setState(current => current.activeWorkout ? { ...current, activeWorkout: { ...current.activeWorkout, ...patch } } : current);
  }
  function setCompletedSets(completedSets: string[]) { updateWorkout({ completedSets }); }
  function setSetValues(update: (values: NonNullable<AppState['activeWorkout']>['setValues']) => NonNullable<AppState['activeWorkout']>['setValues']) {
    setState(current => current.activeWorkout ? { ...current, activeWorkout: { ...current.activeWorkout, setValues: update(current.activeWorkout.setValues) } } : current);
  }
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [demoExercise, setDemoExercise] = useState<WorkoutExercise | null>(null);
  const duePlans = state.workoutPlans
    .filter((plan) => isScheduledForDate(plan, date, true))
    .sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'));
  const linkedActivityIds = new Set(duePlans.map((plan) => plan.activityId).filter(Boolean));
  const nextPlan = duePlans.find(plan => !state.workoutSessions.some(session => session.date === date && (session.planId === plan.id || (!session.planId && session.planName === plan.name))));
  const dueActivities = state.activities.filter((activity) => isScheduledForDate(activity, date) && !linkedActivityIds.has(activity.id));
  const scheduleItems = [
    ...duePlans.map((plan) => ({ type: 'plan' as const, id: plan.id, time: plan.time, plan })),
    ...dueActivities.map((activity) => ({ type: 'activity' as const, id: activity.id, time: activity.time, activity })),
  ].sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'));

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setRest(Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [startedAt, restEndAt]);
  const alertedRest = useRef(0);
  useEffect(() => {
    if (restEndAt && rest === 0 && Date.now() >= restEndAt && alertedRest.current !== restEndAt) {
      alertedRest.current = restEndAt;
      if (!Capacitor.isNativePlatform()) playWorkoutSound('done');
    }
  }, [rest, restEndAt]);

  function startWorkout(plan: WorkoutPlan) {
    if (activePlan) { setMinimized(false); return; }
    const remembered = (exercise: WorkoutExercise, index: number) => { const sets = latestExerciseSets(exercise, state.workoutSessions, date, plan.id); return sets.length ? sets[Math.min(index, sets.length - 1)] : { load: exercise.weightKg ?? 0, reps: Number.parseInt(exercise.reps, 10) || 12 }; };
    prepareWorkoutSound();
    setMinimized(false);
    setElapsed(0);
    setRest(0);
    setState(current => ({ ...current, activeWorkout: { plan, date, startedAt: Date.now(), restEndAt: 0, completedSets: [], setValues: Object.fromEntries(plan.exercises.flatMap((exercise) =>
      Array.from({ length: exercise.sets }, (_, setIndex) => [
        `${exercise.id}-${setIndex}`,
        remembered(exercise, setIndex),
      ]),
    )) } }));
  }

  function startExerciseRest(exercise: WorkoutExercise) {
    if (exercise.restSeconds <= 0) return;
    prepareWorkoutSound();
    setRest(exercise.restSeconds);
    updateWorkout({ restEndAt: Date.now() + exercise.restSeconds * 1000 });
    if (Capacitor.isNativePlatform()) {
      void NativeWorkoutTimer.start({
        name: `Descanso · ${exercise.name}`,
        mode: 'interval',
        workSeconds: exercise.restSeconds,
        restSeconds: 0,
        rounds: 1,
      }).catch(() => undefined);
    }
  }

  function finishWorkout() {
    if (!activePlan || !startedAt) return;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const calories = Math.round(
      5 * state.profile.currentWeightKg * (minutes / 60),
    );
    setState((current) => ({
      ...current,
      activeWorkout: undefined,
      activityCheckIns: activePlan.activityId ? [
        ...current.activityCheckIns.filter(checkIn => !(checkIn.activityId === activePlan.activityId && checkIn.date === (current.activeWorkout?.date ?? date))),
        { activityId: activePlan.activityId, date: current.activeWorkout?.date ?? date, status: 'completed' as const },
      ] : current.activityCheckIns,
      workoutSessions: [
        ...current.workoutSessions,
        {
          id: uid(),
          date: current.activeWorkout?.date ?? date,
          planId: activePlan.id,
          activityId: activePlan.activityId,
          planName: activePlan.name,
          exercises: activePlan.exercises.map(exercise => ({ key: exerciseKey(exercise), name: exercise.name, equipment: exercise.equipment, sets: Array.from({ length: exercise.sets }, (_, index) => { const key = `${exercise.id}-${index}`; const values = setValues[key]; return completedSets.includes(key) && values && typeof values.load === 'number' && Number.isFinite(values.load) && values.load >= 0 && typeof values.reps === 'number' && Number.isFinite(values.reps) && values.reps > 0 ? { load: values.load, reps: values.reps } : null; }).filter((value): value is { load: number; reps: number } => value !== null) })).filter(exercise => exercise.sets.length > 0),
          minutes,
          completedSets: completedSets.length,
          calories,
        },
      ],
    }));
    setElapsed(0);
    setRest(0);
    if (Capacitor.isNativePlatform()) void NativeWorkoutTimer.stop().catch(() => undefined);
  }

  if (activePlan && !minimized)
    return (
      <div className="content-page workout-live page-enter">
        <section className="live-header">
          <Button variant="ghost" onClick={() => setMinimized(true)}>
            <ArrowLeft /> Voltar
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
            <Button size="sm" variant="ghost" onClick={() => { setRest(0); updateWorkout({ restEndAt: 0 }); if (Capacitor.isNativePlatform()) void NativeWorkoutTimer.stop().catch(() => undefined); }}>
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
                {exercise.gifUrl && (
                  <Button type="button" variant="outline" size="sm" className="show-demo" onClick={() => setDemoExercise(exercise)}>
                    <CirclePlay /> Ver execução
                  </Button>
                )}
              </CardHeader>
              <CardContent>
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
                              startExerciseRest(exercise);
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
        {demoExercise && <ExerciseDemoDialog exercise={demoExercise} onClose={() => setDemoExercise(null)} />}
      </div>
    );

  return (
    <div className="content-page page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">TREINO DO DIA</p>
          {activePlan && <Button onClick={() => setMinimized(false)}>Retomar {activePlan.name}</Button>}
          <h2>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <p>As sessões agendadas aparecem por ordem de hora.</p>
        </div>
        <div className="page-intro-actions">
          <Button variant="outline" size="lg" onClick={onGoJudo}>
            <BookOpen /> Área de judô
          </Button>
          {nextPlan && (
            <Button size="lg" onClick={() => startWorkout(nextPlan)}>
              <CirclePlay /> Começar treino
            </Button>
          )}
        </div>
      </section>
      <div className="workout-day-list">
          <TrainingTimer state={state} setState={setState} />
          <WorkoutProgression state={state} setState={setState} />
          {scheduleItems.length ? (
            scheduleItems.map((item) => item.type === 'plan' ? (
              <PlanCard key={`plan-${item.id}`} plan={item.plan} completed={state.workoutSessions.some(session => session.date === date && (session.planId === item.id || (!session.planId && session.planName === item.plan.name)))} onStart={() => startWorkout(item.plan)} />
            ) : (
              <ActivityScheduleCard key={`activity-${item.id}`} activity={item.activity} completed={state.activityCheckIns.some(checkIn => checkIn.activityId === item.id && checkIn.date === date && checkIn.status === 'completed')} onOpenJudo={normalizeText(item.activity.name).includes('judo') ? onGoJudo : undefined} />
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
              <details>
              <summary className="workout-history-toggle">Últimos treinos <ChevronDown size={18} /></summary>
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
              </details>
            </Card>
          )}
      </div>
    </div>
  );
}

function ActivityScheduleCard({
  activity,
  onOpenJudo,
  completed,
}: {
  activity: Activity;
  onOpenJudo?: () => void;
  completed?: boolean;
}) {
  return (
    <Card className="panel scheduled-activity-card">
      <CardHeader className="panel-heading">
        <div>
          <p className="eyebrow">{activity.specificDate ? 'ATIVIDADE PONTUAL' : 'ATIVIDADE SEMANAL'}</p>
          <CardTitle>{activity.name}</CardTitle>
          {completed && <span className="workout-done"><Check size={16} /> Concluído</span>}
        </div>
        <span className="time-badge">{activity.time ?? 'Sem hora'}</span>
      </CardHeader>
      <CardContent>
        <div className="scheduled-activity-meta">
          <span><TimerReset /> {activity.minutes} min</span>
          <span><Flame /> Intensidade {activityIntensity(activity)}/5</span>
        </div>
        {onOpenJudo && <Button size="lg" className="wide-button" onClick={onOpenJudo}><BookOpen /> Abrir área de judô</Button>}
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  onStart,
  onDelete,
  completed,
}: {
  plan: WorkoutPlan;
  onStart: () => void;
  onDelete?: () => void;
  completed?: boolean;
}) {
  const [demoExercise, setDemoExercise] = useState<WorkoutExercise | null>(null);
  return (
    <>
    <Card className="panel plan-card">
      <CardHeader className="panel-heading">
        <div>
          <p className="eyebrow">ROTINA SUGERIDA</p>
          <CardTitle>{plan.name}</CardTitle>
          {completed && <span className="workout-done"><Check size={16} /> Concluído neste dia</span>}
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
            <button type="button" key={exercise.id} onClick={() => setDemoExercise(exercise)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{exercise.name}</strong>
                <small>
                  {exercise.target} · {exercise.equipment}
                </small>
              </div>
              <b>
                {exercise.sets} × {exercise.reps}
              </b>
              <CirclePlay className="plan-play" />
            </button>
          ))}
        </div>
        <Button size="lg" className="wide-button" onClick={onStart}>
          <CirclePlay /> {completed ? 'Repetir treino' : 'Começar este treino'}
        </Button>
      </CardContent>
    </Card>
    {demoExercise && <ExerciseDemoDialog exercise={demoExercise} onClose={() => setDemoExercise(null)} />}
    </>
  );
}

function ExerciseDemoDialog({ exercise, onClose }: { exercise: WorkoutExercise; onClose: () => void }) {
  useEffect(() => {
    const close = (event: Event) => { event.preventDefault(); onClose(); };
    window.addEventListener('fitide-back', close);
    return () => window.removeEventListener('fitide-back', close);
  }, [onClose]);
  return (
    <OverlayPortal><div className="dialog-backdrop exercise-demo-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="exercise-demo-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-demo-title">
        <header>
          <div><p className="eyebrow">EXECUÇÃO</p><h2 id="exercise-demo-title">{exercise.name}</h2></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar demonstração" onClick={onClose}><X /></Button>
        </header>
        {exercise.gifUrl ? <img src={exercise.gifUrl} alt={`Demonstração de ${exercise.name}`} /> : <div className="demo-unavailable"><Dumbbell /><p>Demonstração indisponível para este exercício.</p></div>}
        <div className="exercise-demo-stats"><MiniStat label="Séries" value={String(exercise.sets)} /><MiniStat label="Repetições" value={exercise.reps} /><MiniStat label="Peso inicial" value={`${exercise.weightKg ?? 0} kg`} /><MiniStat label="Descanso" value={`${exercise.restSeconds} s`} /></div>
        <p>{exercise.target} · {exercise.equipment}</p>
      </section>
    </div></OverlayPortal>
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
  const [expanded, setExpanded] = useState(false);
  const nativeStarted = useRef(false);

  async function callNative(action: () => Promise<void>) {
    if (!Capacitor.isNativePlatform()) return;
    try { await action(); } catch { /* O cronómetro web continua funcional. */ }
  }

  function resetTimer() {
    setRunning(false);
    setPhase('work');
    setRound(1);
    setRemaining(workSeconds);
    setFreeElapsed(0);
    nativeStarted.current = false;
    void callNative(() => NativeWorkoutTimer.stop());
  }

  async function toggleRunning() {
    if (running) {
      setRunning(false);
      await callNative(() => NativeWorkoutTimer.pause());
      return;
    }
    prepareWorkoutSound();
    setRunning(true);
    if (nativeStarted.current) await callNative(() => NativeWorkoutTimer.resume());
    else {
      nativeStarted.current = true;
      await callNative(() => NativeWorkoutTimer.start({ name, mode, workSeconds, restSeconds, rounds }));
    }
  }

  function skipPhase() {
    nextPhase();
    void callNative(() => NativeWorkoutTimer.skip());
  }

  const nextPhase = useCallback(() => {
    if (phase === 'work') {
      if (round >= rounds) {
        if (!Capacitor.isNativePlatform()) playWorkoutSound('done');
        setPhase('done');
        setRemaining(0);
        setRunning(false);
        nativeStarted.current = false;
      } else if (restSeconds > 0) {
        playWorkoutSound('phase');
        setPhase('rest');
        setRemaining(restSeconds);
      } else {
        playWorkoutSound('phase');
        setRound((value) => value + 1);
        setRemaining(workSeconds);
      }
    } else if (phase === 'rest') {
      playWorkoutSound('phase');
      setRound((value) => value + 1);
      setPhase('work');
      setRemaining(workSeconds);
    }
  }, [phase, restSeconds, round, rounds, workSeconds]);

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
  }, [running, mode, nextPhase]);

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
    <Card className={`panel interval-card ${running ? 'timer-running-sticky' : ''}`}>
      <CardHeader className="panel-heading timer-collapsed-head">
        <div>
          <p className="eyebrow">CRONÓMETRO</p>
          <CardTitle>Timer de treino</CardTitle>
          <CardDescription>{expanded ? 'Intervalos personalizados ou treino livre.' : 'Toca para abrir; no APK continua na barra de notificações.'}</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label={expanded ? 'Fechar cronómetro' : 'Abrir cronómetro'} onClick={() => setExpanded((value) => !value)}><ChevronDown className={expanded ? 'rotated' : ''} /></Button>
      </CardHeader>
      {expanded && <CardContent>
        <div className="segmented compact timer-mode">
          <button type="button" className={mode === 'interval' ? 'selected' : ''} onClick={() => { setMode('interval'); resetTimer(); }}>Intervalado</button>
          <button type="button" className={mode === 'free' ? 'selected' : ''} onClick={() => { setMode('free'); resetTimer(); }}>Livre</button>
        </div>
        {mode === 'interval' ? (
          <>
            <div className={`timer-stage ${phase}`}>
              <span>{phase === 'work' ? 'TRABALHO' : phase === 'rest' ? 'DESCANSO' : 'CONCLUÍDO'}</span>
              <strong>{formatDuration(remaining)}</strong>
              <small>Ronda {round} de {rounds}</small>
            </div>
            <div className="timer-actions">
              <Button type="button" size="lg" onClick={() => { if (phase === 'done') resetTimer(); else void toggleRunning(); }}>
                {running ? <CirclePause /> : <CirclePlay />}{running ? 'Pausar' : phase === 'done' ? 'Recomeçar' : 'Iniciar'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={skipPhase}>Saltar fase</Button>
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
              <Button type="button" size="lg" onClick={() => void toggleRunning()}>{running ? <CirclePause /> : <CirclePlay />}{running ? 'Pausar' : 'Iniciar'}</Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Repor cronómetro" onClick={resetTimer}><RotateCcw /></Button>
            </div>
          </>
        )}
      </CardContent>}
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
  onBack,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  date: string;
  onBack: () => void;
}) {
  const [category, setCategory] = useState<JudoCategory | 'Todas'>('Todas');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [videoTechniqueId, setVideoTechniqueId] = useState<string | null>(null);
  const [customVideo, setCustomVideo] = useState<{ title: string; videoId: string } | null>(null);
  const [duration, setDuration] = useState(90);
  const [uchikomi, setUchikomi] = useState(0);
  const [randoriRounds, setRandoriRounds] = useState(0);
  const [randoriMinutes, setRandoriMinutes] = useState(4);
  const [notes, setNotes] = useState('');
  const [tokuiCandidate, setTokuiCandidate] = useState(judoTechniques[0].id);
  const [learningName, setLearningName] = useState('');
  const [learningMedia, setLearningMedia] = useState('');
  const [learningNotes, setLearningNotes] = useState('');
  const filteredTechniques = judoTechniques.filter((item) =>
    (category === 'Todas' || item.category === category) &&
    normalizeText(`${item.name} ${item.japanese}`).includes(normalizeText(query)),
  );
  const totalRandori = state.judoPractices.reduce((sum, item) => sum + item.randoriRounds * item.randoriMinutes, 0);
  const uniqueTechniques = new Set(state.judoPractices.flatMap((item) => item.techniqueIds)).size;
  const techniqueCounts = state.judoPractices.flatMap((item) => item.techniqueIds).reduce<Record<string, number>>((counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {});
  const mostUsed = Object.entries(techniqueCounts).sort((a, b) => b[1] - a[1])[0];
  const mostUsedTechnique = mostUsed ? judoTechniques.find((item) => item.id === mostUsed[0]) : undefined;
  const selectedVideo = judoTechniques.find((item) => item.id === videoTechniqueId);
  useViewportLock(Boolean(selectedVideo || customVideo));
  useEffect(() => {
    if (!selectedVideo && !customVideo) return;
    const close = (event: Event) => { event.preventDefault(); setVideoTechniqueId(null); setCustomVideo(null); };
    window.addEventListener('fitide-back', close);
    return () => window.removeEventListener('fitide-back', close);
  }, [customVideo, selectedVideo]);
  const radarData = [
    { subject: 'Tachi-waza', value: state.judoProfile.scores.tachiWaza },
    { subject: 'Ne-waza', value: state.judoProfile.scores.neWaza },
    { subject: 'Físico', value: state.judoProfile.scores.physicalCondition },
    { subject: 'Mental', value: state.judoProfile.scores.mental },
    { subject: 'Conhecimento', value: state.judoProfile.scores.knowledge },
    { subject: 'Competição', value: state.judoProfile.scores.matchPrep },
  ];
  const scoreFields: { key: keyof AppState['judoProfile']['scores']; label: string }[] = [
    { key: 'tachiWaza', label: 'Tachi-waza' },
    { key: 'neWaza', label: 'Ne-waza' },
    { key: 'physicalCondition', label: 'Físico e condição' },
    { key: 'mental', label: 'Mental' },
    { key: 'knowledge', label: 'Conhecimento' },
    { key: 'matchPrep', label: 'Competição' },
  ];
  const weakest = [...radarData].sort((a, b) => a.value - b.value)[0];
  const tachiCount = Object.entries(techniqueCounts).reduce((sum, [id, count]) => sum + (judoTechniques.find((item) => item.id === id)?.category.endsWith('waza') && !['Osaekomi-waza', 'Shime-waza', 'Kansetsu-waza'].includes(judoTechniques.find((item) => item.id === id)?.category ?? '') ? count : 0), 0);
  const neCount = Object.entries(techniqueCounts).reduce((sum, [id, count]) => sum + (['Osaekomi-waza', 'Shime-waza', 'Kansetsu-waza'].includes(judoTechniques.find((item) => item.id === id)?.category ?? '') ? count : 0), 0);

  function patchJudoProfile(patch: Partial<AppState['judoProfile']>) {
    setState((current) => ({ ...current, judoProfile: { ...current.judoProfile, ...patch } }));
  }

  function addLearningGoal() {
    const name = learningName.trim();
    if (!name) return;
    const techniqueItem = judoTechniques.find((item) => normalizeText(item.name) === normalizeText(name));
    patchJudoProfile({
      learningGoals: [...state.judoProfile.learningGoals, { id: uid(), techniqueId: techniqueItem?.id, name, mediaUrl: learningMedia.trim() || undefined, notes: learningNotes.trim(), progress: 0 }],
    });
    setLearningName('');
    setLearningMedia('');
    setLearningNotes('');
  }

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
        <div><Button type="button" variant="ghost" className="back-to-workout" onClick={onBack}><ArrowLeft /> Voltar aos treinos</Button><p className="eyebrow">DOJO PESSOAL</p><h2>Judô, técnica por técnica</h2><p>Regista, mede e transforma cada treino no próximo foco.</p></div>
        <div className="judo-source-actions">
          <a className="button-link outline" href={KODOKAN_DEFINITIONS_URL} target="_blank" rel="noreferrer"><BookOpen /> Definições Kodokan</a>
          <a className="button-link" href={KODOKAN_TECHNIQUES_URL} target="_blank" rel="noreferrer"><ExternalLink /> 100 técnicas oficiais</a>
        </div>
      </section>
      <section className="judo-command-grid">
        <Card className="judo-rank-card">
          <CardContent>
            <div className="belt-orbit"><span>{state.judoProfile.belt.slice(0, 1)}</span></div>
            <div><p className="eyebrow">GRADUAÇÃO</p><h3>Faixa {state.judoProfile.belt}</h3><select aria-label="Faixa de judô" value={state.judoProfile.belt} onChange={(event) => patchJudoProfile({ belt: event.target.value })}>{['Branca','Amarela','Laranja','Verde','Azul','Castanha','Preta'].map((belt) => <option key={belt}>{belt}</option>)}</select></div>
          </CardContent>
        </Card>
        <Card className="judo-focus-card">
          <CardContent><p className="eyebrow">PRÓXIMO FOCO</p><h3>Melhorar {weakest.subject.toLowerCase()}</h3><p>É a dimensão com menor pontuação ({weakest.value}/100). Define um exercício concreto para a próxima sessão e revê ao fim da semana.</p></CardContent>
        </Card>
        <Card className="judo-most-card">
          <CardContent><p className="eyebrow">TÉCNICA MAIS USADA</p><h3>{mostUsedTechnique?.name ?? 'Ainda sem dados'}</h3><p>{mostUsed ? `${mostUsed[1]} registos nos teus treinos.` : 'Regista técnicas no diário para descobrir o teu padrão.'}</p></CardContent>
        </Card>
      </section>
      <section className="judo-summary">
        <MiniStat label="Treinos" value={String(state.judoPractices.length)} />
        <MiniStat label="Técnicas" value={String(uniqueTechniques)} />
        <MiniStat label="Randori" value={`${totalRandori} min`} />
        <MiniStat label="Tachi / Ne-waza" value={`${tachiCount} / ${neCount}`} />
      </section>
      <div className="judo-dashboard-grid">
        <Card className="panel judo-radar-card">
          <CardHeader><CardTitle>Radar de evolução</CardTitle><CardDescription>Avaliação pessoal, editável a qualquer momento.</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer className="judo-radar-chart" config={{ value: { label: 'Pontuação', color: '#1f9dcc' } }}>
              <RadarChart data={radarData} outerRadius="68%"><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="value" stroke="#19a8e0" fill="#168fbd" fillOpacity={0.42} strokeWidth={3} /></RadarChart>
            </ChartContainer>
            <div className="judo-score-editor">{scoreFields.map(({ key, label }) => <Field key={key} label={label}><NumberInput value={state.judoProfile.scores[key]} min={0} max={100} step="5" onChange={(score) => patchJudoProfile({ scores: { ...state.judoProfile.scores, [key]: score } })} /></Field>)}</div>
          </CardContent>
        </Card>
        <Card className="panel tokui-card">
          <CardHeader><CardTitle>Tokui-waza</CardTitle><CardDescription>As técnicas que formam o centro do teu jogo.</CardDescription></CardHeader>
          <CardContent>
            <div className="inline-builder"><select value={tokuiCandidate} onChange={(event) => setTokuiCandidate(event.target.value)}>{judoTechniques.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" onClick={() => { if (!state.judoProfile.tokuiWazaIds.includes(tokuiCandidate)) patchJudoProfile({ tokuiWazaIds: [...state.judoProfile.tokuiWazaIds, tokuiCandidate] }); }}><Plus /> Adicionar</Button></div>
            <div className="tokui-list">{state.judoProfile.tokuiWazaIds.length ? state.judoProfile.tokuiWazaIds.map((id) => { const item = judoTechniques.find((techniqueItem) => techniqueItem.id === id); return item ? <button type="button" key={id} onClick={() => patchJudoProfile({ tokuiWazaIds: state.judoProfile.tokuiWazaIds.filter((value) => value !== id) })}><strong>{item.name}</strong><small>{judoCategoryLabels[item.category]}</small><X /></button> : null; }) : <p className="muted-copy">Ainda não escolheste o teu tokui-waza.</p>}</div>
          </CardContent>
        </Card>
      </div>
      <Card className="panel learning-card">
        <CardHeader><CardTitle>Roadmap — técnicas que quero aprender</CardTitle><CardDescription>Guarda uma referência do YouTube, Shorts ou Reel e acompanha o progresso.</CardDescription></CardHeader>
        <CardContent>
          <div className="learning-builder"><Field label="Nome da técnica"><Input list="judo-technique-suggestions" value={learningName} onChange={(event) => setLearningName(event.target.value)} placeholder="Escreve qualquer nome…" /><datalist id="judo-technique-suggestions">{judoTechniques.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</datalist></Field><Field label="Link de vídeo/Reel (opcional)"><Input value={learningMedia} onChange={(event) => setLearningMedia(event.target.value)} placeholder="https://youtube.com/... ou instagram.com/reel/..." /></Field><Field label="O que quero melhorar"><Input value={learningNotes} onChange={(event) => setLearningNotes(event.target.value)} placeholder="Pegada, entrada, combinação…" /></Field><Button type="button" disabled={!learningName.trim()} onClick={addLearningGoal}><Plus /> Adicionar ao roadmap</Button></div>
          <div className="learning-list">{state.judoProfile.learningGoals.map((goal) => { const youtubeId = goal.mediaUrl ? youtubeIdFromUrl(goal.mediaUrl) : undefined; return <article key={goal.id}><div><strong>{goal.name}</strong><p>{goal.notes || 'Sem notas.'}</p>{goal.mediaUrl && (youtubeId ? <button type="button" className="media-chip" onClick={() => setCustomVideo({ title: goal.name, videoId: youtubeId })}><CirclePlay /> Abrir vídeo</button> : <a href={goal.mediaUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir referência</a>)}</div><Field label="Progresso %"><NumberInput value={goal.progress} min={0} max={100} step="5" onChange={(progress) => patchJudoProfile({ learningGoals: state.judoProfile.learningGoals.map((item) => item.id === goal.id ? { ...item, progress } : item) })} /></Field><Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${goal.name}`} onClick={() => patchJudoProfile({ learningGoals: state.judoProfile.learningGoals.filter((item) => item.id !== goal.id) })}><Trash2 /></Button></article>; })}</div>
        </CardContent>
      </Card>
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
        <CardHeader><div><p className="eyebrow">KODOKAN</p><CardTitle>Biblioteca técnica com vídeo</CardTitle><CardDescription>Abre apenas a demonstração escolhida, diretamente dentro da Fitide.</CardDescription></div><Input aria-label="Procurar técnica" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procurar uchi-mata…" /></CardHeader>
        <CardContent>
          <div className="technique-filters">{(Object.keys(judoCategoryLabels) as Array<JudoCategory | 'Todas'>).map((item) => <button type="button" key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{judoCategoryLabels[item]}</button>)}</div>
          <div className="technique-grid">{filteredTechniques.map((item) => (
            <article key={item.id} className={selected.includes(item.id) ? 'selected' : ''}>
              <button type="button" className="technique-select" onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}><span>{item.japanese}</span><strong>{item.name}</strong><small>{judoCategoryLabels[item.category]}</small></button>
              <button type="button" className="technique-video" disabled={!item.videoId} onClick={() => item.videoId && setVideoTechniqueId(item.id)}><CirclePlay /> {item.videoId ? 'Ver vídeo Kodokan' : 'Vídeo em breve'}</button>
            </article>
          ))}</div>
        </CardContent>
      </Card>
      {(selectedVideo || customVideo) && (
        <OverlayPortal>
          <div className="dialog-backdrop video-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) { setVideoTechniqueId(null); setCustomVideo(null); } }}>
            <section className="judo-video-dialog" role="dialog" aria-modal="true" aria-labelledby="judo-video-title">
              <header><div><p className="eyebrow">VÍDEO NO FITIDE</p><h2 id="judo-video-title">{selectedVideo?.name ?? customVideo?.title}</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar vídeo" onClick={() => { setVideoTechniqueId(null); setCustomVideo(null); }}><X /></Button></header>
              <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${selectedVideo?.videoId ?? customVideo?.videoId}?rel=0`} title={`Demonstração de ${selectedVideo?.name ?? customVideo?.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
              {selectedVideo && <p>{selectedVideo.japanese} · {judoCategoryLabels[selectedVideo.category]}</p>}
            </section>
          </div>
        </OverlayPortal>
      )}
    </div>
  );
}

function CalendarPage({
  state,
  selectedDate,
  setSelectedDate,
  onOpenDay,
  onEditMeal,
}: {
  state: AppState;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onOpenDay: () => void;
  onEditMeal: (meal: Meal) => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [monthSlide, setMonthSlide] = useState<{ to: Date; direction: -1 | 1 } | null>(null);
  const calendarSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const daySwipeStart = useRef<{ x: number; y: number } | null>(null);
  const daySwipedAt = useRef(0);
  function changeDay(delta: number) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + delta);
    setSelectedDate(localDateKey(next));
    if (monthSlideTimer.current !== null) window.clearTimeout(monthSlideTimer.current);
    setMonthSlide(null);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }
  const monthSlideTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (monthSlideTimer.current !== null) window.clearTimeout(monthSlideTimer.current);
  }, []);
  function changeMonth(delta: number) {
    if (monthSlide) return;
    const direction = (delta < 0 ? -1 : 1) as -1 | 1;
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonthSlide({ to: next, direction });
    monthSlideTimer.current = window.setTimeout(() => {
      setMonth(next);
      setMonthSlide(null);
      monthSlideTimer.current = null;
    }, 320);
  }
  function daysForMonth(targetMonth: Date) {
    const first = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    first.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }
  const dayMeals = state.meals.filter((meal) => meal.date === selectedDate).sort(mealOrder);
  const nutrients = roundNutrients(
    sumNutrients(dayMeals.flatMap((meal) => meal.ingredients)),
  );
  const water =
    state.water.find((entry) => entry.date === selectedDate)?.liters ?? 0;
  const workouts = state.workoutSessions.filter(
    (entry) => entry.date === selectedDate,
  );
  const judoPractices = state.judoPractices.filter(entry => entry.date === selectedDate);
  const activityRecords = state.activityCheckIns.filter(entry => entry.date === selectedDate)
    .map(checkIn => ({ ...checkIn, activity: state.activities.find(activity => activity.id === checkIn.activityId) }))
    .filter(entry => entry.activity && !workouts.some(workout => workout.activityId === entry.activityId));
  const fast = state.fasts.find(
    (entry) => localDateKey(new Date(entry.start)) === selectedDate,
  );
  const todayKey = localDateKey();
  const firstRecordDate = [
    ...state.meals.map((entry) => entry.date),
    ...state.weights.map((entry) => entry.date),
    ...state.water.map((entry) => entry.date),
    ...state.fasts.map((entry) => localDateKey(new Date(entry.start))),
    ...state.workoutSessions.map((entry) => entry.date),
    ...state.judoPractices.map((entry) => entry.date),
    ...state.healthSnapshots.map((entry) => entry.date),
  ].sort()[0];
  const fastingMetForDate = (key: string) => state.fasts.some((entry) => {
    const durationHours = (new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 3_600_000;
    return localDateKey(new Date(entry.start)) === key && durationHours >= state.goals.fastingHours;
  });
  function renderMonthGrid(targetMonth: Date, interactive = true) {
    return (
      <div className="calendar-grid">
        {dayNames.map((day, index) => <span className="calendar-week" key={`${day}-${index}`}>{day}</span>)}
        {daysForMonth(targetMonth).map((day) => {
          const key = localDateKey(day);
          const fastStatus = key === todayKey
            ? 'today'
            : key < todayKey && firstRecordDate && key >= firstRecordDate
              ? (fastingMetForDate(key) ? 'met' : 'missed')
              : '';
          return (
            <button
              type="button"
              key={key}
              tabIndex={interactive ? 0 : -1}
              className={`${day.getMonth() !== targetMonth.getMonth() ? 'outside' : ''} ${selectedDate === key ? 'selected' : ''}`}
              onClick={() => interactive && setSelectedDate(key)}
            >
              <span>{day.getDate()}</span>
              {fastStatus && <i className={fastStatus} />}
            </button>
          );
        })}
      </div>
    );
  }
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
        <Card
          className="panel calendar-card calendar-interactive"
          onTouchStart={(event) => { event.stopPropagation(); const touch = event.touches[0]; calendarSwipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => {
            event.stopPropagation();
            const swipeStart = calendarSwipeStart.current;
            calendarSwipeStart.current = null;
            const touch = event.changedTouches[0];
            if (!swipeStart || !touch) return;
            const distanceX = touch.clientX - swipeStart.x;
            const distanceY = touch.clientY - swipeStart.y;
            if (Math.abs(distanceX) >= 48 && Math.abs(distanceX) > Math.abs(distanceY) * 1.2) changeMonth(distanceX < 0 ? 1 : -1);
          }}
        >
          <CardHeader className="calendar-head">
            <Button
              variant="ghost"
              size="icon"
              disabled={Boolean(monthSlide)}
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <CardTitle>
              {(monthSlide?.to ?? month).toLocaleDateString('pt-PT', {
                month: 'long',
                year: 'numeric',
              })}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              disabled={Boolean(monthSlide)}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="calendar-legend"><span><i className="met" /> Meta de jejum</span><span><i className="today" /> Hoje</span><span><i className="missed" /> Meta não cumprida</span></div>
            <div className={`calendar-month-viewport ${monthSlide ? `sliding ${monthSlide.direction > 0 ? 'next' : 'previous'}` : ''}`}>
              <div className="calendar-month-current">{renderMonthGrid(month)}</div>
              {monthSlide && <div className="calendar-month-incoming" aria-hidden="true">{renderMonthGrid(monthSlide.to, false)}</div>}
            </div>
          </CardContent>
        </Card>
        <Card className="panel day-detail calendar-interactive"
          onTouchStart={event => { event.stopPropagation(); const touch = event.touches.length === 1 ? event.touches[0] : null; daySwipeStart.current = touch ? {x:touch.clientX,y:touch.clientY} : null; }}
          onTouchMove={event => event.stopPropagation()}
          onTouchCancel={() => { daySwipeStart.current = null; }}
          onTouchEnd={event => {
            event.stopPropagation();
            const start = daySwipeStart.current;
            daySwipeStart.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
            if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) { daySwipedAt.current = Date.now(); changeDay(dx < 0 ? 1 : -1); }
          }}
          onClickCapture={event => { if (Date.now() - daySwipedAt.current < 400) { event.preventDefault(); event.stopPropagation(); } }}
        >
          <CardHeader>
            <p className="eyebrow">DIA SELECIONADO</p>
            <div className="calendar-day-navigation">
            <Button variant="ghost" size="icon" aria-label="Dia anterior" onClick={() => changeDay(-1)}><ChevronLeft /></Button>
            <CardTitle>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                'pt-PT',
                { weekday: 'long', day: 'numeric', month: 'long' },
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" aria-label="Dia seguinte" onClick={() => changeDay(1)}><ChevronRight /></Button>
            </div>
            <small>Desliza neste cartão para mudar de dia.</small>
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
                value={workouts.length ? `${workouts.reduce((sum, workout) => sum + workout.minutes, 0)} min registados` : judoPractices.length ? `${judoPractices.reduce((sum, practice) => sum + practice.durationMinutes, 0)} min de judô` : activityRecords.some(entry => entry.status === 'completed') ? 'Presença confirmada' : '—'}
              />
              <MiniStat label="Proteína" value={`${nutrients.protein} g`} />
              <MiniStat label="Hidratos" value={`${nutrients.carbs} g`} />
              <MiniStat label="Gordura" value={`${nutrients.fat} g`} />
              <MiniStat label="Fibras" value={`${nutrients.fiber} g`} />
            </div>
            <section className="calendar-training-detail" aria-label="Treinos deste dia">
              <strong>Treinos deste dia</strong>
              {workouts.map(workout => <div key={workout.id} className="calendar-training-row"><span className="workout-done"><Check size={16} /> {workout.planName}</span><small>{workout.minutes} min · {workout.completedSets} séries · {workout.calories} kcal estimadas</small></div>)}
              {activityRecords.map(entry => <div key={entry.activityId} className="calendar-training-row"><span>{entry.activity!.name} · {entry.status === 'completed' ? 'Concluído' : 'Não fui'}</span><small>{entry.activity!.minutes} min agendados</small></div>)}
              {judoPractices.map(practice => <div key={practice.id} className="calendar-training-row"><span>Registo de judô · {practice.durationMinutes} min</span><small>{practice.uchikomiReps} uchikomi · {practice.randoriRounds} rondas de randori</small>{practice.notes && <small>{practice.notes}</small>}</div>)}
              {!workouts.length && !activityRecords.length && !judoPractices.length && <p>Sem treinos registados.</p>}
            </section>
            <div className="day-meals">
              <strong>Refeições</strong>
              {dayMeals.length ? (
                dayMeals.map((meal) => <button type="button" className="meal-edit-button" onClick={() => onEditMeal(meal)} key={meal.id}><MealRow meal={meal} /></button>)
              ) : (
                <p>Sem refeições registadas.</p>
              )}
            </div>
            <Button className="wide-button open-day-button" onClick={onOpenDay}>
              <Plus /> Adicionar ou corrigir registos
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgressPage({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [weight, setWeight] = useState(state.profile.currentWeightKg);
  const [entryDate, setEntryDate] = useState(localDateKey());
  const [fat, setFat] = useState<number | ''>(state.profile.bodyFatPercent ?? '');
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

  return <div className="content-page page-enter">
    <section className="page-intro"><div><p className="eyebrow">EVOLUÇÃO</p><h2>Progresso sem ruído</h2><p>Peso ao longo do ano. Nutrição e água, dia a dia.</p></div></section>
    <div className="charts-grid progress-widgets">
      <div className="progress-stats wide" data-widget-id="progress-stats-v2">
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
        <Card className="panel weight-form wide" data-widget-id="progress-weight-form-v2">
          <CardHeader>
            <CardTitle>Registar peso</CardTitle>
            <CardDescription>
              Um registo substitui outro feito na mesma data.
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

      <ProgressCharts state={state} today={localDateKey()} />
      <WorkoutProgression state={state} setState={setState} />
    </div>
  </div>;
}

function HealthConnectPanel({
  state,
  status,
  message,
  onSync,
}: {
  state: AppState;
  status: 'idle' | 'syncing' | 'done' | 'error';
  message: string;
  onSync: () => Promise<boolean>;
}) {
  const native = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const latest = state.healthSnapshots.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="health-connect-panel">
      <div className="integration-row">
        <div className="round-icon health"><HeartPulse /></div>
        <div>
          <strong>Health Connect</strong>
          <p>Importa do relógio passos, calorias, ritmo cardíaco, sono e gordura corporal. Se faltar alguma permissão, “Sincronizar agora” abre a autorização uma única vez; depois passa apenas a atualizar os dados.</p>
          {latest && <small>Última sincronização: {new Date(latest.syncedAt).toLocaleString('pt-PT')} · {latest.steps?.toLocaleString('pt-PT') ?? '—'} passos</small>}
          {message && <small className={status === 'error' ? 'health-error' : ''}>{message}</small>}
          <div className="health-actions">
            <Button type="button" onClick={() => void onSync()} disabled={!native || status === 'syncing'}>{status === 'syncing' ? <LoaderCircle className="spin" /> : <HeartPulse />}{native ? 'Sincronizar agora' : 'Disponível no APK'}</Button>
            {native && <Button type="button" variant="outline" onClick={() => void HealthFitness.openHealthConnect().catch(() => undefined)}>Abrir Health Connect</Button>}
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
  healthSyncStatus,
  healthSyncMessage,
  onHealthSync,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onReset: () => Promise<void>;
  healthSyncStatus: 'idle' | 'syncing' | 'done' | 'error';
  healthSyncMessage: string;
  onHealthSync: () => Promise<boolean>;
}) {
  const [profile, setProfile] = useState(state.profile);
  const [goals, setGoals] = useState(state.goals);
  const [activityPreset, setActivityPreset] = useState('Musculação');
  const [activityName, setActivityName] = useState('Musculação');
  const [minutes, setMinutes] = useState(60);
  const [intensity, setIntensity] = useState(2);
  const [days, setDays] = useState<number[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'routine' | 'single'>('routine');
  const [singleDate, setSingleDate] = useState(localDateKey());
  const [activityTime, setActivityTime] = useState('18:00');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [bodyFocus, setBodyFocus] = useState<string[]>(['biceps']);
  const [level, setLevel] = useState('intermediate');
  const [workoutEquipment, setWorkoutEquipment] = useState<string[]>(defaultWorkoutEquipment);
  const [workoutCreationMode, setWorkoutCreationMode] = useState<'fitide' | 'custom' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [workoutError, setWorkoutError] = useState('');
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [exerciseAlternatives, setExerciseAlternatives] = useState<WorkoutExercise[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useViewportLock(Boolean(editingPlan));
  const draftMaintenance = tdee(profile, state.activities);
  const draftBaseMaintenance = sedentaryTdee(profile);
  const draftExerciseAverage = Math.round(exerciseCaloriesPerWeek(profile, state.activities) / 7);
  const draftEstimate = weeksToGoal(profile, goals.calorieTarget, draftMaintenance);
  function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const nextGoals = alignCalorieGoal(goals, profile, state.activities);
    setGoals(nextGoals);
    setState((current) => ({ ...current, profile, goals: nextGoals }));
  }
  function recalculate() {
    const next = suggestedGoals(profile, state.activities, goals.kind);
    setGoals(next);
    setState((current) => ({ ...current, profile, goals: next }));
  }
  function resetActivityBuilder() {
    setEditingActivityId(null);
    setActivityPreset('Musculação');
    setActivityName('Musculação');
    setMinutes(60);
    setIntensity(2);
    setDays([]);
    setScheduleMode('routine');
    setSingleDate(localDateKey());
    setActivityTime('18:00');
    setWorkoutCreationMode(null);
    setBodyFocus(['biceps']);
    setLevel('intermediate');
    setWorkoutEquipment(defaultWorkoutEquipment);
  }
  function saveActivity() {
    if (!activityName.trim() || (scheduleMode === 'routine' ? !days.length : !singleDate)) return;
    const activity: Activity = {
      id: editingActivityId ?? uid(),
      name: activityName.trim(),
      days: scheduleMode === 'routine' ? days : [],
      specificDate: scheduleMode === 'single' ? singleDate : undefined,
      minutes,
      intensity,
      time: activityTime,
    };
    const nextActivities = editingActivityId
      ? state.activities.map((item) => item.id === editingActivityId ? activity : item)
      : [...state.activities, activity];
    const nextGoals = alignCalorieGoal(goals, profile, nextActivities);
    setGoals(nextGoals);
    setState((current) => ({
      ...current,
      activities: nextActivities,
      workoutPlans: current.workoutPlans.map((plan) => plan.activityId === activity.id
        ? { ...plan, days: [...activity.days], specificDate: activity.specificDate, time: activity.time }
        : plan),
      goals: nextGoals,
    }));
    resetActivityBuilder();
  }
  function editActivity(activity: Activity) {
    setEditingActivityId(activity.id);
    const preset = activityPresets.find((item) => item.name === activity.name);
    setActivityPreset(preset?.name ?? (normalizeText(activity.name).includes('musculacao') ? 'Musculação' : 'Outro'));
    setActivityName(activity.name);
    setMinutes(activity.minutes);
    setIntensity(activityIntensity(activity));
    setDays([...activity.days]);
    setScheduleMode(activity.specificDate ? 'single' : 'routine');
    setSingleDate(activity.specificDate ?? localDateKey());
    setActivityTime(activity.time ?? '18:00');
  }
  function removeActivity(id: string) {
    const nextActivities = state.activities.filter((activity) => activity.id !== id);
    const nextGoals = alignCalorieGoal(goals, profile, nextActivities);
    setGoals(nextGoals);
    setState((current) => ({ ...current, activities: nextActivities, workoutPlans: current.workoutPlans.filter((plan) => plan.activityId !== id), goals: nextGoals }));
    if (editingActivityId === id) resetActivityBuilder();
  }
  async function generateWorkout() {
    if (scheduleMode === 'routine' ? !days.length : !singleDate) return;
    setWorkoutError('');
    setGenerating(true);
    try {
      const response = await fetch('/api/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goals.kind === 'lose_fat' ? 'fat_loss' : goals.kind === 'gain_muscle' ? 'muscle_gain' : 'general_fitness',
          level,
          bodyFocus,
          equipment: workoutEquipment,
        }),
      });
      if (!response.ok) {
        const failure = await response.json() as { error?: string };
        throw new Error(failure.error ?? 'Não foi possível gerar o treino. Tenta novamente.');
      }
      const result = (await response.json()) as { source: WorkoutPlan['source']; exercises: WorkoutPlan['exercises'] };
      const activityId = uid();
      const plan: WorkoutPlan = {
        id: uid(),
        activityId,
        name: bodyFocus.map((value) => muscleOptions.find((item) => item.value === value)?.label).filter(Boolean).join(', ') || 'Musculação',
        source: result.source,
        createdAt: new Date().toISOString(),
        days: scheduleMode === 'routine' ? [...days] : [],
        specificDate: scheduleMode === 'single' ? singleDate : undefined,
        time: activityTime,
        exercises: result.exercises.map(exercise => adaptExercise(exercise, state.workoutSessions)),
      };
      const activity: Activity = {
        id: activityId,
        name: `Musculação · ${plan.name}`,
        days: scheduleMode === 'routine' ? [...days] : [],
        specificDate: scheduleMode === 'single' ? singleDate : undefined,
        minutes,
        intensity,
        time: activityTime,
      };
      const nextActivities = [...state.activities, activity];
      const nextGoals = alignCalorieGoal(goals, profile, nextActivities);
      setGoals(nextGoals);
      setState((current) => ({ ...current, activities: [...current.activities, activity], workoutPlans: [...current.workoutPlans, plan], goals: nextGoals }));
      setDays([]);
      setScheduleMode('routine');
      setSingleDate(localDateKey());
      setBodyFocus(['biceps']);
      setWorkoutEquipment(defaultWorkoutEquipment);
      setWorkoutCreationMode(null);
    } catch (error) {
      setWorkoutError(error instanceof Error ? error.message : 'Não foi possível gerar o treino.');
    } finally {
      setGenerating(false);
    }
  }
  async function loadWorkoutCatalog(catalogLevel = level) {
    const currentExercises = state.workoutPlans.flatMap((item) => item.exercises);
    setExerciseAlternatives(currentExercises.filter((exercise, index, items) => items.findIndex((item) => item.id === exercise.id) === index));
    setLoadingAlternatives(true);
    try {
      const response = await fetch('/api/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'catalog', level: catalogLevel }),
      });
      if (!response.ok) return;
      const result = (await response.json()) as { exercises?: WorkoutExercise[] };
      if (result.exercises?.length) {
        setExerciseAlternatives(result.exercises);
      }
    } finally {
      setLoadingAlternatives(false);
    }
  }
  async function openWorkoutEditor(plan: WorkoutPlan) {
    setCreatingPlan(false);
    setEditingPlan({ ...plan, days: [...(plan.days ?? [])], exercises: plan.exercises.map((exercise) => ({ ...exercise })) });
    await loadWorkoutCatalog('intermediate');
  }
  async function createCustomWorkout() {
    if (scheduleMode === 'routine' ? !days.length : !singleDate) return;
    const activityId = uid();
    setCreatingPlan(true);
    setEditingPlan({
      id: uid(),
      activityId,
      name: 'O meu treino',
      source: 'Personalizado',
      createdAt: new Date().toISOString(),
      days: scheduleMode === 'routine' ? [...days] : [],
      specificDate: scheduleMode === 'single' ? singleDate : undefined,
      time: activityTime,
      exercises: [],
    });
    await loadWorkoutCatalog('intermediate');
  }
  function saveWorkoutPlan(plan: WorkoutPlan) {
    if (!plan.name.trim() || !plan.exercises.length) return;
    if (creatingPlan) {
      const activity: Activity = {
        id: plan.activityId ?? uid(),
        name: `Musculação · ${plan.name.trim()}`,
        days: [...(plan.days ?? [])],
        specificDate: plan.specificDate,
        minutes,
        intensity,
        time: plan.time,
      };
      const savedPlan = { ...plan, activityId: activity.id, name: plan.name.trim() };
      const nextActivities = [...state.activities, activity];
      const nextGoals = alignCalorieGoal(goals, profile, nextActivities);
      setGoals(nextGoals);
      setState((current) => ({ ...current, activities: [...current.activities, activity], workoutPlans: [...current.workoutPlans, savedPlan], goals: nextGoals }));
      setDays([]);
      setScheduleMode('routine');
      setSingleDate(localDateKey());
      setWorkoutCreationMode(null);
    } else {
      setState((current) => ({ ...current, workoutPlans: current.workoutPlans.map((item) => item.id === plan.id ? { ...plan, name: plan.name.trim() } : item) }));
    }
    setCreatingPlan(false);
    setEditingPlan(null);
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
          <span>Média diária semanal</span>
          <strong>{draftMaintenance} kcal</strong>
          <small>base {draftBaseMaintenance} + treino médio {draftExerciseAverage}</small>
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
        <Card className="panel appearance-card">
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>Escolhe o tema da Fitide.</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              className="theme-switch-row"
              role="switch"
              aria-checked={state.theme === 'dark'}
              onClick={() => setState((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))}
            >
              <span className="theme-switch-icon">{state.theme === 'dark' ? <Moon /> : <Sun />}</span>
              <span><strong>Modo escuro</strong><small>{state.theme === 'dark' ? 'Ativado' : 'Desativado'}</small></span>
              <i aria-hidden="true"><b /></i>
            </button>
          </CardContent>
        </Card>
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
                    onChange={(value) => {
                      const nextGoals = {
                        ...goals,
                        calorieDeficit: value,
                        calorieTarget: Math.max(1000, draftMaintenance - value),
                      };
                      setGoals(nextGoals);
                      setState((current) => ({ ...current, goals: nextGoals }));
                    }}
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
              {state.activities.filter((activity) => !activity.specificDate).map((activity) => (
                <div key={activity.id}>
                  <div className="round-icon soft">
                    <ActivityIcon />
                  </div>
                  <div>
                    <strong>{activity.name}</strong>
                    <small>
                      {scheduleLabel(activity)} · {activity.time ?? 'Sem hora'} · {activity.minutes} min
                    </small>
                  </div>
                  <span>Int. {activityIntensity(activity)}/5</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar atividade ${activity.name}`}
                    onClick={() => editActivity(activity)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Apagar atividade ${activity.name}`}
                    onClick={() => removeActivity(activity.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="activity-builder">
              <div className="form-grid four">
                <Field label="Atividade">
                  <select
                    value={activityPreset}
                    onChange={(event) => {
                      const preset = activityPresets.find((item) => item.name === event.target.value)!;
                      setActivityPreset(preset.name);
                      setActivityName(preset.name === 'Outro' ? '' : preset.name);
                      setIntensity(preset.intensity);
                      setWorkoutCreationMode(null);
                    }}
                  >
                    {activityPresets.map((preset) => <option key={preset.name}>{preset.name}</option>)}
                  </select>
                </Field>
                <Field label="Minutos">
                  <NumberInput value={minutes} min={5} max={240} step="5" onChange={setMinutes} />
                </Field>
                <Field label="Hora">
                  <Input type="time" value={activityTime} onChange={(event) => setActivityTime(event.target.value)} />
                </Field>
                <Field label={<span className="label-help">Intensidade (1–5) <span className="help-tip" tabIndex={0}><CircleHelp /><span role="tooltip">1 = caminhada leve; 2 = treino leve; 3 = moderado/intenso, como judô normal; 4 = muito intenso; 5 = extremo, como maratona ou CrossFit quase sem descanso. O cálculo usa também o teu peso e a duração.</span></span></span>}>
                  <NumberInput value={intensity} min={1} max={5} step="1" onChange={setIntensity} />
                </Field>
              </div>
              {activityPreset === 'Outro' && (
                <Field label="Nome da atividade">
                  <Input value={activityName} onChange={(event) => setActivityName(event.target.value)} placeholder="Ex.: padel" />
                </Field>
              )}
              <Field label="Agendamento">
                <div className="schedule-mode-picker" role="group" aria-label="Tipo de agendamento">
                  <button type="button" className={scheduleMode === 'routine' ? 'selected' : ''} onClick={() => setScheduleMode('routine')}>
                    <strong>Rotina</strong><small>Repete semanalmente</small>
                  </button>
                  <button type="button" className={scheduleMode === 'single' ? 'selected' : ''} onClick={() => setScheduleMode('single')}>
                    <strong>1 dia</strong><small>Treino pontual</small>
                  </button>
                </div>
              </Field>
              {scheduleMode === 'routine' ? (
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
              ) : (
                <Field label="Data do treino">
                  <Input type="date" value={singleDate} onChange={(event) => setSingleDate(event.target.value)} />
                </Field>
              )}
              {(activityPreset !== 'Musculação' || editingActivityId) && (
                <div className="activity-builder-actions">
                  {editingActivityId && <Button type="button" variant="ghost" onClick={resetActivityBuilder}>Cancelar edição</Button>}
                  <Button type="button" variant="outline" onClick={saveActivity} disabled={scheduleMode === 'routine' ? !days.length : !singleDate}>
                    {editingActivityId ? <Save /> : <Plus />} {editingActivityId ? 'Guardar atividade' : 'Adicionar atividade'}
                  </Button>
                </div>
              )}
            </div>
            {activityPreset === 'Musculação' && <>
              <div className="routine-divider" />
              <section className="workout-settings-builder">
              <div>
                <p className="eyebrow">MUSCULAÇÃO</p>
                <h3>Criar treino de musculação</h3>
                <p>Escolhe primeiro se queres uma sugestão da Fitide ou construir o treino exercício a exercício.</p>
              </div>
              <fieldset className="workout-method-picker" aria-label="Método de criação do treino">
                <button type="button" className={workoutCreationMode === 'fitide' ? 'selected' : ''} onClick={() => setWorkoutCreationMode('fitide')}>
                  <Sparkles /><span><strong>Gerar com a Fitide</strong><small>Escolher grupo, nível e equipamento</small></span>
                </button>
                <button type="button" className={workoutCreationMode === 'custom' ? 'selected' : ''} onClick={() => setWorkoutCreationMode('custom')}>
                  <Plus /><span><strong>Personalizado</strong><small>Escolher cada exercício, séries e carga</small></span>
                </button>
              </fieldset>
              {workoutCreationMode === 'fitide' && <div className="workout-method-options">
                <fieldset className="workout-muscle-selection">
                  <legend>Grupos musculares</legend>
                  <p>Seleciona um ou vários grupos para este treino.</p>
                  <div className="muscle-picker">
                    {muscleOptions.map((muscle) => <button type="button" key={muscle.value} aria-pressed={bodyFocus.includes(muscle.value)} className={bodyFocus.includes(muscle.value) ? 'selected' : ''} onClick={() => setBodyFocus((current) => current.includes(muscle.value) ? current.filter((value) => value !== muscle.value) : [...current, muscle.value])}>{bodyFocus.includes(muscle.value) && <Check size={16} />}{muscle.label}</button>)}
                  </div>
                  {!bodyFocus.length && <small>Escolhe pelo menos um grupo muscular.</small>}
                </fieldset>
                <Field label="Nível">
                  <select value={level} onChange={(event) => setLevel(event.target.value)}>
                    <option value="beginner">Iniciante</option><option value="intermediate">Intermédio</option><option value="advanced">Avançado</option>
                  </select>
                </Field>
                <Field label="Equipamento disponível">
                  <div className="muscle-picker equipment-picker">
                    {workoutEquipmentOptions.map((equipment) => <button type="button" key={equipment.value} className={workoutEquipment.includes(equipment.value) ? 'selected' : ''} onClick={() => setWorkoutEquipment((current) => current.includes(equipment.value) ? current.filter((value) => value !== equipment.value) : [...current, equipment.value])}>{equipment.label}</button>)}
                  </div>
                </Field>
                <Button size="lg" type="button" onClick={generateWorkout} disabled={generating || !bodyFocus.length || !workoutEquipment.length || (scheduleMode === 'routine' ? !days.length : !singleDate)}>
                  {generating ? <LoaderCircle className="spin" /> : <Sparkles />}{generating ? 'A gerar…' : 'Gerar e agendar treino'}
                </Button>
                {!workoutEquipment.length && <small className="routine-empty-hint">Escolhe pelo menos um tipo de equipamento.</small>}
              </div>}
              {workoutCreationMode === 'custom' && <div className="custom-method-submit">
                <p>As escolhas de grupo, nível e equipamento não se aplicam. Vais montar o treino livremente no passo seguinte.</p>
                <Button size="lg" type="button" onClick={() => void createCustomWorkout()} disabled={scheduleMode === 'routine' ? !days.length : !singleDate}>
                  <Plus /> Criar e agendar personalizado
                </Button>
              </div>}
              {!workoutCreationMode && <small className="routine-empty-hint">Seleciona um método para continuar.</small>}
              {workoutError && <p role="alert" className="workout-error">{workoutError}</p>}
              {scheduleMode === 'routine' && !days.length && <small className="routine-empty-hint">Escolhe acima os dias da nova rotina. Depois de gerar, o formulário fica limpo para agendares outra.</small>}
              {scheduleMode === 'single' && <small className="routine-empty-hint">Este treino aparecerá apenas na data escolhida e não altera a tua média semanal recorrente.</small>}
              <div className="scheduled-plans">
                {state.workoutPlans.filter((plan) => !plan.specificDate).map((plan) => (
                  <div key={plan.id}>
                    <Dumbbell />
                    <div><strong>{plan.name}</strong><small>{scheduleLabel(plan)} · {plan.time ?? 'Sem hora'} · {plan.exercises.length} exercícios</small></div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void openWorkoutEditor(plan)}><Pencil /> Abrir treino</Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Apagar rotina ${plan.name}`} onClick={() => setState((current) => ({ ...current, activities: plan.activityId ? current.activities.filter((activity) => activity.id !== plan.activityId) : current.activities, workoutPlans: current.workoutPlans.filter((item) => item.id !== plan.id) }))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
              </section>
            </>}
          </CardContent>
        </Card>
        <Card className="panel integration-card">
          <CardHeader>
            <CardTitle>Integrações e referências</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthConnectPanel state={state} status={healthSyncStatus} message={healthSyncMessage} onSync={onHealthSync} />
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
                <strong>Catálogo alimentar integrado</strong>
                <p>
                  Composição por 100 g, com alimentos portugueses e brasileiros num único catálogo sem repetições.
                </p>
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
      {editingPlan && (
        <WorkoutPlanEditorDialog
          plan={editingPlan}
          creating={creatingPlan}
          level={creatingPlan ? 'intermediate' : level}
          alternatives={exerciseAlternatives}
          loadingAlternatives={loadingAlternatives}
          onChange={setEditingPlan}
          onSave={saveWorkoutPlan}
          onClose={() => { setCreatingPlan(false); setEditingPlan(null); }}
        />
      )}
      {confirmReset && (
        <OverlayPortal><div className="dialog-backdrop" role="presentation">
          <section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <h3 id="reset-title">Apagar todo o perfil?</h3>
            <p>Esta ação remove permanentemente todos os registos da Fitide e volta ao ecrã inicial.</p>
            <div><Button variant="outline" onClick={() => setConfirmReset(false)}>Cancelar</Button><Button className="danger-button solid" onClick={async () => { setConfirmReset(false); await onReset(); }}>Sim, apagar tudo</Button></div>
          </section>
        </div></OverlayPortal>
      )}
    </div>
  );
}

function WorkoutPlanEditorDialog({
  plan,
  creating,
  level,
  alternatives,
  loadingAlternatives,
  onChange,
  onSave,
  onClose,
}: {
  plan: WorkoutPlan;
  creating: boolean;
  level: string;
  alternatives: WorkoutExercise[];
  loadingAlternatives: boolean;
  onChange: (plan: WorkoutPlan) => void;
  onSave: (plan: WorkoutPlan) => void;
  onClose: () => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [replacementIndex, setReplacementIndex] = useState<number | null>(null);

  useEffect(() => {
    const close = (event: Event) => { event.preventDefault(); if (catalogOpen) setCatalogOpen(false); else onClose(); };
    window.addEventListener('fitide-back', close);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(event); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('fitide-back', close); window.removeEventListener('keydown', escape); };
  }, [onClose, catalogOpen]);

  function patchExercise(index: number, patch: Partial<WorkoutExercise>) {
    onChange({ ...plan, exercises: plan.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...patch } : exercise) });
  }

  function replaceExercise(index: number, replacementId: string) {
    const replacement = alternatives.find((exercise) => exercise.id === replacementId);
    if (!replacement) return;
    const current = plan.exercises[index];
    patchExercise(index, {
      ...replacement,
      id: `${replacement.id}-${uid()}`,
      sets: current.sets,
      reps: current.reps,
      restSeconds: current.restSeconds,
      weightKg: current.weightKg,
    });
  }

  function addExercise(exerciseId: string) {
    const exercise = alternatives.find((item) => item.id === exerciseId);
    if (!exercise) return;
    onChange({
      ...plan,
      exercises: [...plan.exercises, {
        ...exercise,
        id: `${exercise.id}-${uid()}`,
        reps: '12',
        weightKg: exercise.weightKg ?? suggestedWorkoutWeight(level, exercise.equipment),
      }],
    });
  }

  function addManualExercise() {
    onChange({
      ...plan,
      exercises: [...plan.exercises, {
        id: uid(),
        name: 'Novo exercício',
        target: 'Grupo muscular',
        equipment: 'Outro',
        sets: 3,
        reps: '12',
        weightKg: suggestedWorkoutWeight(level, 'Outro'),
        restSeconds: 60,
      }],
    });
  }

  return (
    <OverlayPortal><div className="dialog-backdrop workout-editor-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="workout-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="workout-editor-title">
        <header>
          <div><p className="eyebrow">{creating ? 'NOVO TREINO PERSONALIZADO' : 'ROTINA SEMANAL'}</p><h2 id="workout-editor-title">{creating ? 'Criar o meu treino' : `Editar ${plan.name}`}</h2><small>{plan.exercises.length} exercícios · {plan.time ?? 'Sem hora'}</small></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar editor" onClick={onClose}><X /></Button>
        </header>
        <div className="workout-editor-list" key={catalogOpen ? 'catalog' : 'plan'}>
          {catalogOpen ? <ExerciseCatalog exercises={alternatives} loading={loadingAlternatives} replacing={replacementIndex !== null} onClose={() => setCatalogOpen(false)} onSelect={(id) => {
            if (replacementIndex !== null) { replaceExercise(replacementIndex, id); setCatalogOpen(false); }
            else addExercise(id);
          }} /> : <>
          <section className="custom-workout-name">
            <Field label="Nome do treino"><Input value={plan.name} onChange={(event) => onChange({ ...plan, name: event.target.value })} placeholder="Ex.: Peito e tríceps" /></Field>
            {creating && <p>Escolhe livremente os exercícios. Podes editar séries, repetições, carga e descanso em cada um.</p>}
          </section>
          <section className="workout-editor-catalog" aria-label="Adicionar exercícios">
            <div>
              <Button type="button" onClick={() => { setReplacementIndex(null); setCatalogOpen(true); }}><BookOpen /> Abrir catálogo de exercícios</Button>
              <Button type="button" variant="outline" onClick={addManualExercise}><Plus /> Adicionar manualmente</Button>
            </div>
          </section>
          {!plan.exercises.length && (
            <div className="custom-workout-empty"><Dumbbell /><strong>O treino ainda está vazio</strong><span>Adiciona o primeiro exercício acima.</span></div>
          )}
          {plan.exercises.map((exercise, index) => (
            <article key={`${exercise.id}-${index}`} className="workout-editor-exercise">
              <div className="workout-editor-number">{String(index + 1).padStart(2, '0')}</div>
              <div className="workout-editor-main">
                <Field label="Exercício"><Input value={exercise.name} onChange={(event) => patchExercise(index, { name: event.target.value })} /></Field>
                <Button type="button" variant="outline" onClick={() => { setReplacementIndex(index); setCatalogOpen(true); }}><BookOpen /> Substituir pelo catálogo</Button>
                <Field label="Equipamento"><Input value={exercise.equipment} onChange={(event) => patchExercise(index, { equipment: event.target.value })} /></Field>
                <div className="workout-editor-values">
                  <Field label="Séries"><NumberInput value={exercise.sets} min={1} max={12} onChange={(sets) => patchExercise(index, { sets })} /></Field>
                  <Field label="Repetições"><Input value={exercise.reps} onChange={(event) => patchExercise(index, { reps: event.target.value })} /></Field>
                  <Field label="Peso (kg)"><NumberInput value={exercise.weightKg ?? 0} min={0} max={400} step="0.5" onChange={(weightKg) => patchExercise(index, { weightKg })} /></Field>
                  <Field label="Descanso (s)"><NumberInput value={exercise.restSeconds} min={0} max={600} step="5" onChange={(restSeconds) => patchExercise(index, { restSeconds })} /></Field>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${exercise.name}`} onClick={() => onChange({ ...plan, exercises: plan.exercises.filter((_, exerciseIndex) => exerciseIndex !== index) })}><Trash2 /></Button>
            </article>
          ))}
          </>}
        </div>
        <footer><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" disabled={!plan.name.trim() || !plan.exercises.length} onClick={() => onSave(plan)}><Save /> {creating ? 'Criar e agendar treino' : 'Guardar treino'}</Button></footer>
      </section>
    </div></OverlayPortal>
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
  unit,
  unitOptions,
  onUnitChange,
  onConfirm,
  decimalPlaces,
  compact = false,
}: {
  value: number | '';
  onChange: (value: number, unit?: QuantityMode) => void;
  step?: string;
  min?: number;
  max?: number;
  ariaLabel?: string;
  unit?: QuantityMode;
  unitOptions?: NumberUnitOption[];
  onUnitChange?: (unit: QuantityMode) => void;
  onConfirm?: (value: number, unit?: QuantityMode) => void;
  decimalPlaces?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftUnit, setDraftUnit] = useState<QuantityMode>(unit ?? unitOptions?.[0]?.value ?? 'g');
  const activeUnitOption = unitOptions?.find((option) => option.value === draftUnit);
  const effectiveStep = activeUnitOption?.step ?? step;
  const effectiveMin = activeUnitOption?.min ?? min;
  const effectiveMax = activeUnitOption?.max ?? max;
  const increment = Number(effectiveStep);
  const precision = decimalPlaces ?? (effectiveStep.includes('.') ? effectiveStep.split('.')[1].length : 0);
  const [customWheelValue, setCustomWheelValue] = useState<number | null>(null);
  const [wheelSyncToken, setWheelSyncToken] = useState(0);
  const options = useMemo(() => {
    const values: number[] = [];
    const count = Math.floor((effectiveMax - effectiveMin) / increment);
    for (let index = 0; index <= count; index += 1) {
      values.push(Number((effectiveMin + index * increment).toFixed(precision)));
    }
    if (value !== '' && value >= effectiveMin && value <= effectiveMax && !values.includes(value)) values.push(value);
    if (customWheelValue !== null && customWheelValue >= effectiveMin && customWheelValue <= effectiveMax && !values.includes(customWheelValue)) {
      values.push(customWheelValue);
    }
    return values.sort((a, b) => a - b);
  }, [customWheelValue, effectiveMax, effectiveMin, increment, precision, value]);
  const initialValue = value === '' || value < effectiveMin || value > effectiveMax
    ? activeUnitOption?.defaultValue ?? options[0]
    : value;
  const [draft, setDraft] = useState(initialValue);
  const [manualDraft, setManualDraft] = useState(String(initialValue));
  const wheelRef = useRef<HTMLDivElement>(null);
  const manualInputFocused = useRef(false);
  const pendingWheelSync = useRef<number | null>(null);
  const itemHeight = 56;
  useViewportLock(open);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { event.preventDefault(); setOpen(false); };
    window.addEventListener('fitide-back', close);
    return () => window.removeEventListener('fitide-back', close);
  }, [open]);

  function formatNumber(option: number, digits: number) {
    return option.toLocaleString('pt-PT', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatOption(option: number) {
    return formatNumber(option, precision);
  }

  const committedUnitOption = unitOptions?.find((option) => option.value === unit);
  const committedStep = committedUnitOption?.step ?? step;
  const committedPrecision = decimalPlaces ?? (committedStep.includes('.') ? committedStep.split('.')[1].length : 0);
  const triggerSuffix = committedUnitOption?.suffix;

  useEffect(() => {
    if (!open) return;
    const targetValue = pendingWheelSync.current ?? draft;
    const index = Math.max(0, options.indexOf(targetValue));
    pendingWheelSync.current = null;
    const frame = window.requestAnimationFrame(() => {
      if (wheelRef.current) wheelRef.current.scrollTop = index * itemHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftUnit, open, options, wheelSyncToken]);

  function selectAtScroll() {
    if (manualInputFocused.current) return;
    const index = Math.min(
      options.length - 1,
      Math.max(0, Math.round((wheelRef.current?.scrollTop ?? 0) / itemHeight)),
    );
    const selected = options[index];
    setDraft(selected);
    setManualDraft(formatOption(selected));
  }

  function parsedManualValue() {
    const parsed = Number(manualDraft.trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) return draft;
    return Number(Math.min(effectiveMax, Math.max(effectiveMin, parsed)).toFixed(precision));
  }

  function applyManualDraftToWheel() {
    const parsed = parsedManualValue();
    pendingWheelSync.current = parsed;
    setCustomWheelValue(parsed);
    setDraft(parsed);
    setManualDraft(formatOption(parsed));
    setWheelSyncToken((current) => current + 1);
  }

  function commitDraftAndClose() {
    const committedValue = parsedManualValue();
    const committedUnit = unitOptions?.length ? draftUnit : undefined;
    if (unitOptions?.length) onUnitChange?.(draftUnit);
    onChange(committedValue, committedUnit);
    onConfirm?.(committedValue, committedUnit);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "number-picker-trigger compact-weight" : "number-picker-trigger"}
        aria-label={ariaLabel}
        onClick={(event) => {
          event.currentTarget.blur();
          const openingUnit = unit ?? unitOptions?.[0]?.value ?? 'g';
          const openingOption = unitOptions?.find((option) => option.value === openingUnit);
          const openingStep = openingOption?.step ?? step;
          const openingPrecision = decimalPlaces ?? (openingStep.includes('.') ? openingStep.split('.')[1].length : 0);
          const openingValue = value === '' ? openingOption?.defaultValue ?? min : value;
          pendingWheelSync.current = openingValue;
          setDraftUnit(openingUnit);
          setCustomWheelValue(null);
          setDraft(openingValue);
          setManualDraft(formatNumber(openingValue, openingPrecision));
          setOpen(true);
        }}
      >
        <span>{value === '' ? '—' : `${formatNumber(value, committedPrecision)}${triggerSuffix ? ` ${triggerSuffix}` : ''}`}</span>
        {compact ? <><span>g</span><Pencil size={18} /></> : <small>deslizar ou escrever</small>}
      </button>
      {open && (
        <OverlayPortal><div
          className="number-wheel-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) commitDraftAndClose();
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
            {unitOptions?.length ? (
              <div className="number-wheel-unit-picker" aria-label="Unidade da quantidade">
                {unitOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={draftUnit === option.value ? 'selected' : ''}
                     onClick={() => {
                       const nextPrecision = option.step.includes('.') ? option.step.split('.')[1].length : 0;
                       pendingWheelSync.current = option.defaultValue;
                       setDraftUnit(option.value);
                      setCustomWheelValue(null);
                      setDraft(option.defaultValue);
                      setManualDraft(formatNumber(option.defaultValue, nextPrecision));
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
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
                       setManualDraft(formatOption(option));
                       wheelRef.current?.scrollTo({ top: options.indexOf(option) * itemHeight, behavior: 'smooth' });
                    }}
                  >
                    {formatOption(option)}
                  </button>
                ))}
              </div>
            </div>
            <div className="number-wheel-manual">
              <span>Ou escreve o valor</span>
              <Input
                value={manualDraft}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${ariaLabel ?? 'Valor'} introduzido manualmente`}
                onFocus={() => { manualInputFocused.current = true; }}
                onChange={(event) => setManualDraft(event.target.value.replace(/[^0-9,.-]/g, ''))}
                onBlur={() => {
                  manualInputFocused.current = false;
                  applyManualDraftToWheel();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitDraftAndClose();
                }}
              />
            </div>
            <footer>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={commitDraftAndClose}>Confirmar</Button>
            </footer>
          </section>
        </div></OverlayPortal>
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
