# Manual de Operacion

## APP TEST DE RM

Este documento esta pensado para una persona que no sabe programar.

Su objetivo es que puedas operar la aplicacion durante anos sin depender del desarrollador original, apoyandote en este manual y en herramientas de IA cuando sea necesario.

## 1. Que es esta aplicacion

APP TEST DE RM es una aplicacion web para:

- Buscar personas por cedula.
- Registrar sesiones de entrenamiento.
- Estimar RM (peso maximo estimado para una repeticion).
- Mostrar indicadores como IMC e ICC.
- Administrar usuarios, personas, sesiones y ejercicios desde un panel administrativo.

## 2. Donde vive cada parte

- Aplicacion web (sitio): Vercel.
- Base de datos (informacion): Aiven (MariaDB/MySQL).

Traduccion simple:

- Si Vercel falla, la pagina puede no abrir o mostrar errores.
- Si Aiven falla, la pagina puede abrir, pero no cargar o no guardar datos.

## 3. Quien usa la aplicacion

- Personas que entrenan y consultan resultados.
- Personal de acompanamiento que registra sesiones.
- Administracion que gestiona datos desde el panel admin.

## 4. Flujo principal de uso (operacion diaria)

1. La persona entra a la pagina principal.
2. Ingresa su cedula.
3. La app muestra su dashboard con datos de IMC, ICC y sesiones previas.
4. Si hara una nueva sesion, entra a Nueva sesion.
5. Registra ejercicios y guarda.
6. La app muestra el detalle de resultados.

📷 Captura sugerida.
Pantalla de inicio con campo de cedula.

📷 Captura sugerida.
Pantalla de dashboard con indicadores y lista de sesiones.

📷 Captura sugerida.
Pantalla de nueva sesion y boton Guardar.

## 5. Acceso administrativo

Para entrar al panel administrativo:

1. Abre la ruta /login en la aplicacion.
2. Escribe usuario y contrasena.
3. Pulsa ingresar.

Credenciales actuales de acceso admin:

- Usuario: admin
- Contrasena: admin1234

Importante:

- Cambia estas credenciales si son temporales o de prueba.
- Guarda cualquier cambio en un lugar seguro.
- Nunca compartas credenciales por chat publico.

📷 Captura sugerida.
Pantalla de login con campos usuario y contrasena.

## 6. Antes de pensar que la aplicacion esta danada

Haz estas verificaciones rapidas, en este orden:

1. Internet
   - Abre otra pagina conocida (por ejemplo, un buscador).
   - Si tampoco abre, el problema es tu conexion.
2. Recargar pagina
   - Pulsa recargar una sola vez y espera.
3. Otro navegador
   - Si usas Chrome, prueba Edge o Firefox.
4. Esperar unos minutos
   - A veces hay lentitud temporal en servicios externos.
5. Verificar URL
   - Confirma que escribiste la direccion correcta de la app.
   - Evita enlaces antiguos guardados en favoritos.

Si despues de esto sigue el problema, continua con el arbol de decisiones.

## 7. Arbol de decisiones rapido

Lee de arriba hacia abajo y sigue el camino que coincida con tu caso.

La aplicacion abre?

- NO
  - Revisa Internet.
  - Prueba otro navegador.
  - Verifica URL.
  - Si sigue igual: revisa Vercel (estado de despliegue).
  - Si Vercel esta bien: revisa Aiven.
- SI
  - Puedes iniciar sesion?
    - NO
      - Verifica usuario y contrasena.
      - Revisa si hay bloqueo de sesion o cierre automatico.
      - Si no entra: usa IA para guiar recuperacion de acceso.
    - SI
      - Carga datos?
        - NO
          - Posible problema de base de datos o conexion.
          - Revisa Aiven.
          - Verifica variables de entorno en Vercel (solo existencia, no cambiar valores al azar).
        - SI
          - Guarda datos?
            - NO
              - Revisa Internet.
              - Revisa campos obligatorios.
              - Intenta una sola vez mas.
              - Si persiste: revisar error mostrado y consultar IA.
            - SI
              - Problema visual o de calculo?
                - SI
                  - Revisa datos ingresados (peso, talla, repeticiones, ejercicio).
                  - Si no coincide: pedir a IA validacion paso a paso.
                - NO
                  - Operacion normal.

