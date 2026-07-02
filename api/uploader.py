"""Import trades_*.json journal exports into the trade API.

MQL5 indicators cannot call WebRequest, so hx_trade_helper writes the
payload to MQL5\\Files\\TradesHistory\\<date>\\trades_<date>.json instead.
This script scans that folder and POSTs every export that has not been
uploaded yet; successful uploads are marked with a .uploaded file so the
script can be re-run (or scheduled) safely.

Example:
    python uploader.py --files "C:\\Users\\me\\AppData\\Roaming\\MetaQuotes\\Terminal\\<id>\\MQL5\\Files"
"""
import argparse
import json
import pathlib
import sys

import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--files", required=True,
                        help="path to the terminal's MQL5/Files folder")
    parser.add_argument("--api", default="http://127.0.0.1:8000/api/trades",
                        help="trade API endpoint")
    parser.add_argument("--api-key", default="",
                        help="value for the X-Api-Key header")
    parser.add_argument("--force", action="store_true",
                        help="re-upload files already marked as uploaded")
    args = parser.parse_args()

    base = pathlib.Path(args.files) / "TradesHistory"
    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["X-Api-Key"] = args.api_key

    exports = sorted(base.glob("*/trades_*.json"))
    if not exports:
        print(f"no trade exports found under {base}")
        return

    failed = 0
    for path in exports:
        marker = path.parent / (path.name + ".uploaded")
        if marker.exists() and not args.force:
            continue
        payload = json.loads(path.read_text())
        resp = requests.post(args.api, json=payload, headers=headers, timeout=30)
        if resp.ok:
            marker.touch()
            print(f"uploaded {path} -> {resp.json()}")
        else:
            failed += 1
            print(f"FAILED {path}: HTTP {resp.status_code} {resp.text}", file=sys.stderr)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
