# ManaShelf — HANDOFF PARA CONTINUAR DESARROLLO

> **INSTRUCCIÓN PARA EL PRÓXIMO AGENTE**
>
> Este documento describe decisiones de arquitectura y diseño que siguen vigentes, pero el
> número de versión de su título original (v2.4.1) quedó desactualizado — la baseline real
> hoy es **v2.5.27-beta**. Para el estado actual pieza por pieza, leer `BACKLOG.md` completo
> (tiene el historial real hasta la versión vigente); este archivo sigue siendo válido para
> entender el "por qué" de decisiones de fondo, pero no asumir que describe el estado actual
> exacto de cada componente sin cruzarlo contra el BACKLOG.
>
> Esta es la baseline de referencia de ManaShelf. Antes de modificar código, leer este archivo, `README.md` y `BACKLOG.md` (en ese orden, dándole prioridad al BACKLOG para lo más reciente).
>
> **NO modificar Method 6** salvo que el usuario lo pida explícitamente. Fue validado por el usuario contra sus datos reales de Archidekt.
>
> No eliminar backlog sin confirmación del usuario. No asumir que una función está validada funcionalmente sólo porque pasó `node --check`.
>
> Prioridad inicial: validar los flujos actuales con datos reales y corregir regresiones/UX antes de agregar features nuevas.

---

## 1. Qué es ManaShelf

ManaShelf es una aplicación local para Commander / Magic: The Gathering que cruza:

- colección y mazos de Archidekt;
- recomendaciones de EDHREC;
- metadata de cartas de Scryfall.

Objetivo: aprovechar la colección real del usuario para descubrir Commanders, encontrar recomendaciones que ya posee y analizar/mejorar mazos existentes.

### Flujos principales

1. **Explorar Commander**
   - El usuario elige un Commander.
   - ManaShelf consulta recomendaciones EDHREC.
   - Las cruza con su colección.
   - Permite ver Todas / En colección / Disponibles / Ya en el mazo según contexto.

2. **Descubrir Commanders**
   - Busca Legendary Creatures legales como Commander dentro de la colección.
   - Permite búsqueda y themes EDHREC.
   - Multi-tag AND.
   - Comparación seleccionada de 2–10 Commanders.
   - No debe volver el antiguo ranking masivo/global.

3. **Mejorar mi mazo**
   - El usuario selecciona un mazo Archidekt.
   - **Seleccionar NO debe disparar análisis.**
   - El usuario pulsa `Analizar mazo`.
   - Luego navega:
     - Resumen
     - Salud
     - Recomendaciones
     - Cambios
   - La decklist lateral funciona como inspector/auditor de métricas.

LAB existe todavía como fallback/área de validación de Health. A largo plazo debería desaparecer de navegación principal una vez que Health integrado esté estable.

---

## 2. Entorno y ejecución

Restricciones del proyecto:

- Node-only.
- Sin Docker.
- Sin dependencias npm externas.
- Ejecutar con:

```bash
node server.mjs
```

Abrir:

```text
http://127.0.0.1:3000
```

Entorno principal del usuario:

- Bazzite 44 / Kinoite/Fedora-like.
- Node v26.7.0.

También existe `Abrir ManaShelf.bat` para Windows.

No introducir frameworks/build systems/dependencias salvo acuerdo explícito.

---

## 3. Baseline

Versión actual:

```text
v2.4.1
```

La versión debe seguir siendo claramente visible en UI.

Mantener versiones anteriores para rollback.

---

## 4. Archivos importantes

```text
server.mjs
public/
  index.html
  app.js
  styles.css
lib/
  archidekt-size.mjs
README.md
BACKLOG.md
HANDOFF.md
```

### Responsabilidades

`server.mjs`
- integración Archidekt;
- integración EDHREC;
- integración Scryfall;
- cachés;
- endpoints locales;
- Deck Health;
- clasificación estructural;
- recomendaciones;
- CUT / IN→OUT;
- Discovery jobs.

`public/app.js`
- estado frontend;
- navegación;
- filtros;
- render;
- inspector/decklist;
- gráficos;
- Discovery;
- Improve;
- Health.

