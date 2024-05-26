function addTask(product, quantity) {
  const shoppingList = document.getElementById('shopping-list');
  if (!shoppingList) {
    console.error('Shopping list element is not available');
    return;
  }

  const existingItem = Array.from(shoppingList.children).find(li => li.textContent.includes(`${product}, ${quantity} mal`));
  if (existingItem) {
    return;
  }

  const li = document.createElement('li');
  li.textContent = `${product}, ${quantity} mal`;
  const button = document.createElement('button');
  button.textContent = 'Remove';
  button.addEventListener('click', () => {
    shoppingList.removeChild(li);
    checkIfEmpty();
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'REMOVE_ITEM_FROM_CACHE',
        url: `/cache/${product}`,
      });
    }
  });
  li.appendChild(button);
  li.addEventListener('click', () => {
    li.classList.toggle('completed');
  });
  shoppingList.appendChild(li);
  checkIfEmpty();

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_NEW_ITEM',
      url: `/cache/${product}`,
      item: { product: product, quantity: quantity },
    });
  }
}


function removeTaskByUrl(url) {
  const productName = url.split('/').pop();
  const items = document.querySelectorAll('#shopping-list li');
  items.forEach(item => {
    if (item.textContent.startsWith(productName + ', ')) {
      item.parentNode.removeChild(item);
      checkIfEmpty();
    }
  });
}

function checkIfEmpty() {
  const shoppingList = document.getElementById('shopping-list');
  const noProductsMessage = document.getElementById('no-products-message');
  if (!shoppingList || !noProductsMessage) {
    console.error('Required elements for checking emptiness are not available');
    return;
  }

  if (!shoppingList.children.length) {
    noProductsMessage.style.display = 'block';
  } else {
    noProductsMessage.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('shopping-form');
  const input = document.getElementById('produkt');
  const input2 = document.getElementById('anzahl');
  const installButton = document.getElementById('install');
  const pushButton = document.getElementById('push-button');
  const pushButton2 = document.getElementById('push-button2');
  let installPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.removeAttribute('hidden');
  });

  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      return;
    }
    const result = await installPrompt.prompt();
    console.log(`Install prompt was: ${result.outcome}`);
    disableInAppInstallPrompt();
  });

  function disableInAppInstallPrompt() {
    installPrompt = null;
    installButton.setAttribute('hidden', '');
  }

  window.addEventListener('appinstalled', () => {
    disableInAppInstallPrompt();
  });

  // Cache management and initialization
  window.addEventListener('focus', () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'REQUEST_CURRENT_LIST',
      });
    }
  });

  if ('caches' in window) {
    try {
      const cache = await caches.open('shopping-list-cache-v1');
      const keys = await cache.keys();
      keys.forEach(async (request) => {
        if (request.url.includes('/cache/')) {
          const response = await cache.match(request);
          const data = await response.json();
          addTask(data.product, data.quantity);
        }
      });
    } catch (error) {
      console.error('Error fetching cached items:', error);
    }
  }

  // Submit form logic
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const product = input.value.trim();
    const quantity = input2.value.trim();
    if (product && quantity) {
      addTask(product, quantity);
      input.value = '';
      input2.value = '';
    }
  });

  // Push notification setup
  pushButton.addEventListener('click', () => {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Push notification permission granted.');
        pushButton.style.display = 'none';
        pushButton2.style.display = 'flex';
      } else {
        pushButton.style.display = 'flex';
        pushButton2.style.display = 'none';
        console.log('Push notification permission denied.');
      }
    });
  });

  pushButton2.addEventListener('click', () => {
    pushButton.style.display = 'flex';
    pushButton2.style.display = 'none';
    console.log('Push notifications disabled.');
  });
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function (registration) {
        console.log('Service Worker registered with scope:', registration.scope);

        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'NEW_ITEM_CACHED') {
            const { item } = event.data;
            addTask(item.product, item.quantity);
          } else if (event.data && event.data.type === 'ITEM_REMOVED_FROM_CACHE') {
            const { url } = event.data;
            removeTaskByUrl(url);
          }
        });
      })
      .catch(function (error) {
        console.log('Service Worker registration failed:', error);
      });

      navigator.serviceWorker.ready.then(function (swRegistration) {
        return swRegistration.sync.register("myFirstSync");
      });
  });
}