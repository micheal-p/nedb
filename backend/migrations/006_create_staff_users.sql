CREATE TABLE IF NOT EXISTS staff_users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    role          TEXT NOT NULL DEFAULT 'staff',  -- 'admin' | 'staff'
    password_hash TEXT NOT NULL,
    agency        TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_by    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login    TIMESTAMPTZ
);

-- Also add uploaded_by_name to upload_sessions if not already present
ALTER TABLE upload_sessions
    ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT;
