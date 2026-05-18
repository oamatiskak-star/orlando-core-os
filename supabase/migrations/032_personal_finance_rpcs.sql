-- 032: Personal Finance RPC functies voor maandoverzicht en trend

-- Maandaggregatie: inkomsten / uitgaven / cashflow per maand voor een jaar
CREATE OR REPLACE FUNCTION public.personal_finance_maanden(p_jaar integer DEFAULT NULL)
RETURNS TABLE (
  maand       text,
  inkomsten   numeric,
  uitgaven    numeric,
  cashflow    numeric,
  sparen      numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    to_char(booking_date, 'YYYY-MM')               AS maand,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS inkomsten,
    SUM(CASE WHEN direction = 'debet'  THEN amount ELSE 0 END) AS uitgaven,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS cashflow,
    SUM(CASE WHEN is_savings = true    THEN amount ELSE 0 END) AS sparen
  FROM public.personal_transactions
  WHERE EXTRACT(YEAR FROM booking_date) = COALESCE(p_jaar, EXTRACT(YEAR FROM CURRENT_DATE))
  GROUP BY to_char(booking_date, 'YYYY-MM')
  ORDER BY maand;
$$;

-- Trend: jaarlijkse inkomsten/uitgaven voor de laatste 3 jaar
CREATE OR REPLACE FUNCTION public.personal_finance_trend()
RETURNS TABLE (
  jaar        integer,
  inkomsten   numeric,
  uitgaven    numeric,
  cashflow    numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    EXTRACT(YEAR FROM booking_date)::integer       AS jaar,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS inkomsten,
    SUM(CASE WHEN direction = 'debet'  THEN amount ELSE 0 END) AS uitgaven,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS cashflow
  FROM public.personal_transactions
  WHERE booking_date >= (CURRENT_DATE - INTERVAL '3 years')
  GROUP BY EXTRACT(YEAR FROM booking_date)
  ORDER BY jaar;
$$;

-- Categorie samenvatting voor een maand (voor budget vs. actuals)
CREATE OR REPLACE FUNCTION public.personal_finance_cat_maand(p_month text)
RETURNS TABLE (
  category  text,
  uitgaven  numeric,
  inkomsten numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    category,
    SUM(CASE WHEN direction = 'debet'  THEN amount ELSE 0 END) AS uitgaven,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS inkomsten
  FROM public.personal_transactions
  WHERE to_char(booking_date, 'YYYY-MM') = p_month
  GROUP BY category
  ORDER BY uitgaven DESC;
$$;

GRANT EXECUTE ON FUNCTION public.personal_finance_maanden(integer)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.personal_finance_trend()             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.personal_finance_cat_maand(text)    TO authenticated, service_role;
