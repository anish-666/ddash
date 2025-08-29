import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the Docvai dashboard.  The
// react plugin enables JSX and HMR support.  We
// explicitly specify the dev server port so that local
// development is predictable.  Additional Vite
// configuration options can be added here as needed.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
});