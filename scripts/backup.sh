#!/usr/bin/env bash
# نسخ احتياطي يومي لقاعدة بيانات نُزه — يحتفظ بآخر 14 نسخة فقط.
# جدولته على السيرفر (مرة واحدة):
#   crontab -e
#   0 3 * * * /path/to/nuzh/scripts/backup.sh >> /path/to/nuzh/logs/backup.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$APP_DIR/data/nuzh.db"
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB" ]; then
  echo "[backup] لا توجد قاعدة بيانات بعد — تخطي"
  exit 0
fi

STAMP=$(date +%Y-%m-%d_%H%M)
DEST="$BACKUP_DIR/nuzh-$STAMP.db"

# نسخة متسقة بدون قفل الكتابة (SQLite backup API عبر sqlite3 إن وُجد، وإلا نسخ مباشر لأن WAL يسمح بقراءة آمنة)
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$DEST'"
else
  cp "$DB" "$DEST"
fi

gzip -f "$DEST"
echo "[backup] تم: $DEST.gz"

# احتفظ بآخر 14 نسخة فقط
ls -1t "$BACKUP_DIR"/nuzh-*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm --
