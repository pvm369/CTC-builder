// ========== CTC BUILDER - MAIN APPLICATION ==========

// ========== STATE MANAGEMENT ==========
const appState = {
    components: {},
    customCategories: [],
    nextCustomId: 1
};

// Global lock to prevent multiple simultaneous calculations
let isCalculating = false;
// ========== TAX REGIME ENGINE (folder-based, lazy) ==========
let taxIndexData = null;
let taxIndexLoadPromise = null;
const taxCountryCache = {};
const taxStateCache = {}; // Stage 6: state/province layer data, keyed by countryId
const taxCityCache = {}; // Stage 6b: city/locality layer data, keyed by stateId

// ========== PREVIEW PERIOD + EXPORT STATE ==========
let lastCalculation = null;
let previewPeriod = 'monthly';

let exportLibrariesReady = false;
let exportLibrariesPromise = null;
let exportLibraryError = null;

let pendingLongImageFormat = null;

const IMAGE_WARNING_REPORT_HEIGHT = 1700;
const IMAGE_SLICE_HEIGHT = 2600;
const TEMPLATE_SCHEMA_VERSION = '2.0';

// ========== DOM REFERENCES ==========
const sidebar = document.getElementById('sidebar');
const canvas = document.getElementById('canvas');
const previewPanel = document.getElementById('previewPanel');
const configModal = document.getElementById('configModal');
const categoryModal = document.getElementById('categoryModal');

const btnPreview = document.getElementById('btnPreview');
const btnSaveTemplate = document.getElementById('btnSaveTemplate');
const btnLoadTemplate = document.getElementById('btnLoadTemplate');

const btnAddCategory = document.getElementById('btnAddCategory');
const categoryModalClose = document.getElementById('categoryModalClose');
const categoryModalCancel = document.getElementById('categoryModalCancel');
const categoryModalSave = document.getElementById('categoryModalSave');

const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');
const dependsOnGroup = document.getElementById('dependsOnGroup');
const dependsOnField = document.getElementById('dependsOnField');
const configuredTotalEl = document.getElementById('configuredTotal');
const slabEditorGroup = document.getElementById('slabEditorGroup');

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function () {
    initSidebarToggle();
    initSidebarClickToAdd();
    initPreviewToggle();
    initPreviewPeriodToggle();
    initExportSystem();
    initCategoryModal();
    initConfigModal();
    initAddFieldButtons();
    initCopyButton();
    initTemplateSystem();
    initPayrollTemplateSystem();
    initClearButton();
    initMobileSidebar();
    initModalBackButtonHandler();
    preloadTaxIndex();
    updateConfiguredTotal();
    updateExportAvailability();
});

// ========== SIDEBAR CATEGORY TOGGLE ==========
function initSidebarToggle() {
    const headers = document.querySelectorAll('.category-header');
    headers.forEach(header => {
        header.addEventListener('click', function (e) {
            if (e.target.classList.contains('btn-delete-category')) return;
            this.classList.toggle('open');
            const fields = this.nextElementSibling;
            if (fields && fields.classList.contains('category-fields')) {
                fields.classList.toggle('open');
            }
        });
    });
    // Close all by default
    document.querySelectorAll('.category-fields').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.category-header').forEach(el => el.classList.remove('open'));
}

// ========== SIDEBAR CLICK TO ADD ==========
function initSidebarClickToAdd() {
    document.querySelectorAll('.sidebar .field-card').forEach(card => {
        card.addEventListener('click', function () {
            handleSidebarCardClick(this);
        });
    });
}

function handleSidebarCardClick(card) {
    const fieldId = card.dataset.fieldId;
    const fieldName = card.textContent.trim();
    const category = card.dataset.category;

    if (isFieldOnCanvas(fieldId)) {
        showNotification('This component is already on the canvas.', 'warning');
        return;
    }

    const dropZone = document.querySelector('.drop-zone[data-category="' + category + '"]');
    if (!dropZone) {
        showNotification('No matching category on canvas.', 'error');
        return;
    }

    const canvasField = createCanvasField(fieldId, fieldName, category);
    invalidateCalculatedPreview();
    removePlaceholder(dropZone);
    dropZone.appendChild(canvasField);

    addComponentToState(fieldId, fieldName, category);
    updateConfiguredTotal();
    disableSidebarCard(fieldId);

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.add('hidden');
    }

    showNotification(fieldName + ' added.', 'success');
}

// ========== PREVIEW PANEL TOGGLE ==========
function initPreviewToggle() {
    btnPreview.addEventListener('click', function () {
        previewPanel.classList.toggle('hidden');
    });

    const btnCalculate = document.getElementById('btnCalculate');
    if (btnCalculate) {
        btnCalculate.addEventListener('click', function () {
            runPreviewValidation();
        });
    }
}

// ========== HELPER FUNCTIONS ==========
function isFieldOnCanvas(fieldId) {
    return appState.components.hasOwnProperty(fieldId);
}

function disableSidebarCard(fieldId) {
    const card = document.querySelector('.sidebar .field-card[data-field-id="' + fieldId + '"]');
    if (card) {
        card.style.opacity = '0.4';
        card.style.cursor = 'not-allowed';
        card.style.pointerEvents = 'none';
    }
}

function enableSidebarCard(fieldId) {
    const card = document.querySelector('.sidebar .field-card[data-field-id="' + fieldId + '"]');
    if (card) {
        card.style.opacity = '';
        card.style.cursor = '';
        card.style.pointerEvents = '';
    }
}

function removePlaceholder(dropZone) {
    const p = dropZone.querySelector('.drop-placeholder');
    if (p) p.remove();
}

function checkAndAddPlaceholder() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        if (zone.querySelectorAll('.canvas-field').length === 0 && !zone.querySelector('.drop-placeholder')) {
            const p = document.createElement('p');
            p.className = 'drop-placeholder';
            p.textContent = 'Click components from sidebar to add here';
            zone.appendChild(p);
        }
    });
}

// ========== CREATE CANVAS FIELD ==========
function createCanvasField(fieldId, name, category) {
    const div = document.createElement('div');
    div.className = 'canvas-field';
    div.dataset.fieldId = fieldId;
    div.dataset.category = category;
    div.innerHTML =
        '<div class="field-info">' +
            '<span class="field-name">' + escapeHtml(name) + '</span>' +
            '<span class="field-logic">Click to configure</span>' +
        '</div>' +
        '<div class="field-actions">' +
            '<button class="btn-reorder btn-move-up" data-field-id="' + fieldId + '" title="Move up">↑</button>' +
            '<button class="btn-reorder btn-move-down" data-field-id="' + fieldId + '" title="Move down">↓</button>' +
            '<button class="btn-remove" data-field-id="' + fieldId + '" title="Remove">✕</button>' +
        '</div>';

    // Click to configure
    div.addEventListener('click', function (e) {
        if (e.target.closest('.btn-remove') || e.target.closest('.btn-reorder')) return;
        openConfigModal(fieldId);
    });

    // Remove
    div.querySelector('.btn-remove').addEventListener('click', function (e) {
        e.stopPropagation();
        removeFieldFromCanvas(fieldId);
    });

    // Move up
    div.querySelector('.btn-move-up').addEventListener('click', function (e) {
        e.stopPropagation();
        moveField(fieldId, 'up');
    });

    // Move down
    div.querySelector('.btn-move-down').addEventListener('click', function (e) {
        e.stopPropagation();
        moveField(fieldId, 'down');
    });

    return div;
}

// ========== MOVE FIELD (REORDER) ==========
function moveField(fieldId, direction) {
    const field = document.querySelector('.canvas-field[data-field-id="' + fieldId + '"]');
    if (!field) return;

    if (direction === 'up') {
        const prev = field.previousElementSibling;
        if (prev && prev.classList.contains('canvas-field')) {
            field.parentNode.insertBefore(field, prev);
        }
    } else if (direction === 'down') {
        const next = field.nextElementSibling;
        if (next && next.classList.contains('canvas-field')) {
            field.parentNode.insertBefore(next, field);
        }
    }
}

// ========== REMOVE FIELD ==========
function removeFieldFromCanvas(fieldId) {
    // Check dependencies
    const dependentFields = Object.values(appState.components).filter(c =>
        c.target_field === fieldId
    );

    if (dependentFields.length > 0) {
        const names = dependentFields.map(c => c.name).join(', ');
        if (!confirm(names + ' depend(s) on this field. Remove anyway?')) {
            return;
        }
    }

    const field = document.querySelector('.canvas-field[data-field-id="' + fieldId + '"]');
    if (field) field.remove();
    delete appState.components[fieldId];
    invalidateCalculatedPreview();
    enableSidebarCard(fieldId);
    checkAndAddPlaceholder();
    updateConfiguredTotal();
    showNotification('Component removed.', 'info');
}

// ========== STATE MANAGEMENT ==========
function addComponentToState(fieldId, name, category, allowSlabs = false) {
    appState.components[fieldId] = {
        id: fieldId, name: name, category: category,
        logic_type: 'fixed', value: 0, target_field: null,
        percentage: 0, frequency: 'monthly', taxable: 'yes', configured: false,
        allow_slabs: allowSlabs
    };
}

// ========== PAYROLL CONTRIBUTION TEMPLATES (Stage 8) ==========
// Bulk-creates several already-configured deduction/employer_contribution
// fields from one country pick, the same "load like a template" idea as
// the tax-regime dropdowns, just triggered by a country instead of a file.

function initPayrollTemplateSystem() {
    var select = document.getElementById('payrollTemplateCountry');
    if (!select) return;

    fetch(getPayrollTemplatesBaseUrl() + 'index.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) {
            (data.countries || []).forEach(function (c) {
                var opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        })
        .catch(function () {
            // Payroll templates are an optional convenience; fail silently if
            // the registry can't be loaded, same spirit as other optional UI.
        });

    select.addEventListener('change', function () {
        var countryId = select.value;
        select.value = ''; // reset to placeholder immediately, this is a one-shot action
        if (countryId) loadPayrollTemplate(countryId);
    });
}

function loadPayrollTemplate(countryId) {
    var baseUrl = getPayrollTemplatesBaseUrl();

    fetch(baseUrl + 'index.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (indexData) {
            var entry = (indexData.countries || []).find(function (c) { return c.id === countryId; });
            if (!entry) throw new Error('Country not found in payroll registry.');
            return fetch(baseUrl + entry.file);
        })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (template) {
            applyPayrollTemplate(template);
        })
        .catch(function () {
            showNotification('Payroll template could not be loaded for this country.', 'error');
        });
}

function applyPayrollTemplate(template) {
    var components = template.components || [];

    // Only ask for Basic Salary if the template actually needs it, and only
    // if it's genuinely missing — matches the rest of the app's existing
    // convention (HRA/Employer PF presets already require this same field).
    var needsBasic = components.some(function (c) { return c.logic_type === 'percent_basic'; });
    if (needsBasic && !isFieldOnCanvas('basic_salary')) {
        showNotification(
            'Add a "Basic Salary" field to the canvas first, then re-select ' + (template.country_name || 'this country') + ' from the payroll dropdown.',
            'warning'
        );
        return;
    }

    var added = [];
    var skipped = [];

    components.forEach(function (comp) {
        if (isFieldOnCanvas(comp.key)) {
            skipped.push(comp.name);
            return;
        }

        var dropZone = document.querySelector('.drop-zone[data-category="' + comp.category + '"]');
        if (!dropZone) {
            skipped.push(comp.name + ' (no matching category on canvas)');
            return;
        }

        var canvasField = createCanvasField(comp.key, comp.name, comp.category);
        removePlaceholder(dropZone);
        dropZone.appendChild(canvasField);

        addComponentToState(comp.key, comp.name, comp.category);
        var state = appState.components[comp.key];
        state.logic_type = comp.logic_type;
        state.value = comp.value;
        state.taxable = comp.taxable || 'no';
        state.configured = true;
        if (comp.target_field) state.target_field = comp.target_field;
        if (comp.threshold_annual !== undefined) state.threshold_annual = comp.threshold_annual;

        added.push(comp.name);
    });

    if (added.length > 0) {
        invalidateCalculatedPreview();
        updateConfiguredTotal();
        var msg = added.join(', ') + ' added.';
        if (skipped.length > 0) msg += ' Skipped (already on canvas): ' + skipped.join(', ') + '.';
        showNotification(msg, 'success');
    } else if (skipped.length > 0) {
        showNotification('All payroll fields for this country are already on the canvas.', 'warning');
    }
}

// ========== CONFIG MODAL ==========
let currentConfigFieldId = null;
let activeAddFieldCategory = null;

function initConfigModal() {
    modalClose.addEventListener('click', closeConfigModal);
    modalCancel.addEventListener('click', closeConfigModal);
    modalSave.addEventListener('click', saveConfig);
    configModal.addEventListener('click', e => { if (e.target === configModal) closeConfigModal(); });

    document.getElementById('formulaType').addEventListener('change', function () {
        toggleDependsOnVisibility();
        if (this.value === 'tax_slabs') {
            preloadTaxIndex();
            var comp = appState.components[currentConfigFieldId];
            populateSlabEditor(comp ? comp.slab_config : null);
        }
    });

    var btnAddSlab = document.getElementById('btnAddSlab');
    if (btnAddSlab) {
        btnAddSlab.addEventListener('click', function () {
            addSlabRow();
            var cs = document.getElementById('taxCountry');
            if (cs) cs.value = 'custom';
            hideTaxSubOption();
            updateZeroTaxUI('custom');
            updateFlatRateUI('custom');
            refreshTaxMetadata();
            if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
                appState.components[currentConfigFieldId].post_rules = null;
            }
        });
    }

    var taxCountrySelect = document.getElementById('taxCountry');
    if (taxCountrySelect) taxCountrySelect.addEventListener('change', handleTaxCountryChange);

    var taxSubSelect = document.getElementById('taxSubOption');
    if (taxSubSelect) taxSubSelect.addEventListener('change', handleTaxSubOptionChange);

    var taxStateSelect = document.getElementById('taxStateOption');
    if (taxStateSelect) taxStateSelect.addEventListener('change', handleTaxStateOptionChange);

    var taxLocalSelect = document.getElementById('taxLocalOption');
    if (taxLocalSelect) taxLocalSelect.addEventListener('change', handleTaxLocalOptionChange);

    var taxLocalMultiplierInput = document.getElementById('taxLocalMultiplierInput');
    if (taxLocalMultiplierInput) taxLocalMultiplierInput.addEventListener('input', handleTaxLocalMultiplierInputChange);

    var taxResidencyDaysInput = document.getElementById('taxResidencyDaysInput');
    if (taxResidencyDaysInput) taxResidencyDaysInput.addEventListener('input', handleTaxResidencyDaysInputChange);

        if (slabEditorGroup) {
        slabEditorGroup.addEventListener('input', function (e) {
            if (e.target.tagName === 'SELECT') return;

        // Sync edited flat rate into the hidden slab row before switching to Custom
        if (e.target.id === 'flatRateValue') {
            var rowRate = document.querySelector('#slabTableBody .slab-rate');
            if (rowRate) rowRate.value = e.target.value;
        }

        var cs = document.getElementById('taxCountry');
        if (cs && cs.value !== 'custom') {
            cs.value = 'custom';
            hideTaxSubOption();
            updateZeroTaxUI('custom');
            updateFlatRateUI('custom');
            refreshTaxMetadata();
            if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
                appState.components[currentConfigFieldId].post_rules = null;
            }
        }
        });
    }
}

