// Interruptor para simular que la pasarela de pago está caída.
// Uso: node pasarela.ts [caida|ok]
import { existsSync, rmSync, writeFileSync } from 'node:fs';

export const flag = new URL('./.pasarela-caida', import.meta.url);

if (import.meta.main) {
  const action = process.argv[2];
  if (action === 'caida') writeFileSync(flag, '');
  if (action === 'ok') rmSync(flag, { force: true });
  console.log(`Pasarela de pago: ${existsSync(flag) ? 'CAÍDA' : 'funcionando'}`);
}
