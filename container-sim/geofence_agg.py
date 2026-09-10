#!/usr/bin/env python3
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
"""Geofence roll-up for the container yard (stdlib only).

Computes two fleet-wide geofence KPIs and writes them as telemetry on the Yard
asset so plain value_card widgets (which render reliably on the deployed build)
can show them:

  yard_outside          - containers whose latest insideYardStatus == OUTSIDE
  yard_geofence_alarms  - active "Container outside yard" alarms

Run:  TB_TENANT_PASSWORD=... python3 geofence_agg.py --host http://HOST:8080 \
        --email tenant@airlinq.com --yard-asset <assetId> --interval 20
"""
from __future__ import annotations
import argparse, json, os, sys, time, urllib.parse, urllib.request, urllib.error

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="http://127.0.0.1:8080")
    p.add_argument("--email", required=True)
    p.add_argument("--password", default=os.environ.get("TB_TENANT_PASSWORD"))
    p.add_argument("--yard-asset", required=True)
    p.add_argument("--container-type", default="Container")
    p.add_argument("--alarm-type", default="Container outside yard")
    p.add_argument("--interval", type=float, default=20.0)
    p.add_argument("--count", type=int, default=0)
    a = p.parse_args()
    if not a.password:
        p.error("no password (pass --password or set TB_TENANT_PASSWORD)")
    L = a.host.rstrip("/")

    def call(method, path, body=None, tok=None):
        data = json.dumps(body).encode() if body is not None else None
        h = {"Content-Type": "application/json"}
        if tok:
            h["X-Authorization"] = "Bearer " + tok
        req = urllib.request.Request(L + path, data=data, headers=h, method=method)
        try:
            r = urllib.request.urlopen(req, timeout=30)
            t = r.read().decode()
            return json.loads(t) if t.strip() else {}
        except urllib.error.HTTPError as e:
            return {"__err__": e.code, "__body__": e.read().decode()[:200]}

    def login():
        r = call("POST", "/api/auth/login", {"username": a.email, "password": a.password})
        if "token" not in r:
            sys.exit("login failed: %s" % r)
        return r["token"]

    tok = login()
    outside_q = {
        "entityFilter": {"type": "deviceType", "deviceTypes": [a.container_type], "deviceNameFilter": ""},
        "keyFilters": [{
            "key": {"type": "TIME_SERIES", "key": "insideYardStatus"},
            "valueType": "STRING",
            "predicate": {"type": "STRING", "operation": "EQUAL",
                          "value": {"defaultValue": "OUTSIDE"}, "ignoreCase": False}}]}
    n = 0
    while True:
        outside = call("POST", "/api/entitiesQuery/count", outside_q, tok)
        if isinstance(outside, dict) and outside.get("__err__") == 401:
            tok = login(); continue
        alarms = call("GET", "/api/v2/alarms?pageSize=1&page=0&statusList=ACTIVE&typeList=%s"
                      % urllib.parse.quote(a.alarm_type), tok=tok)
        n_alarm = alarms.get("totalElements", 0) if isinstance(alarms, dict) else 0
        call("POST", "/api/plugins/telemetry/ASSET/%s/timeseries/ANY" % a.yard_asset,
             {"yard_outside": int(outside) if isinstance(outside, int) else 0,
              "yard_geofence_alarms": int(n_alarm)}, tok=tok)
        n += 1
        if n == 1 or n % 15 == 0:
            print("tick %d  outside=%s geofence_alarms=%s" % (n, outside, n_alarm), flush=True)
        if a.count and n >= a.count:
            break
        time.sleep(a.interval)

if __name__ == "__main__":
    main()
