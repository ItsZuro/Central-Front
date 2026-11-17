# Central-Front — Configuración cloud de demostración

El cliente Axios ya utiliza `VITE_API_BASE_URL` (`src/core/api/api.ts`), por lo que no hay que reescribirlo.

- Desarrollo local: `http://localhost:8080/api/v1/` (proxy Nginx de Docker Compose).
- Vercel: configurar `VITE_API_BASE_URL=https://<dominio-de-la-api>/api/v1/` y reconstruir el frontend.
- En backend, CORS debe permitir exactamente el origen HTTPS del frontend.
- No poner contraseñas, JWT secrets ni endpoints privados de RDS en `VITE_*`, pues se publican en el navegador.
- No conectar React directamente a PostgreSQL ni a un bucket S3 privado.
- Probar login, consulta de productos, reservas y rutas protegidas tras desplegar.

Rama de adaptación: `feature/cloud-final-project`. No está fusionada con `main` ni desplegada automáticamente.
