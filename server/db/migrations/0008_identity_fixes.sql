-- The application's user types are 'personal' and 'company'.
ALTER TABLE users ALTER COLUMN user_type SET DEFAULT 'personal';
UPDATE users SET user_type = 'personal' WHERE user_type = 'individual';
