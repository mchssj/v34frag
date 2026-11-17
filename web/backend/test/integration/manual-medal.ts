import { admin } from './local';

// Una medalla manual de Comunidad para las pruebas. Desde la 127 no hay de torneo; «staff» la crea un admin desde
// Administración › Medallas, así que en una base limpia puede no estar.
export async function manualDefinitionId(): Promise<string> {
  const a = admin();
  const found = (await a.from('medal_definitions').select('id').eq('key', 'staff').maybeSingle()).data;
  if (found) return found.id as string;
  const { data, error } = await a
    .from('medal_definitions')
    .insert({
      key: 'staff', template: 'staff', title: 'Staff', design: {}, metric: 'manual', aggregation: 'manual',
      filters: {}, target: 1, status: 'active', activated_at: new Date().toISOString(), retroactive: false,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