function openConfigModal(fieldId) {
    currentConfigFieldId = fieldId;
    const component = appState.components[fieldId];
    if (!component) return;

    document.getElementById('modalTitle').textContent = 'Configure: ' + component.name;
    document.getElementById('fieldName').value = component.name;
    document.getElementById('fieldFrequency').value = component.frequency || 'monthly';
    document.getElementById('fieldTaxable').value = component.taxable || 'yes';

    // Rebuild formulaType dropdown
    // Always remove the Tax Slabs option first
        // Rebuild formulaType dropdown dynamically
    var formulaSelect = document.getElementById('formulaType');
    var existingSlabOption = formulaSelect.querySelector('option[value="tax_slabs"]');
    if (existingSlabOption) {
        existingSlabOption.remove();
    }

    // Tax Slabs calculation type is strictly allowed only for:
    // 1. The default TDS / Income Tax component ('tds')
    // 2. Any custom components that had "allow_slabs" checked during creation
    const isSlabEligible = (component.id === 'tds') || (component.allow_slabs === true);

    if (isSlabEligible) {
        var slabOption = document.createElement('option');
        slabOption.value = 'tax_slabs';
        slabOption.textContent = 'Tax Slabs';
        formulaSelect.appendChild(slabOption);
    } else {
        // Fallback safety: if field cannot have slabs but is set to it, reset to fixed
        if (component.logic_type === 'tax_slabs') {
            component.logic_type = 'fixed';
        }
    }

    // Set dropdown and value AFTER rebuilding options
    formulaSelect.value = component.logic_type || 'fixed';
    document.getElementById('fieldValue').value = component.logic_type === 'tax_slabs' ? '' : (component.value || '');

    populateDependsOnOptions(fieldId);
    toggleDependsOnVisibility();

    // Populate slab editor if already configured as tax_slabs
    if (component.logic_type === 'tax_slabs') {
        populateSlabEditor(component.slab_config);
    }

    openModal('configModal');
}

function closeConfigModal() {
    closeModal('configModal');
    currentConfigFieldId = null;
}

function saveConfig() {
    if (!currentConfigFieldId) return;
    const component = appState.components[currentConfigFieldId];
    if (!component) return;

    const fieldName = document.getElementById('fieldName').value.trim();
    const formulaType = document.getElementById('formulaType').value;
    const fieldValueRaw = document.getElementById('fieldValue').value.trim();
    const fieldValue = parseFloat(fieldValueRaw);
    const fieldFrequency = document.getElementById('fieldFrequency').value;
    const fieldTaxable = document.getElementById('fieldTaxable').value;

    if (currentConfigFieldId === 'basic_salary' && formulaType !== 'fixed') {
        showNotification('Basic Salary must be a Fixed Amount.', 'error');
        return;
    }
    if (!fieldName) { showNotification('Field name cannot be empty.', 'error'); return; }

    if (formulaType !== 'tax_slabs') {
        if (fieldValueRaw === '' || isNaN(fieldValue)) { showNotification('Please enter a valid numeric value.', 'error'); return; }
        if (fieldValue < 0) { showNotification('Value cannot be negative.', 'error'); return; }
        if (formulaType !== 'fixed' && (fieldValue < 0 || fieldValue > 100)) { showNotification('Percentage must be between 0 and 100.', 'error'); return; }
    }

        if (formulaType === 'percent_basic') {
        if (!isFieldOnCanvas('basic_salary')) { showNotification('Basic Salary must be on canvas.', 'error'); return; }
        component.target_field = 'basic_salary';
        } else if (formulaType === 'tax_slabs') {
        component.target_field = null;
        var taxSel = getCurrentTaxSelection();
        var isZeroTax = isZeroTaxCountry(taxSel.country);
        var isFlatTax = isFlatRateCountry(taxSel.country);
        var slabs;

        if (isZeroTax) {
            slabs = [];
        } else if (isFlatTax) {
            var flatRate = parseFloat(document.getElementById('flatRateValue').value);
            if (isNaN(flatRate) || flatRate < 0 || flatRate > 100) {
                showNotification('Flat rate must be between 0 and 100.', 'error');
                return;
            }
            slabs = [{ from: 0, to: null, rate: flatRate }];
        } else {
            slabs = getSlabDataFromUI();
        }

        if (!isZeroTax && !isFlatTax) {
            if (slabs.length === 0) {
                showNotification('Please add at least one tax slab.', 'error');
                return;
            }
            for (var i = 0; i < slabs.length; i++) {
                if (slabs[i].rate < 0 || slabs[i].rate > 100) {
                    showNotification('Slab ' + (i + 1) + ': Rate must be between 0 and 100.', 'error');
                    return;
                }
                if (slabs[i].to !== null && slabs[i].to <= slabs[i].from) {
                    showNotification('Slab ' + (i + 1) + ': "To" must be greater than "From".', 'error');
                    return;
                }
            }
        }

            var stateLayer = component.state_tax_layer || null;
        var localLayer = component.local_tax_layer || null;
        var stateSuffix = stateLayer && stateLayer.state_name ? (' + ' + stateLayer.state_name) : '';
        var localSuffix = localLayer && localLayer.local_name ? (' + ' + localLayer.local_name) : '';

        component.slab_config = {
            country: taxSel.country,
            regime: taxSel.regime,
            regime_label: (taxSel.label || '') + stateSuffix + localSuffix,
            standard_deduction: isZeroTax ? 0 : (parseFloat(document.getElementById('standardDeduction').value) || 0),
            surcharge_percent: isZeroTax ? 0 : (parseFloat(document.getElementById('surchargePercent').value) || 0),
            cess_percent: isZeroTax ? 0 : (parseFloat(document.getElementById('cessPercent').value) || 0),
            slabs: slabs,
            post_rules: component.post_rules
                ? JSON.parse(JSON.stringify(component.post_rules))
                : null,
            state_id: stateLayer ? stateLayer.state_id : null,
            state_name: stateLayer ? stateLayer.state_name : null,
            state: stateLayer
                ? {
                    standard_deduction: stateLayer.standard_deduction || 0,
                    surcharge_percent: stateLayer.surcharge_percent || 0,
                    cess_percent: stateLayer.cess_percent || 0,
                    slabs: stateLayer.slabs || [],
                    multiplier_percent: (stateLayer.multiplier_percent !== undefined && stateLayer.multiplier_percent !== null)
                        ? stateLayer.multiplier_percent
                        : null,
                    post_rules: stateLayer.post_rules || null
                }
                : null,
            local_id: localLayer ? localLayer.local_id : null,
            local_name: localLayer ? localLayer.local_name : null,
            local: localLayer
                ? {
                    standard_deduction: localLayer.standard_deduction || 0,
                    surcharge_percent: localLayer.surcharge_percent || 0,
                    cess_percent: localLayer.cess_percent || 0,
                    slabs: localLayer.slabs || [],
                    multiplier_percent: (localLayer.multiplier_percent !== undefined && localLayer.multiplier_percent !== null)
                        ? localLayer.multiplier_percent
                        : null,
                    post_rules: localLayer.post_rules || null
                }
                : null
        };
        component.value = 0;
    } else {
        component.target_field = null;
    }

        component.name = fieldName;
    component.logic_type = formulaType;
    if (formulaType !== 'tax_slabs') {
        component.value = fieldValue;
    }
    component.frequency = fieldFrequency;
    component.taxable = fieldTaxable;
    component.configured = true;
    invalidateCalculatedPreview();

    updateCanvasFieldDisplay(currentConfigFieldId);
    updateConfiguredTotal();
    closeConfigModal();
    showNotification(fieldName + ' configured successfully.', 'success');
}

function updateCanvasFieldDisplay(fieldId) {
    const component = appState.components[fieldId];
    const canvasField = document.querySelector('.canvas-field[data-field-id="' + fieldId + '"]');
    if (!component || !canvasField) return;

    canvasField.querySelector('.field-name').textContent = component.name;
    let logicText = '';
        switch (component.logic_type) {
        case 'fixed': logicText = 'Fixed: ' + formatCurrency(component.value); break;
        case 'percent_basic': logicText = component.value + '% of Basic Salary'; break;
        case 'percent_gross': logicText = component.value + '% of Gross Salary'; break;
        case 'percent_ctc': logicText = component.value + '% of CTC'; break;
        case 'tax_slabs':
            var sc = component.slab_config;
            var scCount = sc && sc.slabs ? sc.slabs.length : 0;
            var scLabel = (sc && sc.regime_label) ? sc.regime_label : 'Tax Slabs';
            if (scCount === 1) {
                logicText = scLabel + ' (1 slab)';
            } else if (scCount > 1) {
                logicText = scLabel + ' (' + scCount + ' slabs)';
            } else {
                logicText = scLabel;
            }
            break;
        default: logicText = 'Click to configure';
    }
    logicText += ' | ' + capitalize(component.frequency);
    if (component.taxable === 'yes') logicText += ' | Taxable';
    canvasField.querySelector('.field-logic').textContent = logicText;
    canvasField.style.borderLeftColor = '#4361ee';
    canvasField.style.borderLeftWidth = '4px';
    canvasField.classList.add('configured');
}

function toggleDependsOnVisibility() {
    const formulaType = document.getElementById('formulaType').value;
    const needsTarget = ['percent_basic', 'percent_gross', 'percent_ctc'].includes(formulaType);
    const isSlab = formulaType === 'tax_slabs';

    // Hide the Value input row when tax_slabs is selected
    const fieldValueInput = document.getElementById('fieldValue');
    const fieldValueGroup = fieldValueInput ? fieldValueInput.closest('.form-group') : null;
    if (fieldValueGroup) {
        fieldValueGroup.style.display = isSlab ? 'none' : '';
    }

    if (currentConfigFieldId === 'basic_salary') {
        dependsOnGroup.classList.add('hidden');
        dependsOnField.innerHTML = '';
        if (slabEditorGroup) slabEditorGroup.classList.add('hidden');
        return;
    }

    if (needsTarget) {
        dependsOnGroup.classList.remove('hidden');
        if (slabEditorGroup) slabEditorGroup.classList.add('hidden');
    } else if (isSlab) {
        dependsOnGroup.classList.add('hidden');
        dependsOnField.innerHTML = '';
        if (slabEditorGroup) slabEditorGroup.classList.remove('hidden');
    } else {
        dependsOnGroup.classList.add('hidden');
        dependsOnField.innerHTML = '';
        if (slabEditorGroup) slabEditorGroup.classList.add('hidden');
    }
}

function populateDependsOnOptions(currentFieldId) {
    dependsOnField.innerHTML = '';
    const formulaType = document.getElementById('formulaType').value;

    // Tax slabs don't need dependsOn dropdown
    if (formulaType === 'tax_slabs') return;

    if (formulaType === 'percent_gross' || formulaType === 'percent_ctc') {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Calculated from total (auto)';
        dependsOnField.appendChild(opt);
        return;
    }

    if (formulaType === 'percent_basic') {
        const opt = document.createElement('option');
        opt.value = 'basic_salary';
        opt.textContent = isFieldOnCanvas('basic_salary') ? 'Basic Salary' : 'Basic Salary not found';
        dependsOnField.appendChild(opt);
        return;
    }

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = 'Select field';
    dependsOnField.appendChild(optNone);

    Object.values(appState.components).forEach(c => {
        if (c.id === currentFieldId) return;
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        dependsOnField.appendChild(opt);
    });

    const component = appState.components[currentFieldId];
    if (component && component.target_field) {
        dependsOnField.value = component.target_field;
    }
}

// ========== TAX REGIME ENGINE (folder-based, lazy) ==========

function getTaxRegimesBaseUrl() {
    var url = document.body.dataset.taxRegimesUrl || 'vendor/tax-regimes/index.json';
    var idx = url.lastIndexOf('/');
    return idx >= 0 ? url.substring(0, idx + 1) : '';
}

function getPayrollTemplatesBaseUrl() {
    var url = document.body.dataset.payrollTemplatesUrl || 'vendor/payroll/index.json';
    var idx = url.lastIndexOf('/');
    return idx >= 0 ? url.substring(0, idx + 1) : '';
}

function preloadTaxIndex() {
    if (taxIndexData) return Promise.resolve(taxIndexData);
    if (taxIndexLoadPromise) return taxIndexLoadPromise;

    var url = document.body.dataset.taxRegimesUrl || 'vendor/tax-regimes/index.json';
    taxIndexLoadPromise = fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
        if (d && Array.isArray(d.countries)) {
            d.countries = d.countries.filter(function (c) {
                var ok = c && c.id && c.name && c.file;
                if (!ok) console.warn('Skipping invalid country entry in index.json:', c);
                return ok;
            });
            }
            taxIndexData = d;
            populateCountryDropdown();
            return d;
        })
        .catch(function (err) { console.warn('Tax index unavailable:', err); return null; });

    return taxIndexLoadPromise;
}

function populateCountryDropdown() {
    var cs = document.getElementById('taxCountry');
    if (!cs || !taxIndexData || !taxIndexData.countries) return;
    while (cs.options.length > 1) cs.remove(1);
    taxIndexData.countries.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        cs.appendChild(o);
    });
}

function findCountryById(id) {
    if (!taxIndexData || !taxIndexData.countries) return null;
    return taxIndexData.countries.find(function (c) { return c.id === id; }) || null;
}

function validateTaxCountryData(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['File is not a valid JSON object.'] };
    }

    var regimes = Array.isArray(data.regimes) ? data.regimes : [];
    var states = Array.isArray(data.states) ? data.states : [];

    if (regimes.length === 0 && states.length === 0) {
        errors.push('No "regimes" or "states" array found, or both are empty.');
        return { valid: false, errors: errors };
    }

    var lists = regimes.concat(states);
    var seenIds = {};

    lists.forEach(function (entry, i) {
        var label = (entry && entry.id) ? entry.id : ('entry ' + (i + 1));

        if (!entry || typeof entry !== 'object') {
            errors.push(label + ': is not an object.');
            return;
        }

        if (!entry.id || typeof entry.id !== 'string') {
            errors.push(label + ': missing or invalid "id".');
        } else if (seenIds[entry.id]) {
            errors.push(label + ': duplicate id "' + entry.id + '".');
        } else {
            seenIds[entry.id] = true;
        }

        if (!entry.label || typeof entry.label !== 'string') {
            errors.push(label + ': missing or invalid "label".');
        }

        var isZeroTaxFile = data.engine_type === 'zero_income_tax';

        if (!Array.isArray(entry.slabs)) {
            errors.push(label + ': "slabs" must be an array.');
            return;
        }

        if (entry.slabs.length === 0 && !isZeroTaxFile) {
            errors.push(label + ': "slabs" must be a non-empty array.');
            return;
        }

        entry.slabs.forEach(function (slab, j) {
            var sLabel = label + ' slab ' + (j + 1);

            if (!slab || typeof slab !== 'object') {
                errors.push(sLabel + ': is not an object.');
                return;
            }

            var from = Number(slab.from);
            if (slab.from === null || slab.from === undefined || isNaN(from) || from < 0) {
                errors.push(sLabel + ': "from" must be a number >= 0.');
            }

            if (slab.to !== null && slab.to !== undefined) {
                var to = Number(slab.to);
                if (isNaN(to) || to <= from) {
                    errors.push(sLabel + ': "to" must be null or greater than "from".');
                }
            }

            var rate = Number(slab.rate);
            if (slab.rate === null || slab.rate === undefined || isNaN(rate) || rate < 0 || rate > 100) {
                errors.push(sLabel + ': "rate" must be between 0 and 100.');
            }
        });

        if (entry.standard_deduction !== undefined && entry.standard_deduction !== null) {
            var sd = Number(entry.standard_deduction);
            if (isNaN(sd) || sd < 0) errors.push(label + ': "standard_deduction" must be >= 0.');
        }
        if (entry.surcharge_percent !== undefined && entry.surcharge_percent !== null) {
            var sp = Number(entry.surcharge_percent);
            if (isNaN(sp) || sp < 0 || sp > 100) errors.push(label + ': "surcharge_percent" must be 0-100.');
        }
        if (entry.cess_percent !== undefined && entry.cess_percent !== null) {
            var cp = Number(entry.cess_percent);
            if (isNaN(cp) || cp < 0 || cp > 100) errors.push(label + ': "cess_percent" must be 0-100.');
        }
    });

    return { valid: errors.length === 0, errors: errors };
}

