import { addStaffAction } from "@/app/(staff)/actions";

/** Quick "Add staff member" form; returns to `back` with a message. */
export function AddStaffForm({ back, company = "mastervlsi", compact = false }: { back: string; company?: string; compact?: boolean }) {
  return (
    <form action={addStaffAction} className={`grid gap-2 text-xs ${compact ? "grid-cols-2" : "sm:grid-cols-3 lg:grid-cols-5"}`}>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="company" value={company} />
      <label className={`text-muted ${compact ? "col-span-2" : ""}`}>Full name *<input name="full_name" required minLength={2} className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Designation<input name="designation" placeholder="e.g. DV Trainer" className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Department<input name="department" placeholder="Training" className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Joining date<input name="joining_date" type="date" className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Monthly salary (₹)<input name="monthly_salary" type="number" min={0} className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Email<input name="email" type="email" className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Mobile<input name="phone" type="tel" className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Employee code<input name="employee_code" placeholder="Auto (MVE001…)" className="input mt-0.5 py-1.5" /></label>
      <div className={`flex items-end ${compact ? "col-span-2" : ""}`}><button className="btn-primary w-full py-1.5">+ Add staff member</button></div>
    </form>
  );
}
