import { Inicio } from './paginas/Inicio';
import { PaginaSala } from './paginas/Sala';
import { useTema } from './tema';

// Dos pantallas: inicio (crear partida) y /sala/:id. Sin router: basta con leer la ruta.
export function App() {
  const tema = useTema();
  const sala = /^\/sala\/([a-z0-9]{6,32})\/?$/i.exec(location.pathname)?.[1]?.toLowerCase();
  return sala ? <PaginaSala salaId={sala} tema={tema} /> : <Inicio tema={tema} />;
}
