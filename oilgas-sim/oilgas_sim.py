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

"""Oil & Gas IoT device simulator for ThingsBoard (stdlib only, no pip installs).

One script drives three independent demo tenants, one --scenario each:

  wellhead  Upstream well pads   - wellhead/casing pressure, ESP lift, gas detection
  pipeline  Midstream segments   - pressure/flow, leak detection, cathodic protection
  tankfarm  Storage tank farm    - level, temperature, vapour-space %LEL, pumps

It is self-configuring: given a tenant login it discovers that tenant's devices
and their access tokens, publishes each device's telemetry through the device's
OWN access token over the HTTP device API (so device auth is real, not faked),
and pushes rolled-up KPIs to the scenario's aggregate asset over the tenant REST
API (assets have no device credential of their own). No MQTT, no dependencies -
runs anywhere python3 runs and can reach the server.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request

# --------------------------------------------------------------------------- #
# HTTP plumbing                                                               #
# --------------------------------------------------------------------------- #

class TB:
    """Thin ThingsBoard REST + HTTP-device-API client over urllib."""

    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jwt = None
        self.refresh = None
        self._email = None
        self._password = None

    def _raw(self, method, path, body=None, headers=None, timeout=30):
        data = json.dumps(body).encode() if body is not None else None
        h = {"Content-Type": "application/json"}
        if headers:
            h.update(headers)
        req = urllib.request.Request(self.base + path, data=data, headers=h, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
            txt = resp.read().decode()
            return json.loads(txt) if txt.strip() else {}
        except urllib.error.HTTPError as e:
            return {"__err__": e.code, "__body__": e.read().decode()[:300]}
        except (urllib.error.URLError, OSError) as e:
            return {"__err__": -1, "__body__": str(e)}

    def login(self, email, password):
        self._email, self._password = email, password
        r = self._raw("POST", "/api/auth/login",
                      {"username": email, "password": password})
        if "token" not in r:
            raise RuntimeError("login failed: %s" % r)
        self.jwt, self.refresh = r["token"], r.get("refreshToken")

    def _auth(self):
        return {"X-Authorization": "Bearer " + self.jwt}

    def get(self, path):
        r = self._raw("GET", path, headers=self._auth())
        if isinstance(r, dict) and r.get("__err__") == 401:
            self.login(self._email, self._password)
            r = self._raw("GET", path, headers=self._auth())
        return r

    def rest_post(self, path, body):
        r = self._raw("POST", path, body, headers=self._auth())
        if isinstance(r, dict) and r.get("__err__") == 401:
            self.login(self._email, self._password)
            r = self._raw("POST", path, body, headers=self._auth())
        return r

    def device_telemetry(self, token, values):
        """Publish telemetry as the device itself (HTTP device API)."""
        return self._raw("POST", "/api/v1/%s/telemetry" % token, values)

    # -- discovery / seeding ------------------------------------------------
    def devices_of_type(self, dtype):
        out, page = [], 0
        while True:
            r = self.get("/api/tenant/devices?pageSize=100&page=%d&type=%s"
                         % (page, urllib.request.quote(dtype)))
            for d in r.get("data", []):
                out.append(d)
            if not r.get("hasNext"):
                break
            page += 1
        return out

    def device_token(self, device_id):
        return self.get("/api/device/%s/credentials" % device_id).get("credentialsId")

    def asset_by_name(self, name):
        r = self.get("/api/tenant/assets?pageSize=1&page=0&textSearch=%s"
                     % urllib.request.quote(name))
        data = r.get("data", [])
        return data[0] if data else None

    def push_asset_ts(self, asset_id, values):
        return self.rest_post(
            "/api/plugins/telemetry/ASSET/%s/timeseries/ANY" % asset_id, values)

    def set_server_attrs(self, entity_type, entity_id, attrs):
        return self.rest_post(
            "/api/plugins/telemetry/%s/%s/attributes/SERVER_SCOPE"
            % (entity_type, entity_id), attrs)


def jitter(rng, s):
    return rng.uniform(-s, s)


# --------------------------------------------------------------------------- #
# Scenario: UPSTREAM wellhead                                                 #
# --------------------------------------------------------------------------- #

class WellheadSim:
    """One ESP-lifted producing well. A few wells carry standing faults so the
    dashboard has alarms to show: `esp_fault` drives bearing vibration up,
    `gas_event` drives H2S/CH4 above the detection thresholds."""

    # Eagle Ford-ish pad, wells spread a few hundred metres apart.
    BASE_LAT, BASE_LON = 28.5361, -98.5072

    def __init__(self, idx, name, fault=None, seed=None):
        self.rng = random.Random(seed)
        self.idx, self.name, self.fault = idx, name, fault
        self.lat = self.BASE_LAT + (idx // 3) * 0.0018 + jitter(self.rng, 0.0004)
        self.lon = self.BASE_LON + (idx % 3) * 0.0022 + jitter(self.rng, 0.0004)
        self.api_number = "42-255-%05d" % self.rng.randint(10000, 99999)
        # baselines, per-well spread
        self.oil0 = self.rng.uniform(350, 1050)          # bbl/d
        self.gor0 = self.rng.uniform(600, 1800)          # scf/bbl
        self.whp0 = self.rng.uniform(1400, 2300)         # psi
        self.wc0 = self.rng.uniform(8, 45)               # water cut %
        self.esp_vib = self.rng.uniform(1.5, 3.0)        # mm/s baseline

    def attributes(self):
        return {
            "well_id": self.name,
            "field": "Eagle Ford",
            "pad": "Pad A",
            "api_number": self.api_number,
            "lift_type": "ESP",
            "operator": "Airlinq Energy",
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
        }

    def telemetry(self):
        rng = self.rng
        whp = self.whp0 + jitter(rng, 40)
        casing = whp * 0.35 + jitter(rng, 25)
        tubing_temp = 78 + jitter(rng, 3)
        oil = max(0.0, self.oil0 + jitter(rng, 25))
        wc = min(95.0, max(0.0, self.wc0 + jitter(rng, 1.5)))
        gas = oil * self.gor0 / 1000.0 + jitter(rng, 40)   # mscf/d
        esp_intake = 900 + jitter(rng, 60)
        esp_current = 48 + jitter(rng, 4)
        esp_motor_temp = 96 + jitter(rng, 4)
        # gas detection: normally trace, elevated on a gas_event well
        h2s = abs(jitter(rng, 1.2))
        ch4 = abs(jitter(rng, 2.0))

        if self.fault == "esp_fault":
            self.esp_vib = min(12.0, self.esp_vib + rng.uniform(0.0, 0.15))
            esp_current += 9
            esp_motor_temp += 14
        else:
            self.esp_vib = max(1.2, self.esp_vib + jitter(rng, 0.1))
        if self.fault == "gas_event":
            h2s = 14 + abs(jitter(rng, 4))
            ch4 = 28 + abs(jitter(rng, 6))

        return {
            "wellhead_pressure": round(whp, 1),
            "casing_pressure": round(casing, 1),
            "tubing_temp": round(tubing_temp, 2),
            "oil_rate": round(oil, 1),
            "gas_rate": round(gas, 1),
            "water_cut": round(wc, 1),
            "esp_intake_pressure": round(esp_intake, 1),
            "esp_current": round(esp_current, 2),
            "esp_vibration": round(self.esp_vib, 2),
            "esp_motor_temp": round(esp_motor_temp, 1),
            "h2s_ppm": round(h2s, 1),
            "ch4_lel": round(ch4, 1),
            "latitude": round(self.lat + jitter(rng, 0.00002), 6),
            "longitude": round(self.lon + jitter(rng, 0.00002), 6),
        }


def wellhead_faults(n, rng):
    """Deterministically hand out a couple of standing faults across the wells."""
    faults = [None] * n
    if n >= 2:
        faults[1] = "esp_fault"
    if n >= 4:
        faults[3] = "gas_event"
    return faults


def wellhead_aggregate(latest):
    """Roll per-well latest telemetry up to the Pad/Field KPIs."""
    vals = list(latest.values())
    n = len(vals)
    total_oil = sum(v["oil_rate"] for v in vals)
    total_gas = sum(v["gas_rate"] for v in vals)
    in_alarm = sum(1 for v in vals
                   if v["esp_vibration"] > 6 or v["h2s_ppm"] > 10 or v["ch4_lel"] > 20)
    avg_whp = sum(v["wellhead_pressure"] for v in vals) / max(n, 1)
    max_h2s = max((v["h2s_ppm"] for v in vals), default=0)
    return {
        "active_wells": n,
        "wells_in_alarm": in_alarm,
        "total_oil_rate": round(total_oil, 0),
        "total_gas_rate": round(total_gas, 0),
        "avg_wellhead_pressure": round(avg_whp, 0),
        "max_h2s_ppm": round(max_h2s, 1),
    }


# --------------------------------------------------------------------------- #
# Scenario: MIDSTREAM pipeline                                                #
# --------------------------------------------------------------------------- #

class PipelineSim:
    """One monitored pipeline segment / pump station. Faults: `leak` opens a
    flow imbalance between inlet and outlet and vents CH4; `cathodic` lets the
    cathodic-protection potential decay toward the corrosion range."""

    # A trunk line laid roughly W->E; segments strung along it.
    BASE_LAT, BASE_LON = 29.7604, -95.3698  # Houston-ish

    def __init__(self, idx, name, fault=None, seed=None):
        self.rng = random.Random(seed)
        self.idx, self.name, self.fault = idx, name, fault
        self.lat = self.BASE_LAT + idx * 0.0009 + jitter(self.rng, 0.0003)
        self.lon = self.BASE_LON + idx * 0.0140 + jitter(self.rng, 0.0006)
        self.inlet0 = self.rng.uniform(720, 880)      # psi
        self.flow0 = self.rng.uniform(1800, 3200)     # bbl/h
        self.cp = -1.05 + jitter(self.rng, 0.03)      # V (cathodic protection)

    def attributes(self):
        return {
            "segment_id": self.name,
            "line": "Gulf Trunk 24in",
            "diameter_in": 24,
            "medium": "crude",
            "milepost": 5 * self.idx + 12,
            "operator": "Airlinq Energy",
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
        }

    def telemetry(self):
        rng = self.rng
        inlet = self.inlet0 + jitter(rng, 12)
        drop = 18 + jitter(rng, 4)
        outlet = inlet - drop
        flow_in = self.flow0 + jitter(rng, 40)
        flow_out = flow_in + jitter(rng, 15)
        fluid_temp = 32 + jitter(rng, 2)
        ch4 = abs(jitter(rng, 1.5))

        if self.fault == "leak":
            flow_out = flow_in * 0.86 + jitter(rng, 20)   # ~14% loss
            ch4 = 26 + abs(jitter(rng, 6))
            outlet -= 30
        if self.fault == "cathodic":
            self.cp = min(-0.72, self.cp + rng.uniform(0.0, 0.004))
        imbalance = (flow_in - flow_out) / flow_in * 100.0

        return {
            "inlet_pressure": round(inlet, 1),
            "outlet_pressure": round(outlet, 1),
            "flow_in": round(flow_in, 1),
            "flow_out": round(flow_out, 1),
            "flow_imbalance": round(imbalance, 2),
            "fluid_temp": round(fluid_temp, 2),
            "cathodic_potential": round(self.cp, 3),
            "ch4_lel": round(ch4, 1),
            "latitude": round(self.lat + jitter(rng, 0.00002), 6),
            "longitude": round(self.lon + jitter(rng, 0.00002), 6),
        }


def pipeline_faults(n, rng):
    faults = [None] * n
    if n >= 3:
        faults[2] = "leak"
    if n >= 5:
        faults[4] = "cathodic"
    return faults


def pipeline_aggregate(latest):
    vals = list(latest.values()); n = len(vals)
    total_flow = sum(v["flow_in"] for v in vals)
    in_alarm = sum(1 for v in vals
                   if v["flow_imbalance"] > 5 or v["cathodic_potential"] > -0.85 or v["ch4_lel"] > 20)
    max_drop = max((v["inlet_pressure"] - v["outlet_pressure"] for v in vals), default=0)
    min_cp = min((v["cathodic_potential"] for v in vals), default=0)
    return {
        "active_segments": n,
        "segments_in_alarm": in_alarm,
        "total_throughput": round(total_flow, 0),
        "max_pressure_drop": round(max_drop, 1),
        "min_cathodic_potential": round(min_cp, 3),
    }


# --------------------------------------------------------------------------- #
# Scenario: STORAGE tank farm                                                 #
# --------------------------------------------------------------------------- #

class TankSim:
    """One storage tank. Faults: `overfill` drives the level up past the high-high
    trip; `vapor` raises vapour-space %LEL into the flammable-detection band."""

    BASE_LAT, BASE_LON = 29.7220, -95.2560  # Houston ship-channel tank farm

    PRODUCTS = ["Crude", "Diesel", "Gasoline", "Jet-A"]

    def __init__(self, idx, name, fault=None, seed=None):
        self.rng = random.Random(seed)
        self.idx, self.name, self.fault = idx, name, fault
        self.lat = self.BASE_LAT + (idx // 3) * 0.0012 + jitter(self.rng, 0.0002)
        self.lon = self.BASE_LON + (idx % 3) * 0.0014 + jitter(self.rng, 0.0002)
        self.product = self.PRODUCTS[idx % len(self.PRODUCTS)]
        self.level = self.rng.uniform(35, 75)         # %
        self.capacity_bbl = self.rng.choice([80000, 120000, 150000])

    def attributes(self):
        return {
            "tank_id": self.name,
            "product": self.product,
            "capacity_bbl": self.capacity_bbl,
            "farm": "Ship Channel Terminal",
            "roof": "external floating",
            "operator": "Airlinq Energy",
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
        }

    def telemetry(self):
        rng = self.rng
        if self.fault == "overfill":
            self.level = min(99.5, self.level + rng.uniform(0.2, 0.6))
        else:
            self.level = min(88.0, max(20.0, self.level + jitter(rng, 0.5)))
        temp = 24 + jitter(rng, 2)
        vapor = abs(jitter(rng, 3))
        if self.fault == "vapor":
            vapor = 22 + abs(jitter(rng, 6))
        pump_on = self.level < 80 and rng.random() < 0.5
        return {
            "level_pct": round(self.level, 1),
            "level_bbl": round(self.capacity_bbl * self.level / 100.0, 0),
            "temperature": round(temp, 2),
            "vapor_lel": round(vapor, 1),
            "vapor_pressure": round(2.5 + jitter(rng, 0.4), 2),
            "pump_status": 1 if pump_on else 0,
            "latitude": round(self.lat + jitter(rng, 0.00001), 6),
            "longitude": round(self.lon + jitter(rng, 0.00001), 6),
        }


def tank_faults(n, rng):
    faults = [None] * n
    if n >= 2:
        faults[1] = "overfill"
    if n >= 5:
        faults[4] = "vapor"
    return faults


def tank_aggregate(latest):
    vals = list(latest.values()); n = len(vals)
    total_inv = sum(v["level_bbl"] for v in vals)
    in_alarm = sum(1 for v in vals if v["level_pct"] > 90 or v["vapor_lel"] > 20)
    avg_temp = sum(v["temperature"] for v in vals) / max(n, 1)
    max_vapor = max((v["vapor_lel"] for v in vals), default=0)
    return {
        "active_tanks": n,
        "tanks_in_alarm": in_alarm,
        "total_inventory_bbl": round(total_inv, 0),
        "avg_temperature": round(avg_temp, 1),
        "max_vapor_lel": round(max_vapor, 1),
    }


# scenario registry: (device profile type, aggregate asset name, sim class,
#                     fault-assigner, aggregator)
SCENARIOS = {
    "wellhead": {
        "profile": "Wellhead",
        "asset": "Eagle Ford Pad A",
        "sim": WellheadSim,
        "faults": wellhead_faults,
        "aggregate": wellhead_aggregate,
    },
    "pipeline": {
        "profile": "Pipeline Segment",
        "asset": "Gulf Trunk Line",
        "sim": PipelineSim,
        "faults": pipeline_faults,
        "aggregate": pipeline_aggregate,
    },
    "tankfarm": {
        "profile": "Storage Tank",
        "asset": "Ship Channel Terminal",
        "sim": TankSim,
        "faults": tank_faults,
        "aggregate": tank_aggregate,
    },
}


# --------------------------------------------------------------------------- #
# Runner                                                                      #
# --------------------------------------------------------------------------- #

def run(args):
    scn = SCENARIOS[args.scenario]
    tb = TB(args.host)
    tb.login(args.email, args.password)
    print("logged in as %s" % args.email)

    devices = tb.devices_of_type(scn["profile"])
    devices.sort(key=lambda d: d["name"])
    if not devices:
        sys.exit("no devices of type %s in this tenant" % scn["profile"])
    rng = random.Random(args.seed)
    faults = scn["faults"](len(devices), rng)

    sims, tokens = {}, {}
    for i, d in enumerate(devices):
        name = d["name"]
        tok = tb.device_token(d["id"]["id"])
        tokens[name] = tok
        sims[name] = scn["sim"](i, name, fault=faults[i], seed=rng.randrange(1 << 30))
        # seed static identity once (server-scope attributes)
        tb.set_server_attrs("DEVICE", d["id"]["id"], sims[name].attributes())
        print("  %-10s fault=%-9s token=%s..." % (name, faults[i], tok[:8]))

    asset = tb.asset_by_name(scn["asset"])
    asset_id = asset["id"]["id"] if asset else None
    print("aggregate asset %s -> %s" % (scn["asset"], asset_id))

    print("\npublishing every %ss (Ctrl-C to stop)\n" % args.interval)
    n = 0
    try:
        while True:
            latest = {}
            for name, sim in sims.items():
                v = sim.telemetry()
                latest[name] = v
                tb.device_telemetry(tokens[name], v)
            if asset_id:
                tb.push_asset_ts(asset_id, scn["aggregate"](latest))
            n += 1
            if n == 1 or n % 10 == 0:
                agg = scn["aggregate"](latest)
                print("tick %d  %s" % (n, json.dumps(agg)))
            if args.count and n >= args.count:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nstopping")
    return 0


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--host", default="http://127.0.0.1:8080",
                   help="ThingsBoard base URL")
    p.add_argument("--scenario", required=True, choices=sorted(SCENARIOS))
    p.add_argument("--email", required=True, help="tenant admin email")
    p.add_argument("--password", default=os.environ.get("TB_TENANT_PASSWORD"),
                   help="tenant admin password (or env TB_TENANT_PASSWORD)")
    p.add_argument("--interval", type=float, default=10.0,
                   help="seconds between telemetry rounds")
    p.add_argument("--count", type=int, default=0, help="stop after N rounds (0=forever)")
    p.add_argument("--seed", type=int, default=42)
    a = p.parse_args(argv)
    if not a.password:
        p.error("no password (pass --password or set TB_TENANT_PASSWORD)")
    return a


if __name__ == "__main__":
    sys.exit(run(parse_args()))
