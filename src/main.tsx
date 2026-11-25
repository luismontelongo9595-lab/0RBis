import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import type {BeforeInstallPromptEvent} from './hooks/usePWAInstall.ts';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__orbisDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('orbis:sw-update-available'));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('orbis:sw-offline-ready'));
  },
});

createRoot(document.getElementById('root')!).render(<App />);
