/**
 * Shared Rollup configuration for all SDK packages
 */
const typescript = require('rollup-plugin-typescript2');
const { readFileSync } = require('fs');
const { resolve } = require('path');

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

module.exports = [
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
        tsconfigOverride: {
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM'],
            module: 'ESNext',
            moduleResolution: 'node',
            declaration: false,
            declarationMap: false,
            outDir: './dist',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            allowSyntheticDefaultImports: true,
            composite: false,
          },
          exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*'],
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
        tsconfigOverride: {
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM'],
            module: 'ESNext',
            moduleResolution: 'node',
            declaration: true,
            declarationMap: true,
            outDir: './dist',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            allowSyntheticDefaultImports: true,
            composite: false,
          },
          exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*'],
        },
      }),
    ],
  },
];