import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    esbuild: {
        // Force local TS config to avoid esbuild walking to a broken parent tsconfig.
        tsconfigRaw: {
            compilerOptions: {
                target: 'ESNext',
                module: 'ESNext',
                moduleResolution: 'Bundler',
                jsx: 'automatic',
                useDefineForClassFields: true,
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
            },
        },
    },
        optimizeDeps: {
            esbuildOptions: {
                tsconfigRaw: {
                    compilerOptions: {
                        target: 'ESNext',
                        module: 'ESNext',
                        moduleResolution: 'Bundler',
                        jsx: 'automatic',
                        useDefineForClassFields: true,
                        allowImportingTsExtensions: true,
                        resolveJsonModule: true,
                        isolatedModules: true,
                    },
                },
            },
        },
});
