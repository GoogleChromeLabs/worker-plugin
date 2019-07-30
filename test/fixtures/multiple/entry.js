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

const worker0 = new Worker('./worker-0', { type: 'module' });
const worker1 = new Worker('./worker-1', { type: 'module' });

worker0.onmessage = ({ data }) => {
  console.log('page got data: ', data);
};
worker0.postMessage('hello 0');

worker1.onmessage = ({ data }) => {
  console.log('page got data: ', data);
};
worker1.postMessage('hello 1');
