def _calculate_single_layer_tax(taxable_income, layer_config):
    """Calculate tax for ONE layer (e.g. federal, or a single state) using
    progressive slabs plus extended post-rules. This is the original
    single-layer engine, unchanged in behavior."""
    standard_deduction = float(layer_config.get('standard_deduction', 0))
    surcharge_percent = float(layer_config.get('surcharge_percent', 0))
    cess_percent = float(layer_config.get('cess_percent', 0))
    slabs = layer_config.get('slabs', [])
    post_rules = layer_config.get('post_rules', {}) or {}

    gross_taxable = float(taxable_income)

    # Step 1: Standard deduction with optional taper
    effective_deduction = standard_deduction
    taper = post_rules.get('tapering_deduction')
    if taper and standard_deduction > 0:
        taper_start = float(taper.get('taper_start', 0))
        taper_rate = float(taper.get('taper_rate', 0))
        if gross_taxable > taper_start:
            reduction = (gross_taxable - taper_start) * taper_rate
            effective_deduction = max(0, standard_deduction - reduction)

    net_taxable = max(0, gross_taxable - effective_deduction)

    # Step 2: Progressive slabs
    total_tax = 0
    for slab in slabs:
        slab_from = float(slab.get('from', 0))
        slab_to = slab.get('to')
        rate = float(slab.get('rate', 0))

        if slab_to is None or slab_to == 0:
            taxable_in_slab = max(0, net_taxable - slab_from)
        else:
            slab_to = float(slab_to)
            taxable_in_slab = max(0, min(net_taxable, slab_to) - slab_from)

        total_tax += (taxable_in_slab * rate) / 100

    # Step 3: Rebate (threshold-based, clamp at 0)
    rebate_rule = post_rules.get('rebate')
    if rebate_rule:
        rebate_threshold = float(rebate_rule.get('threshold', 0))
        rebate_amount = float(rebate_rule.get('amount', 0))
        if net_taxable <= rebate_threshold:
            total_tax = max(0, total_tax - rebate_amount)

    # Step 4: Tax credits (fixed or rate-based, clamp at 0)
    credits = post_rules.get('credits', [])
    for credit in credits:
        credit_amount = float(credit.get('amount', 0))
        credit_rate = credit.get('rate')
        if credit_rate is not None:
            credit_value = (credit_amount * float(credit_rate)) / 100
        else:
            credit_value = credit_amount
        total_tax = max(0, total_tax - credit_value)

    # Step 5: Surcharge and cess (on post-credit tax)
    surcharge = (total_tax * surcharge_percent) / 100
    tax_plus_surcharge = total_tax + surcharge
    cess = (tax_plus_surcharge * cess_percent) / 100

    final_tax = tax_plus_surcharge + cess
    return round(final_tax, 2)


def calculate_slab_tax(taxable_income, slab_config, breakdown=None):
    """Calculate tax based on progressive slabs, with extended post-rules.

    Backward compatible: if slab_config has no "state" key, behaves exactly
    as before (single layer, e.g. a country's federal/national tax).

    Multi-layer (Stage 6): if slab_config["state"] is present, it is treated
    as a second, independent layer (e.g. a US state or Canadian province)
    computed with the same engine and simply added to the federal amount.

    Three-layer (Stage 6b): if slab_config["local"] is also present (only
    meaningful when "state" is also present), it is treated as a third,
    independent layer (e.g. NYC) computed the same way and added on top.

    Multiplier layers (Stage 6c, e.g. Switzerland cantons/communes): a
    "state" or "local" layer may instead carry "multiplier_percent". Rather
    than being taxed on income directly, its tax = (that layer's own
    bracket-computed "simple tax") x multiplier_percent / 100. A "local"
    layer with multiplier_percent and NO slabs multiplies the CANTON's
    simple tax instead of computing its own — this is how a Swiss commune's
    multiplier applies to the same simple tax the canton itself is based on.

    Pass a dict via `breakdown` to have {'federal': x, 'state': y, 'local': z}
    written into it for display purposes (does not affect the returned total).
    """
    federal_tax = _calculate_single_layer_tax(taxable_income, slab_config)

    state_config = slab_config.get('state')
    state_tax = 0.0
    state_simple_tax = None
    if state_config:
        state_simple_tax = _calculate_single_layer_tax(taxable_income, state_config)
        state_multiplier = state_config.get('multiplier_percent')
        if state_multiplier is not None:
            state_tax = round(state_simple_tax * float(state_multiplier) / 100, 2)
        else:
            state_tax = state_simple_tax

    local_config = slab_config.get('local')
    local_tax = 0.0
    if local_config:
        local_multiplier = local_config.get('multiplier_percent')
        if local_multiplier is not None:
            # A multiplier local layer applies to the CANTON's simple tax
            # (the same base the canton itself multiplies), not its own
            # income-based calculation. Falls back to 0 if there is no
            # canton simple tax to multiply (shouldn't normally happen).
            base = state_simple_tax if state_simple_tax is not None else 0.0
            local_tax = round(base * float(local_multiplier) / 100, 2)
        else:
            local_tax = _calculate_single_layer_tax(taxable_income, local_config)

    if breakdown is not None:
        breakdown['federal'] = federal_tax
        breakdown['state'] = state_tax
        breakdown['local'] = local_tax

    return round(federal_tax + state_tax + local_tax, 2)


