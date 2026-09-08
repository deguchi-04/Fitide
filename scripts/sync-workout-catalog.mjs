import { writeFile, mkdir } from 'node:fs/promises';

// Run with WORKOUTX_API_KEY in the environment. Keep a complete, compact
// snapshot so opening the editor never spends 134 API requests or omits pages.
const key = process.env.WORKOUTX_API_KEY;
if (!key) throw new Error('WORKOUTX_API_KEY is required');
const exercises = new Map();
let total = Infinity;
let offset = 0;
while (offset < total) {
  const response = await fetch(`https://api.workoutxapp.com/v1/exercises?limit=100&offset=${offset}&lang=en`, {
    headers: { 'X-WorkoutX-Key': key },
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 429) {
    const remaining = response.headers.get('X-Quota-Remaining');
    if (remaining === '0') throw new Error('Monthly API quota exhausted; existing snapshot preserved');
    await new Promise(resolve => setTimeout(resolve, 60000));
    continue;
  }
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  const result = await response.json();
  const batch = Array.isArray(result) ? result : result.data;
  if (!Array.isArray(batch) || !batch.length) {
    if (Number.isFinite(total) && offset < total) throw new Error('Incomplete catalog; existing snapshot preserved');
    break;
  }
  total = result.total ?? Infinity;
  const previousSize = exercises.size;
  for (const item of batch) {
    if (!item.id || !item.name) throw new Error('Invalid exercise');
    exercises.set(item.id, {
      id: item.id, name: item.name, bodyPart: item.bodyPart, target: item.target,
      equipment: item.equipment, gifUrl: item.gifUrl, difficulty: item.difficulty,
      recommendedSets: item.recommendedSets,
    });
  }
  if (previousSize === exercises.size) throw new Error('Repeated API page; existing snapshot preserved');
  offset += batch.length; // The free plan caps results at 10, regardless of limit.
  if (offset % 100 === 0 || offset >= total) console.log(`${exercises.size}/${total} exercises`);
  if (offset < total) await new Promise(resolve => setTimeout(resolve, 2200));
}
if (Number.isFinite(total) && exercises.size !== total) throw new Error('Catalog count mismatch');
await mkdir(new URL('../lib/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/data/workout-catalog.json', import.meta.url), JSON.stringify({
  source: 'https://www.workoutxapp.com/docs.html',
  updatedAt: new Date().toISOString(), total: exercises.size,
  exercises: [...exercises.values()],
}));
console.log(`Saved complete catalog: ${exercises.size} exercises`);
