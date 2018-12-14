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

export function runWebpack (fixture, { output, plugins, ...config } = {}) {
  return new Promise((resolve, reject) => {
    webpack({
      mode: 'production',
      devtool: false,
      context: path.resolve(__dirname, 'fixtures', fixture),
      entry: './entry.js',
      output: {
        publicPath: 'dist/',
        path: path.resolve(__dirname, 'fixtures', fixture, 'dist'),
        ...(output || {})
      },
      optimization: {
        minimizer: [
          new TerserPlugin({
            terserOptions: {
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
        ])
      ].concat(plugins || []),
      ...config
    }, (err, stats) => {
      if (err) return reject(err);

      stats.assets = Object.keys(stats.compilation.assets).reduce((acc, name) => {
        acc[name] = stats.compilation.assets[name].source();
        return acc;
      }, {});

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

export class CountApplyWebpackPlugin {
  constructor() {
    this.count = 0;
  }
  apply() {
    this.count++;
  }
}
