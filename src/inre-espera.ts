/*
 * Pantalla de espera de la experiencia. Archivo generado por INRE; se reescribe en
 * cada publicación, así que los cambios que se hagan aquí se pierden.
 *
 * No toca la escena ni los marcadores: solo enseña y esconde una capa encima del
 * lienzo. Si algo falla dentro, se retira sola para no dejar la pantalla tapada.
 */

const MARCADORES = ["Recurso1"]

/**
 * Cuenta las descargas en curso de archivos del proyecto (assets/ o blobs) para
 * saber si todavía hay modelos, vídeos o texturas pesados bajando en segundo plano.
 */
let descargasActivas = 0
const oyentesDescarga = new Set<() => void>()
const notificarDescargas = () => {
  for (const fn of oyentesDescarga) {
    fn()
  }
}

if (typeof window.fetch === 'function') {
  const fetchOriginal = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    const esAsset = url.indexOf('assets/') !== -1
    if (!esAsset) {
      return fetchOriginal(input, init)
    }
    descargasActivas += 1
    notificarDescargas()
    return fetchOriginal(input, init).finally(() => {
      descargasActivas = Math.max(0, descargasActivas - 1)
      notificarDescargas()
    })
  }
}

/** El motor, tal como lo ve este archivo. */
interface Motor {
  addCameraPipelineModule: (module: Record<string, unknown>) => void
}

