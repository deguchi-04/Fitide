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

function asWorkoutExercise(
  item: ApiExercise,
  index: number,
  sets?: number,
  reps?: string,
  restSeconds?: number,
): WorkoutExercise {
  const id = item.id ?? `wx-${index}`;
  return {
    id,
    name: item.name ?? `Exercício ${index + 1}`,
    target: item.target ?? item.bodyPart ?? '',
    equipment: item.equipment ?? '',
    gifUrl:
      item.gifUrl && item.id
        ? `/api/workout?gif=${encodeURIComponent(item.id)}`
        : undefined,
    sets: sets ?? (Number(item.recommendedSets) || 3),
    reps: reps ?? item.recommendedReps ?? '8-12',
    restSeconds: restSeconds ?? 60,
  };
}

async function catalogWorkout(apiKey: string, focus: string[], level: string) {
  const requests = focus.slice(0, 6).map(async (bodyPart) => {
    const params = new URLSearchParams({
      bodyPart,
      effortLevel: level,
      sortMethod: 'popularityRank',
      sortOrder: 'ascending',
      limit: '4',
      lang: 'es',
    });
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
    return Array.isArray(result) ? result : (result.data ?? []);
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
    .map((item, index) => asWorkoutExercise(item, index));
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
    equipment?: string;
    bodyFocus?: string[];
  };
  const split = body.split && splitFocus[body.split] ? body.split : 'full_body';
  const focus = body.bodyFocus?.length ? body.bodyFocus : splitFocus[split];
  const apiKey = env.WORKOUTX_API_KEY;

  if (body.action === 'catalog') {
    if (apiKey) {
      try {
        const exercises = await catalogWorkout(
          apiKey,
          body.bodyFocus?.length
            ? body.bodyFocus
            : ['chest', 'back', 'shoulders', 'upper legs', 'upper arms', 'waist'],
          body.level ?? 'intermediate',
        );
        if (exercises.length) return Response.json({ source: 'WorkoutX', exercises });
      } catch {
        // Keep the editor usable with the local catalogue.
      }
    }
    return Response.json({ source: 'Demonstração', exercises: fallbackBase });
  }

  if (apiKey) {
    const params = new URLSearchParams({
      goal: body.goal ?? 'fat_loss',
      level: body.level ?? 'intermediate',
      split,
      duration: '55',
      equipment: body.equipment ?? 'barbell,dumbbell,cable,leverage machine',
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
      );
      if (exercises.length)
        return Response.json({ source: 'WorkoutX', exercises });
    } catch {
      // The app remains usable with the demonstration routine below.
    }
  }

  return Response.json({ source: 'Demonstração', exercises: fallbackBase });
}
