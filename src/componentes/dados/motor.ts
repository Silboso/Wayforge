import * as THREE from 'three';

// Dados 3D dibujados como en el cuaderno: caras de papel, aristas de tinta trazadas dos veces (un poco
// movidas, como a mano) y los números escritos con la letra de la mesa. Este módulo se carga solo al tirar.

export interface DadoPedido {
  caras: number;
  // Sin valor, el dado sigue rodando (la tirada viene en camino); con valor, cae en esa cara
  valor?: number;
}

interface Cara {
  normal: THREE.Vector3;
  centro: THREE.Vector3;
  derecha: THREE.Vector3;
  arriba: THREE.Vector3;
}

interface Modelo {
  geometria: THREE.BufferGeometry;
  caras: Cara[];
  textura: THREE.CanvasTexture;
}

export const CARAS_3D = [4, 6, 8, 10, 12, 20];

const GIRO = 9; // radianes por segundo mientras rueda
const CAIDA_MS = 800;

function formaBase(caras: number): THREE.BufferGeometry {
  switch (caras) {
    case 4: return new THREE.TetrahedronGeometry(1.25);
    case 6: return new THREE.BoxGeometry(1.3, 1.3, 1.3).toNonIndexed();
    case 8: return new THREE.OctahedronGeometry(1.15);
    case 10: return trapezoedro();
    case 12: return new THREE.DodecahedronGeometry(1.1);
    default: return new THREE.IcosahedronGeometry(1.15);
  }
}

// El d10: un trapezoedro pentagonal. La altura del anillo hace que cada cometa sea plana.
function trapezoedro(): THREE.BufferGeometry {
  const h = 1.1;
  const z0 = h * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  const anillo = Array.from({ length: 10 }, (_, k) => {
    const a = (k * Math.PI) / 5;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), k % 2 === 0 ? z0 : -z0);
  });
  const arriba = new THREE.Vector3(0, 0, h);
  const abajo = new THREE.Vector3(0, 0, -h);
  const puntos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // Hacia afuera siempre
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const centro = new THREE.Vector3().add(a).add(b).add(c);
    if (n.dot(centro) < 0) [b, c] = [c, b];
    puntos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const r = (k: number) => anillo[((k % 10) + 10) % 10]!;
  for (let i = 0; i < 5; i++) {
    // Cometas de arriba: la punta, dos del anillo alto y la del medio, baja
    tri(arriba, r(2 * i), r(2 * i + 1));
    tri(arriba, r(2 * i + 1), r(2 * i + 2));
    // Cometas de abajo
    tri(abajo, r(2 * i + 1), r(2 * i + 2));
    tri(abajo, r(2 * i + 2), r(2 * i + 3));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
  return g;
}

