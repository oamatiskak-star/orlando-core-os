-- ============================================================================
-- Migration 142: ai_models — cloud reasoning/classification tiers seeden
-- ============================================================================
-- Zonder reasoning-tier-modellen kan de council GPT/Claude niet routeren →
-- degradeert stil naar local-only. Additief: seed Anthropic + OpenAI tiers.
-- Local-first blijft: ollama heeft hoogste effectieve voorrang via routing-rules.
-- ============================================================================
insert into public.ai_models
  (provider, model_id, display_name, tier, context_window, cost_in_per_mtok, cost_out_per_mtok,
   is_local, is_available, priority, capabilities, health_status)
values
  ('anthropic','claude-sonnet-4-6','Claude Sonnet 4.6','reasoning', 200000, 3.0, 15.0, false, true, 90, array['reasoning','vision'],'healthy'),
  ('anthropic','claude-haiku-4-5-20251001','Claude Haiku 4.5','classification', 200000, 1.0, 5.0, false, true, 50, array['classification'],'healthy'),
  ('openai','gpt-4o','GPT-4o','reasoning', 128000, 2.5, 10.0, false, true, 70, array['reasoning','vision'],'healthy'),
  ('openai','gpt-4o-mini','GPT-4o mini','classification', 128000, 0.15, 0.6, false, true, 45, array['classification'],'healthy')
on conflict (provider, model_id) do update
  set tier = excluded.tier, is_available = excluded.is_available, priority = excluded.priority,
      cost_in_per_mtok = excluded.cost_in_per_mtok, cost_out_per_mtok = excluded.cost_out_per_mtok,
      health_status = excluded.health_status;
