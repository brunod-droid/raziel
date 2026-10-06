import ExcelJS from "exceljs";
import { KnowledgeBase, getAssistantBehaviorSections } from "@/lib/kb";

export type PendingItem = {
  target: string;
  proposed_fact: string;
  raw_input: string;
  reason: string;
  conflicting_with: string | null;
  submitted_by: string | null;
  created_at: string;
};

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF20241D" } };

function addSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][], widths: number[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  ws.getRow(1).height = 26;
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return ws;
}

export function buildJson(kb: KnowledgeBase, pending: PendingItem[]) {
  return {
    exportedAt: new Date().toISOString(),
    note: "Live export of the Raziel knowledge base, including anything added inside the app. Items in pendingValidation are not yet part of the knowledge base.",
    common: kb.common,
    sites: kb.sites,
    assistantBehaviorRules: getAssistantBehaviorSections(kb),
    pendingValidation: pending,
  };
}

export async function buildWorkbook(kb: KnowledgeBase, pending: PendingItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const behavior = getAssistantBehaviorSections(kb);
  const nSiteFacts = kb.sites.reduce((n, s) => n + s.facts.length, 0);
  const nPromos = kb.sites.reduce((n, s) => n + s.promoCodes.length, 0);
  const nSiteRules = kb.sites.reduce((n, s) => n + s.rules.length, 0);

  const readme = wb.addWorksheet("Read Me");
  readme.getColumn(1).width = 120;
  const lines: [string, boolean][] = [
    ["Raziel knowledge base, live export", true],
    [`Exported ${new Date().toISOString().slice(0, 10)}. This is the version currently live in the app, including anything added through the Add knowledge box, agent notes, or edits on the Knowledge Base page.`, false],
    ["", false],
    [`Common Facts: ${kb.common.facts.length}`, false],
    [`Common Rules: ${kb.common.rules.length}`, false],
    [`Assistant Behavior: ${behavior.length} sections of tone, writing style, incentive, language and context rules`, false],
    [`Sites: ${kb.sites.length}`, false],
    [`Site Facts: ${nSiteFacts}`, false],
    [`Site Promo Codes: ${nPromos}`, false],
    [`Site Rules: ${nSiteRules}`, false],
    [`Pending Validation: ${pending.length} items waiting for a decision, not yet part of the knowledge base`, false],
    ["", false],
    ["Not included: the single-use coupon pool (individual codes), and the login passcodes.", false],
  ];
  lines.forEach(([text, bold], i) => {
    const c = readme.getCell(i + 1, 1);
    c.value = text;
    c.font = { name: "Arial", bold, size: i === 0 ? 14 : 11 };
    c.alignment = { wrapText: true, vertical: "top" };
  });

  addSheet(wb, "Common Facts", ["#", "Fact"], kb.common.facts.map((f, i) => [i + 1, f]), [6, 140]);
  addSheet(wb, "Common Rules", ["#", "Category / Situation", "Rule"], kb.common.rules.map((r, i) => [i + 1, r.category, r.rule]), [6, 38, 120]);
  addSheet(wb, "Assistant Behavior", ["#", "Section", "Rule text"], behavior.map((b, i) => [i + 1, b.section, b.text]), [6, 38, 120]);
  addSheet(
    wb,
    "Sites",
    ["Site ID", "Name", "Domains", "Voice", "# Facts", "# Promo codes", "# Rules", "Live banner (last scan)", "Banner checked at"],
    kb.sites.map((s) => [
      s.id,
      s.name,
      s.domains.join(", ") || "(none yet)",
      s.voice,
      s.facts.length,
      s.promoCodes.length,
      s.rules.length,
      s.scrapedFacts?.homepageBanner || "",
      s.scrapedFacts?.checkedAt || "never",
    ]),
    [16, 20, 34, 100, 9, 12, 9, 50, 22]
  );
  addSheet(wb, "Site Facts", ["Site", "Fact"], kb.sites.flatMap((s) => s.facts.map((f) => [s.name, f])), [20, 140]);
  addSheet(
    wb,
    "Site Promo Codes",
    ["Site", "Code", "Discount / Gesture", "Condition", "Expiry / Status"],
    kb.sites.flatMap((s) => s.promoCodes.map((p) => [s.name, p.code, p.discount, p.condition, p.expiry])),
    [20, 22, 30, 90, 30]
  );
  addSheet(wb, "Site Rules", ["Site", "Category / Situation", "Rule"], kb.sites.flatMap((s) => s.rules.map((r) => [s.name, r.category, r.rule])), [20, 38, 120]);
  addSheet(
    wb,
    "Pending Validation",
    ["Target", "Proposed fact", "Why it's waiting", "Conflicts with", "Raw submission", "Submitted by", "Submitted at"],
    pending.map((p) => [p.target, p.proposed_fact, p.reason, p.conflicting_with || "", p.raw_input, p.submitted_by || "", p.created_at]),
    [16, 70, 60, 60, 60, 14, 22]
  );

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
