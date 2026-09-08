import type { WorkoutExercise } from './fit-types';

export const workoutGroups = [
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
  // Preserve all catalog entries, including muscles outside the suggested split.
  { value: 'chest', label: 'Peito' },
  { value: 'other', label: 'Outros / mobilidade e cardio' },
];

export function exerciseGroups(exercise: Pick<WorkoutExercise, 'target' | 'name' | 'muscleGroups'>): string[] {
  if (exercise.muscleGroups?.length) return exercise.muscleGroups;
  const target = exercise.target.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/biceps/.test(target)) return ['biceps'];
  if (/triceps/.test(target)) return ['triceps'];
  if (/trapez|traps/.test(target)) return ['traps'];
  if (/antebr|forearm/.test(target)) return ['forearms'];
  if (/geme|calves/.test(target)) return ['calves'];
  if (/delto|delts|ombro|shoulder/.test(target)) return ['shoulders'];
  if (/quad|glut|posterior|hamstring|adutor|abdutor|adduct|abduct|perna/.test(target)) return ['upper legs'];
  if (/abs|abdomin|obliqu|serra/.test(target)) return ['abs', 'core'];
  if (/coluna|spine|lombar/.test(target)) return ['back', 'core'];
  if (/costas|dorsa|lats|back/.test(target)) return ['back'];
  if (/peit|pector/.test(target)) return ['chest'];
  return ['other'];
}
