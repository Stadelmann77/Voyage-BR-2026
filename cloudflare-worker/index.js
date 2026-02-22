/**
 * Cloudflare Worker — Voyage BR 2026 Admin Backend
 *
 * Endpoints:
 *   GET  /auth/github          → redirect to GitHub OAuth
 *   GET  /auth/callback        → exchange code for token, return session
 *   POST /api/commit           → create a commit via GitHub API (admin only)
 *   GET  /api/me               → return authenticated user info
 *   OPTIONS *                  → CORS preflight
 *
 * Required Cloudflare Worker secrets (set via wrangler secret put):
 *   GITHUB_CLIENT_ID     — GitHub OAuth App client ID
 *   GITHUB_CLIENT_SECRET — GitHub OAuth App client secret
 *   JWT_SECRET           — Secret for signing session JWTs (min 32 chars)
 *
 * Required Cloudflare Worker variables (wrangler.toml [vars]):
 *   REPO_OWNER           — "Stadelmann77"
 *   REPO_NAME            — "Voyage-BR-2026"
 *   ALLOWED_GITHUB_LOGIN — "Stadelmann77"
 *   SITE_URL             — e.g. "https://stadelmann77.github.io/Voyage-BR-2026"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── JWT helpers (HS256, using Web Crypto) ────────────────────────────────────
async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = v => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const arr = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const sigB64 = btoa(binary)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sigB64}`;
}

async function verifyJwt(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// ── Request helpers ───────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const path = url.pathname;

    // ── GET /auth/github ──────────────────────────────────────────────────────
    if (path === '/auth/github' && request.method === 'GET') {
      // Sign state as a short-lived JWT to prevent CSRF (valid 10 minutes)
      const statePayload = {
        nonce: crypto.randomUUID(),
        exp: Math.floor(Date.now() / 1000) + 600,
      };
      const signedState = await signJwt(statePayload, env.JWT_SECRET);
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${new URL(request.url).origin}/auth/callback`,
        scope: 'repo',
        state: signedState,
      });
      return redirect(`https://github.com/login/oauth/authorize?${params}`);
    }

    // ── GET /auth/callback ────────────────────────────────────────────────────
    if (path === '/auth/callback' && request.method === 'GET') {
      const code  = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code)  return json({ error: 'Missing code' }, 400);
      if (!state) return json({ error: 'Missing state' }, 400);

      // Verify state to prevent CSRF
      const statePayload = await verifyJwt(state, env.JWT_SECRET);
      if (!statePayload || !statePayload.nonce) {
        return json({ error: 'Invalid or expired state — possible CSRF attack' }, 403);
      }

      // Exchange code for GitHub access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${new URL(request.url).origin}/auth/callback`,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return json({ error: 'OAuth failed', detail: tokenData }, 401);

      // Get GitHub user
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'User-Agent': 'Voyage-BR-2026-Worker/1.0',
        },
      });
      const ghUser = await userRes.json();

      // Enforce allowed user
      if (ghUser.login !== env.ALLOWED_GITHUB_LOGIN) {
        return json({ error: 'Unauthorized: only the repository owner can access admin mode.' }, 403);
      }

      // Issue JWT session (valid 8 hours)
      const payload = {
        login: ghUser.login,
        name: ghUser.name || ghUser.login,
        avatar_url: ghUser.avatar_url,
        gh_token: tokenData.access_token,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 8 * 3600,
      };
      const jwt = await signJwt(payload, env.JWT_SECRET);

      // Redirect back to site with token in hash (never in query string)
      const siteUrl = env.SITE_URL || 'https://stadelmann77.github.io/Voyage-BR-2026';
      return redirect(`${siteUrl}/admin.html#admin_token=${jwt}`);
    }

    // ── Authenticated endpoints ───────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const jwtToken = authHeader.replace(/^Bearer\s+/, '');
    const session = jwtToken ? await verifyJwt(jwtToken, env.JWT_SECRET) : null;

    // ── GET /api/me ───────────────────────────────────────────────────────────
    if (path === '/api/me' && request.method === 'GET') {
      if (!session) return json({ error: 'Unauthorized' }, 401);
      return json({ login: session.login, name: session.name, avatar_url: session.avatar_url });
    }

    // ── POST /api/commit ──────────────────────────────────────────────────────
    if (path === '/api/commit' && request.method === 'POST') {
      if (!session) return json({ error: 'Unauthorized' }, 401);

      let body;
      try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

      const { message, files, branch = 'main', create_pr = false, pr_title } = body;
      if (!message || !Array.isArray(files) || files.length === 0) {
        return json({ error: 'message and files[] required' }, 400);
      }

      const owner = env.REPO_OWNER;
      const repo = env.REPO_NAME;
      const ghToken = session.gh_token;
      const headers = {
        'Authorization': `token ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Voyage-BR-2026-Worker/1.0',
        'Content-Type': 'application/json',
      };

      try {
        // Get current branch SHA
        const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { headers });
        if (!branchRes.ok) return json({ error: `Branch ${branch} not found` }, 404);
        const branchData = await branchRes.json();
        const baseSha = branchData.commit.sha;
        const baseTreeSha = branchData.commit.commit.tree.sha;

        // Create blobs for each file
        const treeItems = await Promise.all(files.map(async f => {
          if (!f.path || f.content == null) throw new Error(`File entry missing path or content`);
          const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST', headers,
            body: JSON.stringify({ content: f.content, encoding: 'utf-8' }),
          });
          if (!blobRes.ok) throw new Error(`Blob creation failed for ${f.path}`);
          const blob = await blobRes.json();
          return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
        }));

        // Create tree
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
          method: 'POST', headers,
          body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
        });
        if (!treeRes.ok) return json({ error: 'Tree creation failed' }, 500);
        const tree = await treeRes.json();

        // Create commit
        const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
          method: 'POST', headers,
          body: JSON.stringify({
            message,
            tree: tree.sha,
            parents: [baseSha],
            author: { name: session.name || session.login, email: `${session.login}@users.noreply.github.com` },
          }),
        });
        if (!commitRes.ok) return json({ error: 'Commit creation failed' }, 500);
        const commit = await commitRes.json();

        if (create_pr) {
          // Push to a new branch and open PR
          const newBranch = `admin/${Date.now()}`;
          await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
            method: 'POST', headers,
            body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: commit.sha }),
          });
          const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: 'POST', headers,
            body: JSON.stringify({
              title: pr_title || message,
              head: newBranch,
              base: branch,
              body: `Admin change via Voyage BR 2026 Admin Panel\n\nAuthor: ${session.login}`,
            }),
          });
          const pr = await prRes.json();
          return json({ success: true, commit_sha: commit.sha, pr_url: pr.html_url, pr_number: pr.number });
        } else {
          // Push directly to branch
          const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ sha: commit.sha, force: false }),
          });
          if (!refRes.ok) return json({ error: 'Ref update failed' }, 500);
          return json({ success: true, commit_sha: commit.sha, commit_url: commit.html_url });
        }
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