function loadCountryFile(countryId) {
    if (taxCountryCache[countryId] && taxCountryCache[countryId].data) {
        return Promise.resolve(taxCountryCache[countryId].data);
    }
    if (taxCountryCache[countryId] && taxCountryCache[countryId].promise) {
        return taxCountryCache[countryId].promise;
    }
    var country = findCountryById(countryId);
    if (!country || !country.file) return Promise.reject(new Error('No file mapped for ' + countryId));

    var url = getTaxRegimesBaseUrl() + country.file;
        var p = fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
            var check = validateTaxCountryData(d);
            if (!check.valid) {
                var err = new Error('Invalid tax data: ' + check.errors[0]);
                err.validationErrors = check.errors;
                throw err;
            }
            taxCountryCache[countryId].data = d;
            return d;
        });

    taxCountryCache[countryId] = { promise: p, data: null };
    return p;
}

// ========== STATE / PROVINCE LAYER (Stage 6: multi-layer tax) ==========

function validateStatesData(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['State file is not a valid JSON object.'] };
    }

    var states = Array.isArray(data.states) ? data.states : [];
    if (states.length === 0) {
        errors.push('No "states" array found, or it is empty.');
        return { valid: false, errors: errors };
    }

    var seenIds = {};
    states.forEach(function (s, i) {
        var label = (s && s.id) ? s.id : ('state ' + (i + 1));

        if (!s || typeof s !== 'object') {
            errors.push(label + ': is not an object.');
            return;
        }
        if (!s.id || typeof s.id !== 'string') {
            errors.push(label + ': missing or invalid "id".');
        } else if (seenIds[s.id]) {
            errors.push(label + ': duplicate id "' + s.id + '".');
        } else {
            seenIds[s.id] = true;
        }
        if (!s.name || typeof s.name !== 'string') {
            errors.push(label + ': missing or invalid "name".');
        }

        var isZeroTax = s.engine_type === 'zero_income_tax';
        var isMultiplierOnly = s.multiplier_percent !== undefined && s.multiplier_percent !== null;
        if (!Array.isArray(s.slabs)) {
            errors.push(label + ': "slabs" must be an array.');
            return;
        }
        if (s.slabs.length === 0 && !isZeroTax && !isMultiplierOnly) {
            errors.push(label + ': "slabs" must be a non-empty array.');
            return;
        }

        s.slabs.forEach(function (slab, j) {
            var sLabel = label + ' slab ' + (j + 1);
            if (!slab || typeof slab !== 'object') {
                errors.push(sLabel + ': is not an object.');
                return;
            }
            var from = Number(slab.from);
            if (slab.from === null || slab.from === undefined || isNaN(from) || from < 0) {
                errors.push(sLabel + ': "from" must be a number >= 0.');
            }
            if (slab.to !== null && slab.to !== undefined) {
                var to = Number(slab.to);
                if (isNaN(to) || to <= from) {
                    errors.push(sLabel + ': "to" must be null or greater than "from".');
                }
            }
            var rate = Number(slab.rate);
            if (slab.rate === null || slab.rate === undefined || isNaN(rate) || rate < 0 || rate > 100) {
                errors.push(sLabel + ': "rate" must be between 0 and 100.');
            }
        });
    });

    return { valid: errors.length === 0, errors: errors };
}

function loadStatesFile(countryId) {
    if (taxStateCache[countryId] && taxStateCache[countryId].data) {
        return Promise.resolve(taxStateCache[countryId].data);
    }
    if (taxStateCache[countryId] && taxStateCache[countryId].promise) {
        return taxStateCache[countryId].promise;
    }

    var p = loadCountryFile(countryId).then(function (countryData) {
        if (!countryData.states_file) return null;
        var url = getTaxRegimesBaseUrl() + countryData.states_file;
        return fetch(url)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (d) {
                var check = validateStatesData(d);
                if (!check.valid) {
                    var err = new Error('Invalid state data: ' + check.errors[0]);
                    err.validationErrors = check.errors;
                    throw err;
                }
                taxStateCache[countryId].data = d;
                return d;
            });
    });

    taxStateCache[countryId] = { promise: p, data: null };
    return p;
}

function updateTaxStateLabel(text) {
    var label = document.getElementById('taxStateOptionLabel');
    if (label) label.textContent = text || 'Select State / Province';
}

function updateTaxLocalLabel(text) {
    var label = document.getElementById('taxLocalOptionLabel');
    if (label) label.textContent = text || 'Select City / Locality';
}

function showTaxStateOption(stateList) {
    var group = document.getElementById('taxStateGroup');
    var select = document.getElementById('taxStateOption');
    if (!group || !select) return;

    select.innerHTML = '';
    var noStateOpt = document.createElement('option');
    noStateOpt.value = 'no_state';
    noStateOpt.textContent = 'No State Tax / Not Listed';
    select.appendChild(noStateOpt);

    stateList.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name;
        select.appendChild(o);
    });

    group.classList.remove('hidden');
}

function hideTaxStateOption() {
    var group = document.getElementById('taxStateGroup');
    var select = document.getElementById('taxStateOption');
    if (select) select.innerHTML = '';
    if (group) group.classList.add('hidden');
    updateStateNotesDisplay(null);
    updateTaxStateLabel(null);
}

function updateStateNotesDisplay(entry) {
    var notesEl = document.getElementById('taxStateNotes');
    if (!notesEl) return;
    if (entry && entry.notes) {
        notesEl.innerHTML = '<strong>' + escapeHtml(entry.name) + ':</strong> ' + escapeHtml(entry.notes);
        notesEl.classList.remove('hidden');
    } else {
        notesEl.innerHTML = '';
        notesEl.classList.add('hidden');
    }
}

function applyStatePreset(stateEntry) {
    if (!currentConfigFieldId || !appState.components[currentConfigFieldId]) return;

    if (!stateEntry || stateEntry.id === 'no_state') {
        appState.components[currentConfigFieldId].state_tax_layer = null;
        return;
    }

    appState.components[currentConfigFieldId].state_tax_layer = {
        state_id: stateEntry.id,
        state_name: stateEntry.name,
        standard_deduction: stateEntry.standard_deduction || 0,
        surcharge_percent: stateEntry.surcharge_percent || 0,
        cess_percent: stateEntry.cess_percent || 0,
        slabs: stateEntry.slabs || [],
        // Stage 6c: canton-style multiplier (e.g. Switzerland). Only carried
        // through when the preset actually defines one — undefined/null for
        // ordinary US-state/Canada-province presets, which is what keeps
        // those countries computing exactly as before.
        multiplier_percent: (stateEntry.multiplier_percent !== undefined && stateEntry.multiplier_percent !== null)
            ? Number(stateEntry.multiplier_percent)
            : null,
        post_rules: stateEntry.post_rules
            ? JSON.parse(JSON.stringify(stateEntry.post_rules))
            : null
    };
}

function handleTaxStateOptionChange() {
    var st = document.getElementById('taxStateOption');
    var cs = document.getElementById('taxCountry');
    if (!st || !cs) return;

    var sdata = taxStateCache[cs.value] && taxStateCache[cs.value].data;
    var stateList = (sdata && sdata.states) || [];
    var entry = stateList.find(function (e) { return e.id === st.value; });

    applyStatePreset(entry || { id: 'no_state' });
    updateStateNotesDisplay(entry);

    // Stage 6b: a state may itself have a city/locality layer (e.g. NY -> NYC).
    // Reset local selection whenever the state changes.
    if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
        appState.components[currentConfigFieldId].local_tax_layer = null;
    }
    hideTaxLocalOption();

    if (entry && entry.cities_file) {
        loadCitiesFile(entry).then(function (citiesData) {
            if (document.getElementById('taxStateOption').value !== entry.id) return; // user changed while loading
            var cityList = citiesData.cities || [];
            var usesMultiplier = entry.multiplier_percent !== undefined && entry.multiplier_percent !== null;
            updateTaxLocalLabel(citiesData.local_label);
            showTaxLocalOption(cityList, usesMultiplier);
            updateLocalNotesDisplay(null);
            refreshTaxMetadata();
        }).catch(function () {
            showNotification('Local/city tax data could not be loaded for this state. State and federal tax will still be calculated.', 'warning');
            hideTaxLocalOption();
            refreshTaxMetadata();
        });
    } else {
        refreshTaxMetadata();
    }
}

// ========== CITY / LOCALITY LAYER (Stage 6b: three-layer tax) ==========

function validateCitiesData(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['City/locality file is not a valid JSON object.'] };
    }

    var cities = Array.isArray(data.cities) ? data.cities : [];
    if (cities.length === 0) {
        errors.push('No "cities" array found, or it is empty.');
        return { valid: false, errors: errors };
    }

    var seenIds = {};
    cities.forEach(function (c, i) {
        var label = (c && c.id) ? c.id : ('city ' + (i + 1));

        if (!c || typeof c !== 'object') {
            errors.push(label + ': is not an object.');
            return;
        }
        if (!c.id || typeof c.id !== 'string') {
            errors.push(label + ': missing or invalid "id".');
        } else if (seenIds[c.id]) {
            errors.push(label + ': duplicate id "' + c.id + '".');
        } else {
            seenIds[c.id] = true;
        }
        if (!c.name || typeof c.name !== 'string') {
            errors.push(label + ': missing or invalid "name".');
        }

        var isZeroTax = c.engine_type === 'zero_income_tax';
        var isMultiplierOnly = c.multiplier_percent !== undefined && c.multiplier_percent !== null;
        if (!Array.isArray(c.slabs)) {
            errors.push(label + ': "slabs" must be an array.');
            return;
        }
        if (c.slabs.length === 0 && !isZeroTax && !isMultiplierOnly) {
            errors.push(label + ': "slabs" must be a non-empty array.');
            return;
        }

        c.slabs.forEach(function (slab, j) {
            var sLabel = label + ' slab ' + (j + 1);
            if (!slab || typeof slab !== 'object') {
                errors.push(sLabel + ': is not an object.');
                return;
            }
            var from = Number(slab.from);
            if (slab.from === null || slab.from === undefined || isNaN(from) || from < 0) {
                errors.push(sLabel + ': "from" must be a number >= 0.');
            }
            if (slab.to !== null && slab.to !== undefined) {
                var to = Number(slab.to);
                if (isNaN(to) || to <= from) {
                    errors.push(sLabel + ': "to" must be null or greater than "from".');
                }
            }
            var rate = Number(slab.rate);
            if (slab.rate === null || slab.rate === undefined || isNaN(rate) || rate < 0 || rate > 100) {
                errors.push(sLabel + ': "rate" must be between 0 and 100.');
            }
        });
    });

    return { valid: errors.length === 0, errors: errors };
}

function loadCitiesFile(stateEntry) {
    var stateId = stateEntry.id;
    if (taxCityCache[stateId] && taxCityCache[stateId].data) {
        return Promise.resolve(taxCityCache[stateId].data);
    }
    if (taxCityCache[stateId] && taxCityCache[stateId].promise) {
        return taxCityCache[stateId].promise;
    }

    var url = getTaxRegimesBaseUrl() + stateEntry.cities_file;
    var p = fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
            var check = validateCitiesData(d);
            if (!check.valid) {
                var err = new Error('Invalid city data: ' + check.errors[0]);
                err.validationErrors = check.errors;
                throw err;
            }
            taxCityCache[stateId].data = d;
            return d;
        });

    taxCityCache[stateId] = { promise: p, data: null };
    return p;
}

function showTaxLocalOption(cityList, allowCustomMultiplier) {
    var group = document.getElementById('taxLocalGroup');
    var select = document.getElementById('taxLocalOption');
    if (!group || !select) return;

    select.innerHTML = '';
    var noLocalOpt = document.createElement('option');
    noLocalOpt.value = 'no_local';
    noLocalOpt.textContent = 'No City/Local Tax';
    select.appendChild(noLocalOpt);

    cityList.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        select.appendChild(o);
    });

    if (allowCustomMultiplier) {
        var customOpt = document.createElement('option');
        customOpt.value = 'custom_multiplier';
        customOpt.textContent = 'Other / Custom (enter multiplier)';
        select.appendChild(customOpt);
    }

    group.classList.remove('hidden');
}

function hideTaxLocalOption() {
    var group = document.getElementById('taxLocalGroup');
    var select = document.getElementById('taxLocalOption');
    var multGroup = document.getElementById('taxLocalMultiplierGroup');
    var multInput = document.getElementById('taxLocalMultiplierInput');
    if (select) select.innerHTML = '';
    if (group) group.classList.add('hidden');
    if (multGroup) multGroup.classList.add('hidden');
    if (multInput) multInput.value = '';
    updateLocalNotesDisplay(null);
    updateTaxLocalLabel(null);
}

function updateLocalNotesDisplay(entry) {
    var notesEl = document.getElementById('taxLocalNotes');
    if (!notesEl) return;
    if (entry && entry.notes) {
        notesEl.innerHTML = '<strong>' + escapeHtml(entry.name) + ':</strong> ' + escapeHtml(entry.notes);
        notesEl.classList.remove('hidden');
    } else {
        notesEl.innerHTML = '';
        notesEl.classList.add('hidden');
    }
}

function applyLocalPreset(cityEntry) {
    if (!currentConfigFieldId || !appState.components[currentConfigFieldId]) return;

    if (!cityEntry || cityEntry.id === 'no_local') {
        appState.components[currentConfigFieldId].local_tax_layer = null;
        return;
    }

    appState.components[currentConfigFieldId].local_tax_layer = {
        local_id: cityEntry.id,
        local_name: cityEntry.name,
        standard_deduction: cityEntry.standard_deduction || 0,
        surcharge_percent: cityEntry.surcharge_percent || 0,
        cess_percent: cityEntry.cess_percent || 0,
        slabs: cityEntry.slabs || [],
        multiplier_percent: (cityEntry.multiplier_percent !== undefined && cityEntry.multiplier_percent !== null)
            ? Number(cityEntry.multiplier_percent)
            : null,
        post_rules: cityEntry.post_rules
            ? JSON.parse(JSON.stringify(cityEntry.post_rules))
            : null
    };
}

