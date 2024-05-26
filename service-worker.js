const CACHE_NAME = 'shopping-list-cache-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/manifest.json',
]

self.addEventListener('install', function (event) {
  console.log('[ServiceWorker] Install')
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('Opened cache')
      console.log('offline page cached')
      return cache.addAll(urlsToCache)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', function (event) {
  if (event.request.url.includes('/cache/')) {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        if (response) {
          return response
        }
        return fetch(event.request).then(function (networkResponse) {
          return caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, networkResponse.clone())
            return networkResponse
          })
        })
      })
    )
  } else {
    event.respondWith(
      fetch(event.request)
        .then(function (networkResponse) {
          return caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, networkResponse.clone())
            return networkResponse
          })
        })
        .catch(function () {
          return caches.match(event.request)
        })
    )
  }
})

self.addEventListener('message', event => {
  if (event.data) {
    switch (event.data.type) {
      case 'CACHE_NEW_ITEM':
        cacheNewItem(event.data);
        break;
      case 'REQUEST_CURRENT_LIST':
        sendCurrentList();
        break;
      case 'REMOVE_ITEM_FROM_CACHE':
        removeItemFromCache(event.data.url);
        break;
      default:
        console.log('Received unknown message type:', event.data.type);
    }
  }
});

function cacheNewItem(data) {
  const { url, item } = data;
  const response = new Response(JSON.stringify(item), {
    headers: {'Content-Type': 'application/json'}
  });
  caches.open(CACHE_NAME).then(cache => {
    cache.put(url, response).then(() => {
      console.log(`Item cached successfully: ${url}`);
      broadcastToClients({type: 'NEW_ITEM_CACHED', url: url, item: item});
    }).catch(err => {
      console.error('Error caching item:', err);
    });
  });
}

function sendCurrentList() {
  caches.open(CACHE_NAME).then(cache => {
    cache.keys().then(keys => {
      keys.forEach(key => {
        if (key.url.includes('/cache/')) {
          cache.match(key).then(response => {
            response.json().then(item => {
              broadcastToClients({type: 'NEW_ITEM_CACHED', url: key.url, item: item});
            });
          });
        }
      });
    });
  });
}

function removeItemFromCache(url) {
  caches.open(CACHE_NAME).then(cache => {
    cache.delete(url).then(response => {
      if (response) {
        console.log(`Item removed from cache: ${url}`);
        broadcastToClients({type: 'ITEM_REMOVED_FROM_CACHE', url: url});
      } else {
        console.error('Failed to delete item from cache:', url);
      }
    });
  });
}

function broadcastToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}
 
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({
      type: 'ITEM_REMOVED_FROM_CACHE',
      url: url
    });
  });
});
 
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({
      type: 'NEW_ITEM_CACHED',
      url: url,
      item: item
    });
  });
});

self.addEventListener('push', function (event) {
  console.log('Push received:', event)
  event.waitUntil(
    self.registration.showNotification('Push Notification', {
      body: 'Was geht ab?',
    })
  )
})

self.addEventListener("sync", function (event) {
  console.log("tag: ", event.tag);

  if (event.tag == "myFirstSync") {
    console.log("Doing some sync stuff!");
  }
});