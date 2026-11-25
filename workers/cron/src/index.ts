/**
 * MasterVLSI scheduled jobs on Cloudflare Cron Triggers.
 *  - 06:00 IST daily: /api/cron/expiry (validity reminders + auto-expiry, alerts, fee reminders, finance)
 *  - every hour:      /api/cron/reminders (staff calendar reminders over WhatsApp / email)
 */
export interface Env {
  ERP_URL: string;
  CRON_SECRET: string;
}

const DAILY = "30 0 * * *";

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const call = (path: string) =>
      fetch(`${env.ERP_URL}${path}`, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } }).then(async (r) =>
        console.log(path, r.status, await r.text()),
      );
    ctx.waitUntil(event.cron === DAILY ? Promise.all([call("/api/cron/expiry"), call("/api/cron/reminders")]) : call("/api/cron/reminders"));
  },
} satisfies ExportedHandler<Env>;
