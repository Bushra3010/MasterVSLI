import { Download, Upload } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { addDays, todayISO } from "@/lib/format";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import & export" };

const TEMPLATES = {
  leads: "full_name,phone,email,city,source,course,remarks\nRohit Gupta,9876543210,rohit@example.com,Bengaluru,Website,DV,Interested in weekend batch",
  students: "full_name,phone,email,gender,course,mode,admission_date,fee,city,state,category\nNeha Rao,9876500000,neha@example.com,Female,DV,online,2026-11-20,30000,Hyderabad,Telangana,normal",
  colleges: "name,code,city,state,affiliation,type,status\nATME College of Engineering,CLG-ATME-001,Mysuru,Karnataka,VTU,Private,partner",
  hr_contacts: "full_name,designation,department,company,phone,email,personal_email,city,linkedin,joined_on,introduced_by,assigned_to\nPriya Sharma,HR Manager,Talent Acquisition,ABC Technologies,9876543210,priya@abc.example,priya.personal@example.com,Bengaluru,linkedin.com/in/priya,2026-02-01,Rakesh Kumar,Rakesh Kumar",
};

export default function ImportPage() {
  const today = todayISO();
  const exports = [
    ["/api/export/students", "Students"],
    ["/api/export/fees", "Fees & installments"],
    [`/api/export/attendance?from=${addDays(today, -30)}&to=${today}`, "Attendance (30 days)"],
    ["/api/export/placements", "Placements"],
    ["/api/export/finance", "Accounts cash book"],
    ["/api/export/leads", "Leads"],
    ["/api/export/colleges", "Colleges & TPO contacts"],
    ["/api/export/hr_contacts", "HR contacts"],
  ];
  return (
    <>
      <PageHeader title="Import & Export" subtitle="Bring in leads and students from Excel (CSV), and download any register as a CSV that opens in Excel." />
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {(["leads", "students", "colleges", "hr_contacts"] as const).map((k) => (
          <Card key={k} title={`Import ${k.replace("_", " ")}`} icon={<Upload size={15} />}>
            <p className="mb-2 text-xs text-muted">Save your Excel sheet as CSV. The first row must have these headings (extra columns are ignored):</p>
            <pre className="mb-3 overflow-x-auto rounded-[5px] bg-slate-50 p-2 text-[11px]">{TEMPLATES[k]}</pre>
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATES[k])}`} download={`${k}_template.csv`} className="mb-3 inline-flex items-center gap-1 text-xs text-brand hover:underline"><Download size={12} /> Download template</a>
            <ImportForm kind={k} />
            {k === "students" && <p className="mt-2 text-[11px] text-muted">Imported students get the course&apos;s validity and all access channels. Add their fee split afterwards from the student profile or Fees.</p>}
          </Card>
        ))}
        <Card title="Export (CSV / Excel)" icon={<Download size={15} />}>
          <ul className="space-y-2">
            {exports.map(([href, label]) => (
              <li key={href}><a href={href} className="flex items-center justify-between rounded-[5px] border border-line px-3 py-2 text-[13px] hover:border-brand"><span>{label}</span><Download size={14} className="text-brand" /></a></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
