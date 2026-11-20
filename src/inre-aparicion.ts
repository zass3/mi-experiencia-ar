import * as ecs from '@8thwall/ecs'

/**
 * Cubo 3D de Zence que aparece exactamente en la posición de cada elemento
 * mientras su modelo/recurso termina de cargar y se transforma suavemente en el
 * objeto final.
 *
 * Lo genera INRE al publicar.
 */

type Fase = 'oculto' | 'cargando' | 'revelando' | 'terminado' | 'ocultando'

interface EstadoCubo {
  raizCubo: ecs.Eid | null
  hijosCubo: ecs.Eid[]
  materialesCubo: ecs.Eid[]
  angulo: number
  fase: Fase
  tCargando: number
  tReveal: number
  tSalida: number
  tDesdeVisible: number
  esGltf: boolean
  gltfListo: boolean
  videoListo: boolean
  texturaLista: boolean
  baseScale: [number, number, number]
  onGltfLoaded?: () => void
  onVideoReady?: () => void
}

const estados = new Map<ecs.Eid, EstadoCubo>()

const DURACION_MINIMA_CUBO = 0.22
const DURACION_REVEAL = 0.44
const DURACION_SALIDA = 0.44
const TIMEOUT_VIDEO = 1.8
const TIMEOUT_TEXTURA = 1.6

const ARISTAS: Array<[number, number, number, number, number, number]> = [
  // 4 aristas paralelas a X
  [0, -0.5, -0.5, 1.045, 0.045, 0.045],
  [0, 0.5, -0.5, 1.045, 0.045, 0.045],
  [0, -0.5, 0.5, 1.045, 0.045, 0.045],
  [0, 0.5, 0.5, 1.045, 0.045, 0.045],
  // 4 aristas paralelas a Y
  [-0.5, 0, -0.5, 0.045, 1.045, 0.045],
  [0.5, 0, -0.5, 0.045, 1.045, 0.045],
  [-0.5, 0, 0.5, 0.045, 1.045, 0.045],
  [0.5, 0, 0.5, 0.045, 1.045, 0.045],
  // 4 aristas paralelas a Z
  [-0.5, -0.5, 0, 0.045, 0.045, 1.045],
  [0.5, -0.5, 0, 0.045, 0.045, 1.045],
  [-0.5, 0.5, 0, 0.045, 0.045, 1.045],
  [0.5, 0.5, 0, 0.045, 0.045, 1.045],
]

const easeOutBack = (t: number): number => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const easeInCubic = (t: number): number => t * t * t

const pantallaEsperaActiva = (): boolean => {
  if (typeof document === 'undefined') return false
  const capa = document.getElementById('inre-espera')
  return capa !== null && !capa.classList.contains('inre-fuera')
}

const algunAncestroOculto = (world: ecs.World, eid: ecs.Eid, incluirPropio = true): boolean => {
  if (pantallaEsperaActiva()) {
    return true
  }
  let actual: ecs.Eid = incluirPropio ? eid : world.getParent(eid)
  for (let i = 0; i < 32 && actual; i += 1) {
    if (ecs.Hidden.has(world, actual)) {
      return true
    }
    const obj = world.three.entityToObject.get(actual)
    if (actual !== eid && obj && !obj.visible) {
      return true
    }
    const padre = world.getParent(actual)
    if (!padre || padre === actual) {
      break
    }
    actual = padre
  }
  return false
}

const ajustarOpacidadCubo = (world: ecs.World, st: EstadoCubo, alpha: number) => {
  const clamped = Math.max(0, Math.min(1, alpha))
  for (let i = 0; i < st.materialesCubo.length; i += 1) {
    const matEid = st.materialesCubo[i]!
    const baseOpacity = i === 0 ? 0.18 : i === 1 ? 0.28 : 0.95
    ecs.UnlitMaterial.mutate(world, matEid, (c) => {
      c.opacity = baseOpacity * clamped
    })
  }
}

const obtenerMateriales = (obj: any): any[] => {
  const mats: any[] = []
  if (!obj) return mats
  obj.traverse((n: any) => {
    if (n?.material) {
      if (Array.isArray(n.material)) mats.push(...n.material)
      else mats.push(n.material)
    }
  })
  return mats
}