function setLocalMultiplierOverride(percent) {
    if (!currentConfigFieldId || !appState.components[currentConfigFieldId]) return;
    if (percent === null || percent === '' || isNaN(percent)) {
        appState.components[currentConfigFieldId].local_tax_layer = null;
        return;
    }
    appState.components[currentConfigFieldId].local_tax_layer = {
        local_id: 'custom_multiplier',
        local_name: 'Custom commune (' + percent + '%)',
        standard_deduction: 0,
        surcharge_percent: 0,
        cess_percent: 0,
        slabs: [],
        multiplier_percent: Number(percent),
        post_rules: null
    };
}

function handleTaxLocalMultiplierInputChange() {
    var input = document.getElementById('taxLocalMultiplierInput');
    if (!input) return;
    var val = input.value.trim();
    setLocalMultiplierOverride(val === '' ? null : parseFloat(val));
    refreshTaxMetadata();
}

function handleTaxLocalOptionChange() {
    var lo = document.getElementById('taxLocalOption');
    var st = document.getElementById('taxStateOption');
    var multGroup = document.getElementById('taxLocalMultiplierGroup');
    var multInput = document.getElementById('taxLocalMultiplierInput');
    if (!lo || !st) return;

    if (lo.value === 'custom_multiplier') {
        if (multGroup) multGroup.classList.remove('hidden');
        updateLocalNotesDisplay(null);
        // Don't apply a preset yet — wait for the user to type a value.
        if (multInput && multInput.value.trim() !== '') {
            setLocalMultiplierOverride(parseFloat(multInput.value));
        } else if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
            appState.components[currentConfigFieldId].local_tax_layer = null;
        }
        refreshTaxMetadata();
        return;
    }
    if (multGroup) multGroup.classList.add('hidden');
    if (multInput) multInput.value = '';

    var cdata = taxCityCache[st.value] && taxCityCache[st.value].data;
    var cityList = (cdata && cdata.cities) || [];
    var entry = cityList.find(function (e) { return e.id === lo.value; });

    applyLocalPreset(entry || { id: 'no_local' });
    updateLocalNotesDisplay(entry);
    refreshTaxMetadata();
}

function showTaxSubOption(label, entries) {
    var group = document.getElementById('taxSubOptionGroup');
    var labelEl = document.getElementById('taxSubOptionLabel');
    var select = document.getElementById('taxSubOption');
    if (!group || !select) return;
    if (labelEl) labelEl.textContent = label;
    select.innerHTML = '';
    entries.forEach(function (e) {
        var o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.label;
        select.appendChild(o);
    });
    group.classList.remove('hidden');
}

function hideTaxSubOption() {
    var group = document.getElementById('taxSubOptionGroup');
    var select = document.getElementById('taxSubOption');
    if (select) select.innerHTML = '';
    if (group) group.classList.add('hidden');
}

function fillSlabFields(config) {
    var stdDed = document.getElementById('standardDeduction');
    var surchPct = document.getElementById('surchargePercent');
    var cessPct = document.getElementById('cessPercent');
    var tbody = document.getElementById('slabTableBody');

    if (stdDed) stdDed.value = config.standard_deduction || 0;
    if (surchPct) surchPct.value = config.surcharge_percent || 0;
    if (cessPct) cessPct.value = config.cess_percent || 0;

    if (!tbody) return;
    tbody.innerHTML = '';
    var slabs = (config.slabs && config.slabs.length > 0) ? config.slabs : [null];
        slabs.forEach(function (s) {
        if (s) addSlabRow(s.from, (s.to === null || s.to === undefined) ? '' : s.to, s.rate);
        else addSlabRow(0, '', 0);
    });

    // Sync flat-rate input from single-slab configs
    var flatInput = document.getElementById('flatRateValue');
    if (flatInput) {
        var single = (config.slabs && config.slabs.length === 1) ? config.slabs[0] : null;
        flatInput.value = single ? (single.rate || 0) : 0;
    }
}

function applyTaxPreset(entry) {
    fillSlabFields({
        standard_deduction: entry.standard_deduction || 0,
        surcharge_percent: entry.surcharge_percent || 0,
        cess_percent: entry.cess_percent || 0,
        slabs: entry.slabs || []
    });

    // Carry post_rules from the preset into component state
    if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
        appState.components[currentConfigFieldId].post_rules = entry.post_rules
            ? JSON.parse(JSON.stringify(entry.post_rules))
            : null;
    }
}

function computeLabel(countryId, regimeId) {
    var country = findCountryById(countryId);
    if (!country) return null;
    var cdata = taxCountryCache[countryId] && taxCountryCache[countryId].data;
    if (!cdata) return country.name;
    var lists = (cdata.regimes || []).concat(cdata.states || []);
    var entry = lists.find(function (e) { return e.id === regimeId; });
    return entry ? (country.name + ' — ' + entry.label) : country.name;
}

function getCurrentTaxSelection() {
    var cs = document.getElementById('taxCountry');
    var country = cs ? cs.value : 'custom';
    if (country === 'custom') return { country: 'custom', regime: 'custom', label: null };

    var subGroup = document.getElementById('taxSubOptionGroup');
    var sub = document.getElementById('taxSubOption');
    var regime = 'custom';

    if (subGroup && sub && !subGroup.classList.contains('hidden') && sub.value) {
        regime = sub.value;
    } else {
        var cdata = taxCountryCache[country] && taxCountryCache[country].data;
        if (cdata && cdata.regimes && cdata.regimes.length === 1) regime = cdata.regimes[0].id;
    }

    return { country: country, regime: regime, label: computeLabel(country, regime) };
}

function handleTaxCountryChange() {
    var cs = document.getElementById('taxCountry');
    var countryId = cs.value;
    hideTaxSubOption();
    hideTaxStateOption();
    hideTaxLocalOption();
    hideResidencyDaysInput();
    updateZeroTaxUI(countryId);
    updateFlatRateUI(countryId);

        if (countryId === 'custom') {
        if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
            appState.components[currentConfigFieldId].state_tax_layer = null;
            appState.components[currentConfigFieldId].local_tax_layer = null;
        }
        fillSlabFields({ standard_deduction: 0, surcharge_percent: 0, cess_percent: 0, slabs: [] });
        refreshTaxMetadata();
        return;
    }

    var country = findCountryById(countryId);
    if (!country) return;

    loadCountryFile(countryId).then(function (data) {
        if (cs.value !== countryId) return; // user changed while loading
        var states = data.states || [];
        var regimes = data.regimes || [];

        if (data.states_file) {
            // Stage 6: multi-layer country — federal regime dropdown and state
            // dropdown are independent and both shown (not either/or).
            if (regimes.length > 1) {
                showTaxSubOption(data.sub_option_label || 'Select Tax Regime', regimes);
                var rs = document.getElementById('taxSubOption');
                if (rs) { rs.value = regimes[0].id; applyTaxPreset(regimes[0]); }
            } else if (regimes.length === 1) {
                applyTaxPreset(regimes[0]);
            }
            if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
                appState.components[currentConfigFieldId].state_tax_layer = null;
                appState.components[currentConfigFieldId].local_tax_layer = null;
            }
            loadStatesFile(countryId).then(function (statesData) {
                if (cs.value !== countryId) return;
                var stateList = statesData.states || [];
                updateTaxStateLabel(data.state_label);
                showTaxStateOption(stateList);
                updateStateNotesDisplay(null);
                refreshTaxMetadata();
            }).catch(function () {
                showNotification('State tax data could not be loaded for this country. Federal tax will still be calculated.', 'warning');
                hideTaxStateOption();
                refreshTaxMetadata();
            });
            return;
        }

        if (country.internal_states && states.length > 0) {
            showTaxSubOption('Select State / Region', states);
            var s = document.getElementById('taxSubOption');
            if (s) { s.value = states[0].id; applyTaxPreset(states[0]); }
            hideResidencyDaysInput();
        } else if (regimes.length > 1) {
            showTaxSubOption(data.sub_option_label || 'Select Tax Regime', regimes);
            var s2 = document.getElementById('taxSubOption');
            if (s2) { s2.value = regimes[0].id; applyTaxPreset(regimes[0]); }
            if (data.residency_threshold_days) {
                showResidencyDaysInput(data.residency_threshold_days, data.residency_threshold_note);
            } else {
                hideResidencyDaysInput();
            }
        } else if (regimes.length === 1) {
            applyTaxPreset(regimes[0]);
            hideResidencyDaysInput();
        } else {
            fillSlabFields({ standard_deduction: 0, surcharge_percent: 0, cess_percent: 0, slabs: [] });
            hideResidencyDaysInput();
        }
        refreshTaxMetadata();
        }).catch(function (err) {
        if (cs.value === countryId) {
            var msg = 'Tax data for this country could not be loaded.';
            if (err && err.validationErrors) {
                msg = 'Tax data error: ' + err.validationErrors[0];
            } else if (err && err.message && err.message.indexOf('HTTP') === 0) {
                msg = 'Tax data file not found for this country.';
            }
            showNotification(msg, 'warning');
            cs.value = 'custom';
            hideTaxSubOption();
            hideTaxStateOption();
            hideResidencyDaysInput();
            fillSlabFields({ standard_deduction: 0, surcharge_percent: 0, cess_percent: 0, slabs: [] });
            refreshTaxMetadata();
        }
    });
}

function showResidencyDaysInput(thresholdDays, note) {
    var group = document.getElementById('taxResidencyDaysGroup');
    var input = document.getElementById('taxResidencyDaysInput');
    var noteEl = document.getElementById('taxResidencyDaysNote');
    if (!group || !input) return;
    group.dataset.thresholdDays = thresholdDays;
    input.value = '';
    if (noteEl) { noteEl.textContent = ''; noteEl.classList.add('hidden'); }
    group.classList.remove('hidden');
}

function hideResidencyDaysInput() {
    var group = document.getElementById('taxResidencyDaysGroup');
    var input = document.getElementById('taxResidencyDaysInput');
    var noteEl = document.getElementById('taxResidencyDaysNote');
    if (input) input.value = '';
    if (noteEl) { noteEl.textContent = ''; noteEl.classList.add('hidden'); }
    if (group) group.classList.add('hidden');
}

function handleTaxResidencyDaysInputChange() {
    var group = document.getElementById('taxResidencyDaysGroup');
    var input = document.getElementById('taxResidencyDaysInput');
    var noteEl = document.getElementById('taxResidencyDaysNote');
    var sub = document.getElementById('taxSubOption');
    var cs = document.getElementById('taxCountry');
    if (!group || !input || !sub || !cs) return;

    var days = parseInt(input.value, 10);
    var threshold = parseInt(group.dataset.thresholdDays || '0', 10);
    if (isNaN(days)) {
        if (noteEl) { noteEl.textContent = ''; noteEl.classList.add('hidden'); }
        return;
    }

    var cdata = taxCountryCache[cs.value] && taxCountryCache[cs.value].data;
    if (!cdata) return;
    var wantRole = days >= threshold ? 'resident' : 'nonresident';
    var match = (cdata.regimes || []).find(function (r) { return r.regime_role === wantRole; });

    if (match) {
        sub.value = match.id;
        applyTaxPreset(match);
        refreshTaxMetadata();
    }

    if (noteEl) {
        var roleLabel = wantRole === 'resident' ? 'Resident' : 'Non-Resident';
        noteEl.innerHTML = '<strong>Suggested:</strong> ' + escapeHtml(roleLabel) +
            ' (' + days + ' days vs. ' + threshold + '-day guideline). ' +
            escapeHtml(cdata.residency_threshold_note || 'This is advisory only — you can still pick a different regime above.');
        noteEl.classList.remove('hidden');
    }
}

function handleTaxSubOptionChange() {
    var sub = document.getElementById('taxSubOption');
    var cs = document.getElementById('taxCountry');
    if (!sub || !sub.value) return;
    var cdata = taxCountryCache[cs.value] && taxCountryCache[cs.value].data;
    if (!cdata) return;
    var lists = (cdata.regimes || []).concat(cdata.states || []);
    var entry = lists.find(function (e) { return e.id === sub.value; });
    if (entry) applyTaxPreset(entry);
    refreshTaxMetadata();
}

function restoreTaxDropdowns(countryId, regimeId, stateId, localId) {
    var cs = document.getElementById('taxCountry');
    if (!cs) return;

    if (!taxIndexData) {
        cs.value = 'custom';
        hideTaxSubOption();
        hideTaxStateOption();
        hideTaxLocalOption();
        preloadTaxIndex().then(function () { restoreTaxDropdowns(countryId, regimeId, stateId, localId); });
        return;
    }

    var country = findCountryById(countryId);
    if (!country || countryId === 'custom') {
        cs.value = 'custom';
        hideTaxSubOption();
        hideTaxStateOption();
        hideTaxLocalOption();
        updateZeroTaxUI('custom');
        updateFlatRateUI('custom');
        return;
    }

    cs.value = countryId;
    hideTaxSubOption();
    hideTaxStateOption();
    hideTaxLocalOption();
    updateZeroTaxUI(countryId);
    updateFlatRateUI(countryId);

    loadCountryFile(countryId).then(function (data) {
        if (cs.value !== countryId) return;
        var states = data.states || [];
        var regimes = data.regimes || [];

        if (data.states_file) {
            if (regimes.length > 1) {
                showTaxSubOption(data.sub_option_label || 'Select Tax Regime', regimes);
                var rs = document.getElementById('taxSubOption');
                if (rs && regimeId && regimes.some(function (x) { return x.id === regimeId; })) rs.value = regimeId;
            }
            loadStatesFile(countryId).then(function (statesData) {
                if (cs.value !== countryId) return;
                var stateList = statesData.states || [];
                updateTaxStateLabel(data.state_label);
                showTaxStateOption(stateList);
                var st = document.getElementById('taxStateOption');
                var match = stateId && stateList.find(function (x) { return x.id === stateId; });
                if (st) {
                    if (match) {
                        st.value = stateId;
                        updateStateNotesDisplay(match);
                    } else {
                        st.value = 'no_state';
                    }
                }

                // Stage 6b: the matched state may itself have a city/local layer.
                if (match && match.cities_file) {
                    loadCitiesFile(match).then(function (citiesData) {
                        if (document.getElementById('taxStateOption').value !== stateId) return;
                        var cityList = citiesData.cities || [];
                        var usesMultiplier = match.multiplier_percent !== undefined && match.multiplier_percent !== null;
                        updateTaxLocalLabel(citiesData.local_label);
                        showTaxLocalOption(cityList, usesMultiplier);
                        var lo = document.getElementById('taxLocalOption');
                        var cmatch = localId && cityList.find(function (x) { return x.id === localId; });
                        if (lo) {
                            if (cmatch) {
                                lo.value = localId;
                                updateLocalNotesDisplay(cmatch);
                            } else if (localId === 'custom_multiplier') {
                                lo.value = 'custom_multiplier';
                                var multGroup = document.getElementById('taxLocalMultiplierGroup');
                                var multInput = document.getElementById('taxLocalMultiplierInput');
                                var savedLayer = currentConfigFieldId && appState.components[currentConfigFieldId]
                                    ? appState.components[currentConfigFieldId].local_tax_layer : null;
                                if (multGroup) multGroup.classList.remove('hidden');
                                if (multInput) multInput.value = (savedLayer && savedLayer.multiplier_percent !== null) ? savedLayer.multiplier_percent : '';
                            } else {
                                lo.value = 'no_local';
                            }
                        }
                        refreshTaxMetadata();
                    }).catch(function () {
                        hideTaxLocalOption();
                        refreshTaxMetadata();
                    });
                } else {
                    refreshTaxMetadata();
                }
            }).catch(function () {
                hideTaxStateOption();
                hideTaxLocalOption();
                refreshTaxMetadata();
            });
            return;
        }

        if (country.internal_states && states.length > 0) {
            showTaxSubOption('Select State / Region', states);
            var s = document.getElementById('taxSubOption');
            if (s && regimeId && states.some(function (x) { return x.id === regimeId; })) s.value = regimeId;
        } else if (regimes.length > 1) {
            showTaxSubOption(data.sub_option_label || 'Select Tax Regime', regimes);
            var s2 = document.getElementById('taxSubOption');
            if (s2 && regimeId && regimes.some(function (x) { return x.id === regimeId; })) s2.value = regimeId;
        }
        refreshTaxMetadata();
        }).catch(function (err) {
        if (cs.value === countryId) {
            cs.value = 'custom';
            hideTaxSubOption();
            hideTaxStateOption();
            hideTaxLocalOption();
            var msg = 'Saved tax preset could not be restored. Using Custom.';
            if (err && err.validationErrors) {
                msg = 'Saved tax preset invalid: ' + err.validationErrors[0];
            }
            showNotification(msg, 'warning');
            refreshTaxMetadata();
        }
    });
}

