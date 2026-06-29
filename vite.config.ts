import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

function loginRouteRedirect() {
  const redirectLogin = (
    request: { url?: string },
    response: { statusCode: number; setHeader(name: string, value: string): void; end(): void },
    next: () => void,
  ) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname.endsWith('/login') || url.pathname.endsWith('/nova')) {
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
  base: '/AIPEOPLE/',
  plugins: [loginRouteRedirect(), react()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login/index.html'),
        nova: resolve(__dirname, 'nova.html')
      }
    }
  }
});
