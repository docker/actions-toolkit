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
export interface ConfigFile {
    auths: Record<string, AuthConfig>;
    HttpHeaders?: Record<string, string>;
    psFormat?: string;
    imagesFormat?: string;
    networksFormat?: string;
    pluginsFormat?: string;
    volumesFormat?: string;
    statsFormat?: string;
    detachKeys?: string;
    credsStore?: string;
    credHelpers?: Record<string, string>;
    serviceInspectFormat?: string;
    servicesFormat?: string;
    tasksFormat?: string;
    secretFormat?: string;
    configFormat?: string;
    nodesFormat?: string;
    pruneFilters?: string[];
    proxies?: Record<string, ProxyConfig>;
    experimental?: string;
    stackOrchestrator?: string;
    kubernetes?: KubernetesConfig;
    currentContext?: string;
    cliPluginsExtraDirs?: string[];
    plugins?: Record<string, Record<string, string>>;
    aliases?: Record<string, string>;
}
export interface ProxyConfig {
    httpProxy?: string;
    httpsProxy?: string;
    noProxy?: string;
    ftpProxy?: string;
}
export interface KubernetesConfig {
    allNamespaces?: string;
}
export interface AuthConfig {
    username?: string;
    password?: string;
    auth?: string;
    email?: string;
    serveraddress?: string;
    identitytoken?: string;
    registrytoken?: string;
}
export interface ContextInfo {
    Name: string;
    Metadata: any;
    Endpoints: Record<string, EndpointInfo>;
    TLSMaterial: Record<string, Array<string>>;
    Storage: StorageInfo;
}
export interface EndpointInfo {
    Host?: string;
    SkipVerify: boolean;
    TLSData?: TLSData;
}
export interface TLSData {
    CA: any;
    Key: any;
    Cert: any;
}
export interface StorageInfo {
    MetadataPath: string;
    TLSPath: string;
}
