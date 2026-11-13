import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

async function start() {
  if (Capacitor.isNativePlatform()) {
    const serviceWorker = navigator.serviceWorker;
    if (serviceWorker?.controller) {
      const registrations = await serviceWorker.getRegistrations();
      const removed = await Promise.all(registrations.map(registration => registration.unregister()));
      if (removed.some(Boolean)) {
        window.location.reload();
        return;
      }
    }
  } else {
    registerSW();
  }
  createRoot(document.getElementById('root')!).render(<App />);
}

void start();
