import { useState } from 'react';

export type Tema = 'cuaderno' | 'noche';

const CLAVE = 'wayforge:tema';

function temaGuardado(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'cuaderno' || guardado === 'noche') return guardado;
  } catch { /* almacenamiento bloqueado */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'noche' : 'cuaderno';
}

// Cuaderno es el tema claro y Noche el oscuro. Sin elección guardada, sigue al sistema.
// El atributo se pone antes de renderizar (no en un efecto) para que quien lea los colores ya vea el tema nuevo.
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => {
    const inicial = temaGuardado();
    document.documentElement.dataset.tema = inicial;
    return inicial;
  });
  const alternar = () => {
    const siguiente: Tema = tema === 'cuaderno' ? 'noche' : 'cuaderno';
    try { localStorage.setItem(CLAVE, siguiente); } catch { /* almacenamiento bloqueado */ }
    document.documentElement.dataset.tema = siguiente;
    setTema(siguiente);
  };
  return { tema, alternar };
}

// Konva dibuja en un canvas y no lee CSS: le pasamos los colores del tema ya resueltos.
export interface ColoresTablero {
  tablero: string;
  cuadricula: string;
  acento: string;
  texto: string;
  textoSuave: string;
  superficie: string;
  peligro: string;
  marca: string;
  postit: string;
  sombra: string;
  exito: string;
  sobreAcento: string;
}

export function leerColoresTablero(): ColoresTablero {
  const css = getComputedStyle(document.documentElement);
  const leer = (nombre: string) => css.getPropertyValue(`--${nombre}`).trim();
  return {
    tablero: leer('tablero'),
    cuadricula: leer('cuadricula'),
    acento: leer('acento'),
    texto: leer('texto'),
    textoSuave: leer('texto-suave'),
    superficie: leer('superficie'),
    peligro: leer('peligro'),
    marca: leer('marca'),
    postit: leer('postit'),
    sombra: leer('sombra'),
    exito: leer('exito'),
    sobreAcento: leer('sobre-acento'),
  };
}
