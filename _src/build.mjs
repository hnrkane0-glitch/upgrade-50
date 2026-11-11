import { build } from 'esbuild';
const common = { bundle: true, minify: true, format: 'iife', jsx: 'automatic', target: ['es2019'], define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.jsx': 'jsx' }, logLevel: 'error' };
for (const n of process.argv.slice(2)) {
  await build({ ...common, entryPoints: [`src/${n}.jsx`], outfile: `../assets/${n}.js` });
  console.log('built', n);
}
