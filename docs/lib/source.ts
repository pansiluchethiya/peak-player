import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

// fumadocs-mdx 11.10.1 exposes the generated files as a resolver. The core
// loader in 15.8.5 expects the resolved array, so resolve once at module load.
const generated = docs.toFumadocsSource();
type GeneratedFile = (typeof generated.files)[number];

// fumadocs-mdx 11.10.1 returns `files` as a resolver at runtime, while its
// published types describe the resolved array expected by fumadocs-core 15.
const resolveFiles = generated.files as unknown as () => GeneratedFile[];

export const source = loader({
  baseUrl: '/docs',
  source: { files: resolveFiles() },
});
