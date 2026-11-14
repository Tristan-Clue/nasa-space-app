import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' so the build works from any folder or GitHub Pages sub-path.
// singlefile inlines JS + CSS into one index.html that can be opened by double-click.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
