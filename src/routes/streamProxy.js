const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const router = express.Router();

/**
 * HLS Stream Proxy
 *
 * Solves "mixed content" errors when the website is HTTPS but stream URLs are HTTP.
 * Fetches the stream content server-side and pipes it to the client over HTTPS.
 *
 * Usage:  /api/stream-proxy?url=http://example.com/live/stream.m3u8
 *
 * The proxy also rewrites .m3u8 playlists so that any internal HTTP URLs
 * are also routed through this proxy, ensuring all segments load over HTTPS.
 */

// Allowed stream file extensions
const ALLOWED_EXTENSIONS = ['.m3u8', '.ts', '.aac', '.mp4', '.key', '.vtt'];
const MAX_REDIRECTS = 5;

// Helper: set CORS headers on every response
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
}

/**
 * Fetch a URL following redirects (301, 302, 303, 307, 308) up to MAX_REDIRECTS.
 * Calls callback(error, finalResponse, finalUrl) when done.
 */
function fetchWithRedirects(targetUrl, redirectCount, callback) {
  if (redirectCount > MAX_REDIRECTS) {
    return callback(new Error('Too many redirects'));
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return callback(new Error('Invalid redirect URL'));
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const req = client.get(
    targetUrl,
    {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    },
    (response) => {
      // Follow redirects
      if (
        [301, 302, 303, 307, 308].includes(response.statusCode) &&
        response.headers.location
      ) {
        // Consume the redirect response body
        response.resume();

        // Resolve relative redirect URLs
        let redirectUrl;
        try {
          redirectUrl = new URL(response.headers.location, targetUrl).href;
        } catch {
          return callback(new Error('Invalid redirect location'));
        }

        return fetchWithRedirects(redirectUrl, redirectCount + 1, callback);
      }

      callback(null, response, targetUrl);
    }
  );

  req.on('error', (err) => callback(err));
  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Connection timeout'));
  });
}

// Handle preflight OPTIONS
router.options('/', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});

router.get('/', (req, res) => {
  // Always set CORS headers first, so even error responses include them
  setCorsHeaders(res);

  const streamUrl = req.query.url;

  if (!streamUrl) {
    return res.status(400).json({ success: false, message: 'Missing url parameter' });
  }

  // Basic validation
  let parsed;
  try {
    parsed = new URL(streamUrl);
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid URL' });
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ success: false, message: 'Only HTTP/HTTPS URLs allowed' });
  }

  // Check extension
  const pathname = parsed.pathname.toLowerCase();
  const hasKnownExt = ALLOWED_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  if (!hasKnownExt && pathname.includes('.') && !pathname.endsWith('/')) {
    const ext = pathname.split('.').pop();
    if (ext && ext.length > 5) {
      return res.status(400).json({ success: false, message: 'File type not allowed' });
    }
  }

  // Fetch the stream, following any redirects
  fetchWithRedirects(streamUrl, 0, (err, proxyRes, finalUrl) => {
    if (err) {
      console.error('Stream proxy error:', err.message);
      if (!res.headersSent) {
        const status = err.message.includes('timeout') ? 504 : 502;
        return res.status(status).json({ success: false, message: err.message });
      }
      return;
    }

    if (proxyRes.statusCode !== 200) {
      proxyRes.resume();
      return res.status(proxyRes.statusCode).json({
        success: false,
        message: `Upstream returned ${proxyRes.statusCode}`,
      });
    }

    // Use the final URL (after redirects) for resolving relative paths
    const finalParsed = new URL(finalUrl);
    const finalPathname = finalParsed.pathname.toLowerCase();

    const contentType = proxyRes.headers['content-type'] || '';
    const isPlaylist =
      finalPathname.endsWith('.m3u8') ||
      pathname.endsWith('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8');

    if (isPlaylist) {
      // For .m3u8 playlists: read the full content, rewrite internal URLs
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8');

        // Build the base URL for resolving relative paths (use final redirected URL)
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

        // Build proxy base URL — always use HTTPS in production
        const host = req.get('host') || '';
        const proto =
          req.protocol === 'https' || host.includes('i-nettz.site')
            ? 'https'
            : req.protocol;
        const proxyBase = `${proto}://${host}/api/stream-proxy?url=`;

        // Rewrite absolute HTTP/HTTPS URLs in the playlist
        body = body.replace(/(https?:\/\/[^\s\r\n]+)/g, (match) => {
          return proxyBase + encodeURIComponent(match);
        });

        // Rewrite relative paths (lines that don't start with # and aren't already proxied)
        body = body
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (
              trimmed &&
              !trimmed.startsWith('#') &&
              !trimmed.startsWith('http') &&
              !trimmed.includes('stream-proxy')
            ) {
              // Resolve relative URL against the base
              const absoluteUrl = new URL(trimmed, baseUrl).href;
              return proxyBase + encodeURIComponent(absoluteUrl);
            }
            return line;
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        res.send(body);
      });
      proxyRes.on('error', (err) => {
        console.error('Stream proxy read error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: 'Error reading stream' });
        }
      });
    } else {
      // For .ts segments and other binary content: pipe directly
      res.setHeader(
        'Content-Type',
        proxyRes.headers['content-type'] || 'video/mp2t'
      );
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      proxyRes.pipe(res);
    }
  });
});

module.exports = router;
