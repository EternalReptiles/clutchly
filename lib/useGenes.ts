import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useStore } from './store';
import type { AnimalGene, Gene } from './genetics';

const CACHE_KEY = 'clutchly.geneLibrary.v1';
let library: Gene[] | null = null;
const listeners = new Set<(g: Gene[]) => void>();
async function loadLibrary() {
  if (!library) { const c = await AsyncStorage.getItem(CACHE_KEY).catch(() => null); if (c) { library = JSON.parse(c); listeners.forEach(l => l(library!)); } }
  const { data, error } = await supabase.from('gene_library').select('*').order('sort');
  if (!error && data) {
    library = data.map(({ id, updated_at, ...g }) => ({ key: id, ...g })) as Gene[];
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(library)).catch(() => {}); listeners.forEach(l => l(library!));
  }
}
let started = false;

/** Every gene the user can use (shared library, kept on the phone for offline use, plus their own), keyed by gene_key. */
export function useGenes() {
  const st = useStore(); const [lib, setLib] = useState<Gene[]>(library ?? []);
  useEffect(() => { listeners.add(setLib); if (!started) { started = true; loadLibrary(); } return () => { listeners.delete(setLib); }; }, []);
  return useMemo(() => {
    const own: Gene[] = st.user_genes.map(u => ({ key: `u:${u.id}`, species: u.species, name: u.name, inheritance: u.inheritance,
      description: u.description, super_name: u.super_name, sort: 50, custom: true }));
    return new Map([...lib, ...own].map(g => [g.key, g]));
  }, [lib, st.user_genes]);
}
/** One animal's genes (the rows the calculator needs). */
export function useAnimalGenes(animalId?: string | null): AnimalGene[] {
  const st = useStore();
  return useMemo(() => animalId ? st.animal_genes.filter(g => g.animal_id === animalId) as unknown as AnimalGene[] : [], [st.animal_genes, animalId]);
}
