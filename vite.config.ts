import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const repoBase = process.env.VITE_BASE_PATH
  ?? (process.env.GITHUB_ACTIONS ? '/AIPEOPLE/' : '/');

function loginRouteRedirect() {
  const redirectLogin = (
    request: { url?: string },
    response: { statusCode: number; setHeader(name: string, value: string): void; end(): void },
    next: () => void,
  ) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname.endsWith('/login')) {
      response.statusCode = 302;
      response.setHeader('Location', `${url.pathname}/${url.search}`);
      response.end();
      return;
    }

    next();
  };

  return {
    name: 'login-route-redirect',
    configureServer(server: { middlewares: { use(handler: typeof redirectLogin): void } }) {
      server.middlewares.use(redirectLogin);
    },
    configurePreviewServer(server: { middlewares: { use(handler: typeof redirectLogin): void } }) {
      server.middlewares.use(redirectLogin);
    },
  };
}

export default defineConfig({
  base: repoBase,
  plugins: [loginRouteRedirect(), react()],
  build: {
    // We will build into a dist folder first
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login/index.html')
      }
    }
  }
});
