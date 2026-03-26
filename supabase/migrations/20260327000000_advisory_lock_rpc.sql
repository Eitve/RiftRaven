-- Advisory lock RPCs for preventing duplicate concurrent profile compilation.
-- Uses session-level locks (not transaction-level) so the lock persists across
-- multiple queries within the same Edge Function invocation.

CREATE OR REPLACE FUNCTION try_compile_lock(pid TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext(pid));
END;
$$;

CREATE OR REPLACE FUNCTION release_compile_lock(pid TEXT)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext(pid));
END;
$$;
