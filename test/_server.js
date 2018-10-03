const path = require('path');
const http = require('http');
const handler = require('serve-handler');
let server;

const start = ({ port = 3000, fixture }) => {
  server = http.createServer((request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/zeit/serve-handler#options
    return handler(request, response, {
      public: path.resolve(__dirname, 'fixtures', fixture)
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      console.log('------- SERVER LISTENING ON PORT', port);
      resolve();
    });
  });
};

const stop = () => {
  return new Promise((resolve, reject) => {
    server.close(error => {
      error ? reject(error) : resolve();
    });
  });
};

module.exports = {
  start,
  stop
};
