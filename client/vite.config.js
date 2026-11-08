import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const BACKEND_TARGET = 'https://localhost:8888';

const createProxyConfig = (rewriteFn) => ({
    target: BACKEND_TARGET,
    changeOrigin: true,
    secure: false,
    ...(rewriteFn ? { rewrite: rewriteFn } : {})
});

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        host: true,
        https: true,
        proxy: {
            '/auth': createProxyConfig(),
            '/login': createProxyConfig(),
            '/callback': createProxyConfig(),
            '/refresh_token': createProxyConfig(),
            '/anghami': createProxyConfig(),
            '/health': createProxyConfig((path) => path.replace(/^\/health/, ''))
        }
    }
})
