# Registro de decisiones (ADR) — APP_TEST_DE_RM

> Formato fijo por decisión: **Contexto → Decisión → Consecuencias → Fecha → Estado**.
> Este archivo se referencia desde `CLAUDE.md` y `AGENTS.md`: cualquier persona o agente
> que toque el dominio (RM, planificación, progresión) debe leerlo antes de cambiar una
> constante o una regla. Ver `docs/PLAN-MAESTRO.md` §18 para el índice original de ADRs
> pendientes.

---

## ADR-01 · Fórmula primaria para estimar 1RM: Epley

**Contexto.** El sistema calculaba 8 fórmulas y usaba `Math.max()` entre ellas como el
"1RM estimado" (D-02), lo que sesga sistemáticamente al alza — un estimador no puede ser
el máximo de un conjunto de estimadores.

**Decisión.** Epley (`1RM = carga × (1 + 0.0333 × r)`) es la fórmula primaria
(`lib/rm/formulas.ts calculateEpley`, usada en `lib/rm/estimacion.ts estimarRm`). Es
lineal, sin singularidades (a diferencia de Brzycki y Lander, que se anulan cerca de 37
repeticiones), coincide con Brzycki alrededor de las 10 repeticiones, y se extiende con
naturalidad a la variante con RIR (F-03, ADR-consecuente para e1RM de entrenamiento). Ya
estaba implementada y en producción antes de este cambio.

**Consecuencias.** Todo `rm1Estimado`/`ResultadoRm`/`RmVigente.origen=estimacion` usa
Epley. Las otras 7 fórmulas se conservan como referencia (banda de incertidumbre, ver
ADR-02), no como candidatas a estimador puntual.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-02 · Por qué no se usa `max()` entre fórmulas, y qué significa la banda

**Contexto.** D-02.

**Decisión.** Las 8 fórmulas se calculan siempre, pero se reportan como
`{ min, max }` (F-02, `getMinFormulaRM`/`getMaxFormulaRM` en `lib/rm/formulas.ts`) junto
al valor puntual de Epley. La banda es la **dispersión entre modelos**, no un intervalo de
confianza estadístico — debe presentarse así en la interfaz (`app/sesion/[id]/page.tsx`
ya lo hace: "Banda de incertidumbre").

**Consecuencias.** Ninguna decisión de prescripción (carga, clasificación de nivel) se
basa en el máximo de la banda. El backfill histórico (`prisma/backfill-resultados.ts`)
recalcula esta banda desde `carga`/`repeticiones` ya guardados, sin reinterpretar el
valor viejo.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-03 · Ventana válida de repeticiones (3–10) y qué pasa fuera de ella

**Contexto.** D-04: las fórmulas de Brzycki y Lander tienen singularidades cerca de
r≈37 y r≈38 respectivamente; el protocolo de carga por % de masa corporal empuja a
repeticiones altas, justo donde las fórmulas dejan de ser válidas.

**Decisión** (`lib/rm/estimacion.ts`):
- `REPETICIONES_VENTANA_VALIDA = [1, 10]` — dentro de esta ventana, confianza media o
  alta según RIR.
- `r > 10` → `fueraDeRango = true`, confianza `baja`, pero se sigue calculando un valor
  (D-04 no exige descartarlo, solo advertir).
- `r > REPETICIONES_LIMITE_UTILIZABLE (15)` → `noUtilizable = true`: no debe usarse para
  prescribir.
- `r >= REPETICIONES_BLOQUEO_DURO (30)` → bloqueo duro, valor = 0. Evita que Brzycki/Lander
  crucen su singularidad y devuelvan negativos.

**Consecuencias.** `AC-06` y `AC-07` (ningún 1RM se estima fuera de rango sin marcarlo;
ninguna fórmula produce negativos/infinitos/cero por reps altas) se cumplen por
construcción — cubierto por `lib/rm/formulas.test.ts` y `lib/rm/estimacion.test.ts`
(casos r=36,37,38,40).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-04 · Significado operativo del RIR y su escala

**Contexto.** El sistema necesita autorregular la carga entre evaluaciones (R-07, R-13).

