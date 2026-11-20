import { Bell, Mail, MessageCircle, Send } from "lucide-react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/format";
import { AUDIENCES, emailConfigured, whatsappConfigured } from "@/lib/messaging";
import { getRepo } from "@/lib/server";
import { BroadcastForm } from "./broadcast-form";

export const metadata = { title: "Communication" };

export default async function CommunicationPage() {
  const repo = await getRepo();
  const [messages, notifications, batches, students] = await Promise.all([repo.messages(), repo.notifications(), repo.batches(), repo.students()]);
  const name = new Map(students.map((s) => [s.id, s.full_name]));
  const email = emailConfigured();
  const wa = whatsappConfigured();

  return (
    <>
      <PageHeader title="Communication" subtitle="WhatsApp and email broadcasts to students, plus the automatic validity notifications." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="WhatsApp API" value={wa ? "Connected" : "Not set up"} tone={wa ? "green" : "amber"} icon={<MessageCircle size={16} />} hint={wa ? undefined : "Click-to-chat links used instead"} />
        <Stat label="Email (Resend)" value={email ? "Connected" : "Not set up"} tone={email ? "green" : "amber"} icon={<Mail size={16} />} />
        <Stat label="Broadcasts sent" value={messages.length} tone="blue" icon={<Send size={16} />} />
        <Stat label="Pending notifications" value={notifications.filter((n) => !n.sent_at).length} tone="red" icon={<Bell size={16} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="New message">
          <BroadcastForm audiences={AUDIENCES} batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
        </Card>

        <Card title="Message history" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Channel</th><th>Audience</th><th>Message</th><th>Delivered</th></tr></thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td><Badge tone={m.channel === "whatsapp" ? "green" : "blue"}>{m.channel === "whatsapp" ? "WhatsApp" : "Email"}</Badge></td>
                  <td className="text-sm">{m.audience}</td>
                  <td className="max-w-80 text-sm">{m.subject && <div className="font-medium">{m.subject}</div>}<div className="line-clamp-2 text-muted">{m.body}</div></td>
                  <td className="whitespace-nowrap text-sm tabular-nums">{m.sent} / {m.recipients}<div className="text-[11px] text-muted">{m.status}</div></td>
                </tr>
              ))}
              {!messages.length && <tr><td colSpan={5} className="text-center text-muted">No broadcasts yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Automatic notifications (validity reminders & expiry)" icon={<Bell size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Created</th><th>Student</th><th>Notice</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td>{fmtDate(n.created_at)}</td>
                <td>{name.get(n.student_id) ?? "—"}</td>
                <td>{n.kind === "expired" ? "Access expired" : titleCase(n.kind).replace("Expiry ", "Expires in ") + " days"}</td>
                <td className="capitalize">{n.channel}</td>
                <td>{n.sent_at ? <Badge tone="green">Sent {fmtDate(n.sent_at)}</Badge> : <Badge tone="amber">Pending</Badge>}</td>
              </tr>
            ))}
            {!notifications.length && <tr><td colSpan={5} className="text-center text-muted">No notifications yet. They are created by the daily expiry run (Training validity page).</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
