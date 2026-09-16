'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { frequentIngredients, ingredientKey } from '@/lib/personal-tracking';
import type { IngredientEntry, Meal } from '@/lib/fit-types';
export function IngredientShortcuts({ meals, favorites, onAdd, onFavorites }: { meals: Meal[]; favorites: IngredientEntry[]; onAdd: (item: IngredientEntry) => void; onFavorites: (items: IngredientEntry[]) => void }) {
  const frequent = frequentIngredients(meals);
  const [added, setAdded] = useState('');
  const items = [...favorites, ...frequent.map(item => item.ingredient)].filter((item, index, all) => all.findIndex(other => ingredientKey(other.name) === ingredientKey(item.name)) === index);
  if (!items.length) return null;
  return <details className="ingredient-shortcuts" open><summary>⭐ Favoritos e mais usados</summary><div className="ingredient-shortcut-grid">{items.slice(0, 12).map(item => {
    const key = ingredientKey(item.name); const favorite = favorites.some(other => ingredientKey(other.name) === key); const count = frequent.find(other => ingredientKey(other.ingredient.name) === key)?.count ?? 0;
    return <div key={key}><Button variant="outline" type="button" onClick={() => { onAdd(item); setAdded(`${item.name} · ${item.grams} g adicionado`); }} aria-label={`Repetir ${item.grams} g de ${item.name}`}><span>{item.name}<small>{item.grams} g · {count} utilizações</small></span><span>＋</span></Button><Button variant="ghost" type="button" aria-label={`${favorite ? 'Remover' : 'Guardar'} favorito ${item.name}`} aria-pressed={favorite} onClick={() => onFavorites(favorite ? favorites.filter(other => ingredientKey(other.name) !== key) : [...favorites, item])}>{favorite ? '★' : '☆'}</Button></div>;
  })}</div>{added && <p role="status">{added}</p>}</details>;
}
