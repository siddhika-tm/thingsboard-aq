#!/usr/bin/env python3
"""Container / cargo device simulator for ThingsBoard.

Provisions itself through ThingsBoard MQTT device provisioning, then publishes a
combined alignment + cargo telemetry stream.

The device walks a labelled state machine and publishes the current phase as a
`phase` telemetry key, so the resulting stream doubles as ground-truth-labelled
training data for stack-alignment models rather than undifferentiated noise.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import threading
import time
import warnings

try:
    from paho.mqtt import client as mqtt
except ImportError:  # pragma: no cover - dependency guard
    sys.exit("paho-mqtt is not installed. Run: pip install -r requirements.txt")

# --- ThingsBoard MQTT contract -------------------------------------------------
# Verified against common/data/src/main/java/.../device/profile/MqttTopics.java
# and common/data/src/main/java/.../DataConstants.java in this repo.
PROVISION_USERNAME = "provision"
PROVISION_REQUEST_TOPIC = "/provision/request"
PROVISION_RESPONSE_TOPIC = "/provision/response"
TELEMETRY_TOPIC = "v1/devices/me/telemetry"
ATTRIBUTES_TOPIC = "v1/devices/me/attributes"

DEFAULT_TOKEN_CACHE = ".container_sim_token.json"

# Phase schedules. Each entry is (phase, ticks). A "cycle" is one full lift and
# set-down; `mixed` runs a clean cycle followed by a misaligned one.
_ALIGNED_CYCLE = [("AT_REST", 5), ("LIFTING", 4), ("STACKING", 5), ("AT_REST", 8)]
_MISALIGNED_CYCLE = [("AT_REST", 5), ("LIFTING", 4), ("STACKING", 5), ("MISALIGNED", 8)]

LOCKED, UNLOCKED = "LOCKED", "UNLOCKED"


def _new_client(client_id: str = "", username: str | None = None) -> mqtt.Client:
    """Build a paho client that works on both paho-mqtt 1.x and 2.x.

    The v1 callback API is used deliberately: its signatures are compatible with
    both major versions, so one set of callbacks covers each. paho 2.x warns
    about that choice on every construction, which is just noise here.
    """
    warnings.filterwarnings(
        "ignore", message=".*Callback API version 1 is deprecated.*")
    try:  # paho-mqtt >= 2.0 requires an explicit callback API version
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=client_id)
    except (AttributeError, TypeError):  # paho-mqtt 1.x
        client = mqtt.Client(client_id=client_id)
    if username:
        client.username_pw_set(username)
    return client


class ContainerSim:
    """Stateful simulation of one container's sensor package."""

    def __init__(self, device_name, scenario="mixed", misalign_deg=5.0,
                 bay=12, row=3, tier=4, seed=None):
        self.rng = random.Random(seed)
        self.device_name = device_name
        self.scenario = scenario
        self.misalign_deg = misalign_deg
        self.bay, self.row, self.tier = bay, row, tier

        # Static identity. Owner prefix + serial is ISO 6346 shaped; the check
        # digit is not computed since nothing downstream validates it.
        self.container_id = "MSKU%07d" % self.rng.randint(1000000, 9999999)
        self.container_type = "40HC"
        self.tare_weight_kg = 3750

        # Yard position, derived from the slot so containers are spatially
        # distinct on a map. A 40ft box is ~12m long; rows are offset ~15m
        # north-south and bays ~25m east-west. Containers sharing a stack
        # (same bay/row, different tier) sit at the same point, which is
        # physically correct - they are stacked, not spread out.
        self.base_lat = 13.1012 + (row - 3) * 0.000135
        self.base_lon = 80.2968 + (bay - 12) * 0.000240
        self.battery = 100.0
        self.temperature = 4.0
        self.humidity = 60.0
        # Which corners fail to seat when misaligned - fixed per run so the
        # fault signature is consistent rather than flickering randomly.
        self.bad_corners = self.rng.sample(["fl", "fr", "rl", "rr"], 2)

    # -- attributes -------------------------------------------------------
    def attributes(self) -> dict:
        return {
            "container_id": self.container_id,
            "container_type": self.container_type,
            "tare_weight_kg": self.tare_weight_kg,
            "bay": self.bay,
            "row": self.row,
            "tier": self.tier,
            "owner": "Airlinq Logistics",
        }

    # -- phase schedule ---------------------------------------------------
    def phases(self):
        """Yield (phase, index_within_phase, phase_length) forever."""
        if self.scenario == "misaligned":
            # One lift and a bad set-down, then it stays that way. A container
            # seated on a skew does not right itself - it holds that attitude
            # until a crane picks it up again. Cycling back to AT_REST would
            # silently clear the alarm every cycle and make a standing fault
            # look intermittent.
            for phase, ticks in _MISALIGNED_CYCLE:
                for i in range(ticks):
                    yield phase, i, ticks
            while True:
                yield "MISALIGNED", 0, 1
        seq = _ALIGNED_CYCLE if self.scenario == "aligned" \
            else _ALIGNED_CYCLE + _MISALIGNED_CYCLE
        while True:
            for phase, ticks in seq:
                for i in range(ticks):
                    yield phase, i, ticks

    # -- telemetry --------------------------------------------------------
    def telemetry(self, phase: str, i: int, n: int) -> dict:
        rng = self.rng
        j = lambda s: rng.uniform(-s, s)  # symmetric jitter

        if phase == "AT_REST":
            tilt_x, tilt_y = j(0.3), j(0.3)
            accel = (j(0.03), j(0.03), 9.81 + j(0.03))
            shock, locks, door = round(abs(j(0.05)), 3), LOCKED, "CLOSED"
        elif phase == "LIFTING":
            # Crane pick: the box swings and vertical accel departs from 1g.
            swing = 3.0 * (1 - i / max(n - 1, 1))
            tilt_x, tilt_y = j(3.0) + swing, j(3.0)
            accel = (j(0.6), j(0.6), 9.81 + rng.uniform(-0.8, 1.9))
            shock, locks, door = round(rng.uniform(0.4, 1.6), 3), LOCKED, "CLOSED"
        elif phase == "STACKING":
            # Controlled descent: tilt converges toward seated.
            conv = 1 - i / max(n - 1, 1)
            tilt_x, tilt_y = j(2.5) * conv, j(2.5) * conv
            accel = (j(0.3), j(0.3), 9.81 + j(0.45))
            shock, locks, door = round(rng.uniform(0.2, 0.9), 3), LOCKED, "CLOSED"
        elif phase == "MISALIGNED":
            # Seated, but resting at an offset instead of flat, and the corners
            # that did not seat report unlocked. This is the fault signature.
            tilt_x = self.misalign_deg + j(0.5)
            tilt_y = self.misalign_deg * 0.4 + j(0.5)
            accel = (j(0.05), j(0.05), 9.81 + j(0.05))
            shock, locks, door = round(abs(j(0.08)), 3), UNLOCKED, "CLOSED"
        else:
            raise ValueError("unknown phase: %s" % phase)

        # Slow environmental drift.
        self.battery = max(0.0, self.battery - rng.uniform(0.0, 0.02))
        self.temperature += j(0.08)
        self.humidity = min(100.0, max(0.0, self.humidity + j(0.4)))

        twistlocks = {}
        for corner in ("fl", "fr", "rl", "rr"):
            if locks == UNLOCKED and corner in self.bad_corners:
                twistlocks["twistlock_%s" % corner] = UNLOCKED
            else:
                twistlocks["twistlock_%s" % corner] = LOCKED

        values = {
            # alignment
            "tilt_x": round(tilt_x, 3),
            "tilt_y": round(tilt_y, 3),
            "yaw": round(90.0 + j(1.5), 3),
            "accel_x": round(accel[0], 3),
            "accel_y": round(accel[1], 3),
            "accel_z": round(accel[2], 3),
            # cargo / reefer
            "lat": round(self.base_lat + j(0.00002), 7),
            "lon": round(self.base_lon + j(0.00002), 7),
            "temperature": round(self.temperature, 2),
            "humidity": round(self.humidity, 2),
            "shock_g": shock,
            "door": door,
            # common
            "battery": round(self.battery, 2),
            "phase": phase,
        }
        values.update(twistlocks)
        return {"ts": int(time.time() * 1000), "values": values}


