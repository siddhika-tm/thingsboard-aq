# Container / cargo MQTT simulator

Simulates one container's sensor package and publishes a combined
**alignment + cargo** telemetry stream to ThingsBoard over MQTT.

The device walks a labelled state machine and publishes the current phase as a
`phase` telemetry key, so the stream doubles as ground-truth-labelled training
data for stack-alignment models instead of undifferentiated noise.

| phase | behaviour |
|---|---|
| `AT_REST` | small noise around a flat, seated tilt; all twistlocks `LOCKED` |
| `LIFTING` | crane pick — the box swings, vertical accel departs from 1g, shock rises |
| `STACKING` | controlled descent, tilt converging toward seated |
| `MISALIGNED` | seated at an offset tilt (default ~5°) with two corners still `UNLOCKED` |

`--scenario aligned` produces only clean set-downs, `misaligned` only faulty
ones, and `mixed` (the default) alternates — giving balanced positive and
negative examples.

## Setup

```bash
cd container-sim
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## One-time ThingsBoard prerequisite

The script onboards itself with ThingsBoard **device provisioning**, so it needs
a device profile configured to hand out credentials:

1. **Device profiles → +** (or edit an existing profile)
2. Open the **Device provisioning** tab
3. Set the strategy to **Allow to create new devices**
4. Copy the generated **Provision device key** and **Provision device secret**

No device needs to exist beforehand — ThingsBoard creates it on first connect.

## Run

```bash
python container_sim.py \
  --host <thingsboard-host> --port 1883 \
  --provision-key   YOUR_KEY \
  --provision-secret YOUR_SECRET \
  --device-name CONTAINER-SIM-01 \
  --interval 2 --scenario mixed
```

The access token returned by provisioning is cached in
`.container_sim_token.json` (mode 0600), so later runs reconnect directly and
skip the handshake — ThingsBoard rejects re-provisioning an existing device
name. Use `--force-provision` to redo it anyway.

Inspect the payloads without touching a broker:

```bash
python container_sim.py --dry-run --scenario mixed --seed 1
```

Useful flags: `--count N` stop after N messages · `--misalign-deg` resting tilt
when misaligned · `--bay/--row/--tier` stack position · `--seed` reproducible
runs.

## Published data

**Attributes** (once, on connect): `container_id`, `container_type`,
`tare_weight_kg`, `bay`, `row`, `tier`, `owner`

**Telemetry** (every `--interval` s):

- alignment — `tilt_x`, `tilt_y`, `yaw`, `accel_x/y/z`,
  `twistlock_fl/fr/rl/rr`
- cargo / reefer — `lat`, `lon`, `temperature`, `humidity`, `shock_g`, `door`
- common — `battery`, `phase`

## MQTT contract

Verified against this repo, not the public docs:

| purpose | value | source |
|---|---|---|
| provisioning username | `provision` | `MqttTransportHandler.java:1067` |
| provision request | `/provision/request` | `MqttTopics.java:66` |
| provision response | `/provision/response` | `MqttTopics.java:67` |
| telemetry | `v1/devices/me/telemetry` | `MqttTopics.java:44` |
| attributes | `v1/devices/me/attributes` | `MqttTopics.java:46` |

Request keys are `deviceName` / `provisionDeviceKey` / `provisionDeviceSecret`
and the token comes back as `credentialsValue`
(`DataConstants.java:113-118`).

## Note

This directory is intentionally outside the Maven reactor — the root `pom.xml`
`<modules>` list does not include it, so it cannot affect the ThingsBoard build.
