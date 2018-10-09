import http from 'http';
import handler from 'serve-handler';

export function createStaticServer (pathRoot) {
  const opts = {
    public: pathRoot
  };

  const server = http.createServer((request, response) => handler(request, response, opts));

  server.stop = () => new Promise((resolve, reject) => {
    server.close(error => {
      error ? reject(error) : resolve();
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const { address, port } = server.address();
      server.url = `http://${address}:${port}`;
      resolve(server);
    });
  });
};
