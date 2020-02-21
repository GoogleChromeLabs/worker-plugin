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
import ParserHelpers from 'webpack/lib/ParserHelpers';
import WORKER_PLUGIN_SYMBOL from './symbol';

const NAME = 'WorkerPlugin';
const JS_TYPES = ['auto', 'esm', 'dynamic'];
const workerLoader = path.resolve(__dirname, 'loader.js');

export default class WorkerPlugin {
  constructor (options) {
    this.options = options || {};
    this[WORKER_PLUGIN_SYMBOL] = true;
  }

  apply (compiler) {
    compiler.hooks.normalModuleFactory.tap(NAME, factory => {
      let workerId = 0;
      for (const type of JS_TYPES) {
        factory.hooks.parser.for(`javascript/${type}`).tap(NAME, parser => {
          const handleWorker = workerTypeString => expr => {
            const dep = parser.evaluateExpression(expr.arguments[0]);

            if (!dep.isString()) {
              parser.state.module.warnings.push({
                message: `new ${workerTypeString}() will only be bundled if passed a String.`
              });
              return false;
            }

            const optsExpr = expr.arguments[1];
            let typeModuleExpr;
            let opts;
            if (optsExpr) {
              opts = {};
              for (let i = optsExpr.properties.length; i--;) {
                const prop = optsExpr.properties[i];
                if (prop.type === 'Property' && !prop.computed && !prop.shorthand && !prop.method) {
                  opts[prop.key.name] = parser.evaluateExpression(prop.value).string;

                  if (prop.key.name === 'type') {
                    typeModuleExpr = prop;
                  }
                }
              }
            }

            if (!opts || opts.type !== 'module') {
              parser.state.module.warnings.push({
                message: `new ${workerTypeString}() will only be bundled if passed options that include { type: 'module' }.${opts ? `\n  Received: new ${workerTypeString}()(${JSON.stringify(dep.string)}, ${JSON.stringify(opts)})` : ''}`
              });
              return false;
            }

            const loaderOptions = { name: opts.name || workerId + '' };
            const req = `require(${JSON.stringify(workerLoader + '?' + JSON.stringify(loaderOptions) + '!' + dep.string)})`;
            const id = `__webpack__worker__${workerId++}`;
            ParserHelpers.toConstantDependency(parser, id)(expr.arguments[0]);

            if (this.options.workerType) {
              ParserHelpers.toConstantDependency(parser, JSON.stringify(this.options.workerType))(typeModuleExpr.value);
            } else if (this.options.preserveTypeModule !== true) {
              // Options object can contain comma at the end e.g. `{ type: 'module', }`.
              // Previously, `type` property was replaced with an empty string
              // that left this comma.
              // Currently the `type` property value is replaced with `undefined`.
              ParserHelpers.toConstantDependency(parser, 'type:undefined')(typeModuleExpr);
            }

            return ParserHelpers.addParsedVariableToModule(parser, id, req);
          };
          
          parser.hooks.new.for('Worker').tap(NAME, handleWorker('Worker'));
          if (this.options.sharedWorker !== false) {
            parser.hooks.new.for('SharedWorker').tap(NAME, handleWorker('SharedWorker'));
          }
        });
      }
    });
  }
}