## 8. Como identificar si el problema es de Internet, navegador, usuario, aplicacion, Vercel, base de datos o Aiven

### 8.1 Internet

Senales:

- Ninguna pagina abre.
- Carga extremadamente lenta en todo.

Que hacer:

1. Probar otras paginas.
2. Reiniciar router si tienes acceso.
3. Cambiar a otra red (por ejemplo, datos moviles) para comparar.

### 8.2 Navegador

Senales:

- La app falla solo en un navegador.
- En otro navegador funciona.

Que hacer:

1. Abrir en otro navegador.
2. Cerrar y volver a abrir el navegador.
3. Probar modo privado/incognito.

### 8.3 Usuario o sesion

Senales:

- No permite ingresar al panel admin.
- Te saca de la sesion rapidamente.

Que hacer:

1. Verificar usuario y contrasena sin espacios.
2. Revisar mayusculas/minusculas.
3. Volver a iniciar sesion.

### 8.4 Aplicacion

Senales:

- Pantallas en blanco.
- Errores visibles como 500 o 404.

Que hacer:

1. Recargar pagina.
2. Probar otra seccion.
3. Revisar estado de Vercel.

### 8.5 Vercel

Senales:

- Sitio caido.
- Despliegue en estado Error.

Que hacer:

1. Entrar a Vercel.
2. Abrir el proyecto APP TEST DE RM.
3. Revisar Deployments.
4. Si procede, hacer Redeploy.

### 8.6 Base de datos / Aiven

Senales:

- La app abre, pero no muestra datos o no guarda.
- Operaciones que dependen de datos fallan.

Que hacer:

1. Entrar a Aiven.
2. Verificar estado del servicio MariaDB/MySQL.
3. Si no esta activo, reiniciar y esperar.

## 9. Tabla rapida de diagnostico

| Si pasa esto...                 | Lo mas probable es...                                | Que hacer...                                                     |
| ------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| La app no abre                  | Internet, URL incorrecta, Vercel caido               | Verifica Internet, URL, luego Vercel                             |
| La app abre pero no carga datos | Aiven o conexion a base de datos                     | Revisa estado de Aiven                                           |
| No guarda datos                 | Conexion inestable, campos incompletos, falla de BD  | Revisa Internet, valida campos, prueba una vez mas, revisa Aiven |
| Error 500                       | Falla interna de aplicacion o servicio externo       | Recarga, revisa Vercel, luego Aiven                              |
| Error 404                       | URL incorrecta o ruta no disponible                  | Verifica direccion y vuelve al inicio                            |
| Sesion cerrada de golpe         | Token vencido o sesion expirada                      | Inicia sesion nuevamente                                         |
| No llegan correos               | Servicio de correo o configuracion de clave de envio | Verifica estado general y consulta IA para guia segura           |
| Vercel bien, app sin datos      | Base de datos no disponible                          | Revisa Aiven                                                     |
| Aiven bien, app no abre         | Vercel con despliegue fallido                        | Revisa Deployments y Redeploy                                    |
| Login admin no funciona         | Credenciales incorrectas o usuario bloqueado         | Verifica datos de acceso y consulta IA para recuperacion         |

## 10. Problemas comunes y solucion detallada

Regla de seguridad para cambios delicados:

Antes de hacer cualquier cambio, pidele a una IA que te explique exactamente que ocurrira y cuales son los riesgos.

### 10.1 Aplicacion lenta

Sintomas:

- La pagina tarda mucho en cargar.
- Los botones responden con retraso.

Posibles causas:

- Internet lento.
- Carga temporal alta en Vercel o Aiven.
- Navegador saturado.

Solucion paso a paso:

1. Verifica tu Internet con otra pagina.
2. Recarga una vez y espera 30 segundos.
3. Prueba en otro navegador.
4. Espera 2 a 5 minutos y vuelve a intentar.
5. Si sigue igual, revisa Vercel y Aiven.

Cuando detenerse:

- Si despues de 2 intentos y 5 minutos sigue igual, no repitas en bucle.

Cuando usar IA:

- Si no sabes interpretar si la lentitud es de Vercel o de Aiven.

### 10.2 Pagina en blanco

Sintomas:

- Pantalla completamente blanca.
- Sin contenido visible.

