"""Keep an exact local snapshot of the selected source CSV."""
import os
import shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def source_csv(override=None):
    local = ROOT / 'data/source/temiyage_master.csv'
    selected = Path(override or os.environ.get('TEMIYAGE_CSV') or '/workspace/temiyage/temiyage_master.csv')
    if selected.exists():
        local.parent.mkdir(parents=True, exist_ok=True)
        if selected.resolve() != local.resolve():
            shutil.copyfile(selected, local)
    elif override or os.environ.get('TEMIYAGE_CSV'):
        raise FileNotFoundError(selected)
    return local
