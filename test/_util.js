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

import path from 'path';
import webpack from 'webpack';
import CleanPlugin from 'clean-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {string} fixture
 * @param {{ terserOptions?: import('terser').MinifyOptions } & Partial<import('webpack').Configuration>} [options]
 */
export function runWebpack (fixture, { output, plugins, terserOptions, ...config } = {}) {
  return run(callback => webpack({
    mode: 'production',
    devtool: false,
    context: path.resolve(__dirname, 'fixtures', fixture),
    entry: './entry',
    output: {
      publicPath: 'dist/',
      path: path.resolve(__dirname, 'fixtures', fixture, 'dist'),
      ...(output || {})
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: terserOptions || {
            mangle: false,
            output: {
              beautify: true
            }
          },
          sourceMap: false
        })
      ]
    },
    plugins: [
      new CleanPlugin([
        path.resolve(__dirname, 'fixtures', fixture, 'dist', '**')
      ], {}),
      ...(Array.isArray(plugins) ? plugins : [])
    ],
    ...config
  }, callback));
}

/**
 * @param {string} fixture
 * @param {Partial<import('webpack').Configuration & { terserOptions?: import('terser').MinifyOptions }>} [options]
 */
export function watchWebpack (fixture, { output, plugins, context, terserOptions, ...config } = {}) {
  context = context || path.resolve(__dirname, 'fixtures', fixture);
  /** @type {Partial<import('webpack').Compiler & { doRun(): Promise<import('webpack').Stats> }>} */
  const compiler = webpack({
    mode: 'production',
    context,
    entry: './entry.js',
    output: {
      publicPath: 'dist/',
      path: path.resolve(context, 'dist'),
      ...(output || {})
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: terserOptions || {
            mangle: false,
            output: {
              beautify: true
            }
          },
          sourceMap: false
        })
      ]
    },
    plugins: plugins || []
  });
  // compiler.watch({});
  compiler.doRun = () => run(compiler.run.bind(compiler));
  return compiler;
}

export class CountApplyWebpackPlugin {
  constructor () {
    this.count = 0;
  }
  apply () {
    this.count++;
  }
}

export function statsWithAssets (stats) {
  stats.assets = Object.keys(stats.compilation.assets).reduce((acc, name) => {
    acc[name] = stats.compilation.assets[name].source();
    return acc;
  }, {});
  return stats;
}

function run (runner) {
  return new Promise((resolve, reject) => {
    runner((err, stats) => {
      if (err) return reject(err);

      statsWithAssets(stats);

      stats.info = stats.toJson({ assets: true, chunks: true });

      if (stats.hasWarnings()) {
        stats.info.warnings.forEach(warning => {
          console.warn('Webpack warning: ', warning);
        });
        console.warn('\nWebpack build generated ' + stats.info.warnings.length + ' warnings(s), shown above.\n\n');
      }
      if (stats.hasErrors()) {
        return reject(stats.info.errors.join('\n'));
      }
      resolve(stats);
    });
  });
}