/** Crea la capa una sola vez (o reutiliza la del arranque inicial en index.html). */
const crearCapa = (): {raiz: HTMLElement, titulo: HTMLElement, pista: HTMLElement} => {
  const existente = document.getElementById('inre-espera')
  const estilos = `
      #inre-espera {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 32px 24px;
        box-sizing: border-box;
        overflow-y: auto;
        background: #06060a;
        color: #f2f4f8;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        transition: opacity 420ms ease, visibility 420ms ease, background 300ms ease;
      }
      /*
       * Modo flotante (sin fondo): cuando la cámara ya está abierta y se está
       * cargando o esperando un marcador, la cámara debe verse detrás.
       */
      #inre-espera.inre-flotante {
        inset: auto 0 28px 0;
        background: transparent;
        pointer-events: none;
        padding: 0 16px;
        gap: 10px;
        overflow: visible;
      }
      #inre-espera.inre-flotante .inre-marca {
        display: none;
      }
      #inre-espera.inre-flotante .inre-indicador {
        margin: 0;
        transform: scale(0.42);
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #inre-espera.inre-flotante .inre-titulo {
        font-size: 13px;
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.85);
      }
      #inre-espera.inre-flotante .inre-pista {
        font-size: 12px;
        color: rgba(242, 244, 248, 0.88);
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.85);
      }
      @media (max-height: 360px) {
        #inre-espera:not(.inre-flotante) { gap: 8px; padding: 12px 16px; }
        #inre-espera:not(.inre-flotante) .inre-indicador { margin: 8px 0 10px; transform: scale(.72); }
      }
      #inre-espera.inre-fuera { opacity: 0; visibility: hidden; pointer-events: none; }
      /*
       * El mismo cubo ortográfico del arranque (apps/editor/index.html).
       * Sus seis caras necesitan preserve-3d: poner filtros o animar la opacidad
       * del propio cubo aplana el volumen. La salida se anima en su envoltorio.
       */
      #inre-espera .inre-indicador { margin: 24px 0 30px; }
      #inre-espera .inre-cubo {
        position: relative;
        width: 70.4px;
        height: 70.4px;
        --clr: #a78bfa;
        --clr-alpha: rgba(124, 92, 255, .1);
        transform-style: preserve-3d;
        animation: inre-cubo 1.6s infinite ease;
      }
      #inre-espera .inre-cubo > div {
        position: absolute;
        width: 100%;
        height: 100%;
        background: var(--clr-alpha);
        border: 3.5px solid var(--clr);
      }
      #inre-espera .inre-cubo > div:nth-child(1) {
        transform: translateZ(-35.2px) rotateY(180deg);
      }
      #inre-espera .inre-cubo > div:nth-child(2) {
        transform: rotateY(-270deg) translateX(50%);
        transform-origin: top right;
      }
      #inre-espera .inre-cubo > div:nth-child(3) {
        transform: rotateY(270deg) translateX(-50%);
        transform-origin: center left;
      }
      #inre-espera .inre-cubo > div:nth-child(4) {
        transform: rotateX(90deg) translateY(-50%);
        transform-origin: top center;
      }
      #inre-espera .inre-cubo > div:nth-child(5) {
        transform: rotateX(-90deg) translateY(50%);
        transform-origin: bottom center;
      }
      #inre-espera .inre-cubo > div:nth-child(6) { transform: translateZ(35.2px); }
      @keyframes inre-cubo {
        0% { transform: rotate(45deg) rotateX(-25deg) rotateY(25deg); }
        50% { transform: rotate(45deg) rotateX(-385deg) rotateY(25deg); }
        100% { transform: rotate(45deg) rotateX(-385deg) rotateY(385deg); }
      }
      /* Más lento al escanear: conserva tu señal de actividad mientras se apunta. */
      #inre-espera.inre-quieto .inre-cubo { animation-duration: 3.4s; }
      #inre-espera.inre-fuera .inre-indicador {
        animation: inre-cerrar 380ms ease forwards;
      }
      @keyframes inre-cerrar {
        0% { transform: scale(1); }
        60% { transform: scale(1.15); }
        100% { transform: scale(.4); }
      }
      /* Un error no debe parecer trabajo en curso ni depender de la animación. */
      #inre-espera.inre-error .inre-cubo {
        animation-play-state: paused;
        --clr: #f0b4b1;
      }
      @media (prefers-reduced-motion: reduce) {
        #inre-espera .inre-cubo {
          animation: none;
          transform: rotate(45deg) rotateX(-25deg) rotateY(25deg);
        }
        #inre-espera.inre-fuera .inre-indicador { animation: none; }
        #inre-espera, #inre-espera .inre-aviso { transition: none; }
      }
      #inre-espera .inre-titulo {
        font-size: 13px;
        font-weight: 500;
        margin: 4px 0 0;
        color: rgba(242, 244, 248, 0.78);
      }
      #inre-espera .inre-marca {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 2px 0;
        text-align: center;
      }
      #inre-espera .inre-marca-zence {
        font-size: clamp(28px, 6vw, 34px);
        font-weight: 900;
        letter-spacing: 0.12em;
        line-height: 1;
        text-transform: uppercase;
        color: #ffffff;
        text-indent: 0.12em;
      }
      #inre-espera .inre-marca-sub {
        font-size: 11.5px;
        font-weight: 800;
        letter-spacing: 0.19em;
        line-height: 1.2;
        text-transform: uppercase;
        color: #ece9f8;
        text-indent: 0.19em;
      }
      #inre-espera .inre-marca-beta {
        margin-top: 5px;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: rgba(185, 163, 255, 0.72);
        text-indent: 0.26em;
      }
      #inre-espera .inre-pista {
        font-size: 14px;
        line-height: 1.6;
        margin: 0;
        max-width: 34ch;
        color: rgba(242, 244, 248, 0.72);
      }
      #inre-espera .inre-aviso {
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        transition: max-height 260ms ease, opacity 260ms ease;
        font-size: 13px;
        line-height: 1.55;
        max-width: 36ch;
        padding: 0 14px;
        border-radius: 10px;
        background: rgba(224, 134, 130, 0.14);
        border: 1px solid rgba(224, 134, 130, 0.34);
        color: #f0b4b1;
      }
      #inre-espera.inre-error .inre-aviso { max-height: 240px; opacity: 1; padding: 12px 14px; }
  `

  if (existente !== null) {
    const style = document.createElement('style')
    style.textContent = estilos
    document.head.appendChild(style)
    return {
      raiz: existente,
      titulo: existente.querySelector('.inre-titulo') as HTMLElement,
      pista: existente.querySelector('.inre-pista') as HTMLElement,
    }
  }

  const raiz = document.createElement('div')
  raiz.id = 'inre-espera'
  raiz.setAttribute('role', 'status')
  raiz.setAttribute('aria-live', 'polite')
  raiz.innerHTML = `
    <style>${estilos}</style>
    <div class="inre-indicador" aria-hidden="true">
      <div class="inre-cubo">
        <div></div><div></div><div></div><div></div><div></div><div></div>
      </div>
    </div>
    <div class="inre-marca" aria-label="Zence Inverse Reality Beta 1.0">
      <span class="inre-marca-zence">Zence</span>
      <span class="inre-marca-sub">Inverse Reality</span>
      <span class="inre-marca-beta">Beta 1.0</span>
    </div>
    <p class="inre-titulo">Cargando experiencia…</p>
    <p class="inre-pista"></p>
    <p class="inre-aviso"></p>
  `
  document.body.appendChild(raiz)

  return {
    raiz,
    titulo: raiz.querySelector('.inre-titulo') as HTMLElement,
    pista: raiz.querySelector('.inre-pista') as HTMLElement,
  }
}