// Agrupa los triángulos que comparten plano: cada grupo es una cara del dado
function agrupar(g: THREE.BufferGeometry, lados: number): { caras: Cara[]; deTriangulo: number[]; radios: number[] } {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const caras: (Cara & { vertices: THREE.Vector3[] })[] = [];
  const deTriangulo: number[] = [];
  const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
  for (let t = 0; t < pos.count / 3; t++) {
    const [a, b, c] = [v(3 * t), v(3 * t + 1), v(3 * t + 2)];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    let i = caras.findIndex((f) => f.normal.dot(n) > 0.995);
    if (i < 0) {
      caras.push({ normal: n, centro: new THREE.Vector3(), derecha: new THREE.Vector3(), arriba: new THREE.Vector3(), vertices: [] });
      i = caras.length - 1;
    }
    const f = caras[i]!;
    for (const p of [a, b, c]) if (!f.vertices.some((q) => q.distanceTo(p) < 1e-4)) f.vertices.push(p);
    deTriangulo.push(i);
  }
  const radios: number[] = [];
  for (const f of caras) {
    f.centro = f.vertices.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(f.vertices.length);
    // "Arriba" de la cara: hacia el vértice más alejado del centro en el d10 (la punta), si no, una referencia fija
    const ref = Math.abs(f.normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const haciaPunta = lados === 10
      ? f.vertices.reduce((m, p) => (p.distanceTo(f.centro) > m.distanceTo(f.centro) ? p : m)).clone().sub(f.centro)
      : ref;
    f.arriba = haciaPunta.sub(f.normal.clone().multiplyScalar(haciaPunta.dot(f.normal))).normalize();
    f.derecha = new THREE.Vector3().crossVectors(f.arriba, f.normal).normalize();
    radios.push(Math.max(...f.vertices.map((p) => p.distanceTo(f.centro))));
  }
  return { caras, deTriangulo, radios };
}

const modelos = new Map<string, Modelo>();

// La hoja de números: una celda por cara, con papel, un poco de grano y el número a tinta
function modelo(caras: number, tintas: Tintas): Modelo {
  const llave = `${caras}|${tintas.papel}|${tintas.numero}`;
  const guardado = modelos.get(llave);
  if (guardado) return guardado;
  const g = formaBase(caras);
  const { caras: lista, deTriangulo, radios } = agrupar(g, caras);
  const columnas = Math.ceil(Math.sqrt(lista.length));
  const filas = Math.ceil(lista.length / columnas);
  const celda = 128;
  const lienzo = document.createElement('canvas');
  lienzo.width = columnas * celda;
  lienzo.height = filas * celda;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = tintas.papel;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  // Grano de papel: puntitos muy suaves
  for (let i = 0; i < lienzo.width * lienzo.height / 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * lienzo.width, Math.random() * lienzo.height, 1.5, 1.5);
  }
  // Cuánto cabe el número: lo que entra en la cara (triángulo, cuadrado, pentágono, cometa)
  const tamano = { 4: 44, 6: 74, 8: 50, 10: 46, 12: 60, 20: 52 }[caras] ?? 50;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lista.forEach((_, i) => {
    const cx = (i % columnas + 0.5) * celda;
    const cy = (Math.floor(i / columnas) + 0.5) * celda;
    const n = String(i + 1);
    ctx.font = `700 ${tamano}px "Shantell Sans", cursive`;
    ctx.fillStyle = tintas.numero;
    ctx.fillText(n, cx, cy + (caras === 10 ? tamano * 0.15 : 0));
    // El 6 y el 9 llevan raya para no confundirse
    if (n === '6' || n === '9') {
      ctx.fillRect(cx - tamano * 0.22, cy + tamano * 0.42, tamano * 0.44, Math.max(3, tamano * 0.07));
    }
  });
  // Coordenadas de textura: cada triángulo toma la celda de su cara, alrededor de su centro
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let k = 0; k < pos.count; k++) {
    const f = lista[deTriangulo[Math.floor(k / 3)]!]!;
    const r = radios[deTriangulo[Math.floor(k / 3)]!]!;
    const p = new THREE.Vector3().fromBufferAttribute(pos, k).sub(f.centro);
    const i = deTriangulo[Math.floor(k / 3)]!;
    const lx = p.dot(f.derecha) / r;
    const ly = p.dot(f.arriba) / r;
    uv[2 * k] = (i % columnas + 0.5 + lx * 0.48) / columnas;
    uv[2 * k + 1] = 1 - (Math.floor(i / columnas) + 0.5 - ly * 0.48) / filas;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const m = { geometria: g, caras: lista, textura };
  modelos.set(llave, m);
  return m;
}

interface Tintas { papel: string; numero: string; tinta: string }

function leerTintas(): Tintas {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string, otro: string) => css.getPropertyValue(n).trim() || otro;
  return { papel: v('--superficie', '#fbfaf6'), numero: v('--texto', '#23262f'), tinta: v('--acento', '#2450b0') };
}

// La orientación que deja la cara del valor mirando a la cámara, derecha, con una inclinación para que se vea en 3D
function orientacionPara(c: Cara): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(c.derecha, c.arriba, c.normal).transpose();
  const frente = new THREE.Quaternion().setFromRotationMatrix(m);
  const inclinado = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.38, 0.3, 0.05));
  return inclinado.multiply(frente);
}

interface Rodante {
  grupo: THREE.Group;
  modelo: Modelo;
  caras: number;
  q0: THREE.Quaternion;
  eje: THREE.Vector3;
  desde: number;
  // Cuándo empezó a caer, y en qué cara
  cae?: { desde: number; hacia: THREE.Quaternion };
}

const suave = (k: number) => 1 - Math.pow(1 - k, 3);

