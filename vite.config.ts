import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// El plugin de Cloudflare corre el Worker (y sus Durable Objects) dentro de `vite dev`: un solo comando.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // Capturas de revisión, maquetas y documentos no son parte de la app: no recargan la página
  server: { watch: { ignored: ['**/.impeccable/**', '**/docs/**'] } },
});
