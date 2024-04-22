// Copyright 2024 actions-toolkit authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

target "hello" {
  dockerfile = "hello.Dockerfile"
}

target "hello-bar" {
  dockerfile = "hello.Dockerfile"
  args = {
    NAME = "bar"
  }
}

group "hello-all" {
  targets = ["hello", "hello-bar"]
}

target "hello-matrix" {
  name = "matrix-${name}"
  matrix = {
    name = ["bar", "baz", "boo", "far", "faz", "foo", "aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg", "hhh", "iii", "jjj"]
  }
  dockerfile = "hello.Dockerfile"
  args = {
    NAME = name
  }
}
