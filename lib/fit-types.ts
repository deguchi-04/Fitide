export type Sex = 'male' | 'female';
export type GoalKind = 'lose_fat' | 'maintain' | 'gain_muscle';

export interface Profile {
  configured: boolean;
  name: string;
  age: number;
  heightCm: number;
  sex: Sex;
  currentWeightKg: number;
  targetWeightKg: number;
  bodyFatPercent?: number;
  targetBodyFatPercent?: number;
  leanMassPercent?: number;
}

export interface Goals {
  kind: GoalKind;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterLiters: number;
  fastingHours: number;
}

export interface Activity {
  id: string;
  name: string;
  days: number[];
  minutes: number;
  met: number;
}

export interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calcium: number;
  iron: number;
  vitaminC: number;
}

export interface IngredientEntry extends Nutrients {
  id: string;
  name: string;
  grams: number;
  source: 'TACO' | 'Rótulo';
}

export interface Meal {
  id: string;
  date: string;
  type: string;
  ingredients: IngredientEntry[];
  createdAt: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercent?: number;
}

export interface WaterEntry {
  date: string;
  liters: number;
}

export interface FastEntry {
  id: string;
  start: string;
  end: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  target: string;
  equipment: string;
  sets: number;
  reps: string;
  restSeconds: number;
  gifUrl?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  source: 'WorkoutX' | 'Demonstração';
  createdAt: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  planName: string;
  minutes: number;
  completedSets: number;
  calories: number;
}

export interface AppState {
  profile: Profile;
  goals: Goals;
  activities: Activity[];
  meals: Meal[];
  weights: WeightEntry[];
  water: WaterEntry[];
  fasts: FastEntry[];
  activeFastStart?: string;
  workoutPlans: WorkoutPlan[];
  workoutSessions: WorkoutSession[];
}
