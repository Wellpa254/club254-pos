## Architecture rules
- Money and stock changes go only through security-definer SQL functions (complete_sale, receive_stock, adjust_stock, open/close_shift); a trigger blocks direct stock_qty edits so history stays consistent.
- Cost data lives in separate tables (product_costs, sale_item_costs) readable only by cost roles, so cashiers can never fetch buying prices or COGS.
- Staff accounts are created by the owner via server functions using the admin client after an owner role check; the first signup becomes owner.
- Single-tenant: one app deployment serves one club. A new club gets its own copy; the handle_new_user trigger makes the first signup the owner and club_has_owner() hides the setup screen afterwards. Never add open sign-up or per-club scoping.
- Role-to-page access is defined in src/lib/roles.ts and mirrors database policies.
- Purchases record supplier deliveries via record_purchase, which reuses receive_stock so stock and average cost stay consistent.
- Invoice scanning (src/lib/invoice.functions.ts) only returns a draft; nothing is saved until the user reviews and submits via record_purchase, so AI mistakes never touch stock.

- Offline: only the guarded src/lib/pwa.ts registers the service worker (never in dev/preview); offline sales queue in localStorage keyed by client_ref so complete_sale stays idempotent on sync.
- Product deletion goes only through the delete_product RPC: it hard-deletes only items with zero sales/purchase/movement history (cleaning product_costs first) and refuses otherwise; the UI then offers deactivation (active=false) so sales history stays intact.
- Excel exports go through src/lib/excel-export.ts: exceljs for styling plus native charts injected as DrawingML via jszip, because SheetJS community can't style or chart.
