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
export interface CacheOpts {
    htcName: string;
    htcVersion: string;
    baseCacheDir: string;
    cacheFile: string;
    ghaNoCache?: boolean;
}
export interface CachePostState {
    dir: string;
    key: string;
}
export declare class Cache {
    private readonly opts;
    private readonly ghaCacheKey;
    private readonly ghaNoCache?;
    private readonly cacheDir;
    private readonly cachePath;
    private static readonly POST_CACHE_KEY;
    constructor(opts: CacheOpts);
    save(file: string, skipState?: boolean): Promise<string>;
    find(): Promise<string>;
    static post(): Promise<CachePostState | undefined>;
    private copyToCache;
    private platform;
}
