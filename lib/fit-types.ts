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
  calorieDeficit: number;
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
  specificDate?: string;
  minutes: number;
  intensity: number;
  met?: number;
  time?: string;
}

export interface ActivityCheckIn {
  activityId: string;
  date: string;
  status: 'completed' | 'skipped';
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
  source: 'Catálogo' | 'PortFIR' | 'TACO' | 'Rótulo';
}

export interface SavedFood extends Nutrients {
  id: string;
  name: string;
  updatedAt: string;
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
  muscleGroups?: string[];
  name: string;
  target: string;
  equipment: string;
  sets: number;
  reps: string;
  weightKg?: number;
  restSeconds: number;
  gifUrl?: string;
}

export interface WorkoutPlan {
  id: string;
  activityId?: string;
  name: string;
  source: 'WorkoutX' | 'Demonstração' | 'Personalizado';
  createdAt: string;
  days?: number[];
  specificDate?: string;
  time?: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutSession {
  id: string;
  planId?: string;
  activityId?: string;
  date: string;
  planName: string;
  minutes: number;
  completedSets: number;
  calories: number;
}

export interface IntervalPreset {
  id: string;
  name: string;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

export interface JudoPractice {
  id: string;
  date: string;
  durationMinutes: number;
  techniqueIds: string[];
  uchikomiReps: number;
  randoriRounds: number;
  randoriMinutes: number;
  notes: string;
  createdAt: string;
}

export interface JudoLearningGoal {
  id: string;
  techniqueId?: string;
  name: string;
  mediaUrl?: string;
  notes: string;
  progress: number;
}

export interface JudoProfile {
  belt: string;
  tokuiWazaIds: string[];
  learningGoals: JudoLearningGoal[];
  scores: {
    tachiWaza: number;
    neWaza: number;
    physicalCondition: number;
    mental: number;
    knowledge: number;
    matchPrep: number;
  };
}

export interface HealthSnapshot {
  date: string;
  steps?: number;
  activeCalories?: number;
  averageHeartRate?: number;
  sleepMinutes?: number;
  bodyFatPercent?: number;
  syncedAt: string;
}

export interface AppState {
  mealDraft?: { date: string; mealId?: string; type: string; ingredients: IngredientEntry[]; manualName: string; manual: Record<keyof Nutrients, number | ''>; grams: number; foodId?: string; quantityMode?: 'g' | 'ml' | 'unit'; foodQuery: string; mode: 'Catálogo' | 'Rótulo'; assistantText: string };
  activeWorkout?: {
    plan: WorkoutPlan;
    date: string;
    startedAt: number;
    restEndAt: number;
    completedSets: string[];
    setValues: Record<string, { load: number | ''; reps: number | '' }>;
  };
  theme: 'light' | 'dark';
  profile: Profile;
  goals: Goals;
  activities: Activity[];
  activityCheckIns: ActivityCheckIn[];
  meals: Meal[];
  customFoods: SavedFood[];
  weights: WeightEntry[];
  water: WaterEntry[];
  fasts: FastEntry[];
  activeFastStart?: string;
  workoutPlans: WorkoutPlan[];
  workoutSessions: WorkoutSession[];
  intervalPresets: IntervalPreset[];
  judoPractices: JudoPractice[];
  judoProfile: JudoProfile;
  healthSnapshots: HealthSnapshot[];
  healthSyncEnabled: boolean;
  widgetOrders: Record<string, string[]>;
}
