self.addEventListener("install", event => {
  console.log("Service Worker instalado");
});

self.addEventListener("fetch", event => {
  // Não precisa fazer nada ainda
});
