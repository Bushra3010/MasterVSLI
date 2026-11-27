/** Blank bulk-upload template (opens in Excel). */
export function GET() {
  const body = "﻿name,phone,email,city,source,course,remarks\nRohit Gupta,9876543210,rohit@example.com,Bengaluru,Website,DV,Weekend batch\n";
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="lead_upload_template.csv"' } });
}