`public/styles.css`
- design system actual;
- layout;
- responsive;
- retrowave/synthwave.

`lib/archidekt-size.mjs`
- **Method 6.**
- Tratar como código protegido.

---

# 5. ARCHIDEKT — QUÉ ESTÁ VALIDADO

## 5.1 Method 6 — VALIDADO POR EL USUARIO CON DATOS REALES

Éste es el método correcto para calcular Size de un mazo Archidekt.

Archivo:

```text
lib/archidekt-size.mjs
```

Código conceptual actual:

```js
export function partitionArchidektDeck(payload){
  const categories=Array.isArray(payload?.categories)?payload.categories:[];
  const categoryName=x=>typeof x==="string"?x:String(x?.name||x?.category||"");
  const catByName=new Map(categories.map(c=>[
    String(c?.name||"").toLocaleLowerCase("en-US"),c
  ]));

  const mainboard=[],excluded=[],commanders=[];

  for(const entry of (payload?.cards||[])){
    const cardObj=entry?.card||{};
    const oracle=cardObj?.oracleCard||cardObj?.oracle_card||{};
    const name=String(
      oracle?.name||cardObj?.name||entry?.name||""
    ).trim();

    const quantity=Math.max(0,Number(entry?.quantity||1));
    if(!name||quantity<=0)continue;

    const cats=Array.isArray(entry?.categories)
      ? entry.categories.map(categoryName).filter(Boolean)
      : [];

    const primary=cats[0]||"";
    const excludedByBoard=/^(sideboard|maybeboard)$/i.test(primary);

    const primaryMeta=catByName.get(
      primary.toLocaleLowerCase("en-US")
    );

    const isCommander=
      Boolean(primaryMeta?.isPremier) ||
      /^commander$/i.test(primary);

    if(isCommander)commanders.push(name);

    (excludedByBoard?excluded:mainboard).push({
      name,
      quantity,
      categories:cats,
      primaryCategory:primary
    });
  }

  return {
    categories,
    mainboard,
    excluded,
    commanders:[...new Set(commanders)],
    size:mainboard.reduce((n,c)=>n+c.quantity,0),
    excludedCount:excluded.reduce((n,c)=>n+c.quantity,0)
  };
}
```

### Reglas críticas

Size visible NO debe calcularse usando:

- `payload.size`;
- tamaño del catálogo/session;
- `includedInDeck`;
- `entry.category` singular.

Archidekt `categories[0]` es la categoría primaria y gana.

### Regresiones conocidas

```text
100 + 17 Sideboard  => 100
87                  => 87
103 + 4 Maybeboard  => 103
```

Si Size vuelve a estar mal:

**investigar integración, cache o UI antes de tocar Method 6.**

---

## 5.2 Colección pública Archidekt — EXPORT DIRECTO VALIDADO

El usuario probó personalmente el export directo y confirmó que funciona.

Éste debe ser el camino preferido para colección pública por username en lugar del bridge paginado lento.

### Resolver collection ID

```http
GET https://archidekt.com/u/{username}
```

Extraer:

```regex
/collection/v2/(\d+)
```

### Export

```http
POST https://archidekt.com/api/collection/export/v2/{collection_id}/
Content-Type: application/json
Accept: application/json
```

Body:

```json
{
  "fields": ["..."],
  "page": 1,
  "game": 1,
  "pageSize": 2500
}
```

Respuesta relevante:

```json
{
  "content": "<CSV>",
  "totalRows": 1234,
  "moreContent": true
}
```

Incrementar `page` mientras `moreContent === true`.

### Fields validados contra implementación actual investigada

```text
quantity
card__oracleCard__name
modifier
condition
createdAt
language
purchasePrice
tags
card__edition__editionname
card__edition__editioncode
card__multiverseid
card__uid
card__oracle__uid
card__mtgoNormalId
card__collectorNumber
card__color
card__colorIdentity
card__manaCost
card__types
card__subtypes
card__supertypes
card__rarity
card__prices__ck
card__prices__tcg
card__prices__scg
card__prices__mtgo
card__prices__cm
card__prices__mp
card__prices__tcg_land
card__cmc
```

