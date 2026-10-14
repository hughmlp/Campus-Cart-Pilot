// Run: node --experimental-test-module-mocks --test test/clerk-proxy.test.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mock, test } from 'node:test';

let proxy;
let options;
mock.module('httpxy', {
  namedExports: {
    createProxyServer(config) {
      options = config;
      proxy = new EventEmitter();
      proxy.web = async () => {};
      return proxy;
    },
  },
});
const { clerkProxyMiddleware } = await import('../src/middlewares/clerkProxyMiddleware.ts');

function response() {
  const res = new PassThrough();
  res.body = [];
  res.on('data', chunk => res.body.push(chunk));
  res.headersSent = false;
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
    res.headersSent = true;
  };
  return res;
}

test('proxy retains routing, headers, response framing, and error handling', async t => {
  // Synthetic test credentials only. No actual environment secret is read.
  const originalEnv = process.env;
  process.env = { NODE_ENV: 'production', CLERK_SECRET_KEY: 'synthetic-test-key' };
  t.after(() => { process.env = originalEnv; });
  const middleware = clerkProxyMiddleware();
  assert.equal(options.target, 'https://frontend-api.clerk.dev');
  assert.equal(options.changeOrigin, true);
  assert.equal(options.selfHandleResponse, true);

  for (const url of ['/api/__clerk/v1/client?x=1', '/v1/client?x=1']) {
    const req = { url, method: 'POST' };
    let forwarded;
    proxy.web = async request => { forwarded = request; };
    middleware(req, response());
    assert.equal(forwarded, req);
    assert.equal(forwarded.url, '/v1/client?x=1');
    assert.equal(forwarded.method, 'POST');
  }

  const headers = {};
  proxy.emit('proxyReq', { setHeader: (k, v) => { headers[k] = v; } }, {
    headers: {
      'x-forwarded-host': 'campus.example, internal.example',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '192.0.2.1, 192.0.2.2',
    },
  });
  assert.equal(headers['Clerk-Proxy-Url'], 'https://campus.example/api/__clerk');
  assert.equal(headers['Clerk-Secret-Key'], 'synthetic-test-key');
  assert.equal(headers['X-Forwarded-For'], '192.0.2.1');

  const upstream = new PassThrough();
  upstream.statusCode = 200;
  upstream.headers = {
    'transfer-encoding': 'chunked', connection: 'keep-alive',
    'content-encoding': 'gzip', 'set-cookie': ['a=b', 'c=d'],
  };
  const buffered = response();
  proxy.emit('proxyRes', upstream, { method: 'GET' }, buffered);
  upstream.end(Buffer.from([1, 2, 3]));
  await new Promise(resolve => buffered.on('finish', resolve));
  assert.equal(buffered.headers['content-length'], '3');
  assert.equal(buffered.headers['transfer-encoding'], undefined);
  assert.equal(buffered.headers.connection, undefined);
  assert.equal(buffered.headers['content-encoding'], 'gzip');
  assert.deepEqual(buffered.headers['set-cookie'], ['a=b', 'c=d']);
  assert.deepEqual(Buffer.concat(buffered.body), Buffer.from([1, 2, 3]));

  for (const [method, status, length] of [
    ['GET', 200, '3'], ['HEAD', 200, '3'], ['GET', 204, '99'], ['GET', 304, '3'],
  ]) {
    const source = new PassThrough();
    source.statusCode = status;
    source.headers = { 'content-length': length };
    const res = response();
    proxy.emit('proxyRes', source, { method }, res);
    assert.equal(res.headersSent, true);
    assert.equal(res.statusCode, status);
    assert.equal(res.headers['content-length'], status === 204 ? undefined : length);
    source.end();
  }

  const failedUpstream = new PassThrough();
  failedUpstream.statusCode = 200;
  failedUpstream.headers = {};
  const failedResponse = response();
  proxy.emit('proxyRes', failedUpstream, { method: 'GET' }, failedResponse);
  failedUpstream.emit('error', new Error('upstream reset'));
  assert.equal(failedResponse.statusCode, 502);
  assert.equal(failedResponse.headers['content-length'], '0');

  proxy.web = async () => { throw new Error('connection refused'); };
  const refused = response();
  middleware({ url: '/v1/client' }, refused);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refused.statusCode, 502);
  assert.equal(refused.headers['content-length'], '0');

  process.env = { NODE_ENV: 'development' };
  let passed = false;
  clerkProxyMiddleware()({}, {}, () => { passed = true; });
  assert.equal(passed, true);
  process.env = { NODE_ENV: 'production' };
  passed = false;
  clerkProxyMiddleware()({}, {}, () => { passed = true; });
  assert.equal(passed, true);
});
