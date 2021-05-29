/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import WorkerPlugin from '../src';
import { runWebpack, CountApplyWebpackPlugin, watchWebpack, statsWithAssets, sleep } from './_util';

jest.setTimeout(30000);

describe('worker-plugin', () => {
  test('exports a class', () => {
    expect(WorkerPlugin).toBeInstanceOf(Function);
    const inst = new WorkerPlugin();
    expect(inst).toBeInstanceOf(WorkerPlugin);
    expect(inst).toHaveProperty('apply', expect.any(Function));
  });

  test('it replaces Worker constructor with require(worker-loader)', async () => {
    const stats = await runWebpack('basic', {
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(2);
    expect(assetNames).toContainEqual('0.worker.js');

    const main = stats.assets['main.js'];
    expect(main).toMatch(/[^\n]*new\s+Worker\s*\([^)]*\)[^\n]*/g);
    expect(main).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"0\.worker\.js"/g);
  });

  test('it replaces multiple Worker exports with __webpack_require__', async () => {
    const stats = await runWebpack('multiple', {
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(3);
    expect(assetNames).toContainEqual('0.worker.js');
    expect(assetNames).toContainEqual('1.worker.js');

    const main = stats.assets['main.js'];
    expect(main).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"0\.worker\.js"/g);
    expect(main).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"1\.worker\.js"/g);
  });

  test('retainModule:true leaves {type:module} in worker init', async () => {
    const { assets } = await runWebpack('basic', {
      plugins: [
        new WorkerPlugin({
          preserveTypeModule: true
        })
      ]
    });

    const workerInit = assets['main.js'].match(/[^\n]*new\s+Worker\s*\([^)]*\)[^\n]*/g)[0];
    expect(workerInit).toMatch(/new\s+Worker\s*\(\s*__webpack__worker__\d\s*(,\s*\{[\s\n]*type\s*:\s*"module"[\s\n]*\}\s*)?\)/g);
  });

  test('workerType:x modifies the resulting {type} in worker init', async () => {
    const { assets } = await runWebpack('basic', {
      plugins: [
        new WorkerPlugin({
          workerType: 'classic'
        })
      ]
    });

    const workerInit = assets['main.js'].match(/[^\n]*new\s+Worker\s*\([^)]*\)[^\n]*/g)[0];
    expect(workerInit).toMatch(/new\s+Worker\s*\(\s*__webpack__worker__\d\s*(,\s*\{[\s\n]*type\s*:\s*"classic"[\s\n]*\}\s*)?\)/g);
  });

  test('it does not enable other plugins when building worker script', async () => {
    const countPlugin = new CountApplyWebpackPlugin();
    await runWebpack('basic', {
      plugins: [
        countPlugin,
        new WorkerPlugin()
      ]
    });
    expect(countPlugin.count).toStrictEqual(1);
  });

  test('plugins: instance enables plugins when building worker script', async () => {
    const countPlugin = new CountApplyWebpackPlugin();
    await runWebpack('basic', {
      plugins: [
        new WorkerPlugin({
          plugins: [countPlugin]
        })
      ]
    });
    expect(countPlugin.count).toStrictEqual(1);
  });

  test('plugins: string passes plugins from main config', async () => {
    const countPlugin = new CountApplyWebpackPlugin();
    await runWebpack('basic', {
      plugins: [
        countPlugin,
        new WorkerPlugin({
          plugins: ['CountApplyWebpackPlugin']
        })
      ]
    });
    expect(countPlugin.count).toStrictEqual(2);
  });

  test('it uses the Worker constructor\'s name option and chunkFilename to generate asset filenames', async () => {
    const stats = await runWebpack('named', {
      output: {
        chunkFilename: '[name].[hash:5].js'
      },
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(2);
    expect(assetNames).toContainEqual(expect.stringMatching(/^foo\.worker\.[a-zA-Z0-9]+\.js$/));
    expect(stats.assets['main.js']).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"foo\.worker\.[a-zA-Z0-9]+\.js"/g);
  });

  describe('options.filename / options.chunkFilename', () => {
    test('it uses the provided filename when specified', async () => {
      const stats = await runWebpack('named', {
        plugins: [
          new WorkerPlugin({
            filename: 'my-custom-name.[hash:3].js'
          })
        ]
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual(expect.stringMatching(/^my-custom-name\.[a-zA-Z0-9]{3}\.js$/));
      expect(stats.assets['main.js']).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"my-custom-name\.[a-zA-Z0-9]{3}\.js"/g);
    });

    test('it supports [name] in filename templates', async () => {
      const stats = await runWebpack('named', {
        plugins: [
          new WorkerPlugin({
            filename: '[name]_worker.js'
          })
        ]
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual(expect.stringMatching(/^foo_worker\.js$/));
      expect(stats.assets['main.js']).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"foo_worker\.js"/g);
    });

    test('it supports custom chunkFilename templates when code-splitting', async () => {
      const stats = await runWebpack('code-splitting', {
        output: {
          publicPath: '/dist/'
        },
        plugins: [
          new WorkerPlugin({
            filename: 'worker.js',
            chunkFilename: '[id]_worker_chunk.js'
          })
        ]
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(3);
      expect(assetNames).toContainEqual(expect.stringMatching(/^worker\.js$/));
      expect(assetNames).toContainEqual(expect.stringMatching(/^1_worker_chunk\.js$/));
      expect(stats.assets['main.js']).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"worker\.js"/g);
    });
  });

  test('it bundles WASM file which imported dynamically', async () => {
    const stats = await runWebpack('wasm', {
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(4);
    expect(assetNames).toContainEqual(expect.stringMatching(/^[a-zA-Z0-9]+\.module\.wasm$/));
    expect(stats.assets['wasm.worker.js']).toMatch(/WebAssembly\.instantiate/);
  });

  test('it skips Worker constructor with non-string 1st argument', async () => {
    const stats = await runWebpack('skip-blobs', {
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(1);

    expect(stats.assets['main.js']).not.toMatch(/new\s+Worker\s*\(\s*__webpack__worker__\d\s*(,\s*\{[\s\n]*type\s*:\s*"module"[\s\n]*\}\s*)?\)/g);

    expect(stats.assets['main.js']).toMatch(/new\s+Worker\s*\(\s*new\s+Blob\s*\(\s*\[\s*'onmessage=\(\)=>\{postMessage\("right back at ya"\)\}'\s*\]\s*\)\s*\)/g);
  });

  describe('ESM strict mode', () => {
    test('it should work in strict ESM mode', async () => {
      const stats = await runWebpack('strict', {
        plugins: [
          new WorkerPlugin()
        ],
        mode: 'development'
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual('0.worker.js');

      const main = stats.assets['main.js'];
      expect(main).toMatch(/[^\n]*new Worker\s*\([^)]*\)[^\n]*/g);

      const log = main.match(/new Worker\s*\(([^)]*)\)[^\n]*/)[1];
      expect(log).toMatch(/_worker__WEBPACK_IMPORTED_MODULE_\d__\["default"\]/gi);

      // should also put the loader into ESM mode:
      expect(main).toMatch(/__webpack_exports__\["default"\]\s*=\s*\(?\s*__webpack_require__\.p\s*\+\s*"0\.worker\.js"\)?;?/g);
      // the output (in dev mode) looks like this:
      //   /* harmony default export */ __webpack_exports__[\"default\"] = (__webpack_require__.p + \"0.worker.js\");
    });

    test('it should inline for production', async () => {
      const stats = await runWebpack('strict', {
        plugins: [
          new WorkerPlugin()
        ],
        terserOptions: {
          compress: {
            pure_getters: true
          }
        }
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual('0.worker.js');

      const main = stats.assets['main.js'];
      expect(main).toMatch(/[^\n]*new Worker\s*\([^)]*\)[^\n]*/g);

      const log = main.match(/new Worker\s*\(([^)]*)\)[^\n]*/)[1];
      expect(log).toMatch(/^[a-z0-9$_]+\.p\s*\+\s*(['"])0\.worker\.js\1/gi);

      // shouldn't be any trace of the intermediary url provider module left
      expect(main).not.toMatch(/export default/g);
    });
  });

  test('should not emit trailing commas', async () => {
    const stats = await runWebpack('no-trailing-comma', {
      plugins: [
        new WorkerPlugin()
      ]
    });

    const assetNames = Object.keys(stats.assets);
    expect(assetNames).toHaveLength(3);

    // As it replaces the value of the `type` property with `undefined`
    // it will emit a string that contains line breaks, like:
    // `{\n type: void 0 \n}`.
    // We have to replace those line breaks thus it will become one-line string, like:
    const main = stats.assets['main.js'].replace(/\n/g, '');

    // Verify that we replace the second parameter when it's `{ type: module }` with `undefined`
    // and there are no trailing commas.
    // Match `new Worker(__webpack__worker__0, { type: void 0 })`
    expect(main).toMatch(/new Worker\s*\(__webpack__worker__\d, void 0\)/);

    // Match `new Worker(__webpack__worker__0, { type: void 0, name: "foo" })`
    expect(main).toMatch(/new Worker\s*\(__webpack__worker__\d, {\s*type: void 0,\s*name: "foo"\s*}\)/);
  });

  describe('worker-plugin/loader', () => {
    test('it returns a URL when applied to an import', async () => {
      const stats = await runWebpack('loader', {
        resolveLoader: {
          alias: {
            'worker-plugin/loader': resolve(__dirname, '../loader.js')
          }
        }
      });

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual('worker.js');

      const main = stats.assets['main.js'];
      expect(main).toMatch(/[^\n]*console.log\s*\([^)]*\)[^\n]*/g);

      const log = main.match(/\bconsole\.log\s*\(([^)]*)\)[^\n]*/)[1];
      expect(log).toMatch(/worker_plugin_loader_worker__WEBPACK_IMPORTED_MODULE_\d___default.[a-z0-9]+/gi);

      expect(main).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"worker\.js"/g);
    });
  });

  describe('watch mode', () => {
    const workerFile = resolve(__dirname, 'fixtures', 'watch', 'worker.js');
    const workerCode = readFileSync(workerFile, 'utf-8');
    afterAll(() => {
      writeFileSync(workerFile, workerCode);
    });

    test('it produces consistent modules in watch mode', async () => {
      const compiler = watchWebpack('watch', {
        plugins: [
          new WorkerPlugin()
        ]
      });

      /** @returns {Partial<Promise & { resolve(v): void, reject(e): void }>} */
      function Deferred () {
        const controller = {};
        return Object.assign(new Promise((resolve, reject) => {
          controller.resolve = resolve;
          controller.reject = reject;
        }), controller);
      }

      let stats;
      let ready = Deferred();

      const watcher = compiler.watch({
        aggregateTimeout: 1,
        poll: 50,
        ignored: /node_modules|dist/
      }, (err, stats) => {
        if (err) ready.reject(err);
        else ready.resolve(statsWithAssets(stats));
      });

      try {
        for (let i = 1; i < 5; i++) {
          ready = Deferred();
          writeFileSync(workerFile, workerCode.replace(/console\.log\('hello from worker( \d+)?'\)/, `console.log('hello from worker ${i}')`));
          await sleep(1000);
          stats = await ready;
          await sleep(1000);
          expect(Object.keys(stats.assets).sort()).toEqual(['0.worker.js', 'main.js']);
          expect(stats.assets['0.worker.js']).toContain(`hello from worker ${i}`);
        }
      } finally {
        watcher.close(() => {});
      }

      await sleep(1000);
    });
  });
});