Posibles causas:

- Falla temporal del navegador.
- Error interno de aplicacion.

Solucion paso a paso:

1. Recarga una vez.
2. Cierra y abre el navegador.
3. Prueba otro navegador.
4. Verifica si otra ruta de la app abre.
5. Revisa estado de Vercel.

Cuando detenerse:

- Si en dos navegadores ocurre lo mismo.

Cuando usar IA:

- Si necesitas una guia detallada para revisar Vercel sin tocar configuraciones delicadas.

### 10.3 Error 500

Sintomas:

- Mensaje Error 500 o Internal Server Error.

Posibles causas:

- Falla interna en la aplicacion.
- Problema de conexion entre app y base de datos.

Solucion paso a paso:

1. Recarga una vez.
2. Verifica si otras secciones funcionan.
3. Revisa el ultimo despliegue en Vercel.
4. Si hace falta, realiza Redeploy.
5. Revisa Aiven.

Cuando detenerse:

- Si ya hiciste Redeploy y Aiven esta activo, no sigas cambiando cosas al azar.

Cuando usar IA:

- Inmediatamente despues de confirmar que persiste tras Redeploy y revision de Aiven.

### 10.4 Error 404

Sintomas:

- Mensaje 404 o pagina no encontrada.

Posibles causas:

- URL mal escrita.
- Ruta antigua o enlace desactualizado.

Solucion paso a paso:

1. Vuelve a la pagina principal.
2. Navega desde menu interno.
3. Verifica URL sin espacios ni caracteres extra.
4. Si fue un enlace guardado, abre la app desde la URL principal y vuelve a entrar.

Cuando detenerse:

- Si solo falla un enlace antiguo.

Cuando usar IA:

- Si no logras identificar cual URL correcta usar.

### 10.5 Sesion cerrada sola

Sintomas:

- La app te saca del panel admin.
- Te pide login de nuevo.

Posibles causas:

- Sesion expirada por tiempo.
- Cookies o navegador con problemas.

Solucion paso a paso:

1. Inicia sesion de nuevo en /login.
2. Marca recordar datos solo si el equipo es seguro.
3. Prueba en otro navegador si se repite.

Cuando detenerse:

- Si solo ocurre despues de mucho tiempo sin usar la app.

Cuando usar IA:

- Si se cierra en minutos repetidamente.

### 10.6 Usuario bloqueado o no puede entrar

Sintomas:

- No permite acceso aun con usuario conocido.

Posibles causas:

- Contrasena incorrecta.
- Usuario inhabilitado.

Solucion paso a paso:

1. Verifica escritura exacta de usuario y contrasena.
2. Quita espacios al inicio y al final.
3. Revisa mayusculas.
4. Intenta una sola vez mas.
5. Si sigue igual, consulta IA para procedimiento seguro de recuperacion.

Cuando detenerse:

- Si ya intentaste 2 veces y no funciona.

Cuando usar IA:

- Para recuperar acceso sin tocar base de datos manualmente.

### 10.7 No llegan correos

Sintomas:

- Correos de acceso o notificacion no llegan.

Posibles causas:

- Problema temporal del servicio de correo.
- Configuracion incompleta de clave de envio.

Solucion paso a paso:

1. Revisa carpeta Spam/No deseado.
2. Espera 5 minutos.
3. Intenta nuevamente una sola vez.
4. Verifica en Vercel que la variable RESEND_API_KEY exista y no este vacia.

Cuando detenerse:

- Si la variable existe y el correo sigue sin llegar.

Cuando usar IA:

- Para revisar paso a paso que parte del flujo de correo puede fallar, sin revelar claves.

### 10.8 Error al guardar

Sintomas:

- Boton Guardar no completa.
- Mensaje de error al enviar formulario.

Posibles causas:

- Campo faltante o valor invalido.
- Conexion inestable.
- Base de datos no disponible.

Solucion paso a paso:

1. Verifica todos los campos obligatorios.
2. Revisa que numeros esten bien escritos.
3. Confirma Internet activo.
4. Intenta guardar una sola vez mas.
5. Si falla, revisa Aiven.

Cuando detenerse:

- Si ya validaste campos y Aiven y sigue fallando.

Cuando usar IA:

- Para interpretar el mensaje exacto que aparece en pantalla.

