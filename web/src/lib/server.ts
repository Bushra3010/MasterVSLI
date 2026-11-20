import "server-only";
import { createRepo } from "./repo";
import { getServiceStore, getStore } from "./session";

/** Repo acting as the signed-in user (RLS). */
export const getRepo = async () => createRepo(await getStore());
/** Repo with service rights — webhooks and cron only. */
export const getServiceRepo = () => createRepo(getServiceStore());