export function crearEscena(lienzo: HTMLCanvasElement, quieto: boolean) {
  const render = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-1.4, 1.4, 1.3, -1.3, 0.1, 50);
  camara.position.set(0, 0, 10);
  escena.add(new THREE.AmbientLight(0xffffff, 2.3));
  const luz = new THREE.DirectionalLight(0xffffff, 1.4);
  luz.position.set(-2, 3, 5);
  escena.add(luz);

  let rodantes: Rodante[] = [];
  let cuadro = 0;
  let tintas = leerTintas();

  function armar(pedidos: DadoPedido[]) {
    for (const r of rodantes) escena.remove(r.grupo);
    tintas = leerTintas();
    rodantes = pedidos.map((d, i) => {
      const m = modelo(d.caras, tintas);
      const grupo = new THREE.Group();
      grupo.add(new THREE.Mesh(m.geometria, new THREE.MeshLambertMaterial({ map: m.textura })));
      // Aristas a tinta, dos pasadas apenas corridas: el trazo de una mano, no de una regla
      const aristas = new THREE.EdgesGeometry(m.geometria, 10);
      grupo.add(new THREE.LineSegments(aristas, new THREE.LineBasicMaterial({ color: tintas.tinta })));
      const segunda = new THREE.LineSegments(aristas, new THREE.LineBasicMaterial({ color: tintas.tinta, transparent: true, opacity: 0.45 }));
      segunda.scale.setScalar(1.018);
      segunda.rotation.set(0.025, -0.02, 0.015);
      grupo.add(segunda);
      grupo.position.x = (i - (pedidos.length - 1) / 2) * 2.4;
      escena.add(grupo);
      const eje = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      return { grupo, modelo: m, caras: d.caras, q0: new THREE.Quaternion().random(), eje, desde: performance.now() };
    });
    // Encuadre justo: cada dado ocupa 2.4 de ancho y la vista 2.6 de alto (igual que el lienzo en Dados3D)
    const ancho = Math.max(1, pedidos.length) * 1.2 + 0.2;
    camara.left = -ancho;
    camara.right = ancho;
    camara.top = 1.3;
    camara.bottom = -1.3;
    camara.updateProjectionMatrix();
  }

  function caer(pedidos: DadoPedido[]) {
    const ahora = performance.now();
    rodantes.forEach((r, i) => {
      const valor = pedidos[i]?.valor;
      if (valor === undefined || r.cae) return;
      const cara = r.modelo.caras[Math.min(r.modelo.caras.length, Math.max(1, valor)) - 1]!;
      r.cae = { desde: ahora + i * 90, hacia: orientacionPara(cara) };
    });
  }

  function cuadroDe(ahora: number) {
    let sigue = false;
    for (const r of rodantes) {
      const t = (ahora - r.desde) / 1000;
      const girando = new THREE.Quaternion().setFromAxisAngle(r.eje, GIRO * t).multiply(r.q0);
      if (!r.cae) {
        r.grupo.quaternion.copy(girando);
        r.grupo.position.y = Math.abs(Math.sin(t * 7)) * 0.22 - 0.08;
        sigue = true;
        continue;
      }
      const k = quieto ? 1 : Math.min(1, Math.max(0, (ahora - r.cae.desde) / CAIDA_MS));
      r.grupo.quaternion.copy(girando).slerp(r.cae.hacia, suave(k));
      r.grupo.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * 0.4;
      // Un golpecito al caer
      r.grupo.scale.setScalar(k > 0.82 ? 1 + Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.07 : 1);
      if (k < 1) sigue = true;
    }
    render.render(escena, camara);
    return sigue;
  }

  function animar() {
    cancelAnimationFrame(cuadro);
    const paso = (ahora: number) => {
      if (cuadroDe(ahora)) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
  }

  return {
    // Pone los dados (si cambian cuántos o de qué tipo, se arman de nuevo) y los hace caer cuando hay valor
    poner(pedidos: DadoPedido[], ancho: number, alto: number) {
      render.setSize(ancho, alto, false);
      const iguales = rodantes.length === pedidos.length && rodantes.every((r, i) => r.caras === pedidos[i]!.caras);
      if (!iguales) armar(pedidos);
      caer(pedidos);
      animar();
    },
    destruir() {
      cancelAnimationFrame(cuadro);
      render.dispose();
    },
  };
}
