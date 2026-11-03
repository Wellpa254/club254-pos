CREATE OR REPLACE FUNCTION public.delete_product(_product uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NOT can_see_costs(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT name INTO _name FROM products WHERE id = _product;
  IF _name IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF EXISTS (SELECT 1 FROM sale_items WHERE product_id = _product)
     OR EXISTS (SELECT 1 FROM purchase_items WHERE product_id = _product)
     OR EXISTS (SELECT 1 FROM inventory_movements WHERE product_id = _product) THEN
    RAISE EXCEPTION 'This item has sales, purchases or stock history and cannot be deleted. Deactivate it instead.';
  END IF;

  DELETE FROM product_costs WHERE product_id = _product;
  DELETE FROM products WHERE id = _product;

  PERFORM log_audit('product_deleted', 'product', _product::text, jsonb_build_object('name', _name), NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_product(uuid) TO authenticated;