/*
  # Fix API key constraint and trigger function

  - Add missing unique constraint on api_keys
  - Fix trigger to work properly with RLS and service role
  - Ensure schema path is set correctly for trigger execution
*/

ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_key_unique UNIQUE(user_id, key);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.api_keys (user_id, key, is_active)
  VALUES (NEW.id, 'mp_' || encode(gen_random_bytes(32), 'hex'), true);
  
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();