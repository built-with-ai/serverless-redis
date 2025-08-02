import typescript from 'rollup-plugin-typescript2';

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
    },
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: 'tsconfig.json',
        clean: true,
      }),
    ],
    external: ['http', 'https', 'url', 'util'],
  },
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
    },
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: 'tsconfig.json',
        clean: false,
      }),
    ],
    external: ['http', 'https', 'url', 'util'],
  },
];