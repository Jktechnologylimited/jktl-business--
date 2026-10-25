CREATE TABLE IF NOT EXISTS tycoon_saves (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 document jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
