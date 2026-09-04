import { suggestedGoals } from './calculations';
import type { AppState, Profile } from './fit-types';

const profile: Profile = {
  configured: false,
  name: '',
  age: 30,
  heightCm: 175,
  sex: 'male',
  currentWeightKg: 75,
  targetWeightKg: 70,
};

export const defaultState: AppState = {
  profile,
  goals: suggestedGoals(profile, [], 'lose_fat'),
  activities: [],
  meals: [],
  weights: [],
  water: [],
  fasts: [],
  workoutPlans: [],
  workoutSessions: [],
  intervalPresets: [
    {
      id: 'randori-2-1',
      name: 'Randori curto 2:1',
      workSeconds: 120,
      restSeconds: 60,
      rounds: 7,
    },
  ],
  judoPractices: [],
  healthSnapshots: [],
};
