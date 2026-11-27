// Atajo: arranca todos los procesos en una sola terminal. Ctrl+C los detiene.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const name of ['api', 'relay', 'pedidos', 'inventario', 'pagos', 'notificaciones']) {
  const file = fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
  const child = spawn(process.execPath, [file], { stdio: 'inherit' });
  child.on('exit', (code) => {
    if (code) console.error(`[iniciar] ${name} terminó con código ${code}`);
  });
}

// Ctrl+C llega también a los procesos hijos; este espera a que cierren.
process.on('SIGINT', () => {});
