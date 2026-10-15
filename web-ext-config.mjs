export default {
  ignoreFiles: [
    'tests',
    'scripts',
    'docs',
    '.github',
    'package.json',
    'package-lock.json',
    'web-ext-config.mjs',
    'README.md',
    'LICENSE',
    'web-ext-artifacts',
    'node_modules',
  ],
  build: { overwriteDest: true },
  run: { startUrl: ['https://www.kuantokusta.pt/p/3422263/itf-farma-natalben-lactacao-60-capsulas'] },
};
