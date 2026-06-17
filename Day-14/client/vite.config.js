import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/pure-sdk': 'http://localhost:5000',
      '/langchain': 'http://localhost:5000',
      '/llamaindex': 'http://localhost:5000'
    }
  }
});
