import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB = Path(tempfile.gettempdir()) / "rc3_test.db"
os.environ["RC3_TEST_DB"] = str(DB)
