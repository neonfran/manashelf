# server/

Backend Express de ManaShelf.

`index.mjs` es el punto de entrada: monta las rutas de `/api/*` (definidas como
`apiRouter.get/post(...)` sobre un `express.Router()`) y sirve `public/` como
estático. La lógica de negocio (`lib/`, `experimental/`) es la misma que tenía
el proyecto antes de la migración a Express — no se reescribió, solo se movió
y se le cambió la capa de transporte HTTP.

Para correrlo: `npm start` (equivalente a `node index.mjs`) desde esta carpeta.
