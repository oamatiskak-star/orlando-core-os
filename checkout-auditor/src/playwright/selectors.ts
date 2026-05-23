/**
 * Aquier.com DOM selector library — centraal versionable.
 *
 * Selectors are intentionally fuzzy (text-based + role-based) to survive
 * markup changes that don't affect the actual user-visible UX.
 *
 * If a selector breaks, the auditor will report this as `ux_friction` /
 * `accessibility` finding rather than crashing — runtime resilience matters.
 */

export const MEMBERSHIP_SELECTORS = {
  // Aquier.com uses #tier-<code> as the tier card id; keep fallbacks for other naming conventions
  tier_card_by_name: (displayName: string) => `:text-is("${displayName}")`,
  tier_card_by_code: (code: string) => `#tier-${code}, [data-tier="${code}"], [data-tier-code="${code}"]`,

  cta_button_within_tier: [
    'button:has-text("Lid worden")',     // Aquier NL primary (verified on live site)
    'a:has-text("Lid worden")',
    'button:has-text("Become a member")',
    'button:has-text("Word lid")',
    'button:has-text("Aanmelden")',
    'role=button[name*="Start"]',
    'role=button[name*="Subscribe"]',
    'role=link[name*="Choose"]',
    'button.bg-gold-500',                 // class-based fallback (Aquier brand)
  ],

  monthly_toggle: ['role=tab[name="Monthly"]', 'role=tab[name="Maandelijks"]', 'button:has-text("Monthly")', 'button:has-text("Maandelijks")', 'button:has-text("Maand")'],
  yearly_toggle: ['role=tab[name="Yearly"]', 'role=tab[name="Jaarlijks"]', 'button:has-text("Yearly")', 'button:has-text("Jaarlijks")', 'button:has-text("Annual")', 'button:has-text("Per jaar")'],
  quarterly_toggle: ['role=tab[name="Quarterly"]', 'role=tab[name="Per kwartaal"]', 'button:has-text("Quarterly")', 'button:has-text("Kwartaal")'],

  price_text_pattern: /€\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g,
  vat_label_keywords: ['vat', 'btw', 'incl.', 'excl.', 'reverse charge'],
  sales_contact_indicator_text: ['Prijs op aanvraag', 'Contact sales', 'Op aanvraag', 'Custom pricing', 'On request'],
}

export const STRIPE_CHECKOUT_SELECTORS = {
  url_pattern: /checkout\.stripe\.com/,

  card_number: ['#cardNumber', 'input[name="cardNumber"]', 'input[autocomplete="cc-number"]'],
  card_expiry: ['#cardExpiry', 'input[name="cardExpiry"]', 'input[autocomplete="cc-exp"]'],
  card_cvc: ['#cardCvc', 'input[name="cardCvc"]', 'input[autocomplete="cc-csc"]'],
  cardholder_name: ['#billingName', 'input[name="billingName"]', 'input[autocomplete="cc-name"]'],
  postal_code: ['#billingPostalCode', 'input[name="billingPostalCode"]', 'input[autocomplete="postal-code"]'],
  country_select: ['#billingCountry', 'select[name="billingCountry"]'],

  vat_id_field: ['input[name="taxId"]', 'input[name="vatId"]', '[data-testid="tax-id-input"]'],

  email_field: ['#email', 'input[name="email"]', 'input[type="email"]'],

  pay_button: ['button[type="submit"]:has-text("Pay")', 'button[type="submit"]:has-text("Subscribe")', '#submit'],

  subtotal_amount: ['[data-testid="line-item-amount"]', '[data-testid="subtotal-amount"]'],
  tax_amount: ['[data-testid="tax-amount"]', '[data-testid="taxes-row"]'],
  total_amount: ['[data-testid="total-amount"]', '[data-testid="order-total"]'],

  three_ds_iframe: 'iframe[name*="3ds"], iframe[src*="3ds"]',
  three_ds_complete_button: ['button:has-text("Complete authentication")', 'button:has-text("Complete")', '#test-source-authorize-3ds'],
}

export const AQUIER_POST_CHECKOUT_SELECTORS = {
  success_indicator_text: ['Thank you', 'Welcome to Aquier', 'Your subscription is active', 'Bedankt', 'Abonnement actief'],
  redirect_url_pattern: /\/(success|thank-you|welcome|dashboard)/,
  invoice_email_confirm_text: ['Confirmation sent', 'Bevestiging verzonden', 'Check your email'],
}
