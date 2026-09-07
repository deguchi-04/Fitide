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
  theme: 'light',
  profile,
  goals: suggestedGoals(profile, [], 'lose_fat'),
  activities: [],
  activityCheckIns: [],
  meals: [],
  customFoods: [],
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
  judoProfile: {
    belt: 'Branca',
    tokuiWazaIds: [],
    learningGoals: [],
    scores: {
      tachiWaza: 45,
      neWaza: 45,
      physicalCondition: 50,
      mental: 50,
      knowledge: 40,
      matchPrep: 35,
    },
  },
  healthSnapshots: [],
  healthSyncEnabled: false,
};
