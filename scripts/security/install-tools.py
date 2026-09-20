"""Install the pinned secret scanner from its official release, checking SHA-256.
The caller supplies an isolated destination; nothing is installed globally.
"""
import hashlib
import io
from pathlib import Path
import platform
import sys
import tarfile
import urllib.request

VERSION = "8.30.1"
if platform.system() != "Linux" or platform.machine() not in {"x86_64", "amd64"}:
    raise SystemExit("Install Gitleaks 8.30.1 for your OS, then set GITLEAKS_BIN.")
destination = Path(sys.argv[1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
name = f"gitleaks_{VERSION}_linux_x64.tar.gz"
base = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/"
with urllib.request.urlopen(base + f"gitleaks_{VERSION}_checksums.txt", timeout=30) as response:
    checks = response.read().decode()
expected = next(line.split()[0] for line in checks.splitlines() if line.endswith(name))
with urllib.request.urlopen(base + name, timeout=60) as response:
    data = response.read()
if hashlib.sha256(data).hexdigest() != expected:
    raise SystemExit("Gitleaks checksum mismatch. Installation blocked.")
with tarfile.open(fileobj=io.BytesIO(data)) as archive:
    member = archive.getmember("gitleaks")
    if not member.isfile():
        raise SystemExit("Unexpected release member.")
    (destination / "gitleaks").write_bytes(archive.extractfile(member).read())
(destination / "gitleaks").chmod(0o755)
print(f"Gitleaks {VERSION} verified and installed in isolated tool directory.")
