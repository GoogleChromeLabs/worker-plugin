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

import loaderUtils from 'loader-utils';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import WebWorkerTemplatePlugin from 'webpack/lib/webworker/WebWorkerTemplatePlugin';
import FetchCompileWasmTemplatePlugin from 'webpack/lib/web/FetchCompileWasmTemplatePlugin';
import JsonpTemplatePlugin from 'webpack/lib/web/JsonpTemplatePlugin'
import WORKER_PLUGIN_SYMBOL from './symbol';

const NAME = 'WorkerPluginLoader';
let hasWarned = false;

export function pitch (request) {
  this.cacheable(false);
  const cb = this.async();

  const compilerOptions = this._compiler.options || {};

  const plugin = compilerOptions.plugins.find(p => p[WORKER_PLUGIN_SYMBOL]) || {};
  const pluginOptions = plugin && plugin.options || {};

  if (pluginOptions.globalObject == null && !hasWarned && compilerOptions.output && compilerOptions.output.globalObject === 'window') {
    hasWarned = true;
    console.warn('Warning (worker-plugin): output.globalObject is set to "window". It must be set to "self" to support HMR in Workers.');
  }

  const options = loaderUtils.getOptions(this) || {};
  const chunkFilename = compilerOptions.output.chunkFilename.replace(/\.([a-z]+)$/i, '.worker.$1');
  const workerOptions = {
    filename: chunkFilename.replace(/\[(?:chunkhash|contenthash)(:\d+(?::\d+)?)?\]/g, '[hash$1]'),
    chunkFilename: compilerOptions.output.chunkFilename,,
    globalObject: pluginOptions.globalObject || 'self'
  };

  const plugins = (pluginOptions.plugins || []).map(plugin => {
    if (typeof plugin !== 'string') {
      return plugin;
    }
    const found = compilerOptions.plugins.find(p => p.constructor.name === plugin);
    if (!found) {
      console.warn(`Warning (worker-plugin): Plugin "${plugin}" is not found.`);
    }
    return found;
  });

  const workerCompiler = this._compilation.createChildCompiler(NAME, workerOptions, plugins);
  workerCompiler.context = this._compiler.context;
  
  (new JsonpTemplatePlugin()).apply(workerCompiler)
  (new WebWorkerTemplatePlugin(workerOptions)).apply(workerCompiler);
  (new FetchCompileWasmTemplatePlugin({
    mangleImports: compilerOptions.optimization.mangleWasmImports
  })).apply(workerCompiler);
  (new SingleEntryPlugin(this.context, request, options.name)).apply(workerCompiler);

  const subCache = `subcache ${__dirname} ${request}`;
  workerCompiler.hooks.compilation.tap(NAME, compilation => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) compilation.cache[subCache] = {};
      compilation.cache = compilation.cache[subCache];
    }

    compilation.hooks.optimizeChunkAssets.tapAsync(NAME, (chunks, callback) => {
      const allFiles = chunks.filter(chunk => chunk.name !== options.name).reduce((accumulated, chunk) => {
        return accumulated.concat(chunk.files);
      }, []);
      const uniqueFiles = [...new Set(allFiles)];

      if (uniqueFiles.length) {
        // Sort to ensure the output is predictable.
        uniqueFiles.sort();
        const file = chunks.find(c => c.name === options.name).files[0]
        compilation.assets[file] = new ConcatSource(uniqueFiles.map(chunk => `importScripts(${JSON.stringify(chunk)});`).join('\n'), compilation.assets[file])
      }
      callback()
    })
  });

  workerCompiler.runAsChild((err, entries, compilation) => {
    if (!err && compilation.errors && compilation.errors.length) {
      err = compilation.errors[0];
    }
    const entry = entries && entries[entries.length - 1] && entries[entries.length - 1].files[0];
    if (!err && !entry) err = Error(`WorkerPlugin: no entry for ${request}`);
    if (err) return cb(err);
    return cb(null, `${options.esModule ? 'export default' : 'module.exports ='} __webpack_public_path__ + ${JSON.stringify(entry)}`);
  });
};

export default { pitch };
