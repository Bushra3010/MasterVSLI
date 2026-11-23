import "server-only";
import { createRepo } from "./repo";
import { getServiceStore, getStore } from "./session";
import { isSupabaseConfigured } from "./supabase/clients";

/** Repo acting as the signed-in user (RLS). */
export const getRepo = async () => createRepo(await getStore());
/** Repo with service rights — webhooks and cron only. */
export const getServiceRepo = () => createRepo(getServiceStore());

/**
 * Read-only access for a signed-in student's *own* profile. Attendance % needs the institute-wide
 * count of class days, which RLS hides from students, so this reads with service rights when available.
 * Callers must pass only the session's own studentId.
 */
export const getStudentReadRepo = async () =>
  isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY ? getServiceRepo() : getRepo();

/** Finance repo acting as the signed-in user (database restricts finance tables to admins). */
export const getFinance = async () => {
  const { createFinanceRepo } = await import("./finance");
  return createFinanceRepo(await getStore());
};
/** Finance repo with service rights — daily job only. */
export const getServiceFinance = async () => {
  const { createFinanceRepo } = await import("./finance");
  return createFinanceRepo(getServiceStore());
};
