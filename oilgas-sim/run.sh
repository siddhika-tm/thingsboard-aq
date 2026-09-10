#!/usr/bin/env bash
#
# Copyright © 2016-2026 The Thingsboard Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Launch one oil & gas scenario simulator, reading the tenant admin password
# from the gitignored .env.oilgas so no secret lands on the command line.
#
#   ./run.sh wellhead [host] [interval]
#   ./run.sh pipeline
#   ./run.sh tankfarm
#
set -euo pipefail
SCEN="${1:?usage: run.sh <wellhead|pipeline|tankfarm> [host] [interval]}"
HOST="${2:-http://10.221.89.67:8080}"
INTERVAL="${3:-15}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENVFILE="$HERE/../.env.oilgas"

# All three scenarios now live in the single Upstream tenant as separate
# device profiles (Wellhead / Pipeline Segment / Storage Tank).
case "$SCEN" in
  wellhead|pipeline|tankfarm) EMAIL="upstream@oilgas.airlinq.com" ;;
  *) echo "unknown scenario: $SCEN" >&2; exit 2 ;;
esac

PW="$(grep "^${EMAIL}=" "$ENVFILE" | cut -d= -f2-)"
[ -n "$PW" ] || { echo "no password for $EMAIL in $ENVFILE" >&2; exit 3; }

exec env TB_TENANT_PASSWORD="$PW" python3 "$HERE/oilgas_sim.py" \
  --host "$HOST" --scenario "$SCEN" --email "$EMAIL" --interval "$INTERVAL"
