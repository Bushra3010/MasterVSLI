import { Check } from "lucide-react";

type Item = { n: number; title: string; sub?: string; href: string; tone: { badge: string; head: string; border: string }; points: (string | [string, string])[] };

const T = {
  blue: { badge: "bg-blue-600", head: "from-blue-100 to-blue-50 text-[#1d3c8f]", border: "border-blue-200" },
  orange: { badge: "bg-orange-500", head: "from-amber-100 to-amber-50 text-[#1d3c8f]", border: "border-amber-200" },
  red: { badge: "bg-rose-500", head: "from-rose-100 to-rose-50 text-[#1d3c8f]", border: "border-rose-200" },
  violet: { badge: "bg-violet-600", head: "from-violet-100 to-violet-50 text-[#1d3c8f]", border: "border-violet-200" },
  green: { badge: "bg-emerald-600", head: "from-emerald-100 to-emerald-50 text-[#1d3c8f]", border: "border-emerald-200" },
  sky: { badge: "bg-sky-600", head: "from-sky-100 to-sky-50 text-[#1d3c8f]", border: "border-sky-200" },
  pink: { badge: "bg-pink-500", head: "from-pink-100 to-pink-50 text-[#1d3c8f]", border: "border-pink-200" },
};

const ITEMS: Item[] = [
  {
    n: 1, title: "Admin Master Data", sub: "(Add / Remove from Dropdown)", href: "#master", tone: T.blue,
    points: [["Branch / Domain", "+ Add / Remove"], ["Course", "+ Add / Remove"], ["Batch", "+ Add / Remove"], ["Training Mode (Online / Offline)", "+ Add / Remove"], ["Validity Type (in Months) – 3 / 6 / 9 / 12 etc.", ""]],
  },
  {
    n: 2, title: "Student Data Flexibility", href: "#personal", tone: T.orange,
    points: ["Any authorized user (Student / Office) can fill or edit Personal, Family, Education, Course, Professional & Placement details (role-based).", "Profile editable during admission itself."],
  },
  {
    n: 3, title: "Education Details", sub: "(Vertical)", href: "#education", tone: T.red,
    points: ["10th, 12th, B.E./B.Tech/B.Sc (Graduation), M.E./M.Tech (Post Graduation) – Vertical view.", "Board, University, Stream, State – Dropdown with add/remove (e.g., Karnataka State Board, AP State Board, etc.)."],
  },
  {
    n: 4, title: "College Details", href: "#college", tone: T.violet,
    points: ["Capture 2–3 key college contacts – TPO, HOD, Principal (or Faculty).", "Position dropdown (add/remove), with Name, Mobile, Email."],
  },
  {
    n: 5, title: "Professional Information", sub: "(Split)", href: "#professional", tone: T.green,
    points: ["Before joining MasterVLSI – Working/Fresher, Company, Designation, Experience, Duration, Location.", "After joining MasterVLSI – Placement details (Company, Package, DOJ, HR POC, Email, Job Location)."],
  },
  {
    n: 6, title: "Access, Tools & Attendance", href: "#attendance", tone: T.sky,
    points: ["TeamViewer, Zoom Email ID, Biometric ID – in one section.", "Attendance (View/Mark) next to access details."],
  },
  {
    n: 7, title: "Documents", sub: "(Minimal)", href: "#documents", tone: T.pink,
    points: ["Only Photo, Resume and ID Proof.", "No academic documents or other documents."],
  },
];

/** "Key Improvements / Additions" panel shown beside the student profile. */
export function KeyImprovements() {
  return (
    <aside aria-label="Key improvements and additions" className="overflow-hidden rounded-[6px] border-2 border-red-500 bg-white shadow-sm">
      <h2 className="bg-gradient-to-r from-red-600 to-rose-500 px-3 py-2 text-center text-[16px] font-bold text-white">Key Improvements / Additions</h2>
      <div className="space-y-2.5 p-2.5">
        {ITEMS.map((it) => (
          <section key={it.n} className={`overflow-hidden rounded-[6px] border ${it.tone.border} bg-white`}>
            <a href={it.href} className={`flex items-center gap-2 bg-gradient-to-r px-2.5 py-1.5 ${it.tone.head} hover:brightness-95`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white ${it.tone.badge}`}>{it.n}</span>
              <span className="text-[14px] leading-tight font-bold">
                {it.title}
                {it.sub && <span className="ml-1 text-[12px] font-semibold">{it.sub}</span>}
              </span>
            </a>
            <ul className="space-y-1 px-2.5 py-2 text-[12px] leading-snug text-[#1f2a44]">
              {it.points.map((p, i) => (
                <li key={i} className="flex gap-1.5">
                  <Check size={14} className="mt-px shrink-0 text-emerald-600" strokeWidth={3} />
                  {Array.isArray(p) ? (
                    <span className="flex flex-1 justify-between gap-2">
                      <span>{p[0]}</span>
                      {p[1] && <span className="shrink-0 font-medium text-[#1d3c8f]">{p[1]}</span>}
                    </span>
                  ) : (
                    <span>{p}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
