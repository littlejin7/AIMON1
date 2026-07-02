"""Soft-deleted account purge helper.

Usage:
  python scripts/soft_delete_purge.py
  python scripts/soft_delete_purge.py --apply
  python scripts/soft_delete_purge.py --days 30 --limit 20
"""
import argparse
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

os.environ.setdefault("SECRET_KEY", "x" * 40)

from routers.utils import purge_soft_deleted_users  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge users soft-deleted beyond a retention period.")
    parser.add_argument("--days", type=int, default=30, help="Retention days before hard delete. Default: 30")
    parser.add_argument("--apply", action="store_true", help="Actually delete matching users")
    parser.add_argument("--limit", type=int, default=20, help="How many user ids to preview in output")
    args = parser.parse_args()

    result = purge_soft_deleted_users(retention_days=args.days, dry_run=not args.apply)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] retention_days={result['retention_days']} cutoff={result['cutoff']}")
    print(f"deleted_count={result['deleted_count']}")

    preview_ids = result["deleted_user_ids"][: max(0, args.limit)]
    if preview_ids:
        print("preview_user_ids:")
        for user_id in preview_ids:
            print(f"  - {user_id}")
    else:
        print("preview_user_ids: []")

    if not args.apply:
        print("No data was deleted. Re-run with --apply to execute.")


if __name__ == "__main__":
    main()
