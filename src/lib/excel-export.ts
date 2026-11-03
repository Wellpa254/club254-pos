// Premium Excel export: styled sheets (exceljs) + native Excel charts injected as DrawingML (jszip).
export type Cell = string | number | null;
export type XRow = Record<string, Cell>;
export type XSheet = { name: string; rows: XRow[]; key?: string };

const C = { bg: "0F0F11", panel: "17171B", band: "1D1C21", line: "3A3428", gold: "C9A961", goldHi: "E8D9B0", text: "EDE6D6", muted: "9A9488", red: "E06C5A", green: "7FB98A", amber: "E0A85A" };
const PALETTE = ["C9A961", "7FB98A", "6FA3C7", "E0A85A", "B58ACF", "E06C5A", "8FA39A", "D9C38A"];
const KSH = '#,##0;[Red]-#,##0;"–"';
const FONT = "Arial";

type Chart = { title: string; kind: "col" | "bar" | "doughnut"; cats: string[]; series: { name: string; values: number[] }[] };
type Kpi = { label: string; value: number; note: string; fmt?: string; color?: string };

const num = (v: Cell | undefined) => (typeof v === "number" ? v : Number(v) || 0);
const groupSum = (rows: XRow[], k: string, v: string) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r[k] || "Other"), (m.get(String(r[k] || "Other")) ?? 0) + num(r[v]));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

/** Derive dashboard KPIs and chart data from whichever report sheets are present. */
export function summarize(sheets: XSheet[]) {
  const by = (k: string) => sheets.find((s) => s.key === k)?.rows;
  const pnl = by("pnl"), sales = by("sales"), products = by("products"), expenses = by("expenses"), stock = by("stock"), purchases = by("purchases");
  const kpis: Kpi[] = [], charts: Chart[] = [];
  const done = sales?.filter((s) => s["Status"] === "completed");
  const revenue = pnl ? pnl.reduce((a, r) => a + num(r["Revenue (KSh)"]), 0) : done?.reduce((a, r) => a + num(r["Total (KSh)"]), 0);
  const count = pnl ? pnl.reduce((a, r) => a + num(r["Sales"]), 0) : done?.length;
  if (revenue !== undefined) kpis.push({ label: "TOTAL REVENUE", value: revenue, note: "KSh, completed sales", color: C.gold });
  if (pnl) kpis.push({ label: "NET PROFIT", value: pnl.reduce((a, r) => a + num(r["Net profit (KSh)"]), 0), note: "KSh after COGS & expenses", color: C.green });
  if (count !== undefined) kpis.push({ label: "TRANSACTIONS", value: count, note: "completed sales", fmt: "#,##0" });
  if (revenue !== undefined && count) kpis.push({ label: "AVERAGE SALE", value: Math.round(revenue / count), note: "KSh per transaction" });
  const activeExp = expenses?.filter((e) => e["Status"] === "Active");
  const expTotal = pnl ? pnl.reduce((a, r) => a + num(r["Expenses (KSh)"]), 0) : activeExp?.reduce((a, r) => a + num(r["Amount (KSh)"]), 0);
  if (expTotal !== undefined) kpis.push({ label: "EXPENSES", value: expTotal, note: "KSh, excluding voided", color: C.red });
  if (stock) kpis.push({ label: "STOCK VALUE", value: stock.reduce((a, r) => a + num(r["Stock value (KSh)"]), 0), note: `${stock.filter((s) => s["Low"] === "Yes").length} items low on stock` });
  if (purchases) kpis.push({ label: "PURCHASES", value: purchases.reduce((a, r) => a + num(r["Total (KSh)"]), 0), note: `KSh, ${purchases.filter((p) => p["Paid"] === "No").length} unpaid` });

  if (pnl?.length) charts.push({ title: "Daily revenue vs net profit (KSh)", kind: "col", cats: pnl.map((r) => String(r["Date"]).slice(5)), series: [{ name: "Revenue", values: pnl.map((r) => num(r["Revenue (KSh)"])) }, { name: "Net profit", values: pnl.map((r) => num(r["Net profit (KSh)"])) }] });
  if (done?.length) { const g = groupSum(done, "Payment", "Total (KSh)"); charts.push({ title: "Payment methods", kind: "doughnut", cats: g.map((x) => cap(x[0])), series: [{ name: "KSh", values: g.map((x) => x[1]) }] }); }
  if (products?.length) { const t = products.slice(0, 10); charts.push({ title: "Top 10 products by revenue (KSh)", kind: "bar", cats: t.map((r) => String(r["Product"])), series: [{ name: "Revenue", values: t.map((r) => num(r["Revenue (KSh)"])) }] }); }
  if (activeExp?.length) { const g = groupSum(activeExp, "Category", "Amount (KSh)"); charts.push({ title: "Expenses by category", kind: "doughnut", cats: g.map((x) => x[0]), series: [{ name: "KSh", values: g.map((x) => x[1]) }] }); }
  if (stock?.length) { const g = groupSum(stock, "Category", "Stock value (KSh)").filter((x) => x[1] > 0); if (g.length) charts.push({ title: "Stock value by category", kind: "doughnut", cats: g.map((x) => x[0]), series: [{ name: "KSh", values: g.map((x) => x[1]) }] }); }
  if (purchases?.length) { const g = groupSum(purchases, "Supplier", "Total (KSh)").slice(0, 10); charts.push({ title: "Purchases by supplier (KSh)", kind: "bar", cats: g.map((x) => x[0]), series: [{ name: "Purchases", values: g.map((x) => x[1]) }] }); }
  return { kpis, charts };
}