def calculate_ctc_breakdown(data):
    total_ctc = float(data.get('total_ctc', 0))
    components = data.get('components', {})

    if total_ctc <= 0:
        return {'success': False, 'error': 'Total CTC must be greater than 0.'}
    if not components:
        return {'success': False, 'error': 'No components provided.'}

    warnings = []
    calculated = {}

    # 1. Fixed components
    for field_id, comp in components.items():
        if comp.get('logic_type') == 'fixed':
            val = float(comp.get('value', 0))
            freq = comp.get('frequency', 'monthly')
            annual = val * 12 if freq == 'monthly' else (val * 4 if freq == 'quarterly' else val)
            calculated[field_id] = {
                'id': field_id,
                'name': comp.get('name'),
                'category': comp.get('category'),
                'annual': annual,
                'monthly': round(annual / 12, 2),
                'taxable': comp.get('taxable', 'yes')
            }

    # 2. % of Basic
    basic_annual = calculated.get('basic_salary', {}).get('annual', 0)
    for field_id, comp in components.items():
        if comp.get('logic_type') == 'percent_basic':
            annual = (basic_annual * float(comp.get('value', 0))) / 100
            calculated[field_id] = {
                'id': field_id,
                'name': comp.get('name'),
                'category': comp.get('category'),
                'annual': round(annual, 2),
                'monthly': round(annual / 12, 2),
                'taxable': comp.get('taxable', 'yes')
            }

    # 3. % of CTC
    for field_id, comp in components.items():
        if comp.get('logic_type') == 'percent_ctc':
            annual = (total_ctc * float(comp.get('value', 0))) / 100
            calculated[field_id] = {
                'id': field_id,
                'name': comp.get('name'),
                'category': comp.get('category'),
                'annual': round(annual, 2),
                'monthly': round(annual / 12, 2),
                'taxable': comp.get('taxable', 'yes')
            }

    # 4. Gross (Initial for % of Gross)
    gross_annual = sum(c.get('annual', 0) for c in calculated.values() if c.get('category') == 'earnings')

    # 5. % of Gross
    for field_id, comp in components.items():
        if comp.get('logic_type') == 'percent_gross':
            annual = (gross_annual * float(comp.get('value', 0))) / 100
            calculated[field_id] = {
                'id': field_id,
                'name': comp.get('name'),
                'category': comp.get('category'),
                'annual': round(annual, 2),
                'monthly': round(annual / 12, 2),
                'taxable': comp.get('taxable', 'yes')
            }

    # Recalculate Gross after % of Gross
    gross_annual = sum(c.get('annual', 0) for c in calculated.values() if c.get('category') == 'earnings')

    # 6. Tax Slabs calculation
    for field_id, comp in components.items():
        if comp.get('logic_type') == 'tax_slabs':
            slab_config = comp.get('slab_config', {})
            taxable_income = sum(
                c.get('annual', 0) for c in calculated.values()
                if c.get('category') == 'earnings' and c.get('taxable', 'yes') == 'yes'
            )
            breakdown = {}
            annual_tax = calculate_slab_tax(taxable_income, slab_config, breakdown=breakdown)
            entry = {
                'id': field_id,
                'name': comp.get('name'),
                'category': comp.get('category'),
                'annual': annual_tax,
                'monthly': round(annual_tax / 12, 2),
                'taxable': 'no'
            }
            # Only include the breakdown when a state/province layer was actually used,
            # so single-layer countries keep an identical response shape to before.
            if slab_config.get('state'):
                entry['tax_breakdown'] = {
                    'federal_annual': breakdown.get('federal', 0),
                    'state_annual': breakdown.get('state', 0),
                    'federal_monthly': round(breakdown.get('federal', 0) / 12, 2),
                    'state_monthly': round(breakdown.get('state', 0) / 12, 2)
                }
                # Local (city/county) layer is optional on top of state — only
                # add these keys when actually present, same backward-compat rule.
                if slab_config.get('local'):
                    entry['tax_breakdown']['local_annual'] = breakdown.get('local', 0)
                    entry['tax_breakdown']['local_monthly'] = round(breakdown.get('local', 0) / 12, 2)
            calculated[field_id] = entry

    # Calculate Deductions total (now includes slab-based tax if present)
    deductions_annual = sum(c.get('annual', 0) for c in calculated.values() if c.get('category') == 'deductions')
    net_annual = gross_annual - deductions_annual

    # CTC validation
    calc_ctc = gross_annual + sum(
        c.get('annual', 0) for c in calculated.values()
        if c.get('category') in ['employer_contributions', 'variable_pay', 'perks_benefits']
    )
    if abs(calc_ctc - total_ctc) > 1:
        warnings.append(f"Calculated CTC ({round(calc_ctc, 2)}) differs from Target CTC ({total_ctc}).")

    # Build response
    components_list = [c for c in calculated.values() if c.get('annual', 0) > 0]
    all_components_list = list(calculated.values())

    return {
        'success': True,
        'total_ctc': total_ctc,
        'gross_annual': round(gross_annual, 2),
        'gross_monthly': round(gross_annual / 12, 2),
        'deductions_annual': round(deductions_annual, 2),
        'deductions_monthly': round(deductions_annual / 12, 2),
        'net_annual': round(net_annual, 2),
        'net_monthly': round(net_annual / 12, 2),
        'components': components_list,
        'all_components': all_components_list,
        'warnings': warnings
    }