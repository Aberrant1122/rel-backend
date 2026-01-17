ALTER TABLE google_oauth_tokens ADD COLUMN google_email VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id;
ALTER TABLE google_oauth_tokens ADD INDEX idx_google_email (google_email);