const tieneVideoListo = (obj: any): boolean => {
  const mats = obtenerMateriales(obj)
  for (const mat of mats) {
    const img = mat?.map?.image
    if (img && typeof HTMLVideoElement !== 'undefined' && img instanceof HTMLVideoElement) {
      if (img.readyState >= 2) {
        return true
      }
    }
  }
  return false
}

const tieneTexturaLista = (obj: any): boolean => {
  const mats = obtenerMateriales(obj)
  for (const mat of mats) {
    if (mat?.map?.image) {
      return true
    }
  }
  return false
}

const destruirCubo = (world: ecs.World, st: EstadoCubo) => {
  for (const hijo of st.hijosCubo) {
    try {
      world.deleteEntity(hijo)
    } catch {
      // ya eliminado
    }
  }
  st.hijosCubo = []
  st.materialesCubo = []
  if (st.raizCubo !== null) {
    try {
      world.deleteEntity(st.raizCubo)
    } catch {
      // ya eliminado
    }
    st.raizCubo = null
  }
}

const crearCuboZence = (world: ecs.World, eid: ecs.Eid, tamaño: number, st: EstadoCubo) => {
  if (st.raizCubo !== null) return

  const padre = world.getParent(eid)
  const pos = ecs.Position.get(world, eid)
  const raiz = world.createEntity()
  if (padre) {
    world.setParent(raiz, padre)
  }
  world.setPosition(raiz, pos.x, pos.y, pos.z)
  world.setScale(raiz, tamaño, tamaño, tamaño)

  const hijos: ecs.Eid[] = []
  const materiales: ecs.Eid[] = []

  // Caras translúcidas (#7c5cff)
  const caras = world.createEntity()
  world.setParent(caras, raiz)
  ecs.BoxGeometry.set(world, caras, {width: 0.96, height: 0.96, depth: 0.96})
  ecs.UnlitMaterial.set(world, caras, {
    r: 124,
    g: 92,
    b: 255,
    opacity: 0.18,
    forceTransparent: true,
    depthWrite: false,
    side: 'double',
  })
  hijos.push(caras)
  materiales.push(caras)

  // Núcleo sutil interno (#a78bfa)
  const nucleo = world.createEntity()
  world.setParent(nucleo, raiz)
  ecs.BoxGeometry.set(world, nucleo, {width: 0.36, height: 0.36, depth: 0.36})
  ecs.UnlitMaterial.set(world, nucleo, {
    r: 167,
    g: 139,
    b: 250,
    opacity: 0.28,
    forceTransparent: true,
    depthWrite: false,
    side: 'double',
  })
  hijos.push(nucleo)
  materiales.push(nucleo)

  // 12 aristas nítidas (#a78bfa)
  for (const [x, y, z, w, h, d] of ARISTAS) {
    const arista = world.createEntity()
    world.setParent(arista, raiz)
    world.setPosition(arista, x, y, z)
    ecs.BoxGeometry.set(world, arista, {width: w, height: h, depth: d})
    ecs.UnlitMaterial.set(world, arista, {
      r: 167,
      g: 139,
      b: 250,
      opacity: 0.95,
      forceTransparent: true,
      depthWrite: false,
    })
    hijos.push(arista)
    materiales.push(arista)
  }

  st.raizCubo = raiz
  st.hijosCubo = hijos
  st.materialesCubo = materiales
}

const aplicarVisibilidadYEscala = (
  world: ecs.World,
  eid: ecs.Eid,
  esGltf: boolean,
  visible: boolean,
  factor: number,
  baseScale: [number, number, number]
) => {
  const obj = world.three.entityToObject.get(eid) as any
  if (!obj) return

  if (esGltf) {
    // Nunca dejamos `obj.visible = false` en modelos glTF para que sus hijos
    // ni el propio modelo queden bloqueados si el `.glb` termina de bajar después.
    obj.visible = true
    world.three.notifyChanged(obj)
    const gltfScene = obj.userData?.gltf?.scene
    if (gltfScene) {
      gltfScene.visible = visible
      const s = Math.max(0.001, factor)
      gltfScene.scale.set(s, s, s)
      world.three.notifyChanged(gltfScene)
    }
    return
  }

  obj.visible = visible
  const k = Math.max(0.001, factor)
  obj.scale.set(baseScale[0] * k, baseScale[1] * k, baseScale[2] * k)
  world.three.notifyChanged(obj)
}

