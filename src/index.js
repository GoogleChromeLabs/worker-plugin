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

import * as Types from '@babel/types';
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
      for (const type of JS_TYPES) {
        factory.hooks.parser.for(`javascript/${type}`).tap(NAME, parser => {
          let workerId = 0;

          parser.hooks.new.for('imported var').tap(NAME, expr => {
            const dep = parser.evaluateExpression(expr.arguments[0]);

            if (expr.callee.name !== 'Worker') return false

            if (!dep.isString()) {
              parser.state.module.warnings.push({
                message: 'new Worker() will only be bundled if passed a String.'
              });
              return false;
            }

            const optsExpr = expr.arguments[1];
            let typeModuleExpr = Types.objectProperty(
              Types.identifier("type"),
              Types.stringLiteral("module")
            )
            typeModuleExpr.range=[0, 0]

            let opts = {};
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

            let loaderOptions = opts.name && { name: opts.name };
            const req = `require(${JSON.stringify(workerLoader + (loaderOptions ? ('?' + JSON.stringify(loaderOptions)) : '') + '!' + dep.string)})`;
            const id = `__webpack__worker__${++workerId}`;
            ParserHelpers.toConstantDependency(parser, id)(expr.arguments[0]);

            ParserHelpers.addParsedVariableToModule(parser, id, req);
          });
        });
      }
    });
  }
}
