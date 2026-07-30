import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use('/api/generate', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": env.ANTHROPIC_API_KEY,
                      "anthropic-version": "2023-06-01",
                    },
                    body,
                  });
                  const data = await response.json();
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = response.status;
                  res.end(JSON.stringify(data));
                } catch (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            }
          });
        }
      }
    ],
    base: '/ResaleIQ/',
  }
})
