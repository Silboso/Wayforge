# Wayforge

Mesa virtual de Pathfinder 2e en tiempo real. El concepto completo está en [docs/CONCEPT.md](docs/CONCEPT.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta todo en local (web + Worker + salas + R2 simulado) en http://localhost:5173 |
| `npm test` | Tests del protocolo y del motor de reglas |
| `npm run typecheck` | Revisa tipos de la web, el Worker y la configuración |
| `npm run build` | Compila para Cloudflare |
| `npm run deploy` | Compila y publica en Cloudflare (crea antes el bucket: `npx wrangler r2 bucket create wayforge-imagenes`) |
| `npm run cf-typegen` | Regenera los tipos del Worker después de cambiar `wrangler.jsonc` |

## Cómo está armado

```
src/          interfaz (React + Vite + Tailwind; tablero con Konva)
worker/       Worker (Hono) y el Durable Object Sala
compartido/   protocolo de la sala: estado, acciones y `aplicar`, usado por los dos lados
reglas/       motor de reglas PF2e: calcula la ficha (CA, PG, skills, ataques) con su desglose
```

Una partida es un Durable Object `Sala`. Cada navegador abre un WebSocket con su sala y entra como
visitante; con el código de su personaje (o el de GM) pasa a jugador o GM. Las acciones (mover un
token, cambiar el mapa, editar la ficha) se aplican al instante en quien las hace; la sala revisa que
sean válidas y que esa persona las pueda hacer (`puede` en `compartido/sala.ts`), las guarda y las
reparte al resto. Las tiradas las hace la sala con el motor de reglas, para que nadie invente un 20.
Las imágenes de mapas, tokens y retratos se guardan en R2.

En un mismo navegador todas las pestañas comparten la sesión de cada mesa. Para probar como GM y
jugador a la vez, usa una ventana de incógnito o dos navegadores.
