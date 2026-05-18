
CREATE OR REPLACE FUNCTION public._mig_dump_auth_users()
RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS
$$ SELECT to_jsonb(u) FROM auth.users u $$;

CREATE OR REPLACE FUNCTION public._mig_dump_auth_identities()
RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS
$$ SELECT to_jsonb(i) FROM auth.identities i $$;

GRANT EXECUTE ON FUNCTION public._mig_dump_auth_users() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public._mig_dump_auth_identities() TO postgres, service_role;