### 10.9 Datos incorrectos o resultados extranos

Sintomas:

- IMC, ICC o RM parecen fuera de rango.

Posibles causas:

- Datos de entrada incorrectos.
- Se eligio ejercicio equivocado.

Solucion paso a paso:

1. Revisa peso, talla, repeticiones y carga.
2. Verifica cedula y persona correcta.
3. Corrige los datos y guarda de nuevo.

Cuando detenerse:

- Si no puedes confirmar cual dato original era correcto.

Cuando usar IA:

- Para validar si el resultado tiene sentido con los datos ingresados.

### 10.10 Error de conexion

Sintomas:

- Mensajes de no se pudo conectar o timeout.

Posibles causas:

- Internet inestable.
- Corte temporal entre Vercel y Aiven.

Solucion paso a paso:

1. Verifica Internet.
2. Recarga y espera.
3. Revisa Vercel.
4. Revisa Aiven.

Cuando detenerse:

- Si ambos servicios muestran estado correcto pero el error persiste.

Cuando usar IA:

- Para obtener guia de validacion mas profunda, paso por paso.

### 10.11 Vercel funcionando pero Aiven caida

Sintomas:

- La app abre pero no trae ni guarda datos.

Posibles causas:

- Servicio de base de datos detenido o degradado.

Solucion paso a paso:

1. Entra a Aiven.
2. Abre el servicio MariaDB/MySQL.
3. Si no esta en Running, reinicia.
4. Espera 2 a 3 minutos.
5. Vuelve a probar la app.

Cuando detenerse:

- Si despues del reinicio sigue sin responder.

Cuando usar IA:

- Para decidir el siguiente paso sin tocar configuraciones sensibles.

### 10.12 Aiven funcionando pero Vercel caida

Sintomas:

- Sitio no abre o devuelve errores de despliegue.

Posibles causas:

- Despliegue fallido.
- Incidencia temporal de Vercel.

Solucion paso a paso:

1. Entra a Vercel.
2. Abre proyecto APP TEST DE RM.
3. Revisa Deployments.
4. Si ultimo estado es Error, haz Redeploy.
5. Espera hasta ver Ready.
6. Prueba de nuevo.

Cuando detenerse:

- Si despues de Redeploy sigue fallando igual.

Cuando usar IA:

- Para guiar analisis del siguiente paso sin editar configuraciones delicadas.

### 10.13 Despliegue fallido

Sintomas:

- En Vercel el despliegue queda en Error.

Posibles causas:

- Falla temporal de plataforma.
- Cambio reciente incompatible.

Solucion paso a paso:

1. Intenta Redeploy una vez.
2. Espera finalizacion completa.
3. Si vuelve a fallar, no hagas mas cambios.

Cuando detenerse:

- Si falla dos veces seguidas.

Cuando usar IA:

- Para pedir explicacion exacta de que revisar antes de tocar configuracion.

### 10.14 Variables de entorno faltantes

Sintomas:

- La app abre pero funciones clave fallan (login, guardado, correo).

Posibles causas:

- Falta una o mas variables en Vercel.

Solucion paso a paso:

Antes de hacer cualquier cambio, pidele a una IA que te explique exactamente que ocurrira y cuales son los riesgos.

1. Entra a Vercel, proyecto APP TEST DE RM.
2. Ve a Settings y luego Environment Variables.
3. Verifica existencia de:
   - DATABASE_URL
   - JWT_SECRET
   - RESEND_API_KEY
   - ADMIN_EMAILS
   - NEXT_ALLOWED_DEV_ORIGINS
4. Confirma que no esten vacias.
5. Si falta alguna o esta vacia, no inventes valores.
6. Pide a IA guia exacta para restaurarlas de forma segura.

Cuando detenerse:

- Si no tienes el valor correcto de una variable.

Cuando usar IA:

- Siempre que una variable falte o tengas dudas sobre su contenido.

## 11. Procedimiento seguro de Redeploy en Vercel

1. Abre https://vercel.com.
2. Inicia sesion.
3. Entra al proyecto APP TEST DE RM.
4. Abre la pestana Deployments.
5. Revisa estado del ultimo despliegue:
   - Ready: correcto.
   - Building: en proceso.
   - Error: fallo.