Default probado/investigado:

```text
pageSize = 2500
game = 1
```

### Historia importante

El bridge `/api/search-owned` paginado llegó a tener páginas de ~45 s y múltiples timeouts.

No volver a esa arquitectura como camino principal de colección pública si no existe una razón demostrable.

---

# 6. Caché / sincronización

Objetivo arquitectónico acordado:

```text
sincronizar una vez
        ↓
reutilizar localmente
        ↓
enriquecer sólo lo que falta
```

No hacer que cada pantalla vuelva a descargar/procesar toda la colección.

La aplicación ya posee `.manashelf-cache` y varias capas de caché.

Conceptualmente:

```text
.manashelf-cache/
  decks-<usuario>.json
  scryfall-images.json
  edhrec.json
  commander-catalog.json
  ...
```

### Estrategia acordada

1. Sync cache
   - colección;
   - catálogo de decks.

2. Deck cache
   - detalle de deck;
   - análisis asociado.

3. Card metadata cache
   - Scryfall compartido por toda la app.

### v2.4.x

Se hicieron mejoras para:

- evitar hidratar todos los decks durante el catálogo inicial;
- cargar detalle completo sólo al seleccionar un deck;
- reutilizar Deck Detail para Health;
- cachear Health mientras la composición no cambie;
- serializar batches Scryfall para evitar trabajo concurrente redundante;
- reutilizar Commanders de Discovery dentro de la sesión;
- invalidar Health cuando se invalida el deck correspondiente.

### Estado

**Arquitectura aceptada.**

Pero el impacto real de performance todavía debe medirse con la colección real del usuario.

No asumir que el problema de “carga dos veces” está completamente resuelto hasta medirlo.

---

# 7. Scryfall

Scryfall se usa para:

- imágenes;
- type line;
- oracle text;
- CMC;
- color identity;
- legalities;
- keywords;
- metadata necesaria para Health/roles.

Existe caché persistente local.

Usar batches para nombres faltantes.

No volver a consultar cartas ya cacheadas sin necesidad.

Existe una cola de batches en v2.4.1 para reducir requests simultáneas redundantes.

Pendiente futuro posible:

- evaluar Bulk Data si realmente mejora la experiencia;
- no implementarlo sólo por optimización teórica.

---

# 8. EDHREC

EDHREC se usa para:

- recomendaciones;
- themes/tags;
- synergy/contexto;
- Discovery.

### Regla importante

Health local **NO debe fallar completamente** porque EDHREC devuelva 403.

Ya existe fallback:

```text
EDHREC falla
      ↓
Health estructural local continúa
      ↓
UI muestra warning
```

No regresar a arquitectura all-or-nothing.

---

# 9. Health

Ejes principales:

- Maná
- Card Advantage
- Interacción
- Curva

Theme se restringe a evidencia asociada al Commander/EDHREC; no inventar themes sólo porque algunas cartas incidentales coinciden.

### Reglas estructurales actuales

1. Ramp
2. Card Advantage
3. Interacción
4. Graveyard hate
5. Board wipe
6. Protección / resiliencia
7. Tierras / base de maná
8. Recursión

Todas las reglas activadas deben poder mostrarse simultáneamente.

### Tierras

Referencia contextual actual:

```js
const landLow =
  (avgCmc >= 3.8 ? 36 : avgCmc <= 2.5 ? 32 : 34)
  + (commanderCmc >= 6 ? 1 : 0);
```

### Auditoría

Regla UX acordada:

```text
Un número importante → debería poder auditarse.
```

Click en:

- tierras;
- ramp;
- draw;
- interacción;
- wipes;
- CMC;
- tipo;
- reglas estructurales;

debe filtrar/mostrar las cartas correspondientes en la decklist lateral.

---

# 10. Curva de maná — estado v2.4.1

El usuario pidió:

- barras mucho más juntas;
- histograma convencional;
- composición por tipos clásicos de MTG;
- colores + leyenda;
- click para auditar.

v2.4.1 implementa stack por:

