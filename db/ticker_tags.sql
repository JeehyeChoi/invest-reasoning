CREATE TABLE IF NOT EXISTS ticker_tags (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  tag TEXT NOT NULL,
  source_rule TEXT,

  inferred_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (ticker, tag)
);

CREATE INDEX IF NOT EXISTS idx_ticker_tags_ticker
ON ticker_tags(ticker);

CREATE INDEX IF NOT EXISTS idx_ticker_tags_tag
ON ticker_tags(tag);

ALTER TABLE IF EXISTS ticker_tags
DROP CONSTRAINT IF EXISTS ticker_tags_ticker_fkey;
