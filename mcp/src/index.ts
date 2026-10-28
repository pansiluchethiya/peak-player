import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Peak MCP Server — stdio transport, read-only repository access.
 *
 * Tools:
 *   read_file(path)         — Read any file in the repo
 *   list_files(path, recursive) — List directory contents
 *   search_code(query)      — Grep across the codebase
 *   get_docs(page)          — Return AI docs for a specific page
 *   get_provider_info(provider) — Return provider metadata
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §7.3
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..', '..');

// AI docs live at docs/content/docs/ai/
const AI_DOCS_DIR = path.join(REPO_ROOT, 'docs', 'content', 'docs', 'ai');

// Provider metadata from providers/rive.js
const PROVIDER_MAP: Record<string, { label: string; codename: string; id: string }> = {
  apogee: { label: 'Apogee', codename: 'PRIME', id: 'rive apogee' },
  vanguard: { label: 'Vanguard', codename: 'STELLAR', id: 'rive vanguard' },
  pulse: { label: 'Pulse', codename: 'NEXUS', id: 'rive pulse' },
  citadel: { label: 'Citadel', codename: 'ORBIT', id: 'rive citadel' },
  netmirror: { label: 'NetMirror', codename: 'NOVA', id: 'netmirror' },
  vixsrc: { label: 'VixSrc', codename: 'VESPER', id: 'vixsrc' },
  vidlink: { label: 'VidLink', codename: 'ORION', id: 'vidlink' },
  videasy: { label: 'Videasy', codename: 'LYRA', id: 'videasy' },
  zxcstreams: { label: 'ZXCStreams', codename: 'KESTREL', id: 'zxcstreams' },
  vaplayer: { label: 'VaPlayer', codename: 'HALCYON', id: 'vaplayer' },
  showbox: { label: 'ShowBox', codename: 'MERIDIAN', id: 'showbox' },
  '4khdhub': { label: '4KHDHub', codename: 'ATLAS', id: '4khdhub' },
  castletv: { label: 'CastleTV', codename: 'CITADEL', id: 'castletv' },
  dahmermovies: { label: 'DahmerMovies', codename: 'DUNE', id: 'dahmermovies' },
  hdghartv: { label: 'HDGharTV', codename: 'HELIOS', id: 'hdghartv' },
  onetouchtv: { label: 'OneTouchTV', codename: 'ONYX', id: 'onetouchtv' },
  streamflix: { label: 'StreamFlix', codename: 'NOCTIS', id: 'streamflix' },
};

function safeReadFile(filePath: string): string | null {
  try {
    const resolved = path.resolve(REPO_ROOT, filePath);
    // Prevent path traversal outside the repo
    if (!resolved.startsWith(REPO_ROOT)) {
      return null;
    }
    if (!fs.existsSync(resolved)) {
      return null;
    }
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}

function safeListFiles(dirPath: string, recursive: boolean = false): string[] | null {
  try {
    const resolved = path.resolve(REPO_ROOT, dirPath);
    if (!resolved.startsWith(REPO_ROOT)) {
      return null;
    }
    if (!fs.existsSync(resolved)) {
      return null;
    }
    if (!fs.statSync(resolved).isDirectory()) {
      return null;
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    if (!recursive) {
      return entries.map((entry) => entry.name);
    }
    const results: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      const relPath = path.relative(REPO_ROOT, fullPath);
      results.push(relPath);
      if (entry.isDirectory()) {
        const sub = safeListFiles(relPath, true);
        if (sub) results.push(...sub);
      }
    }
    return results;
  } catch {
    return null;
  }
}

function searchCode(query: string): string[] {
  // Simple recursive file content search — does not follow symlinks
  // Skips common large dirs
  const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__']);
  const results: string[] = [];

  function walk(dir: string, depth: number = 0) {
    if (depth > 4 || results.length > 100) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(REPO_ROOT, fullPath);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|json|mdx?|css|html|toml|yaml|yml)$/i.test(entry.name)) {
        // Quick content match
        const content = safeReadFile(relPath);
        if (content && content.toLowerCase().includes(query.toLowerCase())) {
          results.push(relPath);
        }
      }
    }
  }

  walk(REPO_ROOT);
  return results.slice(0, 20);
}

function getAiDocs(page: string): string | null {
  // Map page name to AI docs file (without .mdx extension)
  const candidates = [
    page,
    `guides/${page}`,
    `reference/${page}`,
  ];

  for (const candidate of candidates) {
    const filePath = path.join(AI_DOCS_DIR, `${candidate}.mdx`);
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(AI_DOCS_DIR) && fs.existsSync(resolved)) {
      return fs.readFileSync(resolved, 'utf-8');
    }
  }

  // Return list of available AI docs pages
  const dir = safeListFiles('docs/content/docs/ai', false);
  if (dir) {
    return `Available AI docs pages:\n` + dir.map((f) => f.replace('.mdx', '')).join('\n');
  }
  return 'AI docs directory not found. Check docs/content/docs/ai/';
}

// --- Server setup ---

const server = new Server(
  {
    name: 'peak-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_file',
        description: 'Read any file in the Peak repository (full read access).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to repo root, e.g. "utils/config.js"' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_files',
        description: 'List directory contents, optionally recursively.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to repo root' },
            recursive: { type: 'boolean', description: 'List recursively' },
          },
          required: ['path'],
        },
      },
      {
        name: 'search_code',
        description: 'Search for a string across the codebase.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_docs',
        description: 'Return AI-optimized documentation for a specific page.',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'string', description: 'Page name (e.g. "quickstart", "concepts", "guides/embedding")' },
          },
          required: ['page'],
        },
      },
      {
        name: 'get_provider_info',
        description: 'Return provider metadata (codename, label, technical id).',
        inputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Provider id (e.g. "rive apogee", "netmirror")' },
          },
          required: ['provider'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'read_file': {
        const filePath = args?.path as string;
        if (!filePath) throw new Error('path is required');
        const content = safeReadFile(filePath);
        if (content === null) throw new Error(`File not found or outside repo: ${filePath}`);
        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'list_files': {
        const dirPath = args?.path as string;
        if (!dirPath) throw new Error('path is required');
        const recursive = args?.recursive as boolean | undefined;
        const files = safeListFiles(dirPath, recursive);
        if (files === null) throw new Error(`Directory not found or outside repo: ${dirPath}`);
        return {
          content: [{ type: 'text', text: files.join('\n') }],
        };
      }

      case 'search_code': {
        const query = args?.query as string;
        if (!query) throw new Error('query is required');
        const results = searchCode(query);
        return {
          content: [{ type: 'text', text: `Found ${results.length} results for "${query}":\n\n${results.join('\n')}` }],
        };
      }

      case 'get_docs': {
        const page = args?.page as string;
        if (!page) throw new Error('page is required');
        const content = getAiDocs(page);
        if (content === null) throw new Error(`AI docs page not found: ${page}`);
        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'get_provider_info': {
        const provider = (args?.provider as string || '').toLowerCase().trim();
        const info = PROVIDER_MAP[provider];
        if (!info) throw new Error(`Unknown provider: ${provider}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ id: info.id, label: info.label, codename: info.codename }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