# --- provisioning --------------------------------------------------------------

def provision(host, port, device_name, key, secret, timeout=20.0) -> str:
    """Run the TB MQTT provisioning handshake and return the access token."""
    response: dict = {}
    done = threading.Event()
    request = json.dumps({
        "deviceName": device_name,
        "provisionDeviceKey": key,
        "provisionDeviceSecret": secret,
    })

    def on_connect(client, _u, _f, rc, *_a):
        if rc != 0:
            print("  provision connect failed rc=%s" % rc, file=sys.stderr)
            done.set()
            return
        client.subscribe(PROVISION_RESPONSE_TOPIC, qos=1)

    def on_subscribe(client, _u, _mid, _qos, *_a):
        # Publish only once the subscription is live, otherwise the response
        # can be delivered before we are listening for it.
        client.publish(PROVISION_REQUEST_TOPIC, request, qos=1)

    def on_message(_c, _u, msg):
        try:
            response.update(json.loads(msg.payload.decode()))
        except (ValueError, UnicodeDecodeError) as exc:
            response["status"] = "BAD_RESPONSE: %s" % exc
        done.set()

    client = _new_client(client_id="provision-%s" % device_name,
                         username=PROVISION_USERNAME)
    client.on_connect, client.on_subscribe, client.on_message = (
        on_connect, on_subscribe, on_message)
    client.connect(host, port, keepalive=30)
    client.loop_start()
    got = done.wait(timeout)
    client.loop_stop()
    client.disconnect()

    if not got:
        raise TimeoutError("no provisioning response within %.0fs" % timeout)
    if response.get("status") != "SUCCESS":
        raise RuntimeError("provisioning refused: %s" % json.dumps(response))
    token = response.get("credentialsValue")
    if not token:
        raise RuntimeError("provisioning response carried no credentialsValue: %s"
                           % json.dumps(response))
    return token


