import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [{
      name: 'static-pages',
      apply: 'serve',
      transformIndexHtml: async (html, context) => {
        const { renderDocument } = await import('./src/document.tsx');
        const { routes } = await import('./src/content/meta.ts');
        const path = (context.originalUrl ?? context.path).split('?')[0].replace(/\/?$/, '/');
        return renderDocument(html, Object.hasOwn(routes, path) ? path as keyof typeof routes : '/404');
      },
    }],
    server: { port: 4321, strictPort: true },
    preview: { port: 4321, strictPort: true },
    build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 2048 },
    esbuild: { jsx: 'automatic' },
  };
});