const montar = () => {
  let capa: ReturnType<typeof crearCapa> | null = null
  let errorAparecido = false
  let retirada = false
  let escaneando = false
  let marcadorEncontrado = false

  const arrancar = () => {
    if (capa === null) {
      capa = crearCapa()
    }
    return capa
  }

  /** Retira la capa con su transición y la quita del árbol al terminar. */
  const retirar = () => {
    if (retirada) {
      return
    }
    const objetivo = capa?.raiz ?? document.getElementById('inre-espera')
    if (objetivo === null) {
      return
    }
    retirada = true
    objetivo.classList.add('inre-fuera')
    window.setTimeout(() => objetivo.remove(), 460)
  }

  /** Cambia los textos sin tocar el resto. */
  const escribir = (titulo: string, pista: string, quieto: boolean) => {
    const actual = arrancar()
    actual.titulo.textContent = titulo
    actual.pista.textContent = pista
    actual.raiz.classList.toggle('inre-quieto', quieto)
    // Un aviso de error ya visible no se tapa con el texto de progreso: es lo único
    // que explica por qué la experiencia no avanza.
    if (!errorAparecido) {
      actual.raiz.classList.remove('inre-error')
    }
  }

  /** Pasa al cubo pequeño sin fondo sobre la cámara cuando ya se puede apuntar. */
  const pasarAFlotante = () => {
    if (errorAparecido || retirada) {
      return
    }
    const actual = arrancar()
    actual.raiz.classList.add('inre-flotante')
  }

  const actualizarTextoFlotante = () => {
    if (retirada || errorAparecido) {
      return
    }
    if (marcadorEncontrado) {
      if (descargasActivas === 0) {
        escribir('Marcador reconocido', 'Mostrando el contenido.', false)
        retirar()
      } else {
        pasarAFlotante()
        escribir(
          'Cargando marcador…',
          `Descargando contenido (${descargasActivas} pendiente${descargasActivas === 1 ? '' : 's'}).`,
          false
        )
      }
      return
    }
    if (!escaneando) {
      return
    }
    pasarAFlotante()
    if (descargasActivas > 0) {
      escribir(
        'Cargando marcador…',
        `Descargando archivos (${descargasActivas} en curso). Apunta al marcador.`,
        false
      )
    } else {
      escribir(
        'Apunta al marcador',
        MARCADORES.length > 0
          ? 'Enfoca la imagen completa, de frente y con buena luz.'
          : 'Ya puedes mirar alrededor.',
        true
      )
    }
  }

  oyentesDescarga.add(actualizarTextoFlotante)

  const avisar = (texto: string) => {
    const actual = arrancar()
    errorAparecido = true
    ;(actual.raiz.querySelector('.inre-aviso') as HTMLElement).textContent = texto
    actual.raiz.classList.remove('inre-flotante')
    actual.raiz.classList.add('inre-error')
    actual.raiz.classList.remove('inre-quieto')
  }

  const motor = (window as unknown as {XR8?: Motor}).XR8

  if (motor === undefined || typeof motor.addCameraPipelineModule !== 'function') {
    // Sin motor AR (p.ej. escena 3D sin cámara): retira la pantalla de inicio en
    // cuanto terminen las descargas de assets o tras un instante breve.
    if (descargasActivas === 0) {
      window.setTimeout(retirar, 600)
    } else {
      const esperarAssets = () => {
        if (descargasActivas === 0) {
          oyentesDescarga.delete(esperarAssets)
          retirar()
        }
      }
      oyentesDescarga.add(esperarAssets)
      window.setTimeout(retirar, 15000)
    }
    return
  }

  arrancar()

  const sinMarcadores = MARCADORES.length === 0
  let estadoCamara = 'inicial'
  let temporizadorPermiso: number | null = null
  const limpiarPermiso = () => {
    if (temporizadorPermiso !== null) {
      window.clearTimeout(temporizadorPermiso)
      temporizadorPermiso = null
    }
  }

  try {
    motor.addCameraPipelineModule({
      name: 'inre-espera',

      listeners: [
        {
          event: 'reality.imageloading',
          process: () => {
            if (!escaneando) {
              escribir(
                'Preparando la experiencia…',
                MARCADORES.length > 0
                  ? 'Analizando la imagen del marcador.'
                  : 'Preparando el contenido.',
                false
              )
            }
          },
        },
        {
          event: 'reality.imagescanning',
          process: () => {
            escaneando = true
            actualizarTextoFlotante()
          },
        },
        {
          event: 'reality.imagefound',
          process: () => {
            marcadorEncontrado = true
            // Una vez visto el marcador, los cubos 3D en escena toman el relevo visual de carga.
            retirar()
          },
        },
        {
          event: 'reality.imageupdated',
          process: () => {
            marcadorEncontrado = true
            retirar()
          },
        },
      ],

      onCameraStatusChange: (evento: {status?: string, reason?: string}) => {
        const estado = evento.status
        if (estado !== undefined) {
          estadoCamara = estado
        }

        if (estado === 'requesting') {
          escribir('Preparando la experiencia…', 'Pidiendo permiso para la cámara.', false)
          limpiarPermiso()
          temporizadorPermiso = window.setTimeout(() => {
            if (!retirada && !errorAparecido && estadoCamara === 'requesting') {
              escribir(
                'Permiso de cámara pendiente',
                'Acepta el aviso del navegador. Si usas un lector QR o visor interno, ábrelo en Safari o Chrome.',
                false
              )
            }
          }, 7500)
          return
        }

        limpiarPermiso()

        if (estado === 'hasStream' || estado === 'hasVideo') {
          if (estado === 'hasVideo') {
            pasarAFlotante()
            if (sinMarcadores) {
              window.setTimeout(() => {
                if (!errorAparecido && descargasActivas === 0) {
                  retirar()
                }
              }, 900)
            }
          }
          escribir(
            MARCADORES.length > 0 ? 'Cargando marcador…' : 'Cargando contenido…',
            MARCADORES.length > 0
              ? 'Preparando la detección sobre la cámara.'
              : 'Terminando de preparar la escena.',
            false
          )
          return
        }

        /*
         * Los dos fallos que hay que contar, y que el motor calla:
         *
         *   failed        → el navegador no dio cámara. Sin cámara no hay marcador.
         *   hasDesktop3D  → el motor arrancó sin cámara, en su vista 3D. La escena se
         *                   ve, pero el reconocimiento de imágenes es imposible.
         *
         * En el segundo caso la capa NO se retira: dejarla puesta con el aviso es mejor
         * que enseñar una escena que parece funcionar y no reconoce nada.
         */
        if (estado === 'failed') {
          const sinHttps = !window.isSecureContext
          const sinApi = typeof navigator.mediaDevices?.getUserMedia !== 'function'
          avisar(
            sinHttps
              ? 'La cámara requiere HTTPS. Abre la experiencia con una URL https://.'
              : sinApi
                ? 'Este navegador o visor interno no permite usar la cámara. Abre el enlace directamente en Safari o Chrome.'
                : 'No se pudo abrir la cámara'
                  + (evento.reason !== undefined ? ` (${evento.reason})` : '')
                  + '. Si estás en el móvil, ábrelo en Safari/Chrome (no desde el lector de QR) y revisa los permisos de cámara.'
          )
          return
        }

        if (estado === 'hasDesktop3D') {
          avisar(
            'Este dispositivo no está abriendo la cámara, así que no se puede '
            + 'reconocer el marcador. Abre la experiencia en un móvil.'
          )
        }
      },
    })
  } catch {
    // Si el motor rechaza el módulo, la capa se retira: es peor tapar la experiencia
    // con una pantalla de espera eterna que quedarse sin ella.
    retirar()
  }

  /*
   * Red de seguridad: solo retira la capa automáticamente si la cámara ya arrancó
   * (`hasVideo` o `hasStream`). Mientras siga esperando permiso (`requesting`) o
   * inicializando, no se oculta la pantalla ni el aviso de permiso.
   */
  const revisarCierreSeguro = () => {
    if (errorAparecido || retirada) {
      return
    }
    if (estadoCamara === 'hasVideo' || estadoCamara === 'hasStream') {
      retirar()
      return
    }
    if (estadoCamara === 'requesting' || estadoCamara === 'inicial') {
      window.setTimeout(revisarCierreSeguro, 5000)
    }
  }
  window.setTimeout(revisarCierreSeguro, sinMarcadores ? 3500 : 35000)
}

