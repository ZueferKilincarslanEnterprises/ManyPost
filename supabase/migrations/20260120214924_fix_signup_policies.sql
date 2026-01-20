/*
  # Fix signup policies
  
  Allow service role to insert user profiles during signup
*/

DROP POLICY IF EXISTS "Users can insert own profile" ON users_profile;

CREATE POLICY "Service can insert user profiles"
  ON users_profile FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can insert own profile"
  ON users_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);