```text
Creature
Instant
Sorcery
Artifact
Enchantment
Planeswalker
Battle
Other
```

Land no participa de la curva.

Click en segmento:

```text
CMC + Tipo
```

filtra la decklist.

**Esto está implementado pero todavía NO validado visualmente por el usuario.**

---

# 11. Donut de tipos

Debe ser un donut proporcional real.

Centro:

```text
total de cartas
```

Segmentos:

```text
proporción real por primary type
```

La leyenda y el gráfico deben compartir exactamente los mismos colores.

Click en tipo → decklist filtrada.

El usuario indicó que le gusta el estilo visual del donut oscuro/neón propuesto.

---

# 12. Mejorar — UX acordada

No analizar al seleccionar deck.

Flujo correcto:

```text
Seleccionar deck
      ↓
mostrar datos básicos
      ↓
[ Analizar mazo ]
      ↓
Resumen / Salud / Recomendaciones / Cambios
```

### Tabs

Regla:

```text
Tabs  = navegación/sección
Chips = filtros
Botón = acción
```

El usuario pidió que las tabs se sientan como **páginas**:

```text
RESUMEN        ← página activa, contenido visible
SALUD          ← sólo encabezado
RECOMENDACIONES
CAMBIOS
```

Al cambiar:

```text
RESUMEN
SALUD          ← página activa
  contenido...
RECOMENDACIONES
CAMBIOS
```

Le gusta la idea de que los encabezados se stackeen al hacer scroll.

v2.4.1 hizo un primer rediseño hacia esto.

**Todavía requiere validación visual real.**

---

# 13. Decklist lateral

Debe funcionar como inspector/auditor persistente.

Mostrar claramente:

```text
Filtro: Ramp · 11 cartas
```

o:

```text
Filtro: CMC 3 · Creature
```

Ordenar por:

- Nombre
- CMC
- Tipo
- Rol/Categoría según metadata disponible.

No perder filtro al cambiar orden.

---

# 14. IN → OUT / CUT

Es experimental.

## Filosofía

No decir simplemente “sacá esta carta”.

Primero identificar candidatos de CUT:

- no Commander;
- no land;
- CMC alto puede sumar Cut Score;
- baja evidencia de Theme suma;
- no cubrir roles prioritarios suma;
- roles estructurales escasos se protegen;
- wipes escasos se protegen.

### v2.4.1 — pairing

Anteriormente se emparejaba demasiado mecánicamente por posición.

v2.4.1 cambia a un pairing contextual:

Para cada IN:

1. tomar CUT candidates todavía no usados;
2. considerar Cut Score;
3. favorecer mejora de curva;
4. penalizar cortar el mismo rol que el IN intenta reparar;
5. favorecer cortar cartas sin Theme;
6. favorecer cortar cartas sin rol estructural;
7. mantener protegidos roles escasos.

Se produce:

- confidence;
- pair score;
- razones de la pareja;
- impacto CMC;
- protección de roles.

### UI v2.4.1

Cada cambio muestra:

```text
[imagen IN]       →       [imagen OUT]

nombre                    nombre
razón IN                  razón CUT

       POR QUÉ ESTA PAREJA
       ...
```

El usuario pidió explícitamente **ver las cartas**.

Las imágenes se toman de metadata Scryfall ya disponible.

### IMPORTANTE

El algoritmo CUT todavía **NO está validado suficientemente con decks reales**.

No tratarlo como recomendación autoritativa.

Mostrarlo como experimental/auditable.

---

# 15. Descubrir Commanders

Comportamiento aprobado:

- Legendary Creature owned + Commander legal;
- gallery local;
- search;
- catálogo de themes EDHREC;
- compact tags iniciales + búsqueda + expandir;
- active tags separados/removibles;
- multi-tag AND;
- comparación sólo de seleccionados 2–10;
- no mass ranking;
- ranking principal cuando corresponde: cantidad absoluta de recomendaciones EDHREC que el usuario posee.

### Regresión importante

`COMMANDERS DE TU COLECCIÓN` tuvo una regresión:

```text
No pude cargar Commanders..
```

v2.4.x agregó:

