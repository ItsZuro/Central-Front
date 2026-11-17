# Central-Front — Configuración cloud de demostración

El cliente Axios ya utiliza `VITE_API_BASE_URL` (`src/core/api/api.ts`), por lo que no hay que reescribirlo.

- Desarrollo local: `http://localhost:8080/api/v1/` (proxy Nginx de Docker Compose).
- Vercel: configurar `VITE_API_BASE_URL=https://<dominio-de-la-api>/api/v1/` y reconstruir el frontend.
- En backend, CORS debe permitir exactamente el origen HTTPS del frontend.
- No poner contraseñas, JWT secrets ni endpoints privados de RDS en `VITE_*`, pues se publican en el navegador.
- No conectar React directamente a PostgreSQL ni a un bucket S3 privado.
- Probar login, consulta de productos, reservas y rutas protegidas tras desplegar.

Rama de adaptación: `feature/cloud-final-project`. No está fusionada con `main` ni desplegada automáticamente.

## Módulos de demostración

- `/reservations`: consulta disponibilidad de mesas, envía solicitudes en estado pendiente y permite cancelar las propias reservas.
- `/menu`: el detalle de producto muestra reseñas y permite escribir una reseña a usuarios cliente autenticados.
- `/driver`: tablero básico de repartos asignados al empleado autenticado, accesible temporalmente mediante `ROLE_WAITER` y enlazado desde la interfaz del personal. No incluye seguimiento GPS automático.
- `/checkout`: muestra distancia y duración solo cuando Maps valida la cobertura en el backend. Niubiz está fijado en sandbox (script `static-content-qas.vnforapps.com`).
- El precio de envío permanece en cero mientras no exista una tarifa aprobada y calculada por el backend.

**Antes de mostrar al docente**: comprobar con usuario cliente y empleado real, backend conectado a PostgreSQL, Google Maps habilitado y (si se demuestra) Niubiz con credenciales exclusivamente QA. No se afirma que un simple build pruebe estas integraciones externas.
