import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvoiceDraft = {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number | null;
  lines: { description: string; product_id: string | null; quantity: number; unit_cost: number }[];
};

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["supplier_name", "invoice_number", "invoice_date", "total", "lines"],
  properties: {
    supplier_name: { type: ["string", "null"] },
    invoice_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    total: { type: ["number", "null"] },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "product_id", "quantity", "unit_cost"],
        properties: {
          description: { type: "string" },
          product_id: { type: ["string", "null"], description: "id from the catalog list, or null if no clear match" },
          quantity: { type: "number", description: "number of stock units (bottles/cans), not cases, when the pack size is clear" },
          unit_cost: { type: "number", description: "buying price per stock unit in KSh" },
        },
      },
    },
  },
} as const;

export const extractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { fileBase64: string; mimeType: string; fileName: string }) => {
    if (!TYPES.includes(i.mimeType)) throw new Error("Upload a JPG, PNG, WEBP photo or a PDF.");
    if (typeof i.fileBase64 !== "string" || i.fileBase64.length * 0.75 > MAX_BYTES) throw new Error("File is too large (max 8 MB).");
    return { ...i, fileName: String(i.fileName).slice(0, 120) };
  })
  .handler(async ({ data, context }): Promise<{ draft?: InvoiceDraft; error?: string }> => {
    const { supabase, userId } = context;
    const checks = await Promise.all(
      (["owner", "manager", "stock_manager"] as const).map((r) => supabase.rpc("has_role", { _user_id: userId, _role: r })),
    );
    if (!checks.some((c) => c.data)) throw new Error("You don't have access to purchases.");

    const { data: products } = await supabase.from("products").select("id,name").eq("active", true).order("name");
    const catalog = (products ?? []).map((p) => `${p.id} | ${p.name}`).join("\n");
    const dataUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
    const media =
      data.mimeType === "application/pdf"
        ? ({ type: "input_file", filename: data.fileName || "invoice.pdf", file_data: dataUrl } as const)
        : ({ type: "input_image", image_url: dataUrl, detail: "high" } as const);

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) return { error: "Invoice scanning isn't configured. Set OPENAI_API_KEY on the server." };

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env["OPENAI_INVOICE_MODEL"] || "gpt-4.1",
          instructions:
            "You read supplier invoices for a Kenyan bar/club. Extract the header and every product line. Amounts are KSh. Match each line to the product catalog by id only when confident; otherwise null. Use null for anything unreadable. Never invent lines.",
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: `Product catalog (id | name):\n${catalog}` }, media],
            },
          ],
          text: { format: { type: "json_schema", name: "invoice", schema, strict: true } },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
        console.error("invoice extraction failed", response.status, body?.error?.code);
        if (response.status === 402 || (response.status === 429 && body?.error?.code === "insufficient_quota"))
          return { error: "AI credits have run out. Ask the owner to top up, then try again." };
        if (response.status === 429) return { error: "Too many requests right now. Please wait a minute and try again." };
        return { error: "Couldn't read this invoice. Try a clearer photo or enter it manually." };
      }
      const res = (await response.json()) as { output?: any[] };
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
        if (item.type === "message") for (const c of item.content ?? []) if (c.type === "refusal") return { error: "The invoice could not be read." };
      }
      const draft = JSON.parse(text) as InvoiceDraft;
      const ids = new Set((products ?? []).map((p) => p.id));
      draft.lines = draft.lines.map((l) => ({ ...l, product_id: l.product_id && ids.has(l.product_id) ? l.product_id : null }));
      return { draft };
    } catch (e) {
      console.error("invoice extraction failed", e);
      return { error: "Couldn't read this invoice. Try a clearer photo or enter it manually." };
    }
  });
