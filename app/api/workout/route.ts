import { env } from 'cloudflare:workers';
import type { WorkoutExercise } from '@/lib/fit-types';

const fallback: Record<string, WorkoutExercise[]> = {
  full_body: [
    { id: 'demo-1', name: 'Agachamento com barra', target: 'Quadríceps e glúteos', equipment: 'Barra', sets: 4, reps: '8–10', restSeconds: 90 },
    { id: 'demo-2', name: 'Supino com halteres', target: 'Peitoral', equipment: 'Halteres', sets: 4, reps: '8–12', restSeconds: 75 },
    { id: 'demo-3', name: 'Remada sentada', target: 'Dorsais', equipment: 'Cabo', sets: 3, reps: '10–12', restSeconds: 75 },
    { id: 'demo-4', name: 'Peso morto romeno', target: 'Posteriores', equipment: 'Barra', sets: 3, reps: '8–10', restSeconds: 90 },
    { id: 'demo-5', name: 'Elevação lateral', target: 'Ombros', equipment: 'Halteres', sets: 3, reps: '12–15', restSeconds: 45 },
    { id: 'demo-6', name: 'Prancha', target: 'Abdominais', equipment: 'Peso corporal', sets: 3, reps: '40 s', restSeconds: 45 },
  ],
  upper: [
    { id: 'demo-u1', name: 'Supino inclinado', target: 'Peitoral', equipment: 'Halteres', sets: 4, reps: '8–12', restSeconds: 75 },
    { id: 'demo-u2', name: 'Puxada na polia', target: 'Dorsais', equipment: 'Cabo', sets: 4, reps: '10–12', restSeconds: 75 },
    { id: 'demo-u3', name: 'Desenvolvimento sentado', target: 'Ombros', equipment: 'Halteres', sets: 3, reps: '8–10', restSeconds: 75 },
    { id: 'demo-u4', name: 'Remada unilateral', target: 'Costas', equipment: 'Halter', sets: 3, reps: '10/cada', restSeconds: 60 },
    { id: 'demo-u5', name: 'Rosca direta', target: 'Bíceps', equipment: 'Barra', sets: 3, reps: '10–12', restSeconds: 45 },
    { id: 'demo-u6', name: 'Tríceps na polia', target: 'Tríceps', equipment: 'Cabo', sets: 3, reps: '10–12', restSeconds: 45 },
  ],
  lower: [
    { id: 'demo-l1', name: 'Agachamento livre', target: 'Quadríceps e glúteos', equipment: 'Barra', sets: 4, reps: '6–10', restSeconds: 105 },
    { id: 'demo-l2', name: 'Leg press', target: 'Quadríceps', equipment: 'Máquina', sets: 4, reps: '10–12', restSeconds: 90 },
    { id: 'demo-l3', name: 'Peso morto romeno', target: 'Posteriores', equipment: 'Barra', sets: 3, reps: '8–10', restSeconds: 90 },
    { id: 'demo-l4', name: 'Hip thrust', target: 'Glúteos', equipment: 'Barra', sets: 4, reps: '8–12', restSeconds: 75 },
    { id: 'demo-l5', name: 'Flexão de pernas', target: 'Posteriores', equipment: 'Máquina', sets: 3, reps: '10–15', restSeconds: 60 },
    { id: 'demo-l6', name: 'Elevação de gémeos', target: 'Gémeos', equipment: 'Máquina', sets: 4, reps: '12–15', restSeconds: 45 },
  ],
};

export async function POST(request: Request) {
  const body = (await request.json()) as { goal?: string; level?: string; split?: string; equipment?: string };
  const split = body.split && fallback[body.split] ? body.split : 'full_body';
  const apiKey = env.WORKOUTX_API_KEY;

  if (apiKey) {
    const params = new URLSearchParams({
      goal: body.goal ?? 'fat_loss',
      level: body.level ?? 'intermediate',
      split,
      duration: '55',
      equipment: body.equipment ?? 'barbell,dumbbell,cable,leverage machine',
    });
    try {
      const response = await fetch(`https://api.workoutxapp.com/v1/workout/generate?${params}`, {
        headers: { 'X-WorkoutX-Key': apiKey },
      });
      if (response.ok) {
        const data = (await response.json()) as { exercises?: Array<{ sets?: number; reps?: string; restSeconds?: number; exercise?: Record<string, string> }> };
        const exercises = (data.exercises ?? []).map((item, index) => ({
          id: item.exercise?.id ?? `wx-${index}`,
          name: item.exercise?.name ?? `Exercício ${index + 1}`,
          target: item.exercise?.target ?? '',
          equipment: item.exercise?.equipment ?? '',
          gifUrl: item.exercise?.gifUrl,
          sets: item.sets ?? 3,
          reps: item.reps ?? '8–12',
          restSeconds: item.restSeconds ?? 60,
        }));
        if (exercises.length) return Response.json({ source: 'WorkoutX', exercises });
      }
    } catch {
      // A app continua funcional com o plano de demonstração abaixo.
    }
  }

  return Response.json({ source: 'Demonstração', exercises: fallback[split] });
}
