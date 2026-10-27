import { useQuery } from '@tanstack/react-query';

import { parseCatalogue, type Catalogue } from '@/core/zones/catalogue';

export const CATALOGUE_URL =
  'https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json';

export async function fetchCatalogue(): Promise<Catalogue> {
  const response = await fetch(CATALOGUE_URL);
  if (!response.ok) throw new Error(`Catalogue: HTTP ${response.status}`);
  return parseCatalogue(await response.json());
}

/** The catalogue published on GitHub. Query tries 3 more times by itself. */
export function useCatalogue() {
  return useQuery({ queryKey: ['catalogue'], queryFn: fetchCatalogue });
}
