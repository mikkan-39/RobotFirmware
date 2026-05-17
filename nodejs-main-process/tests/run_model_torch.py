#!/usr/bin/env python3
"""
Run the same observation through torch.jit as run_model_node.mjs.

Usage (from nodejs-main-process/):
  python3 tests/run_model_torch.py
  python3 tests/run_model_torch.py path/to/obs.json path/to/policy.pt
"""
import json
import sys
from pathlib import Path

import torch

here = Path(__file__).resolve().parent
root = here.parent
obs_path = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "fixture_obs.json"
model_path = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "policy.pt"

obs = json.loads(obs_path.read_text())
x = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
m = torch.jit.load(str(model_path), map_location="cpu")
with torch.no_grad():
    y = m(x)
    if isinstance(y, (list, tuple)):
        y = y[0]
    out = y[0].cpu().numpy().tolist()

print(
    json.dumps(
        {
            "backend": "torch_jit",
            "model": str(model_path),
            "obs_path": str(obs_path),
            "obs_len": len(obs),
            "output": out,
        }
    )
)
