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

// https://github.com/moby/buildkit/blob/v0.14.0/vendor/github.com/gogo/googleapis/google/rpc/status.pb.go#L36-L49
export interface RpcStatus {
  code: number;
  message: string;
  details: Array<RpcAny>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/vendor/github.com/gogo/protobuf/types/any.pb.go#L108-L143
// Define properties based on google.protobuf.Any. For simplicity, assuming it
// has at least a type_url and a value.
export interface RpcAny {
  type_url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}
