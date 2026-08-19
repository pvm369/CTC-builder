# Custom CTC Builder

A configurable web application for designing, calculating, previewing, saving, and exporting employee **Cost to Company (CTC)** structures.

The application lets employers create salary structures using predefined and custom components, define calculation rules, handle deductions, calculate estimated income tax using country presets or custom tax slabs, and export the final breakdown.

> **Important:** This project is a planning and estimation tool. It is not certified payroll, tax, legal, accounting, or financial software.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Application Architecture](#application-architecture)
- [Project Structure](#project-structure)
- [Installation and Local Setup](#installation-and-local-setup)
- [Moving the Project to Another Computer](#moving-the-project-to-another-computer)
- [How to Use the Application](#how-to-use-the-application)
- [Salary Component Categories](#salary-component-categories)
- [Calculation Types](#calculation-types)
- [Calculation Frequencies](#calculation-frequencies)
- [CTC Calculation Flow](#ctc-calculation-flow)
- [Income Tax System](#income-tax-system)
- [Country Tax Data Architecture](#country-tax-data-architecture)
- [Tax Engine Types](#tax-engine-types)
- [Post-Rules](#post-rules)
- [Country and Regime Metadata](#country-and-regime-metadata)
- [Template System](#template-system)
- [Preview System](#preview-system)
- [Export System](#export-system)
- [Backend Calculation API](#backend-calculation-api)
- [Client-Side State](#client-side-state)
- [Responsive Design](#responsive-design)
- [Browser and Device Requirements](#browser-and-device-requirements)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Tax Data Maintenance](#tax-data-maintenance)
- [Adding a New Country](#adding-a-new-country)
- [Adding a New Component](#adding-a-new-component)
- [Security Considerations](#security-considerations)
- [Caching Strategy](#caching-strategy)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Third-Party Libraries](#third-party-libraries)
- [Tax and Legal Disclaimer](#tax-and-legal-disclaimer)
- [License](#license)
- [Author](#author)

---

# Project Overview

CTC means **Cost to Company**. It represents the total annual cost an employer may incur for an employee.

CTC can contain:

- Direct earnings
- Employer contributions
- Bonuses and variable pay
- Benefits and perks
- Insurance contributions
- Retirement contributions
- Other employer-paid costs

CTC is not necessarily equal to:

- Gross salary
- Taxable income
- Net salary
- Monthly take-home pay

This application helps users define those relationships rather than relying on one fixed salary formula.

The builder supports:

1. Selecting salary components
2. Configuring calculation rules
3. Adding custom fields and categories
4. Calculating monthly and annual values
5. Estimating deductions and take-home salary
6. Calculating estimated income tax
7. Saving structures as portable JSON templates
8. Exporting breakdowns as documents and images

---

# Main Features

## 1. CTC Structure Builder

Users can:

- Click a predefined component to add it to the structure
- Remove components
- Reorder components using up/down controls
- Configure each component separately
- Add custom salary fields
- Add and delete custom categories
- Clear the full structure
- Recalculate after making changes

The application uses a click-to-add design rather than native drag-and-drop. This provides more consistent behavior across:

- Desktop computers
- Tablets
- Mobile devices
- Touch-enabled laptops

---

## 2. Predefined Categories

The application includes these default categories:

- Earnings
- Employer Contributions
- Deductions
- Variable Pay / Bonuses
- Perks & Benefits

Only custom categories can be deleted.

Default categories remain visible while editing, even if they contain no selected components.

Empty categories and zero-value components can be excluded from final output.

---

## 3. Custom Categories

A user can create a category and specify whether it:

- Adds to CTC
- Adds to gross salary
- Reduces net salary
- Uses monthly, quarterly, annual, or one-time frequency

Custom categories can contain custom fields.

> Custom-category behavioral flags must be reflected in the backend calculation engine before they can affect totals. Verify the current `calculator.py` implementation when extending custom-category accounting behavior.

---

## 4. Custom Fields

Users can add custom fields to any category.

For eligible deduction fields, the user may enable:

```text
Include tax slab structure capability
```

If enabled, that field can use progressive tax-slab calculations.

Tax-slab calculation is available by default for:

```text
TDS / Income Tax
```

It is hidden for unrelated components such as:

- Basic Salary
- HRA
- Bonuses
- PF
- Loan Recovery
- Perks

---

## 5. Component Configuration

Each component can contain:

- Editable field name
- Calculation type
- Value
- Frequency
- Taxable status
- Dependency information
- Tax slab configuration, when eligible

Unconfigured components are visually highlighted.

Configured components display a summary of their rule on the canvas.

---

## 6. Validation

Frontend validation currently covers:

- Empty component names
- Missing numeric values
- Negative values
- Invalid percentages
- Percentages outside 0–100
- Missing Basic Salary dependencies
- Unconfigured components
- Invalid annual CTC
- Fixed components exceeding target CTC
- Invalid slab ranges
- Invalid slab rates
- Missing tax slabs
- Duplicate active custom-field names
- Invalid template files
- Missing country tax files
- Malformed country tax JSON

Backend validation should also be retained because frontend validation can be bypassed.

---

## 7. Preview

The preview supports:

- Monthly view
- Annual view
- Annual CTC displayed in both views
- Gross salary
- Total deductions
- Net take-home
- Category-wise breakdown
- Negative signs for deductions
- CTC mismatch warnings

Monthly is the default view.

Changing the salary structure invalidates the old preview and requires recalculation.

---

## 8. Template Portability

Templates can be:

- Downloaded as JSON
- Moved between devices
- Uploaded in another browser
- Restored without a database

Templates preserve:

- Components
- Categories
- Calculation types
- Values
- Frequencies
- Taxable flags
- Tax slab capability
- Slab rows
- Country selection
- Regime or filing-status selection
- Tax metadata labels
- Extended tax post-rules

---

## 9. Export

Calculated reports can be exported as:

- PDF
- DOCX
- PNG
- JPG
- Clipboard text

Export libraries are stored locally in the project and loaded in the browser after the first successful calculation.

No export data needs to be sent to a third-party service.

---

## 10. Country-Specific Income Tax Presets

Income-tax presets are loaded from country-specific JSON files.

The current architecture supports:

- Progressive slab tax
- Flat-rate income tax
- Zero personal income tax
- Standard deductions
- Surcharge
- Cess
- Threshold rebates
- Fixed tax credits
- Percentage-based tax credits
- Tapering allowances
- Multiple tax regimes
- Filing statuses
- Age categories

The registry file is the authoritative list of available countries.

---

# Technology Stack

## Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Browser Fetch API
- Browser File API
- Browser Blob API
- Browser Clipboard API

## Backend

- Python
- Django

## Data

- JSON-based country tax registry
- Country-specific JSON tax files
- Downloadable JSON CTC templates

## Database

No application database is currently required.

CTC structures and templates are not stored server-side.

Django may create a default SQLite database for framework features and migrations, but the builder does not depend on database persistence.

## Local Export Libraries

Stored under:

```text
core/static/core/vendor/
```

Libraries:

- `html2canvas.min.js`
- `jspdf.umd.min.js`
- `docx.iife.js`

---

# Application Architecture

The application uses a simple layered architecture.

```text
Browser UI
    │
    ├── Component builder
    ├── Validation
    ├── Preview controls
    ├── Template import/export
    ├── Country JSON loader
    └── Document/image export
           │
           ▼
Django JSON API
           │
           ▼
Python calculation engine
           │
           ▼
Calculated JSON response
           │
           ▼
Preview and export rendering
```

## Frontend responsibilities

The frontend handles:

- User interaction
- Component selection
- Component configuration
- Modal management
- Client-side validation
- Template file management
- Country tax JSON loading
- Preview rendering
- Export rendering
- Responsive interface behavior

## Backend responsibilities

The backend handles:

- Annualizing values
- Fixed calculations
- Percentage calculations
- Gross salary
- Taxable income
- Tax slab calculations
- Rebates and tax credits
- Deductions
- Net take-home
- CTC mismatch warnings
- Returning monthly and annual results

---

# Project Structure

```text
calculator/
├── manage.py
├── README.md
├── requirements.txt
├── db.sqlite3
│
├── ctc_builder/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── core/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── calculator.py
│   ├── models.py
│   ├── tests.py
│   ├── urls.py
│   ├── views.py
│   │
│   ├── templates/
│   │   └── core/
│   │       └── index.html
│   │
│   └── static/
│       └── core/
│           ├── css/
│           │   └── style.css
│           │
│           ├── js/
│           │   └── app.js
│           │
│           └── vendor/
│               ├── html2canvas.min.js
│               ├── jspdf.umd.min.js
│               ├── docx.iife.js
│               │
│               └── tax-regimes/
│                   ├── index.json
│                   ├── india.json
│                   ├── usa.json
│                   ├── uk.json
│                   ├── canada.json
│                   ├── australia.json
│                   ├── uae.json
│                   └── other-country-files.json
│
└── my_env/
```

> `my_env` is machine-specific and should not be copied between computers or committed to source control.

---

# Installation and Local Setup

## Prerequisites

Install:

- Python 3.10 or newer
- pip
- A modern browser
- Git, if using version control
- VS Code or another editor

Check Python:

```powershell
python --version
```

Check pip:

```powershell
python -m pip --version
```

---

## 1. Open the project folder

```powershell
cd path\to\calculator
```

Verify that `manage.py` is present:

```powershell
dir
```

---

## 2. Create a virtual environment

### Windows

```powershell
python -m venv my_env
```

### macOS/Linux

```bash
python3 -m venv my_env
```

---

## 3. Activate the environment

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
my_env\Scripts\Activate.ps1
```

### Windows Command Prompt

```cmd
my_env\Scripts\activate.bat
```

### macOS/Linux

```bash
source my_env/bin/activate
```

The terminal should begin with:

```text
(my_env)
```

---

## 4. Install project dependencies

If `requirements.txt` exists:

```powershell
python -m pip install -r requirements.txt
```

Otherwise:

```powershell
python -m pip install django
```

Verify Django:

```powershell
python -m django --version
```

---

## 5. Apply migrations

```powershell
python manage.py migrate
```

---

## 6. Start the development server

```powershell
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

---

## 7. Generate `requirements.txt`

On a working development machine:

```powershell
python -m pip freeze > requirements.txt
```

Commit `requirements.txt` to source control.

---

# Moving the Project to Another Computer

Do not copy and reuse the old virtual environment.

Virtual environments contain absolute paths to the Python installation on the computer where they were created.

For example, a copied environment may still reference:

```text
C:\Users\OldUser\...\my_env\Scripts\python.exe
```

This produces errors such as:

```text
Fatal error in launcher: Unable to create process
```

## Correct migration procedure

1. Copy or clone the project without `my_env`
2. Open a terminal in the project root
3. Create a new environment
4. Install requirements
5. Apply migrations
6. Run the server

```powershell
python -m venv my_env
my_env\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

---

# How to Use the Application

## Build a CTC structure

1. Open a component category in the left sidebar.
2. Click a component.
3. The component appears in its category on the canvas.
4. Click the component on the canvas.
5. Configure its calculation rule.
6. Save it.
7. Repeat for all required components.

## Remove a component

Click the remove button on its canvas card.

The sidebar item becomes available again.

If another component depends on it, the application asks for confirmation.

## Reorder components

Use the up/down buttons on the component card.

## Clear the structure

Click:

```text
Clear Canvas
```

This removes:

- Selected components
- Custom categories
- Custom fields
- Preview data
- Annual CTC input
- Current calculated result

---

# Salary Component Categories

## Earnings

Direct salary components included in gross salary.

Examples:

- Basic Salary
- HRA
- Dearness Allowance
- Special Allowance
- Medical Allowance
- Conveyance Allowance

## Employer Contributions

Employer-paid costs that normally add to CTC but not to direct monthly gross pay.

Examples:

- Employer PF
- Employer ESI
- Gratuity
- Employer-paid insurance
- Employer NPS

## Deductions

Amounts subtracted from gross salary to determine net take-home.

Examples:

- Employee PF
- Employee ESI
- Professional Tax
- TDS / Income Tax
- Insurance deductions
- Loan recovery

## Variable Pay / Bonuses

Performance-based or occasional payments.

Examples:

- Performance Bonus
- Annual Bonus
- Joining Bonus
- Retention Bonus
- Commission

## Perks & Benefits

Cash or non-cash benefits.

Examples:

- Food coupons
- Internet reimbursement
- Fuel allowance
- Education support
- Wellness benefits
- ESOP valuation

---

# Calculation Types

## Fixed Amount

A direct amount entered by the user.

Example:

```text
Special Allowance = 8,000 per month
```

## Percentage of Basic Salary

Example:

```text
HRA = 40% of Basic Salary
```

Requires Basic Salary to exist.

## Percentage of Gross Salary

Example:

```text
Bonus = 10% of Gross Salary
```

## Percentage of CTC

Example:

```text
Insurance = 2% of Annual CTC
```

## Tax Slabs

Available only for:

- TDS / Income Tax
- Eligible custom deduction fields with slab capability enabled

The slab engine calculates progressive tax using annual taxable income.

---

# Calculation Frequencies

Supported frequencies:

| Frequency | Annual conversion |
|---|---:|
| Monthly | value × 12 |
| Quarterly | value × 4 |
| Annual | value |
| One-time | value |

Percentage-based calculations are converted into annual and monthly result values by the calculation engine.

---

# CTC Calculation Flow

The simplified calculation flow is:

```text
Gross Salary
= Sum of Earnings
```

```text
Total Deductions
= Sum of Deduction components
```

```text
Net Take-Home
= Gross Salary − Total Deductions
```

```text
Calculated CTC
= Gross Salary
+ Employer Contributions
+ Variable Pay
+ Perks and Benefits
```

If calculated CTC differs from the user-entered target CTC, the application returns a warning.

---

# Income Tax System

## Taxable income

The default taxable base is automatically calculated from annual components where:

```text
taxable = yes
```

The tax component itself and normal deduction components are excluded from taxable earnings.

## Annual calculation

Income-tax slabs operate on annual taxable income.

Monthly TDS is:

```text
Monthly TDS = Annual Income Tax ÷ 12
```

## Custom tax slabs

Users may manually configure:

- Standard deduction
- Surcharge percentage
- Cess percentage
- Slab start
- Slab end
- Slab rate

The final slab may have no upper limit.

## Country presets

Selecting a country can automatically populate:

- Tax year
- Regime
- Filing status
- Age category
- Standard deduction
- Slabs
- Surcharge
- Cess
- Post-rules
- Notes
- Disclaimer
- Official source

Manual editing changes the selected preset to `Custom`.

---

# Country Tax Data Architecture

Country tax data is stored under:

```text
core/static/core/vendor/tax-regimes/
```

## Registry

The registry file is:

```text
core/static/core/vendor/tax-regimes/index.json
```

Example:

```json
{
    "version": "2.0",
    "last_updated": "2025-01-01",
    "countries": [
        {
            "id": "india",
            "name": "India",
            "engine_type": "progressive_slabs_basic",
            "internal_states": false,
            "file": "india.json"
        }
    ]
}
```

The registry is loaded first.

The selected country file is lazy-loaded only when required.

## Benefits

- Smaller initial page load
- Independent country updates
- Easier maintenance
- Lower risk of breaking unrelated countries
- Country-specific sources and disclaimers
- Scalable to many countries

---

# Tax Engine Types

## `progressive_slabs_basic`

Income is split across ranges.

Example:

```text
0–300,000          0%
300,000–700,000    5%
700,000–1,000,000 10%
```

Each band is taxed separately.

## `flat_rate_tax`

A single rate applies to taxable income after any configured deduction.

Example:

```text
Tax = taxable income × 10%
```

Internally, the current system can represent this as one unlimited slab.

## `zero_income_tax`

The income-tax amount is zero.

This does not mean that all payroll deductions are zero.

Users may still add:

- Pension deductions
- Insurance
- Social contributions
- Loan recovery
- Other statutory or company deductions

## Extended progressive slabs

Basic slabs plus optional rebates, credits, or allowance tapers.

## Filing-status variants

Multiple regime entries represent different filing statuses or age categories.

Examples:

- USA: Single, Married Jointly, Married Separately, Head of Household
- South Africa: age groups
- India Old Regime: age categories

## Regional tax layers

Federal/state/provincial/local layers are planned but not yet implemented.

---

# Post-Rules

Post-rules are extra adjustments around normal slab calculations.

## Rebate

Subtracts tax when income is below a threshold.

Example:

```json
"rebate": {
    "threshold": 1200000,
    "amount": 60000
}
```

## Fixed credit

Subtracts a fixed value from calculated tax.

```json
"credits": [
    {
        "label": "Primary Rebate",
        "amount": 17235
    }
]
```

## Rate-based credit

Calculates a credit as a percentage of a base amount.

```json
"credits": [
    {
        "label": "Basic Personal Amount",
        "amount": 15705,
        "rate": 15
    }
]
```

## Tapering deduction

Reduces an allowance when income exceeds a threshold.

```json
"tapering_deduction": {
    "taper_start": 100000,
    "taper_rate": 0.5
}
```

## Post-rule sequence

```text
Gross taxable income
− effective standard deduction
= net taxable income

Apply slabs

− rebate
− credits
+ surcharge
+ cess

= final annual tax
```

Tax is clamped at zero after rebates and credits.

---

# Country and Regime Metadata

Each country file may provide:

- Currency
- Currency symbol
- Tax year
- Engine type
- Last-updated date
- Official source
- Disclaimer
- Filing-status requirement
- State-selection requirement
- Age-category requirement
- Residency requirement
- Regime-specific notes

Example:

```json
{
    "country_id": "example",
    "country_name": "Example Country",
    "currency": "EXC",
    "currency_symbol": "¤",
    "tax_year": "2025",
    "engine_type": "progressive_slabs_basic",
    "last_updated": "2025-01-01",
    "source": "https://example.gov",
    "disclaimer": "Simplified estimate."
}
```

Metadata is displayed when the user selects an official preset.

It is hidden when the preset is changed to Custom.

---

# Template System

## Template contents

A template contains:

```json
{
    "version": "2.0",
    "savedAt": "2025-01-01T12:00:00.000Z",
    "components": {},
    "customCategories": []
}
```

Each component can preserve:

- ID
- Name
- Category
- Calculation type
- Value
- Dependency
- Frequency
- Taxable status
- Configuration status
- Tax-slab capability
- Slab configuration
- Selected country
- Selected regime/status
- Post-rules

## Template security

Template files are untrusted user input.

Before production deployment, enforce:

- File extension validation
- MIME validation where practical
- Maximum file size
- JSON structure validation
- Component-count limits
- String-length limits
- Numeric range validation

---

# Preview System

## Monthly view

Displays:

- Component monthly values
- Monthly gross
- Monthly deductions
- Monthly net take-home

## Annual view

Displays:

- Component annual values
- Annual gross
- Annual deductions
- Annual net take-home

Annual CTC stays annual in both views.

## Zero-value behavior

Normal preview excludes zero-value components.

The export system can optionally include configured zero-value components.

---

# Export System

## Supported formats

- PDF
- DOCX
- PNG
- JPG
- Clipboard text

## Export timing

The export button is disabled until a successful calculation exists.

After the first successful calculation:

1. Export libraries begin loading in the background
2. If the user opens Export too early, a preparation state appears
3. Download becomes available when libraries are ready

## Long-image handling

If a PNG or JPG report is too tall:

- The user receives a warning
- PDF is recommended
- Split-image export is available

## Filename format

Exports use timestamped names:

```text
ctc-breakdown-YYYY-MM-DD-HH-MM-SS.pdf
```

Split files use:

```text
ctc-breakdown-YYYY-MM-DD-HH-MM-SS-part-1-of-3.png
```

## Local processing

Document and image generation happens in the browser.

No generated salary report must be uploaded to a third-party export service.

---

# Backend Calculation API

## Endpoint

```text
POST /api/calculate/
```

## Example request

```json
{
    "total_ctc": 1000000,
    "components": {
        "basic_salary": {
            "id": "basic_salary",
            "name": "Basic Salary",
            "category": "earnings",
            "logic_type": "fixed",
            "value": 500000,
            "frequency": "annual",
            "taxable": "yes",
            "configured": true
        },
        "hra": {
            "id": "hra",
            "name": "HRA",
            "category": "earnings",
            "logic_type": "percent_basic",
            "value": 40,
            "target_field": "basic_salary",
            "frequency": "monthly",
            "taxable": "yes",
            "configured": true
        }
    }
}
```

## Example response

```json
{
    "success": true,
    "total_ctc": 1000000,
    "gross_annual": 700000,
    "gross_monthly": 58333.33,
    "deductions_annual": 0,
    "deductions_monthly": 0,
    "net_annual": 700000,
    "net_monthly": 58333.33,
    "components": [],
    "all_components": [],
    "warnings": [
        "Calculated CTC differs from Target CTC."
    ]
}
```

## API hardening recommendations

Before production:

- Remove unnecessary `csrf_exempt`
- Send Django CSRF token from JavaScript
- Accept POST only
- Validate JSON types
- Limit payload size
- Limit component count
- Limit slab count
- Reject non-finite values
- Reject unsafe strings
- Add rate limiting
- Log calculation errors without exposing internals

---

# Client-Side State

The main application state contains:

```javascript
{
    components: {},
    customCategories: [],
    nextCustomId: 1
}
```

Component state may include:

```javascript
{
    id,
    name,
    category,
    logic_type,
    value,
    target_field,
    frequency,
    taxable,
    configured,
    allow_slabs,
    slab_config
}
```

State exists only in browser memory unless downloaded as a template.

Refreshing the page clears unsaved work.

---

# Responsive Design

## Desktop

- Sidebar remains visible
- Canvas occupies the center
- Preview appears to the right

## Tablet

- Preview may use a fixed overlay
- Sidebar width is reduced

## Mobile

- Sidebar becomes a slide-out drawer
- A bookmark-style tab opens the sidebar
- Sidebar width adjusts to leave clickable space
- Canvas uses the available width
- Navbar buttons wrap
- Modals fit within the viewport
- Long modal bodies scroll vertically
- Modal header and footer remain visible

---

# Browser and Device Requirements

Recommended:

- Current Google Chrome
- Current Microsoft Edge
- Current Firefox
- Current Safari

Required browser capabilities include:

- Fetch API
- Blob API
- FileReader
- Promise
- async/await
- Clipboard API for copy functionality
- Canvas support for image/PDF exports

Some browsers may restrict:

- Automatic multiple file downloads
- Clipboard access outside HTTPS
- Large canvas creation
- File downloads on mobile
- Opening external official-source links

---

# Development Workflow

## Start the environment

```powershell
my_env\Scripts\Activate.ps1
```

## Start Django

```powershell
python manage.py runserver
```

## Apply migrations after model/framework changes

```powershell
python manage.py migrate
```

## Create migrations if models are added later

```powershell
python manage.py makemigrations
python manage.py migrate
```

## Check Django configuration

```powershell
python manage.py check
```

## Regenerate requirements

```powershell
python -m pip freeze > requirements.txt
```

## Hard refresh during development

```text
Ctrl + Shift + R
```

Country files and static assets may be cached during a browser session.

---

# Testing

## Recommended test categories

### Component tests

- Fixed monthly
- Fixed annual
- Fixed quarterly
- Percent of Basic
- Percent of Gross
- Percent of CTC
- Zero value
- Negative input rejection
- Missing dependency rejection

### Tax tests

- First bracket
- Exact bracket boundary
- One unit above boundary
- Highest bracket
- Standard deduction
- Rebate threshold
- Tax credit
- Taper
- Surcharge
- Cess
- Zero-tax preset
- Flat-rate preset
- Filing-status switching
- Age-category switching

### Template tests

- Save/load basic structure
- Save/load custom category
- Save/load slab-capable custom deduction
- Save/load country preset
- Save/load filing status
- Load older template schema
- Load malformed JSON
- Load missing country preset

### Export tests

- Monthly PDF
- Annual PDF
- DOCX
- PNG
- JPG
- Long-image warning
- Split image
- Include zero-value components
- Regime label in output

### Responsive tests

Test these widths:

```text
1440px
1024px
768px
390px
320px
248px
```

Verify:

- Sidebar does not cover the full screen on small devices
- Sidebar bookmark is hidden on desktop
- Navbar remains usable
- Canvas does not become narrower than the viewport
- Modal Save button remains accessible
- Tax-slab table is scrollable where required

---

# Tax Data Maintenance

Tax laws change frequently.

Each country file should contain:

- `tax_year`
- `last_updated`
- `source`
- `disclaimer`
- `notes`

## Maintenance procedure

1. Check the official tax authority
2. Record the tax year
3. Update slabs and deductions
4. Update rebates and credits
5. Update source URL
6. Update disclaimer
7. Change `last_updated`
8. Run known-value tests
9. Test template restore
10. Test preview and export

## Historical data

Do not overwrite old tax-year data if users need historical calculations.

Prefer separate regime entries:

```text
New Regime FY 2024-25
New Regime FY 2025-26
```

---

# Adding a New Country

## 1. Choose the engine type

Select one of:

- `progressive_slabs_basic`
- `flat_rate_tax`
- `zero_income_tax`

More complex engines should not be forced into a basic slab model.

## 2. Create the country file

```text
core/static/core/vendor/tax-regimes/example_country.json
```

## 3. Add it to `index.json`

```json
{
    "id": "example_country",
    "name": "Example Country",
    "engine_type": "progressive_slabs_basic",
    "internal_states": false,
    "file": "example_country.json"
}
```

## 4. Validate

Ensure:

- IDs are unique
- Slabs do not overlap
- Slabs do not have gaps unless legally intended
- Rates are 0–100
- Final slab uses `null` as upper bound
- Deductions are non-negative
- Regime labels are clear
- Source is official
- Simplifications are disclosed

---

# Adding a New Component

## Predefined field

Add a sidebar entry with:

```html
data-field-id="unique_id"
data-category="category_id"
```

The ID must be unique and stable.

## Custom field

The existing custom-field modal can be used.

For a custom deduction requiring slabs:

- create it under Deductions
- enable slab capability
- configure it using Tax Slabs

---

# Security Considerations

## Current client-side protections

- Escaping of selected dynamic text
- Template structure checks
- Tax JSON validation
- Duplicate checks
- Numeric bounds
- Calculation locking
- Restricted slab eligibility

## Remaining production requirements

### Secret management

Do not hardcode production secrets.

Use environment variables for:

- Django `SECRET_KEY`
- allowed host configuration
- deployment-specific settings

### CSRF

Use Django CSRF protection for calculation requests.

### Content Security Policy

Set a CSP restricting:

- script sources
- style sources
- object/embed sources
- frame ancestors

### Upload limits

Limit:

- Template file size
- Number of components
- Number of categories
- Number of tax slabs
- String lengths

### XSS

Avoid inserting untrusted text directly with `innerHTML`.

Use:

- `textContent`
- escaping helpers
- strict JSON validation

### Rate limiting

Protect the calculation API from abusive repeated requests.

---

# Caching Strategy

## Development

During development:

- Avoid long-lived static-file caching
- Use normal refresh or hard refresh after changes
- Country JSON files may require a reload because they are cached in JavaScript memory

## Production

For versioned CSS, JS, vendor files and stable JSON data:

- Use hashed static filenames
- Use long browser cache expiry
- Use cache busting when files change

Country tax data needs careful versioning because stale tax values are more serious than stale styling.

Consider including the tax year in country filenames when maintaining historical versions.

---

# Production Deployment Checklist

## Django

- [ ] Set `DEBUG = False`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Load `SECRET_KEY` from environment
- [ ] Configure `CSRF_TRUSTED_ORIGINS`
- [ ] Remove unnecessary `csrf_exempt`
- [ ] Run `python manage.py check --deploy`
- [ ] Run migrations
- [ ] Run `collectstatic`

## Static files

- [ ] Ensure CSS and JS load
- [ ] Ensure vendor libraries load
- [ ] Ensure `tax-regimes/index.json` loads
- [ ] Ensure all country files are collected
- [ ] Verify lazy country-file paths
- [ ] Verify export libraries in production

## Server

- [ ] Do not use Django development `runserver`
- [ ] Use Gunicorn, uWSGI, or another production WSGI/ASGI server
- [ ] Configure Nginx, WhiteNoise, or platform static hosting
- [ ] Enable HTTPS
- [ ] Enable compression
- [ ] Configure logs
- [ ] Add a health check

## Application security

- [ ] CSRF enabled
- [ ] Rate limits enabled
- [ ] Request-size limits enabled
- [ ] CSP enabled
- [ ] Security headers enabled
- [ ] Custom 404/500 pages
- [ ] No sensitive details in error responses

## Tax data

- [ ] Verify each enabled country against an official source
- [ ] Update `tax_year`
- [ ] Update `last_updated`
- [ ] Include disclaimers
- [ ] Test known values
- [ ] Clearly mark approximations

---

# Troubleshooting

## `No module named django`

Activate the environment and install requirements:

```powershell
my_env\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Fatal launcher error after copying project

Delete and recreate `my_env`.

```powershell
deactivate
Remove-Item -Recurse -Force my_env
python -m venv my_env
my_env\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## PowerShell script execution disabled

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Then activate the environment again.

## Static file returns 404

Check:

- exact filename
- exact folder path
- Django static configuration
- `{% load static %}`
- `{% static 'core/...' %}` path
- `collectstatic` in production

## Export tools fail to load

Open these files directly:

```text
/static/core/vendor/html2canvas.min.js
/static/core/vendor/jspdf.umd.min.js
/static/core/vendor/docx.iife.js
```

Expected browser globals:

```text
window.html2canvas
window.jspdf.jsPDF
window.docx
```

## Country missing from dropdown

Check:

1. Entry exists in `index.json`
2. Entry has `id`, `name`, and `file`
3. JSON is valid
4. Browser was hard-refreshed
5. Country file path matches exactly

## Country loads but slabs do not appear

Check:

- `regimes` is a non-empty array
- regime has `id` and `label`
- `slabs` is valid
- rates are numeric
- final upper bound uses `null`
- no malformed JSON

## Metadata remains after switching to Custom

Ensure metadata refresh is called whenever:

- a slab changes
- flat rate changes
- standard deduction changes
- surcharge/cess changes
- a slab row is added or removed

## Calculate button does nothing

Check the browser console and Network tab.

Verify:

```text
POST /api/calculate/
```

returns valid JSON.

## Modal content extends beyond screen

The modal should use:

- viewport-limited maximum height
- flex column layout
- scrollable modal body
- fixed/non-shrinking header and footer

## Sidebar covers full mobile screen

Use dynamic sidebar width that leaves a minimum clickable gap to close the drawer.

---

# Known Limitations

1. The app is not certified payroll software.
2. Tax data may become outdated.
3. Some countries cannot be represented exactly using simple slabs.
4. State/provincial/local tax layers are not yet implemented.
5. Social security and pension contributions may be excluded from country income-tax presets.
6. The current currency formatter may still default to INR in some views.
7. Custom-category behavior may need further backend integration.
8. Income-tax taxable base is simplified to components marked taxable.
9. Partial exemptions are not yet modeled.
10. Tax credits may be simplified.
11. Marginal relief may be excluded.
12. Some tax systems use formulas instead of slabs.
13. Local image export can hit browser canvas limits for very large reports.
14. Multiple split-image downloads may require browser permission.
15. Templates are not automatically saved if the page is refreshed.
16. Browser Back/Forward and Escape-modal behavior requires a separate navigation-state cleanup pass.
17. No user authentication or account-based storage exists.
18. No database-backed country data administration interface exists.
19. No automated source updates exist.
20. No legal guarantee is made regarding calculation accuracy.

---

# Roadmap

## Completed

- CTC component builder
- Default categories
- Custom categories and fields
- Fixed and percentage calculations
- Deductions
- Monthly/annual preview
- Portable template files
- PDF/DOCX/PNG/JPG export
- Country JSON registry
- Lazy country loading
- Country metadata
- Progressive slabs
- Zero-income-tax countries
- Flat-rate countries
- Rebates
- Credits
- Allowance taper
- Filing statuses
- Age-based regimes
- Mobile sidebar and responsive modal support

## Planned

### Stage 6: Regional tax layers

- Federal + province
- Federal + state
- Optional local tax
- Canada pilot
- US state expansion

### Later stages

- Country-specific payroll deductions
- Country-aware currency formatting
- Formula-based tax systems
- Family quotient systems
- Residency-based rules
- Social-security templates
- Historical tax-year selector
- Automated calculation test suite
- Admin tools for tax data
- Production hardening
- Optional account and database persistence

---

# Third-Party Libraries

The project redistributes local copies of:

- html2canvas
- jsPDF
- docx

Retain each library’s original:

- License
- Copyright notice
- Attribution requirements

Do not remove third-party license files when distributing the project.

---

# Tax and Legal Disclaimer

The CTC calculations, tax presets, salary breakdowns, deductions, reports and exports provided by this application are estimates for informational and planning purposes only.

They do not constitute:

- Tax advice
- Legal advice
- Financial advice
- Accounting advice
- Payroll compliance advice
- An official tax assessment
- A guarantee of take-home salary

Actual results may differ due to:

- Tax residency
- Filing status
- Marital status
- Age
- Dependants
- Exemptions
- Deductions
- Tax credits
- Rebates
- Social-security contributions
- Pension rules
- Regional taxes
- Local taxes
- Tax-year changes
- Employer policies
- Individual circumstances

Always verify calculations using official government sources or consult a qualified tax, accounting, legal, or payroll professional.

---

# License

Add the selected project license here.

Common choices:

- MIT
- Apache-2.0
- GPL-3.0
- Proprietary / All Rights Reserved

Example:

```text
Copyright © YEAR AUTHOR

Licensed under the MIT License.
```

---

# Author

Add project ownership information here:

```text
Name:
Organization:
Website:
Contact:
Project version:
```

---

# Contribution Guidelines

If accepting contributions:

1. Create a branch
2. Keep country tax changes isolated
3. Include an official source
4. Add or update a disclaimer
5. Add expected-value tests
6. Avoid changing unrelated country files
7. Validate JSON before submitting
8. Document calculation assumptions
9. Update this README where behavior changes

A tax-data contribution should not be accepted without:

- Tax year
- Official source
- Explanation of simplifications
- Known-value test cases