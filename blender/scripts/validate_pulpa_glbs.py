import json
import struct
import sys
from pathlib import Path


def read_glb_json(path: Path):
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError(f"{path.name}: not a GLB")
    version, total_length = struct.unpack_from("<II", raw, 4)
    if version != 2 or total_length != len(raw):
        raise ValueError(f"{path.name}: invalid GLB header")
    offset = 12
    while offset + 8 <= len(raw):
        chunk_len, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:  # JSON
            return json.loads(chunk.rstrip(b" \t\r\n\0").decode("utf-8"))
    raise ValueError(f"{path.name}: JSON chunk missing")


def main(folder):
    folder = Path(folder)
    report = {}
    for path in sorted(folder.glob("*.glb")):
        doc = read_glb_json(path)
        names = [node.get("name", "") for node in doc.get("nodes", [])]
        animations = [a.get("name", "") for a in doc.get("animations", [])]
        report[path.name] = {
            "bytes": path.stat().st_size,
            "nodes": len(names),
            "animations": animations,
            "semantic_nodes": [
                n for n in names
                if any(key in n for key in ("DUMP_PIVOT", "WHEEL_STEER", "WHEEL_SPIN", "ROTATING", "PANS_GROUP", "MOVING_JAW"))
            ],
        }

    required = {
        "HAUL-TRUCK.glb": [
            "HAUL-TRUCK_DUMP_PIVOT",
            "HAUL-TRUCK_WHEEL_STEER_FL",
            "HAUL-TRUCK_WHEEL_STEER_FR",
            "HAUL-TRUCK_WHEEL_SPIN_FL",
            "HAUL-TRUCK_WHEEL_SPIN_FR",
            "HAUL-TRUCK_ORE_LOAD",
        ],
        "APRON-FEEDER.glb": ["APRON-FEEDER_PANS_GROUP"],
        "PRIMARY-CRUSHER.glb": ["PRIMARY-CRUSHER_MOVING_JAW"],
        "MILL-01.glb": ["MILL-01_ROTATING_GROUP"],
        "SLURRY-PUMP-01.glb": ["SLURRY-PUMP-01_ROTATING_GROUP"],
    }

    failures = []
    for filename, required_nodes in required.items():
        path = folder / filename
        if not path.exists():
            failures.append(f"missing {filename}")
            continue
        doc = read_glb_json(path)
        names = {node.get("name", "") for node in doc.get("nodes", [])}
        for node in required_nodes:
            if node not in names:
                failures.append(f"{filename}: missing node {node}")

    print(json.dumps({
        "total_glbs": len(report),
        "total_bytes": sum(x["bytes"] for x in report.values()),
        "files": report,
        "failures": failures,
    }, indent=2, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