const fill = (c: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF" + c } });
const font = (c: string, size = 10, bold = false, extra: object = {}) => ({ name: FONT, size, bold, color: { argb: "FF" + c }, ...extra });
const colL = (n: number) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const esc = (s: string | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const qs = (n: string) => `'${n.replace(/'/g, "''")}'`;

type Anchor = { c1: number; r1: number; c2: number; r2: number; o1: number; o2: number };
type Placed = Chart & { anchor: Anchor; catRef: string; valRefs: string[] };

// ---------- chart XML ----------
const solid = (c: string) => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
const txPr = (c: string, sz = 900, b = 0) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}">${solid(c)}<a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
function chartXml(ch: Placed) {
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1">${solid(C.goldHi)}</a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1">${solid(C.goldHi)}<a:latin typeface="${FONT}"/></a:rPr><a:t>${esc(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const cat = `<c:cat><c:strRef><c:f>${esc(ch.catRef)}</c:f></c:strRef></c:cat>`;
  const val = (i: number) => `<c:val><c:numRef><c:f>${esc(ch.valRefs[i])}</c:f></c:numRef></c:val>`;
  const noLine = `<a:ln><a:noFill/></a:ln>`;
  let plot = "";
  if (ch.kind === "doughnut") {
    const dpts = ch.cats.map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr>${solid(PALETTE[k % PALETTE.length]!)}<a:ln w="19050">${solid(C.panel)}</a:ln></c:spPr></c:dPt>`).join("");
    const lbl = `<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/>${noLine}</c:spPr>${txPr(C.text, 900, 1)}<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>`;
    plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${esc(ch.series[0]!.name)}</c:v></c:tx>${dpts}${lbl}${cat}${val(0)}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="60"/></c:doughnutChart>`;
  } else {
    const bar = ch.kind === "bar";
    const sers = ch.series.map((s, i) => {
      const lbl = bar ? `<c:dLbls><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:spPr><a:noFill/>${noLine}</c:spPr>${txPr(C.text, 800, 1)}<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` : "";
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx><c:spPr>${solid(i === 0 ? C.gold : C.green)}${noLine}</c:spPr><c:invertIfNegative val="0"/>${lbl}${cat}${val(i)}</c:ser>`;
    }).join("");
    const axLine = `<c:spPr><a:ln w="6350">${solid(C.line)}</a:ln></c:spPr>`;
    plot = `<c:barChart><c:barDir val="${bar ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${bar ? 45 : 70}"/><c:overlap val="-10"/><c:axId val="101"/><c:axId val="102"/></c:barChart>`
      + `<c:catAx><c:axId val="101"/><c:scaling><c:orientation val="${bar ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${bar ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${axLine}${txPr(C.muted, 800)}<c:crossAx val="102"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="102"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${bar ? 1 : 0}"/><c:axPos val="${bar ? "t" : "l"}"/><c:majorGridlines><c:spPr><a:ln w="6350">${solid("26242A")}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${noLine}</c:spPr>${txPr(C.muted, 800)}<c:crossAx val="101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  }
  const legend = ch.kind === "bar" ? "" : `<c:legend><c:legendPos val="${ch.kind === "doughnut" ? "r" : "t"}"/><c:overlay val="0"/>${txPr(C.text, 900)}</c:legend>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${title}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/>${noLine}</c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${solid(C.panel)}<a:ln w="9525">${solid(C.line)}</a:ln></c:spPr>${txPr(C.text)}</c:chartSpace>`;
}
function drawingXml(charts: Placed[]) {
  const anchors = charts.map((ch, i) => { const a = ch.anchor; return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${a.c1}</xdr:col><xdr:colOff>${a.o1}</xdr:colOff><xdr:row>${a.r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${a.o2 < 0 ? a.c2 - 1 : a.c2}</xdr:col><xdr:colOff>${a.o2 < 0 ? 720000 : 0}</xdr:colOff><xdr:row>${a.r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`; }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`;
}

async function injectCharts(buf: ArrayBuffer, charts: Placed[]) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  charts.forEach((ch, i) => zip.file(`xl/charts/chart${i + 1}.xml`, chartXml(ch)));
  zip.file("xl/drawings/drawing1.xml", drawingXml(charts));
  zip.file("xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${charts.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/chart" Target="../charts/chart${i + 1}.xml"/>`).join("")}</Relationships>`);
  const relsPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const rel = `<Relationship Id="rIdC254Drw" Type="${R}/drawing" Target="../drawings/drawing1.xml"/>`;
  const existing = await zip.file(relsPath)?.async("string");
  zip.file(relsPath, existing ? existing.replace("</Relationships>", rel + "</Relationships>") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`);
  let sheet = (await zip.file("xl/worksheets/sheet1.xml")!.async("string"));
  if (!/<worksheet[^>]*xmlns:r=/.test(sheet)) sheet = sheet.replace("<worksheet", `<worksheet xmlns:r="${R}"`);
  const tag = `<drawing r:id="rIdC254Drw"/>`;
  const m = sheet.match(/<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
  sheet = m ? sheet.replace(m[0], tag + m[0]) : sheet.replace("</worksheet>", tag + "</worksheet>");
  zip.file("xl/worksheets/sheet1.xml", sheet);
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  ct = ct.replace("</Types>", `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${charts.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join("")}</Types>`);
  zip.file("[Content_Types].xml", ct);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

const SUM_COLS = /\(KSh\)|^Qty sold$|^Sales$/;
const NO_SUM = /Avg cost|Selling price/;

/** Build the workbook bytes. */
export async function buildWorkbook(sheets: XSheet[], opts: { title: string; period: string; generated: string }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Club254";
  wb.created = new Date();
  const { kpis, charts } = summarize(sheets);
  const withDash = kpis.length > 0 || charts.length > 0;
  const names = sheets.map((s) => s.name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31));
  const placed: Placed[] = [];

  if (withDash) {
    const ws = wb.addWorksheet("Dashboard", { views: [{ showGridLines: false, zoomScale: 90 }], properties: { tabColor: { argb: "FF" + C.gold } } });
    const W = 16; // B..Q
    ws.getColumn(1).width = 3;
    for (let c = 2; c <= W + 1; c++) ws.getColumn(c).width = 11.5;
    ws.getColumn(W + 2).width = 3;
    for (let r = 1; r <= 120; r++) for (let c = 1; c <= W + 2; c++) ws.getCell(r, c).fill = fill(C.bg);
    const put = (r: number, c: number, v: unknown, f: object, extra: Record<string, unknown> = {}) => { const cell = ws.getCell(r, c); cell.value = v as never; cell.font = f as never; Object.assign(cell, extra); return cell; };

    // Header band
    for (let c = 2; c <= W + 1; c++) { ws.getCell(2, c).fill = fill(C.panel); ws.getCell(3, c).fill = fill(C.panel); ws.getCell(4, c).fill = fill(C.panel); ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: "FF" + C.gold } } }; }
    ws.getRow(2).height = 20; ws.getRow(3).height = 34; ws.getRow(4).height = 22;
    put(2, 2, "◆  CLUB254", font(C.gold, 10, true, { charSpacing: 2 }));
    put(3, 2, opts.title, font(C.text, 22, true, { name: "Georgia" }));
    put(4, 2, `Report period: ${opts.period}`, font(C.muted, 10));
    put(2, W + 1, "CONFIDENTIAL", font(C.gold, 9, true), { alignment: { horizontal: "right" } });
    put(4, W + 1, `Generated ${opts.generated}`, font(C.muted, 9), { alignment: { horizontal: "right" } });

    // KPI tiles
    const tiles = kpis.slice(0, 5), tw = Math.floor(W / Math.max(tiles.length, 1));
    tiles.forEach((k, i) => {
      const c1 = 2 + i * tw, c2 = c1 + tw - 2;
      for (let r = 6; r <= 9; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = fill(C.panel);
      for (let c = c1; c <= c2; c++) ws.getCell(6, c).border = { top: { style: "thick", color: { argb: "FF" + (k.color ?? C.goldHi) } } };
      ws.mergeCells(7, c1, 7, c2); ws.mergeCells(8, c1, 8, c2); ws.mergeCells(9, c1, 9, c2);
      put(7, c1, k.label, font(C.muted, 9, true), { alignment: { indent: 1 } });
      put(8, c1, k.value, font(k.color ?? C.text, 20, true), { numFmt: k.fmt ?? KSH, alignment: { indent: 1, horizontal: "left" } });
      put(9, c1, k.note, font(C.muted, 8, false, { italic: true }), { alignment: { indent: 1 } });
    });
    ws.getRow(8).height = 32;
    ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    // Sheet links
    put(11, 2, "SHEETS", font(C.gold, 9, true));
    names.forEach((n, i) => put(11, 4 + i * 2, { text: `› ${n}`, hyperlink: `#${qs(n)}!A1` }, font(C.text, 9, false, { underline: false })));

    // Chart data tables (below the charts) + chart anchors
    const rowsPer = 18, dataTop = 13 + Math.ceil(charts.length / 2) * (rowsPer + 1) + 2;
    put(dataTop - 1, 2, "CHART DATA", font(C.gold, 9, true));
    charts.forEach((ch, i) => {
      const col = 2 + (i % 4) * 4, top = dataTop + Math.floor(i / 4) * 36;
      put(top, col, ch.title.toUpperCase(), font(C.goldHi, 8, true));
      put(top + 1, col, "ITEM", font(C.gold, 8, true), { fill: fill(C.panel) });
      ch.series.forEach((s, j) => put(top + 1, col + 1 + j, s.name.toUpperCase(), font(C.gold, 8, true), { fill: fill(C.panel), alignment: { horizontal: "right" } }));
      ch.cats.forEach((cat, k) => {
        const r = top + 2 + k, band = k % 2 ? C.band : C.bg;
        put(r, col, cat, font(C.text, 9), { fill: fill(band) });
        ch.series.forEach((s, j) => put(r, col + 1 + j, s.values[k], font(C.text, 9), { numFmt: KSH, fill: fill(band) }));
      });
      const L = (c: number) => `$${colL(c)}$${top + 2}:$${colL(c)}$${top + 1 + ch.cats.length}`;
      const half = W / 2, row0 = 13 + Math.floor(i / 2) * (rowsPer + 1);
      placed.push({ ...ch, catRef: `Dashboard!${L(col)}`, valRefs: ch.series.map((_, j) => `Dashboard!${L(col + 1 + j)}`), anchor: { c1: 1 + (i % 2) * half, r1: row0 - 1, c2: 1 + (i % 2) * half + half, r2: row0 - 1 + rowsPer, o1: i % 2 ? 90000 : 0, o2: i % 2 ? 0 : -90000 } });
    });
    const foot = dataTop + Math.ceil(Math.max(charts.length, 1) / 4) * 36;
    put(foot, 2, "Club254  •  Figures in KSh, Africa/Nairobi time  •  Generated from your live records", font(C.muted, 8, false, { italic: true }));
  }

  // Data sheets
  sheets.forEach((s, si) => {
    const ws = wb.addWorksheet(names[si], { views: [{ state: "frozen", ySplit: 4, showGridLines: false }], properties: { tabColor: { argb: "FF" + C.line } } });
    const rows = s.rows.length ? s.rows : [{ Note: "No data in this period" }];
    const cols = Object.keys(rows[0]!);
    const n = cols.length;
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= n; c++) ws.getCell(r, c).fill = fill(C.panel);
    ws.getRow(1).height = 28;
    Object.assign(ws.getCell(1, 1), { value: s.name, font: font(C.text, 16, true, { name: "Georgia" }) });
    Object.assign(ws.getCell(2, 1), { value: `Club254  •  ${opts.period}  •  ${rows === s.rows ? rows.length : 0} rows`, font: font(C.muted, 9) });
    if (withDash) Object.assign(ws.getCell(2, n), { value: { text: "‹ Dashboard", hyperlink: "#Dashboard!A1" }, font: font(C.gold, 9, true), alignment: { horizontal: "right" } });
    for (let c = 1; c <= n; c++) ws.getCell(3, c).border = { bottom: { style: "medium", color: { argb: "FF" + C.gold } } };

    const isNum = cols.map((k) => rows.some((r) => typeof r[k] === "number"));
    const hdr = ws.getRow(4); hdr.height = 22;
    cols.forEach((k, i) => { const c = hdr.getCell(i + 1); c.value = k.toUpperCase(); c.font = font(C.gold, 9, true) as never; c.fill = fill(C.bg); c.alignment = { vertical: "middle", horizontal: isNum[i] ? "right" : "left" }; c.border = { bottom: { style: "thin", color: { argb: "FF" + C.line } } }; });
    rows.forEach((r, ri) => {
      const row = ws.getRow(5 + ri), band = ri % 2 ? C.band : C.panel;
      cols.forEach((k, i) => {
        const c = row.getCell(i + 1), v = r[k];
        c.value = v ?? "";
        c.fill = fill(band);
        let color = C.text;
        const sv = String(v ?? "");
        if (/^Voided/.test(sv) || (k === "Low" && sv === "Yes") || sv === "refunded" || sv === "voided") color = C.red;
        else if (k === "Paid") color = sv === "Yes" ? C.green : C.amber;
        else if (k.startsWith("Net profit") && typeof v === "number") color = v < 0 ? C.red : C.green;
        c.font = font(color, 10, i === 0) as never;
        if (isNum[i]) c.numFmt = /\(KSh\)/.test(k) ? KSH : "#,##0";
        c.border = { bottom: { style: "hair", color: { argb: "FF" + C.line } } };
      });
    });
    if (s.rows.length) {
      const tr = ws.getRow(5 + rows.length); tr.height = 22;
      cols.forEach((k, i) => {
        const c = tr.getCell(i + 1);
        c.fill = fill(C.bg); c.font = font(C.gold, 10, true) as never;
        c.border = { top: { style: "medium", color: { argb: "FF" + C.gold } }, bottom: { style: "double", color: { argb: "FF" + C.gold } } };
        if (i === 0) c.value = "TOTAL";
        else if (isNum[i] && SUM_COLS.test(k) && !NO_SUM.test(k)) { const L = colL(i + 1); c.value = { formula: `SUBTOTAL(109,${L}5:${L}${4 + rows.length})` } as never; c.numFmt = /\(KSh\)/.test(k) ? KSH : "#,##0"; }
      });
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: n } };
    }
    cols.forEach((k, i) => { const w = Math.max(k.length + 4, ...rows.slice(0, 300).map((r) => String(r[k] ?? "").length + 2)); ws.getColumn(i + 1).width = Math.min(Math.max(w, 10), 48); });
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4" };
  });

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return placed.length ? injectCharts(buf, placed) : new Uint8Array(buf);
}
