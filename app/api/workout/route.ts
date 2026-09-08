import { env } from 'cloudflare:workers';
import type { WorkoutExercise } from '@/lib/fit-types';

type ApiExercise = {
  id?: string;
  name?: string;
  target?: string;
  bodyPart?: string;
  equipment?: string;
  gifUrl?: string;
  recommendedSets?: string;
  recommendedReps?: string;
};

const fieldTranslations: Record<string, string> = {
  abs: 'Abdominais', abductors: 'Abdutores', adductors: 'Adutores', biceps: 'Bíceps',
  calves: 'Gémeos', cardiovascular: 'Cardiovascular', delts: 'Deltoides', forearms: 'Antebraços',
  glutes: 'Glúteos', hamstrings: 'Posteriores da coxa', lats: 'Dorsais', pectorals: 'Peitoral',
  quads: 'Quadríceps', 'serratus anterior': 'Serrátil anterior', spine: 'Coluna', traps: 'Trapézio',
  triceps: 'Tríceps', 'upper back': 'Parte superior das costas', back: 'Costas', chest: 'Peito',
  shoulders: 'Ombros', waist: 'Abdominais', 'upper arms': 'Braços', 'lower arms': 'Antebraços',
  'upper legs': 'Pernas', 'lower legs': 'Gémeos', assisted: 'Assistido', band: 'Banda elástica',
  barbell: 'Barra', 'body weight': 'Peso corporal', 'bosu ball': 'Bosu', cable: 'Cabo',
  dumbbell: 'Halteres', 'elliptical machine': 'Elíptica', 'ez barbell': 'Barra EZ', hammer: 'Martelo',
  kettlebell: 'Kettlebell', 'leverage machine': 'Máquina', 'medicine ball': 'Bola medicinal',
  'olympic barbell': 'Barra olímpica', 'resistance band': 'Banda de resistência', roller: 'Rolo',
  rope: 'Corda', skierg: 'SkiErg', 'sled machine': 'Trenó', 'smith machine': 'Máquina Smith',
  'stability ball': 'Bola suíça', 'stationary bike': 'Bicicleta estática', 'stepmill machine': 'Escada',
  tire: 'Pneu', 'trap bar': 'Barra hexagonal', 'upper body ergometer': 'Ergómetro de braços',
  weighted: 'Com peso', 'wheel roller': 'Roda abdominal', other: 'Outro',
};

const exercisePhrases: Array<[string, string]> = [
  ['romanian deadlift', 'peso morto romeno'], ['stiff leg deadlift', 'peso morto com pernas estendidas'],
  ['straight leg deadlift', 'peso morto com pernas estendidas'], ['deadlift', 'peso morto'],
  ['bench press', 'supino'], ['chest press', 'press de peito'], ['shoulder press', 'press de ombros'],
  ['military press', 'press militar'], ['leg press', 'press de pernas'], ['push-up', 'flexão'],
  ['push up', 'flexão'], ['pull-up', 'elevação na barra'], ['pull up', 'elevação na barra'],
  ['chin-up', 'elevação supinada na barra'], ['chin up', 'elevação supinada na barra'],
  ['lat pulldown', 'puxada de dorsais'], ['pulldown', 'puxada'], ['seated row', 'remada sentada'],
  ['bent over row', 'remada inclinada'], ['upright row', 'remada alta'], ['row', 'remada'],
  ['front raise', 'elevação frontal'], ['lateral raise', 'elevação lateral'],
  ['rear delt fly', 'voo para deltoide posterior'], ['reverse fly', 'voo invertido'], ['fly', 'voo'],
  ['biceps curl', 'rosca de bíceps'], ['hammer curl', 'rosca martelo'], ['preacher curl', 'rosca Scott'],
  ['concentration curl', 'rosca concentrada'], ['curl', 'rosca'], ['triceps extension', 'extensão de tríceps'],
  ['triceps pushdown', 'tríceps na polia'], ['skull crusher', 'tríceps testa'], ['kickback', 'coice'],
  ['split squat', 'agachamento unilateral'], ['squat', 'agachamento'], ['lunge', 'afundo'],
  ['leg extension', 'extensão de pernas'], ['leg curl', 'flexão de pernas'], ['calf raise', 'elevação de gémeos'],
  ['hip thrust', 'elevação de anca'], ['glute bridge', 'ponte de glúteos'],
  ['good morning', 'bom dia'], ['crunch', 'abdominal curto'], ['sit-up', 'abdominal'],
  ['sit up', 'abdominal'], ['plank', 'prancha'], ['russian twist', 'rotação russa'],
  ['mountain climber', 'escalador'], ['jumping jack', 'polichinelo'], ['high knee', 'joelho alto'],
  ['step-up', 'subida no banco'], ['step up', 'subida no banco'], ['shrug', 'encolhimento'],
  ['face pull', 'face pull'], ['pullover', 'pullover'], ['clean and press', 'clean e press'],
  ['clean', 'clean'], ['snatch', 'arranco'], ['farmer walk', 'caminhada do agricultor'],
  ['wrist curl', 'flexão de punho'], ['back extension', 'extensão lombar'],
  ['dumbbell', 'com halteres'], ['barbell', 'com barra'], ['cable', 'na polia'],
  ['bodyweight', 'com peso corporal'], ['body weight', 'com peso corporal'], ['machine', 'na máquina'],
  ['incline', 'inclinado'], ['decline', 'declinado'], ['seated', 'sentado'], ['standing', 'em pé'],
  ['lying', 'deitado'], ['single arm', 'unilateral'], ['one arm', 'unilateral'],
  ['single leg', 'unilateral'], ['alternating', 'alternado'], ['reverse', 'invertido'],
  ['close grip', 'com pega fechada'], ['wide grip', 'com pega larga'], ['overhead', 'acima da cabeça'],
];