/*
 * Botón discreto de instalación PWA cuando el navegador ofrece `beforeinstallprompt`.
 * Solo icono compacto en la esquina inferior derecha, con la estética de Zence.
 */
window.addEventListener('beforeinstallprompt', (evento: Event) => {
  const promptEvento = evento as Event & {prompt?: () => Promise<void>}
  if (typeof promptEvento.prompt !== 'function') {
    return
  }
  evento.preventDefault()
  if (document.getElementById('inre-pwa-instalar') !== null) {
    return
  }
  if (document.getElementById('inre-pwa-instalar-estilo') === null) {
    const estilo = document.createElement('style')
    estilo.id = 'inre-pwa-instalar-estilo'
    estilo.textContent = `
      #inre-pwa-instalar {
        position: fixed;
        right: max(14px, env(safe-area-inset-right));
        bottom: max(14px, env(safe-area-inset-bottom));
        z-index: 2147483647;
        width: 36px;
        height: 36px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        border: 1px solid rgba(167, 139, 250, 0.36);
        background: rgba(11, 11, 18, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #c4b5fd;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.36);
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }
      #inre-pwa-instalar:hover {
        border-color: rgba(167, 139, 250, 0.7);
        background: rgba(18, 18, 30, 0.9);
      }
      #inre-pwa-instalar:active { transform: scale(0.94); }
      #inre-pwa-instalar svg { width: 16px; height: 16px; display: block; }
    `
    document.head.appendChild(estilo)
  }
  const boton = document.createElement('button')
  boton.id = 'inre-pwa-instalar'
  boton.type = 'button'
  boton.title = 'Instalar app'
  boton.setAttribute('aria-label', 'Instalar app')
  boton.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>' +
    '</svg>'
  boton.addEventListener('click', () => {
    void promptEvento.prompt?.().catch(() => {})
    boton.remove()
  })
  document.body.appendChild(boton)
})