function isZeroTaxCountry(countryId) {
    var country = findCountryById(countryId);
    return Boolean(country && country.engine_type === 'zero_income_tax');
}

function updateZeroTaxUI(countryId) {
    var isZero = isZeroTaxCountry(countryId);
    var optionalFields = document.querySelector('#slabEditorGroup .slab-optional-fields');
    var tableContainer = document.querySelector('#slabEditorGroup .slab-table-container');
    var addSlabBtn = document.getElementById('btnAddSlab');
    var indicator = document.getElementById('zeroTaxIndicator');

    if (optionalFields) optionalFields.classList.toggle('hidden', isZero);
    if (tableContainer) tableContainer.classList.toggle('hidden', isZero);
    if (addSlabBtn) addSlabBtn.classList.toggle('hidden', isZero);
    if (indicator) indicator.classList.toggle('hidden', !isZero);
}

function isFlatRateCountry(countryId) {
    var country = findCountryById(countryId);
    return Boolean(country && country.engine_type === 'flat_rate_tax');
}

function updateFlatRateUI(countryId) {
    var isFlat = isFlatRateCountry(countryId);
    var isZero = isZeroTaxCountry(countryId);
    var tableContainer = document.querySelector('#slabEditorGroup .slab-table-container');
    var addSlabBtn = document.getElementById('btnAddSlab');
    var indicator = document.getElementById('flatRateIndicator');

    // Guard: zero-tax UI (updateZeroTaxUI) already hides table/button for zero-tax.
    // Only toggle here when NOT zero-tax, to avoid un-hiding them.
    if (tableContainer && !isZero) tableContainer.classList.toggle('hidden', isFlat);
    if (addSlabBtn && !isZero) addSlabBtn.classList.toggle('hidden', isFlat);
    if (indicator) indicator.classList.toggle('hidden', !isFlat);
}

// ========== SLAB EDITOR ==========

function addSlabRow(fromVal, toVal, rateVal) {
    fromVal = (fromVal !== undefined && fromVal !== null) ? fromVal : '';
    toVal = (toVal !== undefined && toVal !== null) ? toVal : '';
    rateVal = (rateVal !== undefined && rateVal !== null) ? rateVal : '';

    var tbody = document.getElementById('slabTableBody');
    var row = document.createElement('tr');
    row.innerHTML =
        '<td><input type="number" class="slab-from" value="' + fromVal + '" min="0" placeholder="0"></td>' +
        '<td><input type="number" class="slab-to" value="' + toVal + '" min="0" placeholder="No limit"></td>' +
        '<td><input type="number" class="slab-rate" value="' + rateVal + '" min="0" max="100" step="0.01" placeholder="0"></td>' +
        '<td><button type="button" class="btn-remove-slab">✕</button></td>';

        row.querySelector('.btn-remove-slab').addEventListener('click', function () {
        row.remove();
        var cs = document.getElementById('taxCountry');
        if (cs) cs.value = 'custom';
        hideTaxSubOption();
        updateZeroTaxUI('custom');
        updateFlatRateUI('custom');
        refreshTaxMetadata();
        if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
            appState.components[currentConfigFieldId].post_rules = null;
        }
    });

    tbody.appendChild(row);
}

function getSlabDataFromUI() {
    var rows = document.querySelectorAll('#slabTableBody tr');
    var slabs = [];
    rows.forEach(function (row) {
        var fromVal = parseFloat(row.querySelector('.slab-from').value) || 0;
        var toRaw = row.querySelector('.slab-to').value.trim();
        var toVal = toRaw === '' ? null : parseFloat(toRaw);
        var rateVal = parseFloat(row.querySelector('.slab-rate').value) || 0;
        slabs.push({ from: fromVal, to: toVal, rate: rateVal });
    });
    return slabs;
}

function populateSlabEditor(slabConfig) {
    preloadTaxIndex();
    var countryId = slabConfig && slabConfig.country ? slabConfig.country : 'custom';
    var regimeId = slabConfig && slabConfig.regime ? slabConfig.regime : 'custom';
    var stateId = slabConfig && slabConfig.state_id ? slabConfig.state_id : null;
    var localId = slabConfig && slabConfig.local_id ? slabConfig.local_id : null;

    // Stage 6 / 6b: restore the state and local layers directly onto the
    // component being edited. This is authoritative for calculation even if
    // the dropdowns can't visually re-select them (e.g. data files changed).
    if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
        appState.components[currentConfigFieldId].state_tax_layer =
            (slabConfig && slabConfig.state)
                ? {
                    state_id: slabConfig.state_id || null,
                    state_name: slabConfig.state_name || null,
                    standard_deduction: slabConfig.state.standard_deduction || 0,
                    surcharge_percent: slabConfig.state.surcharge_percent || 0,
                    cess_percent: slabConfig.state.cess_percent || 0,
                    slabs: slabConfig.state.slabs || [],
                    multiplier_percent: (slabConfig.state.multiplier_percent !== undefined && slabConfig.state.multiplier_percent !== null)
                        ? slabConfig.state.multiplier_percent
                        : null,
                    post_rules: slabConfig.state.post_rules || null
                }
                : null;

        appState.components[currentConfigFieldId].local_tax_layer =
            (slabConfig && slabConfig.local)
                ? {
                    local_id: slabConfig.local_id || null,
                    local_name: slabConfig.local_name || null,
                    standard_deduction: slabConfig.local.standard_deduction || 0,
                    surcharge_percent: slabConfig.local.surcharge_percent || 0,
                    cess_percent: slabConfig.local.cess_percent || 0,
                    slabs: slabConfig.local.slabs || [],
                    multiplier_percent: (slabConfig.local.multiplier_percent !== undefined && slabConfig.local.multiplier_percent !== null)
                        ? slabConfig.local.multiplier_percent
                        : null,
                    post_rules: slabConfig.local.post_rules || null
                }
                : null;
    }

    restoreTaxDropdowns(countryId, regimeId, stateId, localId);
    fillSlabFields(slabConfig || { standard_deduction: 0, surcharge_percent: 0, cess_percent: 0, slabs: [] });

    // Sync post_rules from the saved slab config
    if (currentConfigFieldId && appState.components[currentConfigFieldId]) {
        appState.components[currentConfigFieldId].post_rules =
            (slabConfig && slabConfig.post_rules) ? slabConfig.post_rules : null;
    }
}

function refreshTaxMetadata() {
    var metadataContainer = document.getElementById('taxRegimeMetadata');
    if (!metadataContainer) return;

    var sel = getCurrentTaxSelection(); // { country: '...', regime: '...' }
    
    // Hide if Custom or if data isn't loaded
    if (sel.country === 'custom' || !taxCountryCache[sel.country] || !taxCountryCache[sel.country].data) {
        metadataContainer.classList.add('hidden');
        return;
    }

    var cdata = taxCountryCache[sel.country].data;
    var lists = (cdata.regimes || []).concat(cdata.states || []);
    var entry = lists.find(function (e) { return e.id === sel.regime; });

    // Update Year
    document.getElementById('taxMetadataYear').textContent = 'Tax Year: ' + (cdata.tax_year || 'N/A');
    
    // Update Source Link
    var sourceLink = document.getElementById('taxMetadataSource');
    if (cdata.source) {
        sourceLink.href = cdata.source;
        sourceLink.style.display = 'inline';
    } else {
        sourceLink.style.display = 'none';
    }

    // Update Disclaimer
    var disclaimerEl = document.getElementById('taxMetadataDisclaimer');
    if (cdata.disclaimer) {
        disclaimerEl.innerHTML = '<strong>Disclaimer:</strong> ' + escapeHtml(cdata.disclaimer);
        disclaimerEl.style.display = 'block';
    } else {
        disclaimerEl.style.display = 'none';
    }

    // Update Regime-specific notes
    var notesEl = document.getElementById('taxMetadataNotes');
    var notesParts = [];
    if (entry && entry.notes) {
        notesParts.push('<strong>Notes:</strong> ' + escapeHtml(entry.notes));
        if (entry.post_rules) {
            var extras = [];
            if (entry.post_rules.rebate) extras.push('rebate');
            if (entry.post_rules.tapering_deduction) extras.push('allowance taper');
            if (entry.post_rules.credits && entry.post_rules.credits.length > 0) extras.push('tax credits');
            if (extras.length > 0) {
                notesParts.push('<strong>Includes:</strong> ' + escapeHtml(extras.join(', ')));
            }
        }
    }

    // Multi-layer (Stage 6): append the selected state/province, if any
    var activeComponent = currentConfigFieldId ? appState.components[currentConfigFieldId] : null;
    var stateLayer = activeComponent ? activeComponent.state_tax_layer : null;
    var localLayer = activeComponent ? activeComponent.local_tax_layer : null;
    if (cdata.states_file) {
        if (stateLayer && stateLayer.state_name) {
            notesParts.push('<strong>State/Province:</strong> ' + escapeHtml(stateLayer.state_name) + ' (federal + state tax will be summed)');
        } else {
            notesParts.push('<strong>State/Province:</strong> None selected — only federal tax will be calculated.');
        }
    }

    // Three-layer (Stage 6b): append the selected city/locality, if the
    // selected state actually has one available.
    var taxStateSelectEl = document.getElementById('taxStateOption');
    var localGroupVisible = taxStateSelectEl
        && taxCityCache[taxStateSelectEl.value]
        && taxCityCache[taxStateSelectEl.value].data;
    if (localGroupVisible) {
        if (localLayer && localLayer.local_name) {
            notesParts.push('<strong>City/Local:</strong> ' + escapeHtml(localLayer.local_name) + ' (federal + state + local tax will be summed)');
        } else {
            notesParts.push('<strong>City/Local:</strong> None selected — no local tax will be added.');
        }
    }

    if (notesParts.length > 0) {
        notesEl.innerHTML = notesParts.join('<br>');
        notesEl.style.display = 'block';
    } else {
        notesEl.style.display = 'none';
    }

    metadataContainer.classList.remove('hidden');
}

// ========== TOTAL CALCULATION ==========
function updateConfiguredTotal() {
    if (!configuredTotalEl) return;
    let total = 0;
    Object.values(appState.components).forEach(comp => {
        if (comp.logic_type === 'fixed') {
            const value = Number(comp.value || 0);
            if (comp.frequency === 'monthly') total += value * 12;
            else if (comp.frequency === 'quarterly') total += value * 4;
            else total += value;
        }
    });
    configuredTotalEl.textContent = formatCurrency(total);
}

// ========== VALIDATION ==========
function validateStructure() {
    const components = Object.values(appState.components);
    if (components.length === 0) return { valid: false, message: 'Please add at least one component.' };
    for (const comp of components) {
        if (!comp.name || !comp.name.trim()) return { valid: false, message: 'One or more components have empty names.' };
    }
    for (const comp of components) {
        if (!comp.configured) return { valid: false, message: '"' + comp.name + '" is not configured yet.' };
    }
    if (appState.components['hra'] && appState.components['hra'].logic_type === 'percent_basic' && !appState.components['basic_salary']) {
        return { valid: false, message: 'HRA depends on Basic Salary, but Basic Salary is missing.' };
    }
    const dependentFields = ['hra', 'dearness_allowance', 'employer_pf', 'employee_pf'];
    const hasDependentField = dependentFields.some(id => appState.components[id]);
    if (hasDependentField && !appState.components['basic_salary']) {
        return { valid: false, message: 'Basic Salary is required because dependent components are present.' };
    }
    return { valid: true, message: 'Structure is valid.' };
}

function calculateFixedAnnualTotal() {
    let total = 0;
    Object.values(appState.components).forEach(comp => {
        if (comp.logic_type === 'fixed') {
            const value = Number(comp.value || 0);
            if (comp.frequency === 'monthly') total += value * 12;
            else if (comp.frequency === 'quarterly') total += value * 4;
            else total += value;
        }
    });
    return total;
}

// ========== PREVIEW & BACKEND ==========
function runPreviewValidation() {
    if (isCalculating) return;

    const structureCheck = validateStructure();
    if (!structureCheck.valid) { showNotification(structureCheck.message, 'error'); return; }

    const ctcInput = document.getElementById('ctcInput');
    const ctcValueRaw = ctcInput.value.trim();
    const ctcValue = parseFloat(ctcValueRaw);

    if (ctcValueRaw === '' || isNaN(ctcValue)) { showNotification('Please enter a valid Annual CTC amount.', 'error'); return; }
    if (ctcValue <= 0) { showNotification('Annual CTC must be greater than 0.', 'error'); return; }

    const fixedAnnualTotal = calculateFixedAnnualTotal();
    if (fixedAnnualTotal > ctcValue) { showNotification('Configured fixed components exceed the total CTC.', 'error'); return; }

    sendToBackend(ctcValue);
}

function sendToBackend(ctcValue) {
    isCalculating = true;

    const btnCalculate = document.getElementById('btnCalculate');
    const originalText = btnCalculate ? btnCalculate.textContent : 'Calculate';

    if (btnCalculate) {
        btnCalculate.disabled = true;
        btnCalculate.textContent = 'Calculating...';
        btnCalculate.classList.add('btn-loading');
    }

    const payload = {
        total_ctc: ctcValue,
        components: appState.components
    };

    fetch('/api/calculate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                displayPreviewResults(data);
                showNotification('Calculation complete.', 'success');
            } else {
                showNotification(data?.error || 'Calculation failed.', 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('Failed to connect to server.', 'error');
        })
        .finally(() => {
            isCalculating = false;
            if (btnCalculate) {
                btnCalculate.disabled = false;
                btnCalculate.textContent = originalText;
                btnCalculate.classList.remove('btn-loading');
            }
        });
}

