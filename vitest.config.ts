import { defineConfig } from 'vitest/config';

// Tests puros (protocolo y motor de reglas): sin el plugin de Cloudflare ni React.
export default defineConfig({
  test: { include: ['compartido/**/*.test.ts', 'reglas/**/*.test.ts'] },
});