function sentenceCase(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean[0].toLocaleUpperCase('pt-PT') + clean.slice(1) : clean;
}

function translateField(value?: string) {
  if (!value) return '';
  return fieldTranslations[value.trim().toLowerCase()] ?? sentenceCase(value);
}

function translateExerciseName(value?: string) {
  if (!value) return '';
  let translated = value.toLowerCase().replace(/[_-]+/g, ' ');
  for (const [english, portuguese] of exercisePhrases) {
    translated = translated.replace(new RegExp(`\\b${english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'), portuguese);
  }
  return sentenceCase(translated);
}

const fallbackBase: WorkoutExercise[] = [
  {
    id: 'demo-1',
    name: 'Agachamento com barra',
    target: 'Quadríceps e glúteos',
    equipment: 'Barra',
    sets: 4,
    reps: '8-10',
    restSeconds: 90,
  },
  {
    id: 'demo-2',
    name: 'Supino com halteres',
    target: 'Peitoral',
    equipment: 'Halteres',
    sets: 4,
    reps: '8-12',
    restSeconds: 75,
  },
  {
    id: 'demo-3',
    name: 'Remada sentada',
    target: 'Costas',
    equipment: 'Cabo',
    sets: 3,
    reps: '10-12',
    restSeconds: 75,
  },
  {
    id: 'demo-4',
    name: 'Peso morto romeno',
    target: 'Posteriores',
    equipment: 'Barra',
    sets: 3,
    reps: '8-10',
    restSeconds: 90,
  },
  {
    id: 'demo-5',
    name: 'Elevação lateral',
    target: 'Ombros',
    equipment: 'Halteres',
    sets: 3,
    reps: '12-15',
    restSeconds: 45,
  },
  {
    id: 'demo-6',
    name: 'Rosca direta',
    target: 'Bíceps',
    equipment: 'Barra',
    sets: 3,
    reps: '10-12',
    restSeconds: 45,
  },
  {
    id: 'demo-7',
    name: 'Tríceps na polia',
    target: 'Tríceps',
    equipment: 'Cabo',
    sets: 3,
    reps: '10-12',
    restSeconds: 45,
  },
  {
    id: 'demo-8',
    name: 'Prancha',
    target: 'Abdominais',
    equipment: 'Peso corporal',
    sets: 3,
    reps: '40 s',
    restSeconds: 45,
  },
  { id: 'demo-9', name: 'Afundo com halteres', target: 'Quadríceps e glúteos', equipment: 'Halteres', sets: 3, reps: '10-12', restSeconds: 75 },
  { id: 'demo-10', name: 'Puxada de dorsais', target: 'Dorsais', equipment: 'Cabo', sets: 3, reps: '8-12', restSeconds: 75 },
  { id: 'demo-11', name: 'Press de ombros', target: 'Ombros', equipment: 'Halteres', sets: 3, reps: '8-12', restSeconds: 75 },
  { id: 'demo-12', name: 'Elevação de anca', target: 'Glúteos', equipment: 'Barra', sets: 4, reps: '8-12', restSeconds: 90 },
  { id: 'demo-13', name: 'Extensão de pernas', target: 'Quadríceps', equipment: 'Máquina', sets: 3, reps: '10-15', restSeconds: 60 },
  { id: 'demo-14', name: 'Flexão de pernas', target: 'Posteriores da coxa', equipment: 'Máquina', sets: 3, reps: '10-15', restSeconds: 60 },
  { id: 'demo-15', name: 'Elevação de gémeos', target: 'Gémeos', equipment: 'Máquina', sets: 4, reps: '12-20', restSeconds: 45 },
  { id: 'demo-16', name: 'Remada unilateral', target: 'Costas', equipment: 'Halteres', sets: 3, reps: '8-12', restSeconds: 60 },
  { id: 'demo-17', name: 'Face pull', target: 'Ombros posteriores', equipment: 'Cabo', sets: 3, reps: '12-15', restSeconds: 45 },
  { id: 'demo-18', name: 'Flexão', target: 'Peitoral e tríceps', equipment: 'Peso corporal', sets: 3, reps: '8-20', restSeconds: 60 },
  { id: 'demo-19', name: 'Elevação na barra', target: 'Dorsais e bíceps', equipment: 'Peso corporal', sets: 3, reps: '5-10', restSeconds: 90 },
  { id: 'demo-20', name: 'Agachamento goblet', target: 'Quadríceps e glúteos', equipment: 'Kettlebell', sets: 3, reps: '10-15', restSeconds: 75 },
  { id: 'demo-21', name: 'Swing com kettlebell', target: 'Glúteos e posteriores', equipment: 'Kettlebell', sets: 4, reps: '12-20', restSeconds: 60 },
  { id: 'demo-22', name: 'Supino na máquina', target: 'Peitoral', equipment: 'Máquina', sets: 3, reps: '8-12', restSeconds: 75 },
  { id: 'demo-23', name: 'Remada na máquina', target: 'Costas', equipment: 'Máquina', sets: 3, reps: '8-12', restSeconds: 75 },
  { id: 'demo-24', name: 'Pallof press', target: 'Abdominais', equipment: 'Cabo', sets: 3, reps: '10-12/lado', restSeconds: 45 },
];

const splitFocus: Record<string, string[]> = {
  full_body: ['chest', 'back', 'shoulders', 'upper legs', 'upper arms'],
  upper: ['chest', 'back', 'shoulders', 'upper arms'],
  lower: ['upper legs', 'lower legs', 'waist'],
  push: ['chest', 'shoulders', 'upper arms'],
  pull: ['back', 'upper arms', 'lower arms'],
  legs: ['upper legs', 'lower legs'],
  core: ['waist', 'back'],
};

const muscleRequestMap: Record<string, { bodyPart: string; targets: string[] }> = {
  biceps: { bodyPart: 'upper arms', targets: ['biceps'] },
  triceps: { bodyPart: 'upper arms', targets: ['triceps'] },
  back: { bodyPart: 'back', targets: ['lats', 'upper back', 'spine'] },
  shoulders: { bodyPart: 'shoulders', targets: ['delts'] },
  'upper legs': { bodyPart: 'upper legs', targets: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors'] },
  abs: { bodyPart: 'waist', targets: ['abs'] },
  traps: { bodyPart: 'back', targets: ['traps'] },
  forearms: { bodyPart: 'lower arms', targets: ['forearms'] },
  core: { bodyPart: 'waist', targets: ['abs', 'spine'] },
  calves: { bodyPart: 'lower legs', targets: ['calves'] },
};

function apiEquipment(equipment: string[] = []) {
  return [...new Set(equipment.flatMap((item) => item === 'free_weights'
    ? ['dumbbell', 'barbell', 'kettlebell']
    : [item]))];
}

function fallbackForEquipment(equipment: string[] = []) {
  const requested = apiEquipment(equipment);
  if (!requested.length) return fallbackBase;
  const labels: Record<string, string[]> = {
    dumbbell: ['Halteres'], barbell: ['Barra', 'Barra EZ', 'Barra olímpica'],
    kettlebell: ['Kettlebell'], 'body weight': ['Peso corporal'], cable: ['Cabo'],
    'leverage machine': ['Máquina'], 'smith machine': ['Máquina Smith'],
    'resistance band': ['Banda elástica', 'Banda de resistência'],
  };
  const allowed = new Set(requested.flatMap((item) => labels[item] ?? []));
  const filtered = fallbackBase.filter((exercise) => allowed.has(exercise.equipment));
  return filtered.length ? filtered : fallbackBase;
}

function asWorkoutExercise(
  item: ApiExercise,
  index: number,
  level = 'intermediate',
  sets?: number,
  _reps?: string,
  restSeconds?: number,
): WorkoutExercise {
  const id = item.id ?? `wx-${index}`;
  return {
    id,
    name: translateExerciseName(item.name) || `Exercício ${index + 1}`,
    target: translateField(item.target ?? item.bodyPart),
    equipment: translateField(item.equipment),
    gifUrl:
      item.gifUrl && item.id
        ? `/api/workout?gif=${encodeURIComponent(item.id)}`
        : undefined,
    sets: sets ?? (Number(item.recommendedSets) || 3),
    reps: '12',
    weightKg: suggestedWeightKg(item.equipment, level),
    restSeconds: restSeconds ?? 60,
  };
}

function suggestedWeightKg(equipment = '', level = 'intermediate') {
  const normalized = equipment.toLowerCase();
  if (normalized.includes('body weight') || normalized.includes('assisted')) return 0;
  const index = level === 'beginner' ? 0 : level === 'advanced' ? 2 : 1;
  if (/(barbell|smith|machine|sled)/.test(normalized)) return [10, 20, 30][index];
  if (/(dumbbell|kettlebell)/.test(normalized)) return [4, 8, 12][index];
  return [5, 10, 15][index];
}

function withCreationDefaults(exercise: WorkoutExercise, level = 'intermediate'): WorkoutExercise {
  return {
    ...exercise,
    reps: '12',
    weightKg: suggestedWeightKg(exercise.equipment, level),
  };
}

async function catalogWorkout(apiKey: string, focus: string[], level: string, equipment: string[] = []) {
  const selectedEquipment = apiEquipment(equipment);
  const requests = focus.slice(0, 6).map(async (requestedFocus) => {
    const request = muscleRequestMap[requestedFocus] ?? { bodyPart: requestedFocus, targets: [] };
    const params = new URLSearchParams({
      bodyPart: request.bodyPart,
      effortLevel: level,
      sortMethod: 'popularityRank',
      sortOrder: 'ascending',
      limit: '4',
      lang: 'en',
    });
    if (selectedEquipment.length) params.set('equipment', selectedEquipment.join(','));
    const response = await fetch(
      `https://api.workoutxapp.com/v1/exercises?${params}`,
      {
        headers: { 'X-WorkoutX-Key': apiKey },
      },
    );
    if (!response.ok) return [] as ApiExercise[];
    const result = (await response.json()) as
      | ApiExercise[]
      | { data?: ApiExercise[] };
    const exercises = Array.isArray(result) ? result : (result.data ?? []);
    if (!request.targets.length) return exercises;
    const exact = exercises.filter((item) => request.targets.includes((item.target ?? '').toLowerCase()));
    return exact.length ? exact : exercises;
  });
  const groups = await Promise.all(requests);
  const selected: ApiExercise[] = [];
  groups.forEach((group, groupIndex) => {
    const candidates = group.filter(
      (item) => item.id && !selected.some((chosen) => chosen.id === item.id),
    );
    const first = candidates[groupIndex % Math.max(1, candidates.length)];
    if (first) selected.push(first);
    const second = candidates.find(
      (item) => !selected.some((chosen) => chosen.id === item.id),
    );
    if (second && selected.length < 8) selected.push(second);
  });
  return selected
    .slice(0, 8)
    .map((item, index) => asWorkoutExercise(item, index, level));
}

