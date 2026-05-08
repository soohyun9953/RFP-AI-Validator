import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rag-reindex-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/reindex' && req.method === 'POST') {
            const pythonCmd = 'python';
            const scriptPath = 'C:\\Users\\KITC\\.gemini\\ISMP2\\extract_rag.py';
            
            exec(`${pythonCmd} "${scriptPath}"`, (error, stdout, stderr) => {
              if (error) {
                console.error(`Exec error: ${error}`);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Indexing completed' }));
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  base: './',
})
