/**
 * Copyright 2023 actions-toolkit authors
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
/**
 * Runs a GitHub Action.
 * Output will be streamed to the live console.
 *
 * @param     main            runs the defined function.
 * @param     post            runs the defined function at the end of the job if set.
 * @returns   Promise<void>
 */
export declare function run(main: () => Promise<void>, post?: () => Promise<void>): Promise<void>;