6. Si corresponde, pulsa Redeploy.
7. Espera a que cambie a Ready.
8. Prueba la app.

📷 Captura sugerida.
Pantalla de Deployments con estados Ready, Building y Error.

## 12. Procedimiento seguro para revisar Aiven

1. Abre https://console.aiven.io.
2. Inicia sesion.
3. Entra al proyecto.
4. Selecciona servicio MariaDB/MySQL.
5. Revisa que el estado sea Running.
6. Si no esta Running, reinicia.
7. Espera 2 a 3 minutos.
8. Prueba la app.

📷 Captura sugerida.
Panel de estado del servicio en Aiven mostrando Running.

## 13. Tiempos aproximados (referencia)

- Carga inicial de la app: 10 a 30 segundos.
- Recarga normal de pagina: 3 a 10 segundos.
- Redeploy en Vercel: 1 a 5 minutos.
- Reinicio de servicio en Aiven: 2 a 3 minutos.
- Propagacion de cambios simples en plataforma: 1 a 10 minutos.
- Entrega de correo transaccional: 1 a 5 minutos.

Si supera ampliamente esos tiempos, tratelo como incidente.

## 14. Checklist antes de pedir ayuda

Marca cada punto antes de escalar el problema:

- Verifique Internet.
- Recargue la pagina una vez.
- Probo en otro navegador.
- Verifico URL correcta.
- Espero al menos 2 a 5 minutos.
- Confirmo si el problema ocurre en una sola pantalla o en toda la app.
- Reviso estado de Vercel.
- Reviso estado de Aiven.
- Anoto mensaje exacto de error.
- Anoto que estaba haciendo justo antes de fallar.
- Evito cambiar configuraciones delicadas al azar.

## 15. NO HACER

Esta seccion es critica.

No debes hacer nada de esta lista, salvo que una IA te indique exactamente que hacer, por que hacerlo, cual es el riesgo y como volver atras.

Antes de hacer cualquier cambio, pidele a una IA que te explique exactamente que ocurrira y cuales son los riesgos.

No modificar al azar:

- Variables de entorno.
- Base de datos.
- Usuarios administrativos.
- Configuraciones generales del proyecto.
- Dominio del sitio.
- DNS.
- Secretos y claves.
- Credenciales.
- Prisma.
- Migraciones.

No borrar:

- Registros de personas.
- Sesiones historicas.
- Ejercicios.
- Usuarios admin activos.

No compartir:

- Contrasenas.
- Claves privadas.
- Tokens.

No repetir en bucle:

- Redeploy continuo sin diagnostico.
- Reinicios continuos de servicios.

## 16. Respaldo y cuidado de la informacion

Nunca borres informacion directamente de la base de datos.

Por que:

- Puedes perder historial de progreso.
- Puedes dejar datos incompletos o inconsistentes.
- Algunas perdidas no se pueden recuperar.

Buena practica:

- Antes de cualquier limpieza de datos, pide a IA un plan paso a paso que incluya respaldo y restauracion.
- Si no hay respaldo confirmado, no continues.

## 17. Mantenimiento preventivo

### 17.1 Una vez por semana

1. Entrar a la app y verificar que abra.
2. Probar busqueda por cedula.
3. Probar guardado de una sesion de prueba controlada.
4. Entrar al panel admin.
5. Confirmar que los listados cargan.

### 17.2 Una vez por mes

1. Revisar en Vercel que no haya despliegues recientes en Error sin atender.
2. Revisar en Aiven que el servicio este estable.
3. Verificar que las variables clave existen en Vercel.
4. Confirmar que acceso admin funciona con cuentas vigentes.
5. Revisar que no se hayan eliminado datos importantes por error.

### 17.3 Que nunca eliminar

- Registros historicos de sesiones.
- Personas registradas activas.
- Ejercicios en uso.
- Variables de entorno criticas.
- Usuarios administrativos principales.

## 18. Cuando detenerse

Si ya hiciste todo esto:

- Redeploy en Vercel.
- Revision de variables de entorno.
- Revision de estado en Aiven.
- Revision de estado en Vercel.

Y el problema continua:

- Detente.
- No sigas cambiando cosas al azar.
- No borres ni edites datos sensibles.
- Pide ayuda a una IA con un reporte claro.

