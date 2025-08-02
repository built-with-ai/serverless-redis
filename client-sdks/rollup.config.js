/**
 * Shared Rollup configuration for all SDK packages
 */
import typescript from 'rollup-plugin-typescript2';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Get package.json for the current package
const packageDir = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'));

const external = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {}),
  // Common externals
  'aws-lambda',
  '@vercel/edge',
  '@cloudflare/workers-types',
  'next',
  'react',
];

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: packageJson.module || 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: './tsconfig.json',
        tsconfigOverride: {
          compilerOptions: {
            declaration: false,
            declarationMap: false,
          },
        },
      }),
    ],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: packageJson.main || 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    external,
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: './tsconfig.json',
        tsconfigOverride: {
          compilerOptions: {
            declaration: true,
            declarationMap: true,
            outDir: './dist',
          },
        },
      }),
    ],
  },
];