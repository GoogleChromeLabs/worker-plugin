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

    const workerInit = main.match(/[^\n]*new\s+Worker\s*\([^)]*\)[^\n]*/g)[0];
    // As it replaces the value of the `type` property with `undefined`
    // it will emit a string that contains line breaks, like:
    // `{\n type: void 0 \n}`.
    // We have to replace those line breaks thus it will become
    // one-line string, like:
    // `const worker = new Worker(__webpack__worker__0, { type: void 0 });`
    const workerInitWithoutLineBreak = workerInit.replace(/\n/g, '');
    // Match also the `type: void 0` string
    expect(workerInitWithoutLineBreak).toMatch(
      /new\s+Worker\s*\(\s*__webpack__worker__\d\s*(,\s*\{\s+type\:\svoid [0]\s+\}\s*)?\)/g
    );

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
    expect(assetNames).toContainEqual(expect.stringMatching(/^foo\.[a-zA-Z0-9]+\.worker\.js$/));
    expect(stats.assets['main.js']).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"foo\.[a-zA-Z0-9]+\.worker\.js"/g);
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
  
  describe('worker-plugin/loader', () => {
    test('it returns a URL when applied to an import', async () => {
      const stats = await runWebpack('loader');

      const assetNames = Object.keys(stats.assets);
      expect(assetNames).toHaveLength(2);
      expect(assetNames).toContainEqual('0.worker.js');

      const main = stats.assets['main.js'];
      expect(main).toMatch(/[^\n]*console.log\s*\([^)]*\)[^\n]*/g);

      const log = main.match(/\bconsole\.log\s*\(([^)]*)\)[^\n]*/)[1];
      expect(log).toMatch(/__webpack__worker__\d\)/g);

      expect(main).toMatch(/module.exports = __webpack_require__\.p\s*\+\s*"0\.worker\.js"/g);
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

      function Deferred () {
        let controller;
        const p = new Promise((resolve, reject) => {
          controller = { resolve, reject };
        });
        Object.assign(p, controller);
        return p;
      }

      let stats;
      let ready = new Deferred();

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
          ready = new Deferred();
          writeFileSync(workerFile, workerCode.replace(/console\.log\('hello from worker( \d+)?'\)/, `console.log('hello from worker ${i}')`));
          await sleep(1000);
          stats = await ready;
          await sleep(1000);
          expect(Object.keys(stats.assets).sort()).toEqual(['0.worker.js', 'main.js']);
          expect(stats.assets['0.worker.js']).toContain(`hello from worker ${i}`);
        }
      } finally {
        watcher.close();
      }

      await sleep(1000);
    });
  });
});
