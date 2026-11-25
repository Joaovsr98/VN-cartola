// Do not cache API responses or credentials. Installability only, online operation required.
self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});
