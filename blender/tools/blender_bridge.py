import argparse
import json
import socket
import sys


def send_code(code: str, host: str = "127.0.0.1", port: int = 9876, timeout: float = 30.0):
    payload = {
        "type": "execute",
        "code": code,
        "strict_json": True,
    }

    data = json.dumps(payload).encode("utf-8") + b"\0"

    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(data)

        chunks = bytearray()
        while True:
            chunk = sock.recv(65536)
            if not chunk:
                break
            chunks.extend(chunk)
            if b"\0" in chunk:
                break

    raw = bytes(chunks).split(b"\0", 1)[0]
    if not raw:
        raise RuntimeError("Blender MCP returned an empty response.")
    return json.loads(raw.decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Python code to Blender Lab MCP bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9876)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--code", help="Python code to execute in Blender.")
    parser.add_argument("--file", help="Read Python code from a file.")
    args = parser.parse_args()

    if bool(args.code) == bool(args.file):
        parser.error("Use exactly one of --code or --file.")

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            code = f.read()
    else:
        code = args.code

    try:
        response = send_code(code, args.host, args.port, args.timeout)
    except Exception as exc:
        print(json.dumps({"status": "client_error", "message": str(exc)}, ensure_ascii=False))
        return 1

    print(json.dumps(response, ensure_ascii=False, indent=2))
    return 0 if response.get("status") == "ok" else 2


if __name__ == "__main__":
    sys.exit(main())
