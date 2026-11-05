import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB = Path(tempfile.gettempdir()) / "rc3_test.db"
os.environ["RC3_TEST_DB"] = str(DB)

# Hard guard: a test run must never be able to touch the demo database.
from config import DATABASE_URL  # noqa: E402

assert "rc3_test" in DATABASE_URL, f"refusing to run tests against {DATABASE_URL}"
