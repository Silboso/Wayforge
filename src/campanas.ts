// Campañas: la lista de mesas de este navegador (para volver a abrirlas) y exportar o importar una mesa entera.
import type { EstadoSala, MesaExportada } from '../compartido/sala';
import { almacen, guardar, leer } from './conexion';

export interface MesaGuardada {
  codigo: string;
  rol: 'gm' | 'jugador';
  nombre?: string;
  // Con qué personaje juega (si es jugador)
  personaje?: string;
  cuando: number;
}

const CLAVE = 'wayforge:mis-mesas';
const MAX_MESAS = 30;

export function misMesas(): MesaGuardada[] {
  try {
    const lista = JSON.parse(leer(CLAVE) ?? '[]') as MesaGuardada[];
    return Array.isArray(lista) ? lista.filter((m) => typeof m?.codigo === 'string').sort((a, b) => b.cuando - a.cuando) : [];
  } catch { return []; }
}

// Anota (o pone al día) una mesa en la que se entró
export function recordarMesa(m: Omit<MesaGuardada, 'cuando'>) {
  const otras = misMesas().filter((x) => !(x.codigo === m.codigo && x.rol === m.rol));
  const previa = misMesas().find((x) => x.codigo === m.codigo && x.rol === m.rol);
  guardar(CLAVE, JSON.stringify([{ ...previa, ...m, cuando: Date.now() }, ...otras].slice(0, MAX_MESAS)));
}

export function olvidarMesa(codigo: string, rol: MesaGuardada['rol']) {
  guardar(CLAVE, JSON.stringify(misMesas().filter((x) => !(x.codigo === codigo && x.rol === rol))));
}

// El código de GM de una mesa, si este navegador lo conoce (quien la creó o la importó)
export const codigoGMDe = (codigo: string) => leer(almacen.gmCodigo(codigo));

// Volver a abrir una mesa como GM sin escribir el código (si este navegador lo tiene)
export function abrirComoGM(codigo: string) {
  const gm = codigoGMDe(codigo);
  if (gm) guardar(almacen.gmNuevo(codigo), gm);
  location.assign(`/sala/${codigo}`);
}

// Todas las imágenes de la mesa (mapas, tokens, retratos, handouts, escenas guardadas)
export function imagenesDe(estado: EstadoSala): string[] {
  return [...new Set(JSON.stringify(estado).match(/\/api\/imagenes\/salas\/[a-z0-9]{6,32}\/[0-9a-f-]{36}\.[a-z]{3,4}/g) ?? [])];
}

const aDataURL = (blob: Blob) => new Promise<string>((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result as string);
  r.onerror = () => mal(r.error);
  r.readAsDataURL(blob);
});

// Arma el archivo de la mesa con sus imágenes adentro y lo descarga
export async function descargarMesa(mesa: MesaExportada, alAvanzar?: (hechas: number, total: number) => void) {
  const urls = imagenesDe(mesa.estado);
  const imagenes: Record<string, string> = {};
  for (const [i, url] of urls.entries()) {
    alAvanzar?.(i, urls.length);
    try {
      const r = await fetch(url);
      if (r.ok) imagenes[url] = await aDataURL(await r.blob());
    } catch { /* una imagen que ya no está: la mesa se exporta igual */ }
  }
  const archivo = new Blob([JSON.stringify({ ...mesa, imagenes })], { type: 'application/json' });
  const nombre = (mesa.estado.nombre || 'mesa').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mesa';
  const fecha = new Date(mesa.exportada).toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo);
  a.download = `wayforge-${nombre}-${fecha}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// Abre un archivo de mesa en una mesa nueva; devuelve su código (y deja anotado el de GM para entrar solo)
export async function importarMesa(archivo: File): Promise<string> {
  if (archivo.size > 90_000_000) throw new Error('El archivo pesa demasiado (más de 90 MB).');
  const texto = await archivo.text();
  let mesa: MesaExportada;
  try { mesa = JSON.parse(texto); } catch { throw new Error('Ese archivo no es una mesa de Wayforge.'); }
  if (mesa?.formato !== 'wayforge-mesa') throw new Error('Ese archivo no es una mesa de Wayforge.');
  const r = await fetch('/api/salas/importar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: texto });
  if (!r.ok) throw new Error((await r.text()) || 'No se pudo abrir la mesa.');
  const { codigo, codigoGM } = (await r.json()) as { codigo: string; codigoGM: string };
  guardar(almacen.gmNuevo(codigo), codigoGM);
  recordarMesa({ codigo, rol: 'gm', ...(mesa.estado.nombre ? { nombre: mesa.estado.nombre } : {}) });
  return codigo;
}
