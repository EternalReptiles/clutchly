import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Template } from './templates';

let cache: Template[] | null = null;
/** Shared species templates (fetched once per app run; null while loading, [] if offline). */
export function useTemplates(): Template[] | null {
  const [t, setT] = useState<Template[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    supabase.from('species_templates').select('*').order('species').then(({ data, error }) => {
      if (!error && data) cache = data as Template[];
      setT(cache ?? []);
    }, () => setT([]));
  }, []);
  return t;
}