def load_token(cache_path, device_name):
    try:
        with open(cache_path) as fh:
            return json.load(fh).get(device_name)
    except (OSError, ValueError):
        return None


def save_token(cache_path, device_name, token):
    data = {}
    try:
        with open(cache_path) as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        pass
    data[device_name] = token
    try:
        with open(cache_path, "w") as fh:
            json.dump(data, fh, indent=2)
        os.chmod(cache_path, 0o600)
    except OSError as exc:
        print("  warning: could not cache token: %s" % exc, file=sys.stderr)


# --- main ----------------------------------------------------------------------

class DeviceSpec:
    """One simulated container and where it sits in the yard."""

    def __init__(self, name, bay, row, tier, scenario, seed):
        self.name, self.bay, self.row, self.tier = name, bay, row, tier
        self.scenario, self.seed = scenario, seed


def device_specs(args):
    """Lay the fleet out as physical stacks, not a flat list.

    Stack-alignment only means anything relative to neighbours, so containers
    are grouped into bay/row stacks of `tiers_per_stack`. Higher tiers are
    likelier to be misaligned, which is both realistic and gives a model
    something with signal to learn.
    """
    rng = random.Random(args.seed)
    specs = []
    for i in range(args.devices):
        stack, tier0 = divmod(i, args.tiers_per_stack)
        if args.scenario == "mixed" and args.devices > 1:
            scenario = "misaligned" if rng.random() < 0.15 + 0.12 * tier0 else "aligned"
        else:
            scenario = args.scenario
        specs.append(DeviceSpec(
            name="%s-%02d" % (args.name_prefix, i + 1),
            bay=args.bay + stack // 2,
            row=args.row + stack % 2,
            tier=tier0 + 1,
            scenario=scenario,
            seed=rng.randrange(1 << 30)))
    return specs


def token_for(args, name):
    token = None if args.force_provision else load_token(args.token_cache, name)
    if token:
        return token, False
    if not (args.provision_key and args.provision_secret):
        raise RuntimeError("no cached token for %s and no --provision-key/-secret" % name)
    token = provision(args.host, args.port, name,
                      args.provision_key, args.provision_secret)
    save_token(args.token_cache, name, token)
    return token, True


def run_device(args, spec, token, stop, status):
    """Publish for one device until `stop` is set. Runs on its own thread."""
    sim = ContainerSim(spec.name, scenario=spec.scenario,
                       misalign_deg=args.misalign_deg, bay=spec.bay,
                       row=spec.row, tier=spec.tier, seed=spec.seed)
    client = _new_client(client_id=spec.name, username=token)
    client.connect(args.host, args.port, keepalive=60)
    client.loop_start()
    client.publish(ATTRIBUTES_TOPIC, json.dumps(sim.attributes()), qos=1)

    # Desynchronise the fleet: without this every container starts its phase
    # cycle on the same tick, so the whole yard lifts and stacks in lockstep
    # and no two containers are ever in different states.
    phases = sim.phases()
    for _ in range(random.Random(spec.seed).randrange(40)):
        next(phases)

    sent = 0
    try:
        for phase, i, length in phases:
            if stop.is_set():
                break
            payload = sim.telemetry(phase, i, length)
            client.publish(TELEMETRY_TOPIC, json.dumps(payload), qos=1)
            sent += 1
            v = payload["values"]
            status[spec.name] = (sent, phase, v["tilt_x"], v["tilt_y"],
                                 sim.container_id, spec.bay, spec.row, spec.tier)
            if args.count and sent >= args.count:
                break
            # Spread publishes across the interval so N devices do not all
            # fire on the same tick and burst the broker.
            stop.wait(args.interval)
    finally:
        client.loop_stop()
        client.disconnect()


