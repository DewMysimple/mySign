// Isolated DESIGN server. Shares the actual App/Controller/renderer, swaps only
// the two JSON imports at dev transform time. No product UI or shipped selector.
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
const variant=process.argv[2], port=Number(process.argv[3]||5174);
if (!['a','b','standard','prototype'].includes(variant)) throw new Error('Specify a, b, standard, or prototype');
const directory=variant==='prototype'?'v0.1.0':`v0.2.0/candidates/${variant}`;
const server=await createServer({
  server:{host:'127.0.0.1',port,strictPort:true},
  plugins:[{name:'offline-two-glyph-study',enforce:'pre',async load(id){
    if (!id.replaceAll('\\','/').endsWith('/src/handwriting/xingshuRegistry.js')) return;
    if (variant==='standard') return 'export const XINGSHU_CHARACTERS=[];export const XINGSHU_VERSION="standard-1.1.0";export const getPrototypeGlyph=()=>undefined;';
    const code=await readFile('src/handwriting/xingshuRegistry.js','utf8');
    return code.replace(/\.\.\/\.\.\/data\/xingshu\/[^']+\/(ni|hao)\.json/g,`../../data/xingshu/${directory}/$1.json`);
  }}]
});
await server.listen();server.printUrls();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