async function fullExerciseCatalog(apiKey: string, level: string) {
  const params = new URLSearchParams({
    effortLevel: level,
    sortMethod: 'popularityRank',
    sortOrder: 'ascending',
    limit: '100',
    lang: 'en',
  });
  const response = await fetch(`https://api.workoutxapp.com/v1/exercises?${params}`, {
    headers: { 'X-WorkoutX-Key': apiKey },
  });
  if (!response.ok) return [] as WorkoutExercise[];
  const result = (await response.json()) as ApiExercise[] | { data?: ApiExercise[] };
  const exercises = Array.isArray(result) ? result : (result.data ?? []);
  return exercises.map((item, index) => asWorkoutExercise(item, index, level));
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('gif');
  const apiKey = env.WORKOUTX_API_KEY;
  if (!apiKey || !id || !/^[a-zA-Z0-9_-]{1,32}$/.test(id))
    return new Response('GIF não disponível', { status: 404 });
  const response = await fetch(
    `https://api.workoutxapp.com/v1/gifs/${encodeURIComponent(id)}.gif`,
    {
      headers: { 'X-WorkoutX-Key': apiKey },
    },
  );
  if (!response.ok || !response.body)
    return new Response('GIF não disponível', { status: response.status });
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/gif',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: 'generate' | 'catalog';
    goal?: string;
    level?: string;
    split?: string;
    equipment?: string[];
    bodyFocus?: string[];
  };
  const split = body.split && splitFocus[body.split] ? body.split : 'full_body';
  const focus = body.bodyFocus?.length ? body.bodyFocus : splitFocus[split];
  const selectedEquipment = apiEquipment(body.equipment);
  const apiKey = env.WORKOUTX_API_KEY;

  if (body.action === 'catalog') {
    if (apiKey) {
      try {
        const exercises = await fullExerciseCatalog(apiKey, body.level ?? 'intermediate');
        if (exercises.length) return Response.json({ source: 'WorkoutX', exercises });
      } catch {
        // Keep the editor usable with the local catalogue.
      }
    }
    return Response.json({ source: 'Demonstração', exercises: fallbackBase.map((exercise) => withCreationDefaults(exercise, body.level)) });
  }

  if (apiKey) {
    const params = new URLSearchParams({
      goal: body.goal ?? 'fat_loss',
      level: body.level ?? 'intermediate',
      split,
      duration: '55',
      lang: 'en',
      equipment: selectedEquipment.length ? selectedEquipment.join(',') : 'barbell,dumbbell,cable,leverage machine,body weight',
    });
    if (body.bodyFocus?.length)
      params.set('bodyFocus', body.bodyFocus.join(','));
    try {
      const response = await fetch(
        `https://api.workoutxapp.com/v1/workout/generate?${params}`,
        {
          headers: { 'X-WorkoutX-Key': apiKey },
        },
      );
      if (response.ok) {
        const data = (await response.json()) as {
          exercises?: Array<{
            sets?: number;
            reps?: string;
            restSeconds?: number;
            exercise?: ApiExercise;
          }>;
        };
        const exercises = (data.exercises ?? []).map((item, index) =>
          asWorkoutExercise(
            item.exercise ?? {},
            index,
            body.level ?? 'intermediate',
            item.sets,
            item.reps,
            item.restSeconds,
          ),
        );
        if (exercises.length)
          return Response.json({ source: 'WorkoutX', exercises });
      }

      // Free WorkoutX keys include the catalogue and GIFs even when the AI
      // generator is unavailable, so assemble a balanced session locally.
      const exercises = await catalogWorkout(
        apiKey,
        focus,
        body.level ?? 'intermediate',
        body.equipment,
      );
      if (exercises.length)
        return Response.json({ source: 'WorkoutX', exercises });
    } catch {
      // The app remains usable with the demonstration routine below.
    }
  }

  return Response.json({ source: 'Demonstração', exercises: fallbackForEquipment(body.equipment).slice(0, 10).map((exercise) => withCreationDefaults(exercise, body.level)) });
}
