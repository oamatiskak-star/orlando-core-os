-- 031: Generieke import RPC functie voor MT940/CSV/XLSX/PDF transacties

CREATE OR REPLACE FUNCTION public.import_transactions_batch(data jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec      jsonb;
  inserted int := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    INSERT INTO public.personal_transactions (
      connection_id, external_id, booking_date, value_date, amount, currency,
      description, creditor_name, debtor_name, creditor_iban, debtor_iban,
      direction, category, subcategory, ai_confidence,
      is_salary, is_savings, is_investment, is_housing
    ) VALUES (
      (rec->>'connection_id')::uuid,
      rec->>'external_id',
      (rec->>'booking_date')::date,
      (rec->>'value_date')::date,
      (rec->>'amount')::numeric,
      COALESCE(rec->>'currency', 'EUR'),
      rec->>'description',
      rec->>'creditor_name',
      rec->>'debtor_name',
      rec->>'creditor_iban',
      rec->>'debtor_iban',
      rec->>'direction',
      COALESCE(rec->>'category', 'overig'),
      rec->>'subcategory',
      COALESCE((rec->>'ai_confidence')::numeric, 0.5),
      COALESCE((rec->>'is_salary')::boolean,    false),
      COALESCE((rec->>'is_savings')::boolean,   false),
      COALESCE((rec->>'is_investment')::boolean, false),
      COALESCE((rec->>'is_housing')::boolean,   false)
    )
    ON CONFLICT (external_id) DO NOTHING;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_transactions_batch(jsonb) TO anon, authenticated, service_role;