function displayPreviewResults(data) {
    lastCalculation = data;
    previewPeriod = 'monthly';

    renderPreviewFromCalculation();
    updatePreviewPeriodButtons();
    updateExportAvailability();

    // Libraries load quietly after first successful calculation.
    startExportLibraryPreload();
}

// ========== MONTHLY / ANNUAL PREVIEW ==========

function initPreviewPeriodToggle() {
    const monthlyButton = document.getElementById('btnMonthlyView');
    const annualButton = document.getElementById('btnAnnualView');

    if (monthlyButton) {
        monthlyButton.addEventListener('click', function () {
            if (!lastCalculation) return;
            previewPeriod = 'monthly';
            renderPreviewFromCalculation();
            updatePreviewPeriodButtons();
        });
    }

    if (annualButton) {
        annualButton.addEventListener('click', function () {
            if (!lastCalculation) return;
            previewPeriod = 'annual';
            renderPreviewFromCalculation();
            updatePreviewPeriodButtons();
        });
    }
}

function updatePreviewPeriodButtons() {
    const monthlyButton = document.getElementById('btnMonthlyView');
    const annualButton = document.getElementById('btnAnnualView');

    if (monthlyButton) {
        const isMonthly = previewPeriod === 'monthly';
        monthlyButton.classList.toggle('active', isMonthly);
        monthlyButton.setAttribute('aria-pressed', String(isMonthly));
    }

    if (annualButton) {
        const isAnnual = previewPeriod === 'annual';
        annualButton.classList.toggle('active', isAnnual);
        annualButton.setAttribute('aria-pressed', String(isAnnual));
    }
}

function getPeriodSuffix() {
    return previewPeriod === 'annual' ? '/yr' : '/mo';
}

function getComponentAmount(component) {
    if (previewPeriod === 'annual') {
        return Number(component.annual || 0);
    }

    return Number(component.monthly || 0);
}

function getSummaryAmount(baseName) {
    if (!lastCalculation) return 0;

    const periodKey = previewPeriod === 'annual'
        ? `${baseName}_annual`
        : `${baseName}_monthly`;

    const directValue = lastCalculation[periodKey];

    if (directValue !== undefined && directValue !== null) {
        return Number(directValue);
    }

    // Fallback for an older backend response.
    if (previewPeriod === 'annual') {
        return Number(lastCalculation[`${baseName}_monthly`] || 0) * 12;
    }

    return Number(lastCalculation[`${baseName}_annual`] || 0) / 12;
}

function getCategoryTitle(categoryId) {
    const defaultTitles = {
        earnings: 'Earnings',
        employer_contributions: 'Employer Contributions',
        deductions: 'Deductions',
        variable_pay: 'Variable Pay / Bonuses',
        perks_benefits: 'Perks & Benefits'
    };

    if (defaultTitles[categoryId]) {
        return defaultTitles[categoryId];
    }

    const customCategory = appState.customCategories.find(
        category => category.id === categoryId
    );

    if (customCategory) {
        return customCategory.name;
    }

    return String(categoryId)
        .replaceAll('_', ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getNonEmptyComponents() {
    if (!lastCalculation) return [];

    if (Array.isArray(lastCalculation.components)) {
        return lastCalculation.components.filter(component =>
            Math.abs(Number(component.annual || 0)) > 0
        );
    }

    return [];
}

function getAllCalculatedComponents() {
    if (!lastCalculation) return [];

    if (Array.isArray(lastCalculation.all_components)) {
        return lastCalculation.all_components;
    }

    return getNonEmptyComponents();
}

function getDisplayComponentName(component) {
    if (!component || !component.id) {
        return component && component.name ? component.name : '';
    }

    const stateComponent = appState.components[component.id];

    if (
        stateComponent &&
        stateComponent.logic_type === 'tax_slabs' &&
        stateComponent.slab_config &&
        stateComponent.slab_config.regime_label
    ) {
        return `${component.name} (${stateComponent.slab_config.regime_label})`;
    }

    return component.name || '';
}

function groupComponentsByCategory(components) {
    const preferredOrder = [
        'earnings',
        'deductions',
        'variable_pay',
        'perks_benefits',
        'employer_contributions'
    ];

    const groups = {};

    preferredOrder.forEach(categoryId => {
        groups[categoryId] = {
            id: categoryId,
            title: getCategoryTitle(categoryId),
            items: []
        };
    });

    components.forEach(component => {
        const categoryId = component.category || 'other';

        if (!groups[categoryId]) {
            groups[categoryId] = {
                id: categoryId,
                title: getCategoryTitle(categoryId),
                items: []
            };
        }

        groups[categoryId].items.push(component);
    });

    return Object.values(groups).filter(group => group.items.length > 0);
}

function renderPreviewFromCalculation() {
    if (!lastCalculation) return;

    const summary = document.getElementById('previewSummary');
    const resultsContainer = document.getElementById('previewResults');

    const periodText = previewPeriod === 'annual' ? 'Annual' : 'Monthly';

    document.getElementById('summaryCtc').textContent =
        formatCurrency(lastCalculation.total_ctc || 0);

    document.getElementById('summaryGrossLabel').textContent =
        `Gross Salary (${periodText})`;

    document.getElementById('summaryDeductionsLabel').textContent =
        `Total Deductions (${periodText})`;

    document.getElementById('summaryNetLabel').textContent =
        `Net Take-Home (${periodText})`;

    document.getElementById('summaryGross').textContent =
        formatCurrency(getSummaryAmount('gross'));

    document.getElementById('summaryDeductions').textContent =
        formatCurrency(getSummaryAmount('deductions'));

    document.getElementById('summaryNet').textContent =
        formatCurrency(getSummaryAmount('net'));

    summary.classList.remove('hidden');
    resultsContainer.innerHTML = '';

    const groups = groupComponentsByCategory(getNonEmptyComponents());

    groups.forEach(group => {
        const section = document.createElement('div');
        section.className = 'preview-group';

        section.innerHTML =
            `<h4 class="preview-group-title">${escapeHtml(group.title)}</h4>`;

        group.items.forEach(item => {
            const isDeduction = item.category === 'deductions';
            const amount = Math.abs(getComponentAmount(item));

            const displayValue = isDeduction
                ? `- ${formatCurrency(amount)}${getPeriodSuffix()}`
                : `${formatCurrency(amount)}${getPeriodSuffix()}`;

            const row = document.createElement('div');
            row.className = 'preview-row';

            row.innerHTML =
                `<span class="preview-row-name">${escapeHtml(getDisplayComponentName(item))}</span>` +
                `<span class="preview-row-value ${isDeduction ? 'deduction-value' : ''}">` +
                `${displayValue}</span>`;

            section.appendChild(row);
        });

        resultsContainer.appendChild(section);
    });

    if (lastCalculation.warnings && lastCalculation.warnings.length > 0) {
        const warningsBox = document.createElement('div');
        warningsBox.className = 'preview-warnings';
        warningsBox.innerHTML = '<h4>⚠️ Warnings</h4>';

        lastCalculation.warnings.forEach(warning => {
            const paragraph = document.createElement('p');
            paragraph.textContent = warning;
            warningsBox.appendChild(paragraph);
        });

        resultsContainer.appendChild(warningsBox);
    }
}

function invalidateCalculatedPreview() {
    lastCalculation = null;
    previewPeriod = 'monthly';

    updatePreviewPeriodButtons();
    updateExportAvailability();

    const summary = document.getElementById('previewSummary');
    const results = document.getElementById('previewResults');

    if (summary) {
        summary.classList.add('hidden');
    }

    if (results) {
        results.innerHTML =
            '<p class="preview-placeholder">Structure changed. Calculate again to refresh the preview.</p>';
    }
}

// ========== CLEAR CANVAS ==========
function initClearButton() {
    const btnClear = document.getElementById('btnClear');
    if (!btnClear) return;
    btnClear.addEventListener('click', function () {
        if (confirm('Are you sure you want to clear the entire canvas?')) {
            clearCanvasSilently();
            showNotification('Canvas cleared.', 'info');
        }
    });
}

function clearCanvasSilently() {
    lastCalculation = null;
    previewPeriod = 'monthly';
    updatePreviewPeriodButtons();
    updateExportAvailability();

    document.querySelectorAll('.canvas-field').forEach(el => el.remove());
    Object.keys(appState.components).forEach(enableSidebarCard);
    appState.components = {};

    document.querySelectorAll('.canvas-category[data-custom-category="true"]').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-category[data-category-id]').forEach(el => el.remove());
    appState.customCategories = [];

    checkAndAddPlaceholder();
    updateConfiguredTotal();

    const summary = document.getElementById('previewSummary');
    if (summary) summary.classList.add('hidden');
    const results = document.getElementById('previewResults');
    if (results) results.innerHTML = '<p class="preview-placeholder">Enter CTC and click Calculate to see breakdown</p>';
    const ctcInput = document.getElementById('ctcInput');
    if (ctcInput) ctcInput.value = '';
}

// ========== CUSTOM CATEGORY ==========
function initCategoryModal() {
    btnAddCategory.addEventListener('click', () => openModal('categoryModal'));
    categoryModalClose.addEventListener('click', closeCategoryModal);
    categoryModalCancel.addEventListener('click', closeCategoryModal);
    categoryModalSave.addEventListener('click', saveCustomCategory);
    categoryModal.addEventListener('click', e => { if (e.target === categoryModal) closeCategoryModal(); });
}

function closeCategoryModal() {
    closeModal('categoryModal');
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryDescription').value = '';
}

function saveCustomCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const addCtc = document.getElementById('categoryAddCtc').value;
    const addGross = document.getElementById('categoryAddGross').value;
    const reduceNet = document.getElementById('categoryReduceNet').value;
    const frequency = document.getElementById('categoryFrequency').value;

    if (!name) { showNotification('Category name cannot be empty.', 'error'); return; }

    const normalized = name.toLowerCase();
    const duplicate = Array.from(document.querySelectorAll('.category-header'))
        .some(el => el.textContent.trim().toLowerCase().includes(normalized));
    if (duplicate) { showNotification('A category with this name already exists.', 'error'); return; }

    if (addGross === 'yes' && reduceNet === 'yes') {
        showNotification('A category cannot both add to Gross and reduce Net.', 'error');
        return;
    }

    const categoryId = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const categoryData = {
        id: categoryId, name: name, description: description,
        addCtc: addCtc === 'yes', addGross: addGross === 'yes',
        reduceNet: reduceNet === 'yes', frequency: frequency, isCustom: true
    };

    appState.customCategories.push(categoryData);
    addCustomCategoryToSidebar(categoryData);
    addCustomCategoryToCanvas(categoryData);
    closeCategoryModal();
    showNotification('Category "' + name + '" created.', 'success');
}

// Sidebar Custom Category
function addCustomCategoryToSidebar(categoryData) {
    const sidebarCategory = document.createElement('div');
    sidebarCategory.className = 'sidebar-category';
    sidebarCategory.dataset.categoryId = categoryData.id;
    sidebarCategory.innerHTML =
        '<h3 class="category-header" data-category="' + categoryData.id + '">' +
            '<span class="arrow">&#9654;</span> ' + categoryData.name +
            '<button class="btn-delete-category" data-category-id="' + categoryData.id + '" title="Delete">✕</button>' +
        '</h3>' +
        '<div class="category-fields" id="' + categoryData.id + '-fields">' +
            '<p class="sidebar-placeholder">Use "+ Add Field" on canvas</p>' +
        '</div>';

    btnAddCategory.parentNode.insertBefore(sidebarCategory, btnAddCategory);

    sidebarCategory.querySelector('.category-header').addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-delete-category')) return;
        this.classList.toggle('open');
        const fields = this.nextElementSibling;
        if (fields) fields.classList.toggle('open');
    });

    sidebarCategory.querySelector('.btn-delete-category').addEventListener('click', function (e) {
        e.stopPropagation();
        deleteCustomCategory(categoryData.id);
    });
}

// Canvas Custom Category
function addCustomCategoryToCanvas(categoryData) {
    const canvasCategory = document.createElement('div');
    canvasCategory.className = 'canvas-category';
    canvasCategory.dataset.category = categoryData.id;
    canvasCategory.dataset.customCategory = 'true';
    canvasCategory.innerHTML =
        '<div class="canvas-category-header">' +
            '<h3>' + categoryData.name + '</h3>' +
            '<button class="btn-add-field" data-category="' + categoryData.id + '">+ Add Field</button>' +
        '</div>' +
        '<div class="drop-zone" id="drop-' + categoryData.id + '" data-category="' + categoryData.id + '">' +
            '<p class="drop-placeholder">Click components from sidebar to add here</p>' +
        '</div>';

    canvas.appendChild(canvasCategory);
    canvasCategory.querySelector('.btn-add-field').addEventListener('click', () => addCustomFieldToCategory(categoryData.id));
}

function deleteCustomCategory(categoryId) {
    const category = appState.customCategories.find(c => c.id === categoryId);
    const categoryName = category ? category.name : 'this category';
    const fieldCount = Object.keys(appState.components).filter(
        id => appState.components[id].category === categoryId
    ).length;

    let message = 'Are you sure you want to delete "' + categoryName + '"?';
    if (fieldCount > 0) message += '\n\nThis will also delete ' + fieldCount + ' field(s) inside it.';
    message += '\n\nThis action cannot be undone.';

    if (!confirm(message)) return;

    Object.keys(appState.components).forEach(fieldId => {
        if (appState.components[fieldId].category === categoryId) {
            enableSidebarCard(fieldId);
            delete appState.components[fieldId];
        }
    });

    appState.customCategories = appState.customCategories.filter(c => c.id !== categoryId);
    document.querySelector('.sidebar-category[data-category-id="' + categoryId + '"]')?.remove();
    document.querySelector('.canvas-category[data-category="' + categoryId + '"]')?.remove();
    invalidateCalculatedPreview();
    updateConfiguredTotal();
    checkAndAddPlaceholder();
    showNotification('"' + categoryName + '" deleted.', 'info');
}

// ========== ADD CUSTOM FIELD ==========
function initAddFieldButtons() {
    document.querySelectorAll('.btn-add-field').forEach(btn => {
        btn.addEventListener('click', function () {
            addCustomFieldToCategory(this.dataset.category);
        });
    });

    // Custom Field Modal Actions
    const customFieldModalClose = document.getElementById('customFieldModalClose');
    const customFieldModalCancel = document.getElementById('customFieldModalCancel');
    const customFieldModalSave = document.getElementById('customFieldModalSave');
    const customFieldModal = document.getElementById('customFieldModal');

    if (customFieldModalClose) customFieldModalClose.addEventListener('click', closeCustomFieldModal);
    if (customFieldModalCancel) customFieldModalCancel.addEventListener('click', closeCustomFieldModal);
    if (customFieldModalSave) customFieldModalSave.addEventListener('click', saveCustomField);
    
    if (customFieldModal) {
        customFieldModal.addEventListener('click', function (e) {
            if (e.target === customFieldModal) closeCustomFieldModal();
        });
    }
}

function closeCustomFieldModal() {
    closeModal('customFieldModal');
    activeAddFieldCategory = null;
    document.getElementById('customFieldName').value = '';
    const checkbox = document.getElementById('customFieldAllowSlabs');
    if (checkbox) checkbox.checked = false;
}

