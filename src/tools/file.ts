import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

export function registerFileTools(server: McpServer, client: ConduitClient) {
  // Upload a file
  server.tool(
    'phabricator_file_upload',
    'Upload a file to Phabricator. Returns a file PHID that can be used with phabricator_file_info to get the file ID for embedding in Remarkup via {F<id>}.',
    {
      name: z.string().optional().describe('Filename with extension (e.g. "screenshot.png")'),
      data_base64: z.string().describe('Base64-encoded file content'),
      viewPolicy: z.string().optional().describe('File visibility policy (e.g., "public", "users", or a custom policy PHID)'),
      canCDN: z.boolean().optional().describe('Whether the file can be served over CDN (for public assets)'),
    },
    async (params) => {
      const apiParams: Record<string, unknown> = {
        data_base64: params.data_base64,
      };
      if (params.name !== undefined) {
        apiParams.name = params.name;
      }
      if (params.viewPolicy !== undefined) {
        apiParams.viewPolicy = params.viewPolicy;
      }
      if (params.canCDN !== undefined) {
        apiParams.canCDN = params.canCDN;
      }
      const phid = await client.call<string>('file.upload', apiParams);
      return { content: [{ type: 'text', text: phid }] };
    },
  );

  // Search files
  server.tool(
    'phabricator_file_search',
    'Search for files in Phabricator',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "authored"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('File IDs'),
        phids: z.array(z.string()).optional().describe('File PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        name: z.string().optional().describe('File name substring search'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        explicit: z.boolean().optional().describe('Filter to explicitly uploaded files only'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        subscribers: z.boolean().optional().describe('Include subscriber details'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('file.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Get file info
  server.tool(
    'phabricator_file_info',
    'Get metadata about a file (name, size, MIME type, URI). Provide at least one of id or phid. Use phabricator_file_download to save the actual file contents to disk on the local machine (the MCP server writes the file and returns the path).',
    {
      id: z.coerce.number().optional().describe('File ID (provide this or phid)'),
      phid: z.string().optional().describe('File PHID (provide this or id)'),
    },
    async (params) => {
      const result = await client.call('file.info', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Download file contents to local disk
  server.tool(
    'phabricator_file_download',
    'Download a file attachment (by id or phid) and save it to the local filesystem. The server fetches the content (via Conduit file.download or fallback to the secret dataURI) and writes the raw bytes to disk. Returns metadata + the absolute local path where the file was saved. The agent can control the destination with output_path. Supports byteLimit to avoid huge files.',
    {
      id: z.coerce.number().optional().describe('File ID (provide this or phid)'),
      phid: z.string().optional().describe('File PHID (provide this or id)'),
      byteLimit: z.coerce.number().optional().describe('If the file is larger than this (in bytes), skip the download and return tooHuge:true instead of writing anything.'),
      timeout: z.coerce.number().optional().describe('Timeout in seconds for the HTTP fallback fetch.'),
      output_path: z.string().optional().describe('Desired output file path or directory on the local machine. If this points to an existing directory, the original filename from Phabricator will be appended. If omitted, the file is saved to a temp directory (OS temp + phabricator-downloads/).'),
      overwrite: z.boolean().optional().describe('Allow overwriting an existing file at the target path. Default: false (error if file already exists).'),
    },
    async (params) => {
      if (!params.id && !params.phid) {
        throw new Error('Provide either "id" or "phid"');
      }

      // Always fetch metadata first (file.info accepts id or phid)
      const info = await client.call<any>('file.info', {
        id: params.id,
        phid: params.phid,
      });
      const phid: string = info.phid;
      const originalName: string = info.name || `phab-file-${phid}`;

      // Compute target path on disk
      let targetPath: string;
      if (params.output_path) {
        const provided = resolve(params.output_path);
        let isDir = false;
        try {
          const s = await stat(provided);
          isDir = s.isDirectory();
        } catch {
          // does not exist — treat the provided string as the intended file path
        }
        if (isDir) {
          targetPath = join(provided, originalName);
        } else {
          targetPath = provided;
        }
      } else {
        const dir = join(tmpdir(), 'phabricator-downloads');
        await mkdir(dir, { recursive: true });
        targetPath = join(dir, originalName);
      }

      // Ensure parent directory exists
      await mkdir(dirname(targetPath), { recursive: true });

      // Check for existing file (unless overwrite)
      if (!params.overwrite) {
        try {
          await stat(targetPath);
          throw new Error(`File already exists at ${targetPath}. Pass overwrite: true to replace it.`);
        } catch (err: any) {
          if (err.code && err.code !== 'ENOENT') {
            throw err;
          }
          // ENOENT or other non-existence → OK to proceed
        }
      }

      const byteSize = parseInt(String(info.byteSize ?? '0'), 10);
      if (params.byteLimit != null && byteSize > params.byteLimit) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...info,
              tooHuge: true,
              path: targetPath,
              note: 'File exceeds byteLimit — nothing was written to disk.',
            }, null, 2),
          }],
        };
      }

      // Download the raw bytes (primary = Conduit file.download, fallback = HTTP dataURI)
      let fileBuffer: Buffer;

      try {
        // Primary path: Conduit file.download returns a base64 string (as used by the upload symmetry and arc call-conduit)
        const data = await client.call<string>('file.download', { phid });
        fileBuffer = Buffer.from(data, 'base64');
      } catch {
        // Fallback: obtain capability dataURI via search, then plain fetch (the hash in the URL is the authorization)
        const searchResult: any = await client.call('file.search', {
          constraints: { phids: [phid] },
          limit: 1,
        });
        const dataURI: string | undefined = searchResult?.data?.[0]?.fields?.dataURI;

        if (!dataURI) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ...info,
                downloadError: 'file.download failed and no dataURI available for fallback',
                attempted_path: targetPath,
              }, null, 2),
            }],
          };
        }

        const controller = params.timeout != null ? new AbortController() : undefined;
        let timer: NodeJS.Timeout | undefined;
        if (controller && params.timeout != null) {
          timer = setTimeout(() => controller.abort(), params.timeout * 1000);
        }

        try {
          const init: RequestInit | undefined = controller ? { signal: controller.signal } : undefined;
          const resp = await fetch(dataURI, init);
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} while fetching dataURI`);
          }
          const buf = await resp.arrayBuffer();
          fileBuffer = Buffer.from(buf);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      // Write the raw bytes to disk
      await writeFile(targetPath, fileBuffer);

      const result = {
        ...info,
        path: targetPath,
        // Include the size we actually wrote in case it differs slightly from reported
        downloadedBytes: fileBuffer.length,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
