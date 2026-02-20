const http = require('http');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

const clients = new Set();

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { links: {}, events: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      links: parsed.links || {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch (error) {
    return { links: {}, events: [] };
  }
}

const persisted = loadData();
const links = new Map(Object.entries(persisted.links));
const events = persisted.events;

function saveData() {
  const linksObj = Object.fromEntries(links.entries());
  const next = JSON.stringify({ links: linksObj, events }, null, 2);
  fs.writeFileSync(DATA_FILE, next);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath, contentType = 'text/html') {
  const fullPath = path.join(__dirname, 'public', filePath);
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function requestOrigin(req, parsed) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const protocol = forwardedProto || parsed.protocol.replace(':', '');
  const host = forwardedHost || req.headers.host;
  return `${protocol}://${host}`;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if ((req.method === 'GET' || req.method === 'HEAD') && parsed.pathname === '/') {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end();
      return;
    }
    serveFile(res, 'index.html');
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/styles.css') {
    serveFile(res, 'styles.css', 'text/css');
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/app.js') {
    serveFile(res, 'app.js', 'application/javascript');
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/links') {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const slug = `/visit/${id}`;
    const linkData = { id, slug, createdAt };
    links.set(id, linkData);
    saveData();

    sendJson(res, 201, {
      ...linkData,
      fullUrl: `${requestOrigin(req, parsed)}${slug}`,
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/events') {
    sendJson(res, 200, events);
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname.startsWith('/visit/')) {
    const id = parsed.pathname.replace('/visit/', '');
    if (!links.has(id)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Invalid link');
      return;
    }
    serveFile(res, 'visit.html');
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/visit') {
    try {
      const body = await parseBody(req);
      if (!body.linkId || !links.has(body.linkId)) {
        sendJson(res, 400, { error: 'Invalid link id' });
        return;
      }

      const event = {
        id: randomUUID(),
        linkId: body.linkId,
        timestamp: new Date().toISOString(),
        userAgent: body.userAgent || 'Unknown',
        platform: body.platform || 'Unknown',
        language: body.language || 'Unknown',
        screen: body.screen || 'Unknown',
      };
      events.unshift(event);
      saveData();
      broadcast(event);
      sendJson(res, 201, { ok: true });
      return;
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