function saveCustomField() {
    const fieldNameInput = document.getElementById('customFieldName');
    const fieldName = fieldNameInput ? fieldNameInput.value.trim() : '';

    if (!fieldName) {
        showNotification('Field name cannot be empty.', 'error');
        return;
    }

    const duplicate = Object.values(appState.components).some(comp =>
        comp.name.toLowerCase() === fieldName.toLowerCase()
    );
    if (duplicate) {
        showNotification('A field with this name already exists.', 'error');
        return;
    }

    const allowSlabsCheckbox = document.getElementById('customFieldAllowSlabs');
    const allowSlabs = allowSlabsCheckbox ? allowSlabsCheckbox.checked : false;

    const fieldId = 'custom_field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const dropZone = document.querySelector('.drop-zone[data-category="' + activeAddFieldCategory + '"]');
    
    if (!dropZone) {
        closeCustomFieldModal();
        return;
    }

    removePlaceholder(dropZone);
    const canvasField = createCanvasField(fieldId, fieldName, activeAddFieldCategory);
    dropZone.appendChild(canvasField);
    
    addComponentToState(fieldId, fieldName, activeAddFieldCategory, allowSlabs);
    invalidateCalculatedPreview();
    updateConfiguredTotal();
    closeCustomFieldModal();
    
    showNotification(fieldName + ' added.', 'success');
}

function addCustomFieldToCategory(category) {
    activeAddFieldCategory = category;

    // Reset inputs
    document.getElementById('customFieldName').value = '';
    const checkbox = document.getElementById('customFieldAllowSlabs');
    if (checkbox) checkbox.checked = false;

    // Determine if the category is a deduction category
    // (Either standard 'deductions' or a custom category set to reduce net salary)
    let isDeduction = category === 'deductions';
    if (!isDeduction) {
        const customCat = appState.customCategories.find(c => c.id === category);
        if (customCat && customCat.reduceNet) {
            isDeduction = true;
        }
    }

    const slabGroup = document.getElementById('customFieldSlabGroup');
    if (slabGroup) {
        slabGroup.classList.toggle('hidden', !isDeduction);
    }

    openModal('customFieldModal');
}

// ========== COPY BREAKDOWN ==========
function initCopyButton() {
    const btnCopy = document.getElementById('btnCopy');
    if (!btnCopy) return;

    btnCopy.addEventListener('click', async function () {
        let text = 'CTC Breakdown\n';
        text += '═'.repeat(30) + '\n\n';
        text += 'Total CTC: ' + document.getElementById('summaryCtc').textContent + '\n';
        text += 'Monthly Gross: ' + document.getElementById('summaryGross').textContent + '\n';
        text += 'Total Deductions: ' + document.getElementById('summaryDeductions').textContent + '\n';
        text += 'Monthly Take Home: ' + document.getElementById('summaryNet').textContent + '\n\n';

        const groups = document.querySelectorAll('.preview-group');
        groups.forEach(group => {
            const title = group.querySelector('.preview-group-title')?.textContent || '';
            if (title) {
                text += '─'.repeat(30) + '\n';
                text += title + '\n';
                text += '─'.repeat(30) + '\n';
            }
            group.querySelectorAll('.preview-row').forEach(row => {
                const name = row.querySelector('.preview-row-name')?.textContent || '';
                const value = row.querySelector('.preview-row-value')?.textContent || '';
                text += '  ' + name + ': ' + value + '\n';
            });
            text += '\n';
        });

        const warningsBox = document.querySelector('.preview-warnings');
        if (warningsBox) {
            text += '⚠️ Warnings:\n';
            warningsBox.querySelectorAll('p').forEach(w => {
                text += '  - ' + w.textContent + '\n';
            });
        }

        try {
            await navigator.clipboard.writeText(text);
            showNotification('Breakdown copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy.', 'error');
        }
    });
}

function normalizeSlabLayer(layer) {
    if (!layer || typeof layer !== 'object') return null;
    return {
        standard_deduction: Number(layer.standard_deduction || 0),
        surcharge_percent: Number(layer.surcharge_percent || 0),
        cess_percent: Number(layer.cess_percent || 0),
        slabs: Array.isArray(layer.slabs)
            ? layer.slabs.map(function (slab) {
                return {
                    from: Number(slab.from || 0),
                    to: (slab.to === null || slab.to === '' || slab.to === undefined) ? null : Number(slab.to),
                    rate: Number(slab.rate || 0)
                };
            })
            : [],
        // Stage 6c: canton/commune-style multiplier (e.g. Switzerland). null
        // for any layer that doesn't use this mechanism — that's what keeps
        // US/Canada layers computing exactly as before.
        multiplier_percent: (layer.multiplier_percent !== undefined && layer.multiplier_percent !== null && layer.multiplier_percent !== '')
            ? Number(layer.multiplier_percent)
            : null,
        post_rules: (layer.post_rules && typeof layer.post_rules === 'object') ? layer.post_rules : null
    };
}

function normalizeSlabConfig(slabConfig) {
    if (!slabConfig || typeof slabConfig !== 'object') {
        return null;
    }

        return {
        country: slabConfig.country || 'custom',
        regime: slabConfig.regime || 'custom',
        regime_label: slabConfig.regime_label || null,
        standard_deduction: Number(slabConfig.standard_deduction || 0),
        surcharge_percent: Number(slabConfig.surcharge_percent || 0),
        cess_percent: Number(slabConfig.cess_percent || 0),
        slabs: Array.isArray(slabConfig.slabs)
            ? slabConfig.slabs.map(function (slab) {
                return {
                    from: Number(slab.from || 0),
                    to: (slab.to === null || slab.to === '' || slab.to === undefined) ? null : Number(slab.to),
                    rate: Number(slab.rate || 0)
                };
            })
            : [],
        post_rules: slabConfig.post_rules || null,
        // Stage 6: state/province layer (only present for multi-layer countries like USA)
        state_id: slabConfig.state_id || null,
        state_name: slabConfig.state_name || null,
        state: normalizeSlabLayer(slabConfig.state),
        // Stage 6b: city/local layer (only present when a state with a local layer was picked)
        local_id: slabConfig.local_id || null,
        local_name: slabConfig.local_name || null,
        local: normalizeSlabLayer(slabConfig.local)
    };
}

function normalizeLoadedComponent(comp) {
    return {
        id: comp.id,
        name: comp.name || comp.id,
        category: comp.category || 'earnings',
        logic_type: comp.logic_type || 'fixed',
        value: Number(comp.value || 0),
        target_field: comp.target_field || null,
        frequency: comp.frequency || 'monthly',
        taxable: comp.taxable || 'yes',
        configured: Boolean(comp.configured),
        allow_slabs: Boolean(comp.allow_slabs),
        slab_config: normalizeSlabConfig(comp.slab_config),
        percentage: Number(comp.percentage || 0),
        // Stage 8: eligibility-cliff payroll fields (e.g. India's ESI)
        threshold_annual: comp.threshold_annual !== undefined ? Number(comp.threshold_annual) : undefined
    };
}

function normalizeLoadedCustomCategory(cat) {
    return {
        id: cat.id,
        name: cat.name || 'Custom Category',
        description: cat.description || '',
        addCtc: Boolean(cat.addCtc),
        addGross: Boolean(cat.addGross),
        reduceNet: Boolean(cat.reduceNet),
        frequency: cat.frequency || 'monthly',
        isCustom: true
    };
}

// ========== TEMPLATE SYSTEM ==========
function initTemplateSystem() {
    const btnSave = document.getElementById('btnSaveTemplate');
    const btnLoad = document.getElementById('btnLoadTemplate');

    if (btnSave) btnSave.addEventListener('click', downloadTemplateFile);
    if (btnLoad) btnLoad.addEventListener('click', openLoadTemplateModal);

    const modal = document.getElementById('loadTemplateModal');
    const modalCloseBtn = document.getElementById('loadTemplateModalClose');
    const modalCancelBtn = document.getElementById('loadTemplateModalCancel');

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeLoadTemplateModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeLoadTemplateModal);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeLoadTemplateModal(); });

    const btnUpload = document.getElementById('btnUploadTemplate');
    const fileInput = document.getElementById('templateFileInput');

    if (btnUpload && fileInput) {
        btnUpload.addEventListener('click', function () { fileInput.value = ''; fileInput.click(); });
        fileInput.addEventListener('change', handleTemplateFileUpload);
    }

    const btnPredefined = document.getElementById('btnLoadPredefined');
    if (btnPredefined) {
        btnPredefined.addEventListener('click', function () {
            applyTemplateData(getPredefinedIndianCTC());
            closeLoadTemplateModal();
        });
    }
}

function downloadTemplateFile() {
    if (Object.keys(appState.components).length === 0) {
        showNotification('Canvas is empty.', 'error');
        return;
    }

    const templateData = {
        version: TEMPLATE_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        components: appState.components,
        customCategories: appState.customCategories
    };

    const blob = new Blob(
        [JSON.stringify(templateData, null, 2)],
        { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ctc_template_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Template downloaded!', 'success');
}

function openLoadTemplateModal() { openModal('loadTemplateModal'); }
function closeLoadTemplateModal() { closeModal('loadTemplateModal'); }

function handleTemplateFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        showNotification('Please select a .json file.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data || typeof data !== 'object') {
                showNotification('Invalid template file.', 'error');
                return;
            }

            if (!data.components || typeof data.components !== 'object') {
                showNotification('Template file is missing components data.', 'error');
                return;
            }

            applyTemplateData(data);
            closeLoadTemplateModal();
            showNotification('Template loaded!', 'success');
        } catch (err) {
            console.error(err);
            showNotification('Error reading template file.', 'error');
        }
    };

    reader.readAsText(file);
}

function getPredefinedIndianCTC() {
    return {
        version: '1.0', customCategories: [],
        components: {
            basic_salary: { id: 'basic_salary', name: 'Basic Salary', category: 'earnings', logic_type: 'fixed', value: 0, target_field: null, frequency: 'monthly', taxable: 'yes', configured: true },
            hra: { id: 'hra', name: 'HRA', category: 'earnings', logic_type: 'percent_basic', value: 40, target_field: 'basic_salary', frequency: 'monthly', taxable: 'yes', configured: true },
            special_allowance: { id: 'special_allowance', name: 'Special Allowance', category: 'earnings', logic_type: 'fixed', value: 0, target_field: null, frequency: 'monthly', taxable: 'yes', configured: true },
            employer_pf: { id: 'employer_pf', name: 'Employer PF', category: 'employer_contributions', logic_type: 'percent_basic', value: 12, target_field: 'basic_salary', frequency: 'monthly', taxable: 'no', configured: true },
            gratuity: { id: 'gratuity', name: 'Gratuity', category: 'employer_contributions', logic_type: 'percent_basic', value: 4.81, target_field: 'basic_salary', frequency: 'monthly', taxable: 'no', configured: true },
            employee_pf: { id: 'employee_pf', name: 'Employee PF', category: 'deductions', logic_type: 'percent_basic', value: 12, target_field: 'basic_salary', frequency: 'monthly', taxable: 'no', configured: true },
            professional_tax: { id: 'professional_tax', name: 'Professional Tax', category: 'deductions', logic_type: 'fixed', value: 200, target_field: null, frequency: 'monthly', taxable: 'no', configured: true }
        }
    };
}

function applyTemplateData(templateData) {
    clearCanvasSilently();

    // 1. Restore custom categories first
    if (templateData.customCategories && Array.isArray(templateData.customCategories)) {
        templateData.customCategories.forEach(function (catData) {
            const normalizedCategory = normalizeLoadedCustomCategory(catData);

            var exists = appState.customCategories.some(function (c) {
                return c.id === normalizedCategory.id;
            });

            if (!exists) {
                appState.customCategories.push(normalizedCategory);
                addCustomCategoryToSidebar(normalizedCategory);
                addCustomCategoryToCanvas(normalizedCategory);
            }
        });
    }

    // 2. Restore components
    if (templateData.components && typeof templateData.components === 'object') {
        Object.values(templateData.components).forEach(function (comp) {
            const normalizedComp = normalizeLoadedComponent(comp);

            appState.components[normalizedComp.id] = normalizedComp;

            var dropZone = document.querySelector('.drop-zone[data-category="' + normalizedComp.category + '"]');
            if (dropZone) {
                removePlaceholder(dropZone);

                var canvasField = createCanvasField(
                    normalizedComp.id,
                    normalizedComp.name,
                    normalizedComp.category
                );

                dropZone.appendChild(canvasField);

                if (normalizedComp.configured) {
                    updateCanvasFieldDisplay(normalizedComp.id);
                }
            }

            // Default sidebar cards should be disabled if present on canvas
            if (normalizedComp.id.indexOf('custom_field_') !== 0) {
                disableSidebarCard(normalizedComp.id);
            }
        });
    }

    updateConfiguredTotal();
    invalidateCalculatedPreview();
}

// ========== MODAL HISTORY MANAGER (VERIFIED & FIXED) ==========
const modalStack = [];
let isPopping = false; // Flag to prevent popstate loops

function openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl || !modalEl.classList.contains('hidden')) return;
    modalEl.classList.remove('hidden');
    modalStack.push(modalId);
    history.pushState({ modal: true, modalId: modalId }, '');
}

function closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl || modalEl.classList.contains('hidden')) return;
    modalEl.classList.add('hidden');
    const index = modalStack.indexOf(modalId);
    if (index !== -1) {
        modalStack.splice(index, 1);
        // Only run history back if NOT closing via the back button (popstate)
        if (!isPopping) {
            history.back();
        }
    }
}

function initModalBackButtonHandler() {
    window.addEventListener('popstate', function () {
        if (modalStack.length > 0) {
            isPopping = true; // Set block flag
            const topId = modalStack[modalStack.length - 1];
            closeModal(topId);
            if (topId === 'configModal') currentConfigFieldId = null;
            isPopping = false; // Unblock
        }
    });
}

// ========== MOBILE SIDEBAR ==========
function initMobileSidebar() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebarEl = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!hamburger || !sidebarEl || !overlay) return;

    hamburger.addEventListener('click', function () {
        adjustSidebarWidth(sidebarEl);
        sidebarEl.classList.toggle('open');
        overlay.classList.toggle('hidden');
    });

    overlay.addEventListener('click', function () {
        sidebarEl.classList.remove('open');
        overlay.classList.add('hidden');
    });

    // Also adjust on window resize while sidebar is open
    window.addEventListener('resize', function () {
        if (sidebarEl.classList.contains('open')) {
            adjustSidebarWidth(sidebarEl);
        }
    });
}

function adjustSidebarWidth(sidebarEl) {
    var screenWidth = window.innerWidth;
    var maxWidth = 280;
    var minWidth = 150;
    var minGap = 50;

    var idealWidth = Math.min(maxWidth, screenWidth - minGap);
    idealWidth = Math.max(idealWidth, minWidth);

    sidebarEl.style.width = idealWidth + 'px';
    sidebarEl.style.minWidth = idealWidth + 'px';
}

// ========== EXPORT SYSTEM ==========