window.addEventListener('appinstalled', () => {
  document.getElementById('inre-pwa-instalar')?.remove()
})

/*
 * Se engancha en cuanto el motor existe. Se comprueba antes por si llegó primero: ese
 * evento no se vuelve a lanzar, y esperarlo dejaría la capa sin montar para siempre.
 *
 * En redes móviles lentas `xr.js` puede tardar más de 12 s: se muestra un aviso de
 * descarga en curso en vez de abandonar `xrloaded`, y solo se avisa de fallo si
 * el script falla o excede el margen largo.
 */
if ((window as unknown as {XR8?: Motor}).XR8 !== undefined) {
  montar()
} else {
  let montado = false
  let temporizadorLento: number | null = null
  let temporizadorFallo: number | null = null
  const limpiarTemporizadores = () => {
    if (temporizadorLento !== null) {
      window.clearTimeout(temporizadorLento)
      temporizadorLento = null
    }
    if (temporizadorFallo !== null) {
      window.clearTimeout(temporizadorFallo)
      temporizadorFallo = null
    }
  }
  const lanzar = () => {
    if (montado) {
      return
    }
    montado = true
    limpiarTemporizadores()
    montar()
  }
  window.addEventListener('xrloaded', lanzar)
  const scriptMotor = document.querySelector('script[src*="xr.js"]')
  if (scriptMotor === null) {
    window.setTimeout(lanzar, 400)
  } else {
    const mostrarErrorMotor = (mensaje: string) => {
      limpiarTemporizadores()
      const raiz = document.getElementById('inre-espera')
      const aviso = raiz?.querySelector('.inre-aviso') as HTMLElement | null
      if (raiz !== null && aviso !== null) {
        aviso.textContent = mensaje
        raiz.classList.remove('inre-flotante', 'inre-quieto')
        raiz.classList.add('inre-error')
      }
    }
    scriptMotor.addEventListener('error', () => {
      if (!montado) {
        mostrarErrorMotor('No se pudo descargar el motor AR. Revisa tu conexión a internet y recarga la página.')
      }
    })
    temporizadorLento = window.setTimeout(() => {
      if (!montado) {
        const pista = document.querySelector('#inre-espera .inre-pista')
        if (pista !== null) {
          pista.textContent = 'Descargando el motor AR (conexión lenta)…'
        }
      }
    }, 10000)
    temporizadorFallo = window.setTimeout(() => {
      if (!montado) {
        mostrarErrorMotor('El motor AR tardó demasiado en cargar. Revisa tu conexión y recarga la página.')
      }
    }, 45000)
  }
}