def run(args):
    specs = device_specs(args)

    if args.dry_run:
        for spec in specs:
            sim = ContainerSim(spec.name, scenario=spec.scenario,
                               misalign_deg=args.misalign_deg, bay=spec.bay,
                               row=spec.row, tier=spec.tier, seed=spec.seed)
            print("%-18s bay=%s row=%s tier=%s scenario=%-10s %s"
                  % (spec.name, spec.bay, spec.row, spec.tier, spec.scenario,
                     json.dumps(sim.attributes())))
            for n, (phase, i, length) in enumerate(sim.phases()):
                if n >= args.dry_run_count:
                    break
                print("   %-11s %s" % (phase, json.dumps(sim.telemetry(phase, i, length))))
        return 0

    print("Preparing %d device(s) against %s:%s ..." % (len(specs), args.host, args.port))
    tokens = {}
    for spec in specs:
        try:
            tokens[spec.name], fresh = token_for(args, spec.name)
            print("  %-18s bay=%-3s row=%-2s tier=%-2s %-11s %s"
                  % (spec.name, spec.bay, spec.row, spec.tier, spec.scenario,
                     "provisioned" if fresh else "cached token"))
        except Exception as exc:
            print("  %-18s FAILED: %s" % (spec.name, exc), file=sys.stderr)

    if not tokens:
        sys.exit("No device could be provisioned.")

    stop, status, threads = threading.Event(), {}, []
    for spec in specs:
        if spec.name not in tokens:
            continue
        t = threading.Thread(target=run_device, name=spec.name, daemon=True,
                             args=(args, spec, tokens[spec.name], stop, status))
        t.start()
        threads.append(t)
        # Stagger startup so the whole fleet does not connect simultaneously.
        time.sleep(0.15)

    print("\n%d device(s) publishing every %ss. Ctrl-C to stop.\n"
          % (len(threads), args.interval))
    try:
        while any(t.is_alive() for t in threads):
            time.sleep(args.status_interval)
            if not status:
                continue
            print("--- %s ---" % time.strftime("%H:%M:%S"), flush=True)
            for name in sorted(status):
                sent, phase, tx, ty, cid, bay, row, tier = status[name]
                print("  %-18s %-11s b%s/r%s/t%-2s %-12s tilt=(%6.2f,%6.2f) msgs=%d"
                      % (name, phase, bay, row, tier, cid, tx, ty, sent))
    except KeyboardInterrupt:
        print("\nStopping ...")
    finally:
        stop.set()
        for t in threads:
            t.join(timeout=5)
    print("Total messages: %d" % sum(v[0] for v in status.values()))
    return 0


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Simulate a container/cargo device publishing to ThingsBoard.")
    p.add_argument("--host", default="127.0.0.1", help="ThingsBoard MQTT host")
    p.add_argument("--port", type=int, default=1883, help="MQTT port")
    p.add_argument("--devices", type=int, default=1,
                   help="How many containers to simulate (each gets its own "
                        "MQTT session and yard position)")
    p.add_argument("--name-prefix", default="CONTAINER-SIM",
                   help="Device names are <prefix>-01, <prefix>-02, ...")
    p.add_argument("--tiers-per-stack", type=int, default=4,
                   help="Containers per bay/row stack before starting a new one")
    p.add_argument("--status-interval", type=float, default=10.0,
                   help="Seconds between fleet status summaries")
    p.add_argument("--provision-key", help="Device profile provision key")
    p.add_argument("--provision-secret", help="Device profile provision secret")
    p.add_argument("--token-cache", default=DEFAULT_TOKEN_CACHE)
    p.add_argument("--force-provision", action="store_true",
                   help="Ignore any cached token and provision again")
    p.add_argument("--interval", type=float, default=2.0,
                   help="Seconds between telemetry messages")
    p.add_argument("--count", type=int, default=0,
                   help="Stop after N messages (0 = run forever)")
    p.add_argument("--scenario", choices=("aligned", "misaligned", "mixed"),
                   default="mixed")
    p.add_argument("--misalign-deg", type=float, default=5.0,
                   help="Resting tilt when misaligned")
    p.add_argument("--bay", type=int, default=12, help="First bay number")
    p.add_argument("--row", type=int, default=3, help="First row number")
    
    p.add_argument("--seed", type=int, help="Seed the RNG for reproducible runs")
    p.add_argument("--dry-run", action="store_true",
                   help="Print payloads instead of connecting")
    p.add_argument("--dry-run-count", type=int, default=24)
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(run(parse_args()))
