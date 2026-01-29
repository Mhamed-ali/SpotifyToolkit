import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        host: true,
        https: true, // Enable HTTPS for the frontend
        proxy: {
            '/auth': {
                target: 'https://localhost:8888',
                changeOrigin: true,
                secure: false
            },
            '/login': {
                target: 'https://localhost:8888',
                changeOrigin: true,
                secure: false
            },
            '/callback': {
                target: 'https://localhost:8888',
                changeOrigin: true,
                secure: false
            },
            '/health': {
                target: 'https://localhost:8888',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/health/, '')
            }
        }
    }
})
