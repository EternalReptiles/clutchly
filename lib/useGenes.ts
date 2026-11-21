import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useStore } from './store';
import type { AnimalGene, Combo, Gene, Lib } from './genetics';

// The shared gene library and combination names, kept on the phone for offline use.
const CACHE_KEY = 'clutchly.geneLibrary.v2';
type Shared = { genes: Gene[]; combos: Combo[] };
let shared: Shared | null = null;
const listeners = new Set<(g: Shared) => void>();
async function loadLibrary() {
  if (!shared) { const c = await AsyncStorage.getItem(CACHE_KEY).catch(() => null); if (c) { shared = JSON.parse(c); listeners.forEach(l => l(shared!)); } }
  const [g, c] = await Promise.all([supabase.from('gene_library').select('*').order('sort'), supabase.from('morph_combos').select('*')]);
  if (!g.error && g.data && !c.error && c.data) {
    shared = { genes: g.data.map(({ id, updated_at, ...x }) => ({ key: id, ...x })) as Gene[],
      combos: c.data.map(({ updated_at, ...x }) => x) as Combo[] };
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(shared)).catch(() => {}); listeners.forEach(l => l(shared!));
  }
}
let started = false;

/** Every gene the user can use (shared library plus their own, keyed by gene_key) and the combination names. */
export function useGeneLib(): Lib {
  const st = useStore(); const [lib, setLib] = useState<Shared>(shared ?? { genes: [], combos: [] });
  useEffect(() => { listeners.add(setLib); if (!started) { started = true; loadLibrary(); } return () => { listeners.delete(setLib); }; }, []);
  return useMemo(() => {
    const own: Gene[] = st.user_genes.map(u => ({ key: `u:${u.id}`, species: u.species, name: u.name, inheritance: u.inheritance,
      description: u.description, super_name: u.super_name, sort: 50, custom: true }));
    return { genes: new Map([...lib.genes, ...own].map(g => [g.key, g])), combos: lib.combos };
  }, [lib, st.user_genes]);
}
export const useGenes = () => useGeneLib().genes;
/** One animal's genes (the rows the calculator needs). */
export function useAnimalGenes(animalId?: string | null): AnimalGene[] {
  const st = useStore();
  return useMemo(() => animalId ? st.animal_genes.filter(g => g.animal_id === animalId) as unknown as AnimalGene[] : [], [st.animal_genes, animalId]);
}