const rotarCubo = (world: ecs.World, raiz: ecs.Eid, angulo: number, escala: number) => {
  const q = ecs.math.quat.pitchYawRollRadians({
    x: -0.44 + Math.sin(angulo * 0.85) * 0.28,
    y: angulo,
    z: 0.785398 + angulo * 0.35,
  })
  world.setQuaternion(raiz, q.x, q.y, q.z, q.w)
  world.setScale(raiz, escala, escala, escala)
}

ecs.registerComponent({
  name: 'inre-aparicion',
  schema: {
    cubo: ecs.f32,
    demora: ecs.f32,
    esGltf: ecs.boolean,
    esVideo: ecs.boolean,
    esTextura: ecs.boolean,
  },
  schemaDefaults: {
    cubo: 0.42,
    demora: 0,
    esGltf: false,
    esVideo: false,
    esTextura: false,
  },
  add: (world, component) => {
    const eid = component.eid
    const esc = ecs.Scale.get(world, eid)
    const obj = world.three.entityToObject.get(eid) as any
    const gltfYaListo = !component.schema.esGltf || Boolean(obj?.userData?.gltf)

    const st: EstadoCubo = {
      raizCubo: null,
      hijosCubo: [],
      materialesCubo: [],
      angulo: Math.random() * Math.PI * 2,
      fase: 'oculto',
      tCargando: 0,
      tReveal: 0,
      tSalida: 0,
      tDesdeVisible: 0,
      esGltf: component.schema.esGltf,
      gltfListo: gltfYaListo,
      videoListo: !component.schema.esVideo,
      texturaLista: !component.schema.esTextura || component.schema.esVideo,
      baseScale: [esc.x || 1, esc.y || 1, esc.z || 1],
    }

    if (component.schema.esGltf && !gltfYaListo) {
      const onGltf = () => {
        st.gltfListo = true
        const actual = world.three.entityToObject.get(eid) as any
        const gltfScene = actual?.userData?.gltf?.scene
        if (gltfScene && st.fase !== 'revelando' && st.fase !== 'terminado') {
          gltfScene.visible = false
          world.three.notifyChanged(gltfScene)
        }
      }
      st.onGltfLoaded = onGltf
      world.events.addListener(eid, ecs.events.GLTF_MODEL_LOADED, onGltf)
    }

    if (component.schema.esVideo) {
      const onVideo = () => {
        st.videoListo = true
      }
      st.onVideoReady = onVideo
      world.events.addListener(eid, ecs.events.VIDEO_CAN_PLAY_THROUGH, onVideo)
    }

    estados.set(eid, st)
    aplicarVisibilidadYEscala(world, eid, component.schema.esGltf, false, 0.001, st.baseScale)
  },
  tick: (world, component) => {
    const eid = component.eid
    const st = estados.get(eid)
    if (!st) return

    const dt = Math.min(0.05, (world.time.delta || 16) / 1000)
    const {cubo, demora, esGltf, esVideo, esTextura} = component.schema

    const padreOculto = algunAncestroOculto(world, eid, false)
    const propioOculto = ecs.Hidden.has(world, eid)

    if (padreOculto) {
      if (st.raizCubo !== null) {
        destruirCubo(world, st)
      }
      if (st.fase !== 'revelando' && st.fase !== 'terminado') {
        st.fase = 'oculto'
      }
      return
    }

    if (st.fase === 'terminado') {
      if (propioOculto) {
        st.fase = 'ocultando'
        st.tSalida = 0
        crearCuboZence(world, eid, cubo * 0.1, st)
        ajustarOpacidadCubo(world, st, 0)
      }
      return
    }

    if (st.fase === 'ocultando') {
      if (!propioOculto) {
        destruirCubo(world, st)
        st.fase = 'oculto'
        st.tCargando = 0
        return
      }
      st.tSalida += dt
      const p = Math.min(1, st.tSalida / DURACION_SALIDA)
      const pivote = 0.48
      if (p < pivote) {
        const local = p / pivote
        st.angulo += dt * (1.8 + local * 2.2)
        if (st.raizCubo !== null) {
          const pos = ecs.Position.get(world, eid)
          world.setPosition(st.raizCubo, pos.x, pos.y, pos.z)
          rotarCubo(world, st.raizCubo, st.angulo, cubo * Math.max(0.02, easeOutBack(local)))
          ajustarOpacidadCubo(world, st, Math.min(1, local * 1.35))
        }
      } else {
        const local = (p - pivote) / (1 - pivote)
        st.angulo += dt * (3.2 + local * 4.5)
        if (st.raizCubo !== null) {
          rotarCubo(world, st.raizCubo, st.angulo, cubo * Math.max(0.001, 1 - easeInCubic(local)))
          ajustarOpacidadCubo(world, st, 1 - local)
        }
      }
      if (p >= 1) {
        destruirCubo(world, st)
        st.fase = 'oculto'
        st.tCargando = 0
      }
      return
    }

    if (propioOculto) {
      if (st.raizCubo !== null) {
        destruirCubo(world, st)
      }
      if (st.fase !== 'revelando') {
        st.fase = 'oculto'
      }
      return
    }

    if (st.fase === 'oculto') {
      st.fase = 'cargando'
      crearCuboZence(world, eid, cubo, st)
      aplicarVisibilidadYEscala(world, eid, esGltf, false, 0.001, st.baseScale)
    }

    st.tDesdeVisible += dt

    if (esGltf && !st.gltfListo) {
      const obj = world.three.entityToObject.get(eid) as any
      if (obj?.userData?.gltf) {
        st.gltfListo = true
      }
    }

    if (esVideo && !st.videoListo) {
      const obj = world.three.entityToObject.get(eid) as any
      if (tieneVideoListo(obj) || st.tDesdeVisible >= TIMEOUT_VIDEO) {
        st.videoListo = true
      }
    }

    if (esTextura && !esVideo && !st.texturaLista) {
      const obj = world.three.entityToObject.get(eid) as any
      if (tieneTexturaLista(obj) || st.tDesdeVisible >= TIMEOUT_TEXTURA) {
        st.texturaLista = true
      }
    }

    if (st.fase === 'cargando') {
      st.tCargando += dt
      st.angulo += dt * 1.65
      const pulso = 1 + Math.sin(st.tCargando * 4.2) * 0.055
      if (st.raizCubo !== null) {
        const pos = ecs.Position.get(world, eid)
        world.setPosition(st.raizCubo, pos.x, pos.y, pos.z)
        rotarCubo(world, st.raizCubo, st.angulo, cubo * pulso)
      }

      const esperaCumplida = st.tCargando >= Math.max(DURACION_MINIMA_CUBO, demora)
      if (esperaCumplida && st.gltfListo && st.videoListo && st.texturaLista) {
        st.fase = 'revelando'
        st.tReveal = 0
        aplicarVisibilidadYEscala(world, eid, esGltf, true, 0.02, st.baseScale)
      }
      return
    }

    if (st.fase === 'revelando') {
      st.tReveal += dt
      const p = Math.min(1, st.tReveal / DURACION_REVEAL)
      const factorObjeto = Math.max(0.02, easeOutBack(p))
      const factorCubo = Math.max(0.001, 1 - easeInCubic(p))

      aplicarVisibilidadYEscala(world, eid, esGltf, true, factorObjeto, st.baseScale)

      st.angulo += dt * (2.2 + p * 4.5)
      if (st.raizCubo !== null) {
        rotarCubo(world, st.raizCubo, st.angulo, cubo * factorCubo)
        ajustarOpacidadCubo(world, st, 1 - p)
      }

      if (p >= 1) {
        aplicarVisibilidadYEscala(world, eid, esGltf, true, 1, st.baseScale)
        destruirCubo(world, st)
        st.fase = 'terminado'
      }
    }
  },
  remove: (world, component) => {
    const eid = component.eid
    const st = estados.get(eid)
    if (!st) return
    if (st.onGltfLoaded) {
      world.events.removeListener(eid, ecs.events.GLTF_MODEL_LOADED, st.onGltfLoaded)
    }
    if (st.onVideoReady) {
      world.events.removeListener(eid, ecs.events.VIDEO_CAN_PLAY_THROUGH, st.onVideoReady)
    }
    aplicarVisibilidadYEscala(world, eid, st.esGltf, true, 1, st.baseScale)
    destruirCubo(world, st)
    estados.delete(eid)
  },
})