- cache de resultados de sesión;
- job de progreso;
- fallback a endpoint directo si falla el job.

**Debe validarse con la colección real.**

No marcar como solucionado definitivamente hasta esa prueba.

---

# 16. UX / Design system acordado

Identidad:

```text
retrowave / synthwave
```

El usuario **quiere neón**.

No usar verde-lima como identidad.

Paleta conceptual:

- cyan → información / datos / disponibilidad;
- magenta/violeta → selección / identidad;
- ámbar → atención;
- rojo/rosa fuerte → error;
- gris → secundario.

Neón principalmente en:

- selección;
- hover;
- focus;
- gráficos;
- progreso;
- elementos interactivos.

Puede haber presencia visual fuerte; no hace falta “tenerle miedo” al neón.

### Consistencia

Reglas UX acordadas:

```text
Un número → se puede auditar.
Un chip → filtra.
Un tab → cambia de sección.
Un botón → ejecuta una acción.
```

### Tipografía

El usuario detectó problemas de jerarquía en Structural Health.

Objetivo:

1. nombre de métrica;
2. número;
3. estado;
4. contexto.

`BAJO`, `ADECUADO`, etc. deben ser badges secundarios, no competir con el nombre.

### Bordes

Evitar nested cards innecesarias.

Usar espacio/contraste para agrupación cuando sea suficiente.

### Alineación

El usuario pidió explícitamente prestar más atención a alineaciones.

Antes de entregar una versión visual:

- revisar grids;
- `min-width: 0`;
- inspector;
- baseline de cards;
- textos;
- headers;
- responsive;
- evitar bleed/overflow.

---

# 17. Errores

Preferencia del usuario:

- errores como notificación emergente arriba;
- desaparecer después de unos segundos;
- no dejar bloques de error persistentes ocupando layout.

Verificar que no haya regresión.

---

# 18. Semántica de texto

Usar:

```text
disponible
```

Nunca usar:

```text
libre
```

---

# 19. Cosas que NO deben volver

Salvo pedido explícito:

- antiguo Compare global;
- ranking masivo de todos los Commanders;
- Top 10 automático de todos los owned;
- exclusiones/no-recommend;
- filtro `No tengo`;
- reescribir Method 6;
- tests de colección anonimizada;
- preferences import/export.

---

# 20. Qué está realmente validado

## Validado por el usuario / datos reales

### Sí

- Method 6 para Size.
- Direct Archidekt collection export v2 con payload correcto.
- Username-only como UX de colección pública.
- La necesidad de no depender del bridge paginado lento.
- Concepto de Explorar / Descubrir / Mejorar.
- Botón explícito `Analizar mazo`.
- Tabs como navegación.
- Chips como filtros.
- Decklist como auditor.
- Health local debe sobrevivir EDHREC 403.
- Preferencia retrowave/neón.
- No usar “libre”.
- Discovery selected compare 2–10 en lugar de mass ranking.
- 8 reglas estructurales simultáneas.
- Method 6 `categories[0]` como primaria.

## Implementado y testeado técnicamente, pero NO necesariamente validado por el usuario

- layout v2.4.1;
- nuevo stack de curva por tipo;
- nuevas tabs/páginas;
- imágenes IN/OUT;
- nuevo pairing contextual IN/OUT;
- correcciones recientes de alineación;
- cache Health;
- cola Scryfall;
- fallback Discovery;
- mejoras de performance de catálogo.

---

# 21. Tests técnicos ejecutados en v2.4.x

Se ejecutó:

```bash
node --check server.mjs
node --check public/app.js
node --check lib/archidekt-size.mjs
```

Y arranque real:

```text
GET /            → 200
GET /app.js      → 200
GET /styles.css  → 200
```

También se verificaron regresiones de Method 6.

Esto significa:

```text
sintaxis / arranque básico OK
```

NO significa:

```text
UX visual validada
integraciones externas reales completamente validadas
CUT validado
Discovery validado con colección real
```

---

# 22. Qué falta validar — PRIORIDAD

## P0 — inmediatamente

### A. Conexión Archidekt

Medir con cuenta/colección real:

