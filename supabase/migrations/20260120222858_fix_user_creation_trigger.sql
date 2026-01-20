/*
  # Fix user creation trigger
  
  Fix the trigger and function to properly create user profiles on signup
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_api_key text;
BEGIN
  new_api_key := 'mp_' || encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO public.users_profile (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.api_keys (user_id, key, is_active, created_at)
  VALUES (NEW.id, new_api_key, true, now())
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();