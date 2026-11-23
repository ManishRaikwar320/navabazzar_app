import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface PythonBackend {
  process: ChildProcess;
  port: number;
}

let pythonBackendPromise: Promise<PythonBackend> | null = null;
let activePythonChild: ChildProcess | null = null;

function startPythonBackend(): Promise<PythonBackend> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, 'backend', 'app.py');
    const child = spawn('python3', [scriptPath], {
      cwd: __dirname,
      env: {
        ...process.env,
        PY_API_PORT: '0',
        SESSION_SECRET,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    activePythonChild = child;
    let settled = false;
    let stdoutBuffer = '';

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for Python SQL backend to start.'));
      }
    }, 10000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^PY_DB_READY:(\d+)$/);
        if (match && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ process: child, port: Number(match[1]) });
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) {
        console.error('[python-sql]', msg);
      }
    });

    child.on('exit', (code) => {
      if (activePythonChild === child) {
        activePythonChild = null;
        pythonBackendPromise = null;
      }
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Python SQL backend exited early with code ${code}`));
      }
    });
  });
}

function ensurePythonBackend(): Promise<PythonBackend> {
  if (!pythonBackendPromise) {
    pythonBackendPromise = startPythonBackend().catch((err) => {
      pythonBackendPromise = null;
      throw err;
    });
  }
  return pythonBackendPromise;
}

function stopPythonBackend() {
  if (activePythonChild && !activePythonChild.killed) {
    activePythonChild.kill('SIGTERM');
    activePythonChild = null;
  }
}

process.on('exit', stopPythonBackend);
process.on('SIGINT', () => {
  stopPythonBackend();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopPythonBackend();
  process.exit(0);
});

async function startServer() {
  // Boot Python + SQLite backend immediately
  const py = await ensurePythonBackend();
  console.log(`Python SQLite backend ready on 127.0.0.1:${py.port}`);

  const app = express();
  app.set('trust proxy', 1);

  // Proxy all /api/* traffic to the Python SQLite HTTP service
  app.use('/api', express.raw({ type: '*/*', limit: '100kb' }), async (req: Request, res: Response) => {
    try {
      const backend = await ensurePythonBackend();
      const targetUrl = `http://127.0.0.1:${backend.port}${req.originalUrl}`;

      const forwardHeaders: Record<string, string> = {};
      const passthroughHeaders = [
        'content-type',
        'authorization',
        'cookie',
        'x-requested-with',
        'origin',
        'host',
        'x-forwarded-host',
        'x-forwarded-proto',
      ];
      for (const h of passthroughHeaders) {
        const val = req.headers[h];
        if (typeof val === 'string' && val.length > 0) {
          forwardHeaders[h] = val;
        }
      }

      const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      const bodyBuffer = hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;

      const pyRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
      });

      const setCookies = typeof pyRes.headers.getSetCookie === 'function'
        ? pyRes.headers.getSetCookie()
        : [];
      if (setCookies.length > 0) {
        res.setHeader('Set-Cookie', setCookies);
      }

      const contentType = pyRes.headers.get('content-type') || 'application/json; charset=utf-8';
      res.status(pyRes.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');

      const responseBytes = Buffer.from(await pyRes.arrayBuffer());
      res.send(responseBytes);
    } catch (err) {
      console.error('Python SQL proxy error:', err);
      res.status(502).json({ error: 'Database service temporarily unavailable.' });
    }
  });

  // Vite dev middleware or static production build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NavaBazaar server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  stopPythonBackend();
  process.exit(1);
});
