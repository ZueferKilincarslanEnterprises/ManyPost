/*
  # Add name column to api_keys table

  1. Changes
    - Add `name` column (text) to api_keys table to allow users to name their keys
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'name'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN name text DEFAULT 'Default API Key';
  END IF;
END $$;
