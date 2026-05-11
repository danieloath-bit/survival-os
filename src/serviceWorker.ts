export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is useful, but the app remains usable if registration fails.
    })
  })
}
