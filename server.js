// Локальный сервер разработки: отдаёт сайт и тестовый API остатков.
// Не содержит паролей и не открывает доступ к 1С из интернета.
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 8787);
const inventory = [
  { article: 'neva-4511e', available: 5, updatedAt: '2026-08-24T00:00:00Z' }
];

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true });
  if (requestUrl.pathname === '/api/inventory') return sendJson(response, 200, { items: inventory });

  const relativePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.resolve(rootDir, `.${relativePath}`);
  if (!filePath.startsWith(rootDir)) return response.end('Not found');

  // Как на боевом сервере: если файла с таким именем нет, а есть файл
  // с добавленным .html — отдаём его (адреса вида /catalog без расширения).
  const candidates = path.extname(filePath) ? [filePath] : [filePath, `${filePath}.html`];

  const tryNext = (i) => {
    if (i >= candidates.length) {
      response.writeHead(404);
      return response.end('Not found');
    }
    fs.readFile(candidates[i], (error, data) => {
      if (error) return tryNext(i + 1);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(candidates[i])] || 'application/octet-stream' });
      response.end(data);
    });
  };
  tryNext(0);
}).listen(port, () => console.log(`ПРОГАЗ: http://localhost:${port}`));
