-- 納品版専用D1。各顧客に専用のWorker/DBを作成する想定。
-- 顧客データの混在を防ぐため、このDBを営業デモに接続しない。
CREATE TABLE IF NOT EXISTS customer_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO customer_state (id, version, data)
VALUES (1, 0,
  '{"businessName":"","selectedMode":"event","events":[],"registrations":[],"inquiries":[],"seq":1,"latest":null,"lpUrls":{},"businessIcon":null}'
);