**Decisión.** RIR (*Repetitions In Reserve*) es el número de repeticiones que el atleta
reporta que le quedaban en el tanque al terminar una serie, en una escala entera de 0
(fallo) a ~5. Se usa en tres puntos: `rirObjetivo` en cada `Prescripcion` (lo que el
motor espera), `rir` reportado en `SerieRealizada` (lo que ocurrió), y como input de e1RM
(F-03, `estimarE1rmConRir`).

**Consecuencias.** La escala no está calibrada por atleta — ADR-19 documenta que es menos
fiable en principiantes. `AJUSTE_UMBRALES.subirCargaRirPorEncimaDelObjetivo = 2` usa esta
escala para decidir cuándo proponer subir carga (R-13).

**Fecha.** 2026-08-27. **Estado.** Implementado (motor); calibración por experiencia del
atleta queda pendiente (mismo hueco que ADR-19).

---

## ADR-05 · RPE de sesión vs. RIR — por qué se registran aparte

**Contexto.** `SesionRealizada.rpeSesion` (RPE, 0–10, percepción global de la sesión) es
distinto de `SerieRealizada.rir` (por serie, por ejercicio).

**Decisión.** RIR mide el margen de una serie concreta; RPE de sesión mide la fatiga
acumulada del entrenamiento completo, y es el insumo del criterio reactivo de deload
(R-10: "RPE de sesión ≥ 9 en tres sesiones seguidas", `lib/progresion/deload.ts`). No son
intercambiables: una sesión puede tener series con buen RIR y aun así un RPE de sesión
alto por volumen o densidad.

**Consecuencias.** Ambos se registran siempre que estén disponibles; ninguno sustituye al
otro en las reglas de autorregulación.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-06 · Cómo se determina la intensidad: %1RM + RIR, y cuál manda en conflicto

**Contexto.** R-07: "el %1RM se calcula sobre un test pasado; el RIR se mide hoy."