## 19. Como pedir ayuda a una IA

Usa estos mensajes listos para copiar y pegar.

### 19.1 Prompt para ChatGPT

Necesito ayuda con una aplicacion web y no se programar.
Quiero instrucciones extremadamente detalladas, paso por paso, sin tecnicismos.

Contexto:

- Aplicacion: APP TEST DE RM.
- Despliegue: Vercel.
- Base de datos: MariaDB en Aiven.

Problema exacto:
[Escribe aqui el problema]

Lo que ya hice:
[Escribe aqui lo que probaste]

Mensaje que aparece en pantalla:
[Copia el mensaje exacto]

Quiero que me indiques:

1. Que significa este problema en palabras simples.
2. Que revisar primero, segundo y tercero.
3. Que NO debo tocar para no empeorar.
4. En que punto debo detenerme.

### 19.2 Prompt para Claude

Actua como soporte tecnico para una persona no tecnica.
No se programar y necesito una guia muy detallada.

Sistema:

- App en Vercel.
- Base de datos en Aiven (MariaDB).

Incidente:
[Describe aqui el incidente]

Pasos que ya hice:
[Lista de pasos]

Error visible:
[Mensaje exacto]

Dame:

1. Diagnostico probable en lenguaje simple.
2. Pasos exactos para resolver sin usar comandos.
3. Alertas de seguridad antes de tocar variables o base de datos.
4. Como validar que quedo resuelto.

### 19.3 Prompt para GitHub Copilot

Necesito soporte operativo, no desarrollo de codigo.
No se programar. Explica todo como a principiante total.

Proyecto:

- APP TEST DE RM.
- Vercel + Aiven MariaDB.

Problema:
[Describe problema]

Acciones previas:
[Que ya intentaste]

Mensaje en pantalla:
[Error exacto]

Por favor:

1. Dame una ruta de solucion paso a paso.
2. Dime que no debo modificar.
3. Dime cuando debo detenerme y pedir escalamiento.

### 19.4 Prompt para Codex

Necesito ayuda para operar una app web sin saber programar.
Quiero instrucciones detalladas, ordenadas y sin tecnicismos.

Contexto:

- APP TEST DE RM.
- Hosting: Vercel.
- Base de datos: Aiven MariaDB.

Falla actual:
[Describe la falla]

Pruebas realizadas:
[Lista lo que ya probaste]

Texto del error:
[Pega aqui el error]

Indicame:

1. Causa probable.
2. Pasos concretos para resolver.
3. Riesgos antes de tocar configuraciones delicadas.
4. Senales para saber si debo detenerme.

## 20. Informacion critica de referencia

### 20.1 Variables de entorno necesarias

Estas variables deben existir en Vercel:

- DATABASE_URL
- JWT_SECRET
- RESEND_API_KEY
- ADMIN_EMAILS
- NEXT_ALLOWED_DEV_ORIGINS

Importante:

- Verificar existencia y que no esten vacias si hay incidentes.
- No cambiar valores sin guia clara.

### 20.2 Que guarda la base de datos

- Personas: cedula, nombre, sexo, peso, talla, cintura, cadera y edad.
- Ejercicios: catalogo de ejercicios.
- Sesiones: entrenamientos registrados.
- Resultados por ejercicio: repeticiones, carga y calculos RM.
- Usuarios administrativos.
- Codigos temporales de acceso administrativo.

### 20.3 Modulos principales de la app

- Inicio: entrada por cedula.
- Dashboard: resumen de salud y progreso.
- Nueva sesion: carga de ejercicios.
- Detalle de sesion: resultados y recomendaciones.
- Panel admin: gestion de usuarios, personas, sesiones y ejercicios.

## 21. Guia rapida para incidentes graves

Si hay una caida importante:

1. No hagas cambios grandes de inmediato.
2. Verifica Internet y URL.
3. Revisa Vercel.
4. Revisa Aiven.
5. Haz solo una accion a la vez.
6. Prueba despues de cada accion.
7. Si no mejora, deten acciones y consulta IA.

## 22. Cierre

Este manual esta disenado para operar la aplicacion durante anos con autonomia.

Si alguna situacion supera lo descrito aqui, usa una IA con los prompts de este documento y sigue instrucciones paso a paso, evitando cambios al azar.
