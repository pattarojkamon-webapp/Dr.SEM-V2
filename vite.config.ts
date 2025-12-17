
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Prevent "process is not defined" error in browser environment
    'process.env': {}
  }
});