**Decisión.** Toda `Prescripcion` con carga lleva `porcentajeRm` (derivado del
`RmVigente` al momento de generar el plan) y `rirObjetivo`. Si en ejecución el RIR real
diverge sistemáticamente del objetivo, manda el RIR — eso es exactamente lo que dispara
las propuestas de `lib/progresion/reglas.ts` (R-13): dos sesiones con RIR ≥2 por encima
del objetivo proponen subir carga; dos sin alcanzar `repsMin` proponen bajarla. El ajuste
nunca se aplica solo (AC-20): crea un `AjustePropuesto` que el entrenador acepta o
rechaza (`services/progresion.service.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-07 · Cómo se determina el volumen: series efectivas por patrón, no tonelaje

**Contexto.** R-03/F-05/F-06.

**Decisión.** `RANGOS_VOLUMEN` (`lib/config/parametros.ts`) define series por semana por
`objetivoBloque` (p.ej. hipertrofia 10–20, fuerza 6–12), no tonelaje. El tonelaje
(`Prescripcion.tonelaje`, F-05) se calcula y se guarda, pero solo como referencia
comparativa dentro de un mismo tipo de bloque — nunca decide el volumen prescrito.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-08 · Por qué el tonelaje se conserva pero no es la métrica principal

**Contexto.** F-05: tonelaje confunde `3×10×50` con `10×3×50` y penaliza el trabajo de
alta intensidad (pocas series pesadas dan tonelaje bajo aunque el estímulo sea alto).

**Decisión.** Se conserva (`MacrocicloSemana.volumen`, derivado de las prescripciones —
corrige D-11, que lo dejaba en 0 como entrada manual) porque es el lenguaje del marco
académico del proyecto (cubano-soviético, ver ADR-23) y sirve para comparar semanas del
mismo tipo dentro de un bloque. No es la métrica que decide el volumen (eso lo hace
ADR-07).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-09 · Reglas de progresión intra e inter mesociclo

**Contexto.** R-08/R-09.

**Decisión.**
- **Intra-mesociclo** (`lib/planificacion/prescripcion.ts`): bloques
  `lineal_intensidad` suben %1RM semana a semana con las series ancladas al mínimo del
  rango; bloques `lineal_volumen` hacen lo inverso; `ondulante` alterna por paridad de
  semana; `mantenimiento` (deload) usa siempre el mínimo. Nunca suben volumen e
  intensidad la misma semana — verificado en `lib/planificacion/prescripcion.test.ts`.
- **Inter-mesociclo**: cada mesociclo reancla su carga al `RmVigente` vigente **a la
  fecha de generación** del plan (no al RM del macrociclo original) — es lo que hace que
  el caso "RM 100→110 kg" no reescriba semanas ya publicadas (`lib/planificacion/motor.ts`
  + `services/rm.service.ts`, regresión cubierta en
  `services/rm.service.test.ts` y `lib/planificacion/motor.test.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-10 · Reglas de deload, programado y reactivo

**Contexto.** R-10.

**Decisión.**
- **Programado** (`lib/planificacion/estructura.ts asignarMicrociclos`): cada
  `DELOAD.frecuenciaSemanasEstandar` (4) semanas, o cada
  `DELOAD.frecuenciaSemanasAvanzado` (3) para nivel avanzado — contador global sobre
  todo el macrociclo, no por mesociclo. Además, un microciclo "choque" nunca se repite
  dos semanas seguidas (R-16 #10): la segunda se convierte automáticamente en descarga.
- **Reactivo** (`lib/progresion/deload.ts evaluarDeloadReactivo`): requiere ≥2 de 4
  criterios (caída de e1RM >5% en dos sesiones, RIR sistemáticamente ≥2 por debajo del
  objetivo, ≥2 sesiones omitidas por fatiga, RPE de sesión ≥9 en tres sesiones seguidas).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-11 · Cuándo se actualiza el RM y cuándo caduca (12 y 24 semanas)

**Contexto.** R-15.

**Decisión** (`lib/rm/vigente.ts`):
- Una evaluación (test) siempre reemplaza el `RmVigente` (`actualizarRmVigente`, sin
  condición).
- Una serie de entrenamiento (e1RM) solo lo reemplaza si lo **supera**
  (`actualizarRmVigenteSiSupera`) — un entrenamiento no debe poder *bajar* el RM
  registrado, solo confirmarlo o mejorarlo.
- `> 12` semanas desde `validoDesde` → `caducado = true`, aviso de reevaluación, el
  motor lo sigue usando.
- `> 24` semanas → además `confianzaEfectiva = "baja"`, señalado en el plan
  (`lib/planificacion/motor.ts` avisos).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-12 · Cómo se manejan los ejercicios sin RM

**Contexto.** R-06.

**Decisión.** Si un ejercicio seleccionado no tiene `RmVigente` (o `admitePorcentajeRm
= false`, p.ej. `esDeTiempo`), se prescribe por `repsMin`/`repsMax`/`rirObjetivo` sin
`cargaKg` (`lib/planificacion/prescripcion.ts calcularPrescripcion`). El motor genera un
aviso explícito (E-09) en vez de fallar o inventar una carga.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-13 · Por qué el RM nunca se extrapola entre ejercicios

**Contexto.** D-01, el defecto más grave de la auditoría original: `Sesion.finalRM` se
calculaba como `Math.max()` entre el RM de ejercicios *distintos* (prensa de pierna
siempre dominaba sobre press de banca), y ese escalar se usaba para clasificar nivel y
sugerir peso para cualquier objetivo.

**Decisión.** El RM vive exclusivamente por (persona, ejercicio) en `RmVigente`. No
existe ningún mecanismo en el dominio que derive el RM de un ejercicio a partir del de
otro. `Sesion.finalRM`/`estimatedRM` a nivel de sesión solo se pueblan cuando son
inequívocos (un único ejercicio evaluado, o un protocolo Casas/Nacleiro sobre un
ejercicio de referencia) — nunca como máximo entre ejercicios distintos
(`actions/sesion.ts`).

**Consecuencias.** `AC-09` y `AC-11` se cumplen por construcción. La correlación de 1RM
entre patrones de movimiento distintos es demasiado débil para ser una base de
prescripción segura.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-14 · Principio de inmutabilidad histórica y sus tres mecanismos

**Contexto.** §4.1 del plan: "un dato que ya fue usado para decidir algo no puede cambiar
de valor retroactivamente."

**Decisión.** Tres mecanismos, todos implementados:
1. **Copia con linaje.** Toda `Prescripcion` con carga guarda `rmUsadoKg` **y**
   `rmVigenteId` (`lib/planificacion/prescripcion.ts`, invariante R-16 #9, verificado en
   `lib/planificacion/validacion.ts`).
2. **Append-only con vigencia.** `RmVigente` nunca hace `UPDATE` del valor: cierra la fila
   (`validoHasta`) y abre otra (`services/rm.service.ts actualizarRmVigente`).
3. **Versionado con supersede.** `Prescripcion` publicada es inmutable; un ajuste crea
   `version + 1` y encadena `supersededById`, nunca reescribe la fila anterior
   (`services/planificacion.service.ts publicarPlan`, `services/progresion.service.ts
   aceptarAjustePropuesto`).

**Fecha.** 2026-08-27. **Estado.** Implementado y cubierto por pruebas de regresión
(`services/rm.service.test.ts`, `services/planificacion.service.test.ts`,
`services/progresion.service.test.ts`).

---

## ADR-15 · Cuándo un valor es override del entrenador y qué implica

**Contexto.** R-12.

**Decisión.** Una `Prescripcion` con `origen = "ajustado_entrenador"` (o
`"autorregulado"`, tras aceptar un `AjustePropuesto`) queda **anclada**:
`services/planificacion.service.ts publicarPlan` la salta explícitamente en cualquier
regeneración futura, sin importar qué calcule el motor para esa semana/ejercicio. Solo
`origen = "generado"` se sobrescribe libremente.

**Fecha.** 2026-08-27. **Estado.** Implementado, cubierto por
`services/planificacion.service.test.ts` (caso "respeta un override existente").

---

## ADR-16 · Origen de `porcentajeMasaHombre/Mujer` — sin fuente documentada

**Contexto.** Estos coeficientes fijan la carga de calibración del test de estimación
submáxima. Determinan la calidad de todas las estimaciones derivadas.

**Estado.** **Sin resolver.** No hay ninguna referencia bibliográfica en el código ni en
la documentación previa que los origine. Es la dependencia científica más crítica del
proyecto (§19.2 del plan). Pendiente de que el entrenador aporte la fuente o los declare
como convención propia — no se ha recalibrado ni inventado una fuente en este trabajo.

---

## ADR-17 · Origen del protocolo Casas (porcentajes y descansos)

**Contexto.** `app/nueva-sesion/CasasProtocol.tsx` codifica 11 pasos con porcentajes
(40%→115.8%) y descansos específicos.

**Estado.** **Sin resolver**, misma situación que ADR-16. Se corrigió el defecto
funcional (D-05: no se puede cerrar el protocolo sin pesos reales), pero los porcentajes
y descansos en sí no tienen fuente documentada.

---

## ADR-18 · Origen del protocolo Nacleiro y de la fórmula KIES

**Contexto.** `lib/nacleiro.ts calculateInitialWeight`/`calculateKIES`.

**Estado.** **Sin resolver**, misma situación. Se corrigieron los defectos (D-06:
división por cero con `series=1`, redondeo a peso no cargable), pero la fórmula en sí
sigue sin una referencia bibliográfica citada en el código.

---

## ADR-19 · Umbrales del índice de fuerza y su normalización

**Contexto.** D-18: `calculateStrengthIndex` sumaba valores por bandas de repeticiones
con umbrales fijos que asumían implícitamente 6 ejercicios evaluados.

**Estado.** **Pendiente** (F-12, TASK-053, no abordado en esta sesión — quedó en la
Etapa 9 del plan, "Consolidación de pruebas", fuera del alcance de las Etapas 1–8
completadas aquí). La corrección propuesta por el plan (normalizar por
`n_ejercicios × valor_máximo` a una escala 0–100) sigue sin implementar.

---

## ADR-20 · Umbrales de nivel (relación fuerza/peso) y su limitación

**Contexto.** `lib/user-level.ts getUserLevel`: `< 0.8` principiante, `≤ 1.2`
intermedio, resto avanzado (relación RM/masa corporal).

**Decisión.** Se conserva la función tal cual (es correcta como utilidad genérica), pero
se corrigió **quién la alimenta** (D-01): ya no recibe el máximo entre ejercicios
distintos, solo un RM inequívoco (ejercicio único o protocolo de referencia) o `0`
(clasifica como "beginner" por defecto, valor conservador).

**Limitación.** Los umbrales 0.8/1.2 no tienen fuente bibliográfica citada; es una
convención del proyecto anterior a esta auditoría, no revisada aquí.

**Fecha.** 2026-08-27. **Estado.** Consumidores corregidos; umbrales sin auditar.

---

## ADR-21 · Por qué se descartan ACWR y el modelo fitness-fatiga

**Contexto.** F-13.

**Decisión.** No se implementan. ACWR (razón carga aguda/crónica) tiene cuestionamientos
metodológicos serios documentados en la literatura reciente (problemas de correlación
espuria y de definición de ventanas). El modelo fitness-fatiga (Banister/TRIMP) requiere
una densidad y regularidad de datos que este producto no tendrá con uso real de gimnasio.

**Fecha.** 2026-08-27. **Estado.** Decisión de alcance, no revisitada en este trabajo.

---

## ADR-22 · Diferenciación por sexo: no existe

**Contexto.** D-03: `calculateRMFemenino` reimplementaba exactamente los mismos
coeficientes que la rama masculina bajo otro nombre — el parámetro `sexo` no cambiaba
ningún resultado.

**Decisión.** Se eliminó la rama duplicada (`lib/rm/formulas.ts calculateRM` ignora
`sexo` para el cálculo, lo acepta solo por compatibilidad de firma). Las mujeres suelen
completar más repeticiones a un mismo %1RM, sobre todo en tren inferior, pero esa
diferencia **no está modelada** — documentarlo como "no existe" es más honesto que
mantener un código que aparenta diferenciar sin hacerlo.

**Qué haría falta.** Coeficientes específicos por sexo con respaldo bibliográfico
(mismo tipo de vacío que ADR-16/17/18) antes de reintroducir la rama.

**Fecha.** 2026-08-27. **Estado.** Implementado (unificación); diferenciación real
pendiente de investigación.

---

## ADR-23 · Vocabulario de periodización adoptado y su escuela de origen

**Contexto.** El proyecto usa `entrante/desarrollador/desarrollador_especifico/
estabilizador/precompetitivo/choque/aproximacion/competencia` para mesociclos, y
`evaluacion/corriente/competitivo/precompetitivo/choque/recuperacion/aproximacion` para
microciclos.

**Decisión.** Se conserva: es el marco de periodización de escuela cubano-soviética
(Matveyev/Forteza), marco académico declarado del proyecto (§0.4 A2 del plan). El motor
nuevo (`lib/planificacion/plantillas.ts`) mapea cada tipo de mesociclo a un
`objetivoBloque` computacional (fuerza_maxima, hipertrofia, etc.) para que el vocabulario
académico y el motor convivan sin duplicar significado:
`OBJETIVO_BLOQUE_POR_MESOCICLO` y `MICROCICLO_BASE_POR_MESOCICLO`
(`lib/planificacion/plantillas.ts`, `lib/planificacion/estructura.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-24 · Relación entre las "direcciones" en minutos y la prescripción en kg

**Contexto.** D-13: `MesocicloCarga` reparte minutos entre "direcciones" (físico,
táctico, técnico, psicológico) — un modelo de planificación de deportes de conjunto — sin
relación con `MacrocicloSemana` (kg) ni con el motor nuevo (`lib/planificacion/**`).

**Estado.** **Sin resolver.** `MesocicloCarga` se conserva como vista avanzada opcional
(§9.5 del plan), pero el motor nuevo no la lee ni la alimenta. Sigue siendo un tercer
sistema de carga desconectado — no se intentó conectarlo en este trabajo porque el plan
mismo lo marca como decisión abierta (Q-04: "¿se conservan las direcciones en minutos o
se simplifican?").

---

## ADR-25 · Modelo de autorización y su resolución (D-19, Q-06)

**Contexto.** Hasta esta sesión, `middleware.ts` solo protegía `/admin/**`; el resto del
flujo de persona viajaba como `?cc=` en la URL sin autenticación — conocer una cédula
daba acceso completo de lectura y escritura a datos de salud de terceros.

**Decisión.** El producto es operado por el entrenador (A1 del plan, confirmado
explícitamente: "el que registra el entrenamiento es el entrenador"). Se reutilizó el
sistema JWT ya existente (`lib/auth.ts`, cookie `auth_token`, `jose`/HS256) — antes
exclusivo de `/admin/**` — para proteger **toda la aplicación**. `middleware.ts` ahora
excluye solo `/login`, `/api/auth/**` y `/api/logout`; todo lo demás exige la misma
sesión.

**Consecuencias.** `?cc=` sigue siendo el mecanismo para que el entrenador *seleccione*
qué atleta está viendo (no es un secreto de acceso), pero ya no basta por sí solo:
primero hace falta la sesión. Verificado end-to-end (middleware redirige a `/login` sin
sesión; tras login, acceso concedido).

**Fecha.** 2026-08-27. **Estado.** Implementado. **Superado en parte por ADR-26** (ver
abajo): `User` sí terminó ganando un rol distintivo — la afirmación de este ADR de "un
solo tipo de cuenta" quedó obsoleta.

---

## ADR-26 · Roles admin/entrenador sobre `User`; atleta sigue sin cuenta propia

**Contexto.** El pedido explícito fue: solo un admin puede crear cuentas de entrenador,
y un entrenador puede registrar atletas. `Persona` (el atleta) nunca tuvo contraseña ni
inició sesión — es un registro que el entrenador consulta por cédula (ver "Persona" en
`CLAUDE.md`); confirmado con el usuario que eso se mantiene así (no se agrega login para
el atleta en este trabajo).

**Decisión.** Se añadió `User.role` (`"admin" | "entrenador"`, default `"entrenador"`,
migración `20260827131650_user_role`) en vez de una tabla de roles/permission separada —
solo hay dos valores y ninguna cuenta pertenece a más de uno. El JWT (`lib/auth.ts`)
ahora incluye `role` como claim firmado; `verifyAuthToken` lo valida contra `isRole()` y
descarta el token si el valor no es uno de los dos conocidos. `requireRole()` queda
disponible para Server Actions que necesiten restringir por rol.
Aplicado en: `POST/GET/PUT/DELETE /api/users` (403 si `role !== "admin"`), y
`middleware.ts` redirige `/admin/usuarios/**` a `/admin` si el rol no es admin (el resto
de `/admin/**` — personas, sesiones, macrociclos, ejercicios — sigue abierto a cualquier
entrenador, sin cambios). El nav admin (`AdminNav`) oculta el enlace "Usuarios" para
quien no es admin. No se agregó una comprobación de rol en `createPersonaAction`
(registro de atletas): como *todo* usuario autenticado ya es admin o entrenador por
construcción (no existe ningún otro rol que pueda iniciar sesión), esa comprobación
sería código muerto hoy — se documenta aquí para que quien introduzca un futuro rol
adicional sepa que debe añadirla entonces.

**Consecuencias.** El usuario "admin" sembrado (`prisma/seed.ts`, `lib/bootstrap.ts`) se
marca explícitamente `role: "admin"`; cualquier cuenta creada antes de esta migración
quedó en el default `"entrenador"` y se corrigió manualmente para `username: "admin"`.
Q-01 (¿multi-entrenador?) sigue sin resolver — puede haber múltiples cuentas
`role: "entrenador"`, pero no hay aislamiento de datos entre ellas (cualquier entrenador
ve todos los atletas), que es lo que esa pregunta realmente plantea.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `e2e/roles.spec.ts`.

---

## Preguntas abiertas del plan aún sin resolver

Ver `docs/PLAN-MAESTRO.md` §19.3 para el detalle. Estado tras esta sesión:

| # | Pregunta | Estado |
|---|---|---|
| Q-01 | ¿Multi-entrenador o un solo entrenador? | Parcial — ahora puede haber varias cuentas `role: "entrenador"` (ADR-26), pero sin aislamiento de datos entre ellas |
| Q-02 | ¿Quién registra el entrenamiento? | **Resuelto**: el entrenador |
| Q-03 | ¿Se recalibran los coeficientes de masa corporal? | Sin resolver (ADR-16) |
| Q-04 | ¿Direcciones en minutos o se simplifican? | Sin resolver (ADR-24) |
| Q-05 | ¿Qué ejercicios entran más allá de los 6 actuales? | Sin resolver — catálogo ampliado con semántica (`Ejercicio.patron` etc.), pero el conjunto de 6 ejercicios no creció |
| Q-06 | ¿Autenticación real de persona? | **Resuelto** (ADR-25) |
| Q-07 | ¿Qué duraciones de macrociclo soportar? | Resuelto de forma general — el motor no está atado a duraciones fijas; probado en 8/12/16/24 semanas (`lib/planificacion/motor.test.ts`) |
