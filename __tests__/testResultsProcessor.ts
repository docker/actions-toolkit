/**
 * Copyright 2024 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

module.exports = results => {
  const allSkipped = results.testResults.every(result => {
    return result.skipped;
  });
  if (allSkipped) {
    console.log('All tests were skipped!');
    // create an empty file to signal that all tests were skipped for CI
    fs.closeSync(fs.openSync('./coverage/allSkipped.txt', 'w'));
  }
  return results;
};