function initExportSystem() {
    const exportButton = document.getElementById('btnExport');
    const exportModalClose = document.getElementById('exportModalClose');
    const exportModalCancel = document.getElementById('exportModalCancel');
    const startExportButton = document.getElementById('btnStartExport');
    const exportFormat = document.getElementById('exportFormat');
    const pdfFallbackButton = document.getElementById('btnExportPdfFallback');
    const splitImagesButton = document.getElementById('btnExportSplitImages');
    const exportModal = document.getElementById('exportModal');

    if (exportButton) {
        exportButton.addEventListener('click', openExportModal);
    }

    if (exportModalClose) {
        exportModalClose.addEventListener('click', closeExportModal);
    }

    if (exportModalCancel) {
        exportModalCancel.addEventListener('click', closeExportModal);
    }

    if (startExportButton) {
        startExportButton.addEventListener('click', function () {
            startSelectedExport();
        });
    }

    if (exportFormat) {
        exportFormat.addEventListener('change', function () {
            hideLongImageWarning();
        });
    }

    if (pdfFallbackButton) {
        pdfFallbackButton.addEventListener('click', function () {
            startSelectedExport('pdf', false);
        });
    }

    if (splitImagesButton) {
        splitImagesButton.addEventListener('click', function () {
            startSelectedExport(pendingLongImageFormat, true);
        });
    }

    if (exportModal) {
        exportModal.addEventListener('click', function (event) {
            if (event.target === exportModal) {
                closeExportModal();
            }
        });
    }
}

function updateExportAvailability() {
    const exportButton = document.getElementById('btnExport');

    if (!exportButton) return;

    exportButton.disabled = !lastCalculation;
}

function openExportModal() {
    if (!lastCalculation) {
        showNotification('Calculate the preview before exporting.', 'warning');
        return;
    }

    const includeEmptyCheckbox = document.getElementById('includeEmptyValues');
    const emptyOption = document.getElementById('exportEmptyOption');

    if (includeEmptyCheckbox) {
        includeEmptyCheckbox.checked = false;
    }

    const hasZeroValueComponents = getAllCalculatedComponents().some(component =>
        Math.abs(Number(component.annual || 0)) === 0
    );

    if (emptyOption) {
        emptyOption.classList.toggle('hidden', !hasZeroValueComponents);
    }

    hideLongImageWarning();
    openModal('exportModal');
    refreshExportLibraryState();

    startExportLibraryPreload().then(function () {
        const exportModal = document.getElementById('exportModal');

        if (exportModal && !exportModal.classList.contains('hidden')) {
            refreshExportLibraryState();
        }
    });
}

function closeExportModal() {
    closeModal('exportModal');
    hideLongImageWarning();
}

function setExportStatus(message, type) {
    const status = document.getElementById('exportLibraryStatus');

    if (!status) return;

    status.className = `export-status ${type}`;

    if (!message) {
        status.textContent = '';
        status.classList.add('hidden');
        return;
    }

    status.textContent = message;
    status.classList.remove('hidden');
}

function refreshExportLibraryState() {
    const startExportButton = document.getElementById('btnStartExport');

    if (!startExportButton) return;

    if (exportLibrariesReady) {
        startExportButton.disabled = false;
        setExportStatus('Export tools are ready.', 'ready');
        return;
    }

    if (exportLibraryError) {
        startExportButton.disabled = true;
        setExportStatus(
            'Unable to prepare export tools. Check local vendor files.',
            'error'
        );
        return;
    }

    startExportButton.disabled = true;
    setExportStatus('Preparing export tools...', 'loading');
}

function loadLocalScript(url, name, readyCheck) {
    if (readyCheck()) {
        return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
        const existingScript = document.querySelector(
            `script[data-export-library="${name}"]`
        );

        if (existingScript) {
            existingScript.addEventListener('load', function () {
                readyCheck() ? resolve() : reject(new Error(`${name} did not initialise.`));
            });

            existingScript.addEventListener('error', function () {
                reject(new Error(`Failed to load ${name}.`));
            });

            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.dataset.exportLibrary = name;

        script.onload = function () {
            if (readyCheck()) {
                resolve();
            } else {
                reject(new Error(`${name} loaded but did not initialise.`));
            }
        };

        script.onerror = function () {
            reject(new Error(`Failed to load ${name}.`));
        };

        document.head.appendChild(script);
    });
}

function startExportLibraryPreload() {
    if (exportLibrariesReady) {
        return Promise.resolve(true);
    }

    if (exportLibrariesPromise) {
        return exportLibrariesPromise;
    }

    const html2canvasUrl = document.body.dataset.exportHtml2canvas;
    const jspdfUrl = document.body.dataset.exportJspdf;
    const docxUrl = document.body.dataset.exportDocx;

    exportLibrariesPromise = Promise.all([
        loadLocalScript(
            html2canvasUrl,
            'html2canvas',
            function () {
                return typeof window.html2canvas === 'function';
            }
        ),

        loadLocalScript(
            jspdfUrl,
            'jspdf',
            function () {
                return Boolean(window.jspdf && window.jspdf.jsPDF);
            }
        ),

        loadLocalScript(
            docxUrl,
            'docx',
            function () {
                return Boolean(window.docx && window.docx.Document);
            }
        )
    ])
        .then(function () {
            exportLibrariesReady = true;
            exportLibraryError = null;
            return true;
        })
        .catch(function (error) {
            console.error('Export library error:', error);
            exportLibraryError = error;
            return false;
        });

    return exportLibrariesPromise;
}

function hideLongImageWarning() {
    const warning = document.getElementById('exportImageWarning');

    if (warning) {
        warning.classList.add('hidden');
    }

    pendingLongImageFormat = null;
}

function showLongImageWarning(format) {
    pendingLongImageFormat = format;

    const warning = document.getElementById('exportImageWarning');

    if (warning) {
        warning.classList.remove('hidden');
    }
}

function getExportFileName(extension, partNumber = null, totalParts = null) {
    const now = new Date();

    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');

    const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('-');

    let suffix = '';

    if (partNumber && totalParts) {
        suffix = `-part-${partNumber}-of-${totalParts}`;
    }

    return `ctc-breakdown-${date}-${time}${suffix}.${extension}`;
}

function getExportModel(includeEmptyValues) {
    const sourceComponents = includeEmptyValues
        ? getAllCalculatedComponents()
        : getNonEmptyComponents();

    const components = sourceComponents.filter(component => {
        if (includeEmptyValues) return true;
        return Math.abs(Number(component.annual || 0)) > 0;
    });

    const periodText = previewPeriod === 'annual' ? 'Annual' : 'Monthly';
    const periodWord = previewPeriod === 'annual' ? 'year' : 'month';

    const groups = groupComponentsByCategory(components).map(group => {
        return {
            title: group.title,
            items: group.items.map(item => {
                const isDeduction = item.category === 'deductions';
                const amount = Math.abs(getComponentAmount(item));

                return {
                    name: getDisplayComponentName(item),
                    isDeduction: isDeduction,
                    value: isDeduction
                        ? `- ${formatCurrency(amount)} / ${periodWord}`
                        : `${formatCurrency(amount)} / ${periodWord}`
                };
            })
        };
    });

    return {
        periodText: periodText,
        summary: [
            {
                label: 'Annual CTC',
                value: formatCurrency(lastCalculation.total_ctc || 0)
            },
            {
                label: `Gross Salary (${periodText})`,
                value: formatCurrency(getSummaryAmount('gross'))
            },
            {
                label: `Total Deductions (${periodText})`,
                value: formatCurrency(getSummaryAmount('deductions'))
            },
            {
                label: `Net Take-Home (${periodText})`,
                value: formatCurrency(getSummaryAmount('net'))
            }
        ],
        groups: groups
    };
}

function createExportReportElement(model) {
    const report = document.createElement('div');
    report.className = 'export-report';

    const summaryHtml = model.summary.map(row => {
        return `
            <div class="export-report-summary-row">
                <span>${escapeHtml(row.label)}</span>
                <span>${escapeHtml(row.value)}</span>
            </div>
        `;
    }).join('');

    const groupsHtml = model.groups.map(group => {
        const rowsHtml = group.items.map(item => {
            return `
                <div class="export-report-row">
                    <span>${escapeHtml(item.name)}</span>
                    <span class="export-report-row-value ${item.isDeduction ? 'deduction' : ''}">
                        ${escapeHtml(item.value)}
                    </span>
                </div>
            `;
        }).join('');

        return `
            <section class="export-report-group">
                <div class="export-report-group-title">${escapeHtml(group.title)}</div>
                ${rowsHtml}
            </section>
        `;
    }).join('');

    report.innerHTML = `
        <h1 class="export-report-title">CTC Breakdown</h1>
        <section class="export-report-summary">
            ${summaryHtml}
        </section>
        ${groupsHtml}
    `;

    return report;
}

function measureExportReportHeight(model) {
    const report = createExportReportElement(model);
    document.body.appendChild(report);

    const height = report.scrollHeight;

    report.remove();

    return height;
}

async function captureExportReport(model) {
    const report = createExportReportElement(model);
    document.body.appendChild(report);

    try {
        return await window.html2canvas(report, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
    } finally {
        report.remove();
    }
}

function canvasToBlob(canvas, mimeType, quality = 0.92) {
    return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
            resolve(blob);
        }, mimeType, quality);
    });
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

function setExportBusy(isBusy, text = 'Download') {
    const startButton = document.getElementById('btnStartExport');

    if (!startButton) return;

    startButton.disabled = isBusy;
    startButton.textContent = isBusy ? 'Preparing...' : text;
}

async function exportPdf(model) {
    const canvas = await captureExportReport(model);
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    const pixelsPerMm = canvas.width / contentWidth;
    const sliceHeightPixels = Math.floor(contentHeight * pixelsPerMm);

    let sourceY = 0;
    let pageNumber = 0;

    while (sourceY < canvas.height) {
        const remainingHeight = canvas.height - sourceY;
        const currentSliceHeight = Math.min(sliceHeightPixels, remainingHeight);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeight;

        const context = sliceCanvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            currentSliceHeight,
            0,
            0,
            canvas.width,
            currentSliceHeight
        );

        if (pageNumber > 0) {
            pdf.addPage();
        }

        const sliceHeightMm = currentSliceHeight / pixelsPerMm;

        pdf.addImage(
            sliceCanvas,
            'PNG',
            margin,
            margin,
            contentWidth,
            sliceHeightMm,
            undefined,
            'FAST'
        );

        sourceY += currentSliceHeight;
        pageNumber += 1;
    }

    pdf.save(getExportFileName('pdf'));
}

async function exportSingleImage(model, format) {
    const canvas = await captureExportReport(model);

    const mimeType = format === 'jpg'
        ? 'image/jpeg'
        : 'image/png';

    const blob = await canvasToBlob(
        canvas,
        mimeType,
        format === 'jpg' ? 0.92 : 1
    );

    downloadBlob(blob, getExportFileName(format));
}

async function exportSplitImages(model, format) {
    const canvas = await captureExportReport(model);

    const mimeType = format === 'jpg'
        ? 'image/jpeg'
        : 'image/png';

    const totalParts = Math.ceil(canvas.height / IMAGE_SLICE_HEIGHT);

    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
        const sourceY = partIndex * IMAGE_SLICE_HEIGHT;
        const currentHeight = Math.min(
            IMAGE_SLICE_HEIGHT,
            canvas.height - sourceY
        );

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentHeight;

        const context = sliceCanvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            currentHeight,
            0,
            0,
            canvas.width,
            currentHeight
        );

        const blob = await canvasToBlob(
            sliceCanvas,
            mimeType,
            format === 'jpg' ? 0.92 : 1
        );

        downloadBlob(
            blob,
            getExportFileName(format, partIndex + 1, totalParts)
        );

        // Gives browser a brief moment between multiple downloads.
        await new Promise(resolve => setTimeout(resolve, 180));
    }
}

function createDocxParagraph(text, options = {}) {
    const docx = window.docx;

    return new docx.Paragraph({
        spacing: options.spacing || {},
        children: [
            new docx.TextRun({
                text: text,
                bold: Boolean(options.bold),
                color: options.color || '20242C',
                size: options.size || 22
            })
        ]
    });
}

function createDocxTable(rows) {
    const docx = window.docx;

    return new docx.Table({
        rows: rows.map(row => {
            return new docx.TableRow({
                children: [
                    new docx.TableCell({
                        children: [
                            createDocxParagraph(row.label, {
                                bold: false,
                                size: 20
                            })
                        ]
                    }),
                    new docx.TableCell({
                        children: [
                            createDocxParagraph(row.value, {
                                bold: true,
                                size: 20,
                                color: row.isDeduction ? 'D32F2F' : '20242C'
                            })
                        ]
                    })
                ]
            });
        })
    });
}

async function exportDocx(model) {
    const docx = window.docx;

    const children = [];

    children.push(
        createDocxParagraph('CTC Breakdown', {
            bold: true,
            size: 32,
            color: '1A1A2E',
            spacing: { after: 260 }
        })
    );

    children.push(
        createDocxTable(
            model.summary.map(row => ({
                label: row.label,
                value: row.value,
                isDeduction: row.label.startsWith('Total Deductions')
            }))
        )
    );

    model.groups.forEach(group => {
        children.push(
            createDocxParagraph(group.title, {
                bold: true,
                size: 24,
                color: '1A1A2E',
                spacing: { before: 260, after: 100 }
            })
        );

        children.push(
            createDocxTable(
                group.items.map(item => ({
                    label: item.name,
                    value: item.value,
                    isDeduction: item.isDeduction
                }))
            )
        );
    });

    const documentFile = new docx.Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 500,
                            right: 500,
                            bottom: 500,
                            left: 500
                        }
                    }
                },
                children: children
            }
        ]
    });

    const blob = await docx.Packer.toBlob(documentFile);
    downloadBlob(blob, getExportFileName('docx'));
}

async function startSelectedExport(formatOverride = null, splitImages = false) {
    if (!lastCalculation) {
        showNotification('Calculate the preview before exporting.', 'warning');
        return;
    }

    if (!exportLibrariesReady) {
        setExportStatus('Preparing export tools...', 'loading');
        startExportLibraryPreload().then(refreshExportLibraryState);
        return;
    }

    const exportFormat = document.getElementById('exportFormat');
    const includeEmptyCheckbox = document.getElementById('includeEmptyValues');

    const format = formatOverride || exportFormat.value;
    const includeEmptyValues = Boolean(
        includeEmptyCheckbox && includeEmptyCheckbox.checked
    );

    const model = getExportModel(includeEmptyValues);

    if (model.groups.length === 0) {
        showNotification('There are no calculated components to export.', 'warning');
        return;
    }

    if ((format === 'png' || format === 'jpg') && !splitImages) {
        const reportHeight = measureExportReportHeight(model);

        if (reportHeight > IMAGE_WARNING_REPORT_HEIGHT) {
            showLongImageWarning(format);
            return;
        }
    }

    hideLongImageWarning();
    setExportBusy(true);

    try {
        if (format === 'pdf') {
            await exportPdf(model);
        } else if (format === 'docx') {
            await exportDocx(model);
        } else if (splitImages) {
            await exportSplitImages(model, format);
        } else {
            await exportSingleImage(model, format);
        }

        closeExportModal();
        showNotification('Export downloaded successfully.', 'success');

    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export failed. Please try again.', 'error');

    } finally {
        setExportBusy(false);
    }
}

// ========== NOTIFICATIONS ==========
function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== UTILITIES ==========
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}