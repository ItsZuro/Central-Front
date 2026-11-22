// CloudFront Functions · viewer-request · runtime cloudfront-js-2.0
// Asociar al comportamiento predeterminado de la distribución del FRONTEND.
// Sirve React Router al recargar URLs como /admin/reports sin capturar recursos estáticos.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    uri.indexOf("/api/") !== 0 &&
    uri.indexOf("/assets/") !== 0 &&
    uri.indexOf("/images/") !== 0 &&
    uri.indexOf("/fonts/") !== 0 &&
    !/\.[^/]+$/.test(uri)
  ) {
    request.uri = "/index.html";
  }
  return request;
}
