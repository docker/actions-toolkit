# syntax=docker/dockerfile-upstream:master

# Copyright 2024 actions-toolkit authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

frOM busybox as base
cOpy lint.Dockerfile .

# some special chars: distroless/python3-debian12のPythonは3.11
# https://github.com/docker/build-push-action/issues/1204#issuecomment-2274056016

from scratch
MAINTAINER moby@example.com
COPy --from=base \
  /lint.Dockerfile \
  /

CMD [ "echo", "Hello, Norway!" ]
CMD [ "echo", "Hello, Sweden!" ]
ENTRYPOINT my-program start