```text
tiempo conexión inicial
tiempo hasta catálogo usable
tiempo selección de deck
tiempo Analizar mazo
```

Confirmar que no exista trabajo duplicado significativo.

### B. COMMANDERS DE TU COLECCIÓN

Probar:

- carga en frío;
- carga con cache;
- progreso;
- fallback;
- número correcto de Commanders.

### C. Mejorar v2.4.1

Con un deck real:

```text
seleccionar deck
→ NO analiza

Analizar mazo
→ analiza una vez

Resumen
Salud
Recomendaciones
Cambios
```

Verificar que cambiar tabs no vuelva a consultar todo.

### D. Visual

Capturas a revisar:

- Resumen;
- Salud;
- Cambios;
- Discovery.

Especialmente:

- alineaciones;
- overflow;
- ancho del inspector;
- tabs stackeadas;
- curva;
- donut;
- IN→OUT.

---

# 23. Tests funcionales concretos pendientes

### Lord of Pain

Theme esperado aproximadamente:

```text
Group Slug
Burn
Group Hug
Chaos
```

`Aristocrats` incidental NO debe aparecer como Theme principal salvo evidencia EDHREC real del Commander.

### Atraxa Infect

Validar Theme y recomendaciones.

### CUT

Probar varios decks reales.

No ajustar pesos sólo para “hacer que una captura parezca correcta”.

Registrar ejemplos donde:

- OUT es bueno;
- OUT es absurdo;
- rol importante fue protegido;
- curva mejora;
- recomendación IN no justifica el OUT.

Ajustar algoritmo con evidencia.

---

# 24. Backlog importante

Además de `BACKLOG.md`, mantener presentes:

- live-test Lord of Pain Health;
- live-test Atraxa Infect;
- broaden `edhrecTagEvidence`;
- mejorar fallback multi-tag si EDHREC falla;
- browser visual validation Discovery/LAB;
- live-test compare 2–10;
- residual stock strings;
- live EDHREC Similar;
- usage links;
- deck search by Commander;
- hide-in-deck behavior;
- availability semantics;
- contextual recommendation quality;
- no-layout-shift;
- eventualmente remover controles provisionales de cache;
- posible Scryfall Bulk Data;
- tests reales de integraciones externas;
- posible `Encontrar parecidos a…` local;
- retirar LAB sólo después de validar Health integrado.

---

# 25. Forma de trabajar recomendada

No hacer varios rediseños especulativos a la vez.

Ciclo recomendado:

```text
1. reproducir
2. identificar capa responsable
3. corregir
4. node --check
5. arrancar server
6. test funcional
7. test visual
8. recién entregar ZIP
```

Para Size:

```text
NO tocar Method 6
```

Para problemas visuales:

```text
inspeccionar DOM real + CSS real
```

No seguir acumulando `!important` a ciegas.

Para integraciones:

```text
validar respuesta real
```

No inferir que una API funciona porque compila.

---

# 26. Versionado / rollback

Mantener cada versión como ZIP independiente:

```text
manashelf-v2.4.0.zip
manashelf-v2.4.1.zip
...
```

No sobrescribir la versión anterior.

Si una modificación grande rompe UX, volver a la última baseline funcional y reaplicar cambios de manera aislada.

---

# 27. Primera tarea sugerida para el próximo agente

No agregar una feature.

Primero pedir al usuario que ejecute **v2.4.1** y obtener capturas/resultados de:

1. `COMMANDERS DE TU COLECCIÓN`;
2. `Mejorar → Resumen`;
3. `Mejorar → Salud`;
4. `Mejorar → Cambios`.

Después corregir las regresiones visibles y confirmar performance de conexión/análisis.

---

# 28. Regla de producto más importante

ManaShelf no debería sentirse como:

```text
herramienta + herramienta + reporte + panel
```

Debe sentirse como una sola aplicación:

```text
ManaShelf
   │
   ├── Explorar
   ├── Descubrir
   └── Mejorar
          │
          ├── Resumen
          ├── Salud
          ├── Recomendaciones
          └── Cambios
```

Preservar esa dirección.
