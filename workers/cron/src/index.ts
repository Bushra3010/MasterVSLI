/**
 * MasterVLSI daily jobs on Cloudflare Cron Triggers.
 * Calls the ERP's /api/cron/expiry (30/15/7/1-day reminders + auto-expiry) every day at 06:00 IST.
 */
export interface Env {
  ERP_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      fetch(`${env.ERP_URL}/api/cron/expiry`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (r) => console.log("expiry job", r.status, await r.text())),
    );
  },
} satisfies ExportedHandler<Env>;
