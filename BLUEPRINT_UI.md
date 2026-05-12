# DC Energy — UI Blueprint

> **Purpose**: Pass this file into any new project as a prompt/reference so an AI or developer can replicate the exact look, feel, and architecture of the DC Energy website.

---

## 1. Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 18 + TypeScript |
| Router | `react-router-dom` (HashRouter) |
| Styling | Tailwind CSS (utility-first, no custom CSS file needed) |
| State | React Context (`CartContext` via `useCart()`) |
| Database | Supabase (pricing fetched at app boot) |
| Payments | Razorpay (client-side SDK) |
| Build | Vite |
| Hosting | Vercel |

---

## 2. Color Palette (MANDATORY — use exact hex codes)

| Token | Hex | Usage |
|---|---|---|
| `brand-green` | `#63923E` | Primary CTA, accents, active states, badges, borders, icons |
| `brand-green-hover` | `#527a33` | Hover state for green buttons |
| `brand-green-light` | `#92B56B` | Particle dots, light nav link hover on dark bg |
| `black` | `#000000` | Headings, hero background, footer bg, bold text |
| `dark-grey` | `#4C4C4C` | Body text, secondary text, nav links on light bg, grid lines |
| `light-grey` | `#bfbfbf` | Footer text, hero paragraph text |
| `surface` | `#FFFFFF` | Cards, page backgrounds, modals |
| `surface-alt` | `gray-50` (Tailwind) | Page background, input fields, panel backgrounds |
| `india-saffron` | `#FF671F` | Used only in the tri-colour gradient on the hero |
| `india-green` | `#046A38` | Used only in the tri-colour gradient on the hero |
| `amber` tones | Tailwind `amber-300/400` | Solar/premium tier accents in calculator |
| `slate-800` | Tailwind | Solar premium tier card background |

### Usage Rules
- **Never** use generic blue, red, or purple for UI controls.
- Red (`red-500`) appears **only** in destructive actions (Remove from cart) and category group borders.
- All green buttons use `bg-[#63923E] hover:bg-[#527a33]`.
- All black buttons use `bg-[#000000] hover:bg-[#333333]`.

---

## 3. Typography

| Element | Class / Style |
|---|---|
| Font family | `font-sans` (system sans-serif) + `antialiased` on `<body>` |
| Display font | `font-['Rajdhani']` — used ONLY for section tier titles in calculator and footer brand name |
| Hero `<h1>` | `text-5xl md:text-7xl font-bold text-white leading-tight` |
| Section `<h2>` | `text-4xl font-bold text-[#000000]` |
| Page header `<h1>` | `text-3xl md:text-4xl font-bold text-white tracking-tight` |
| Card `<h3>` | `text-xl font-bold text-[#000000]` or `text-2xl` |
| Body copy | `text-sm text-[#4C4C4C]` or `text-[#bfbfbf]` on dark |
| Micro-labels | `text-[10px] font-semibold uppercase tracking-wider text-gray-400` |
| Price | `font-bold text-lg text-[#000000]` (store) or `text-[#63923E]` (calculator) |
| Tabular numbers | Always add `tabular-nums` to numerical displays |

---

## 4. Layout Architecture

```
┌─────────────────────────────────────────────┐
│  <Navbar />         (fixed, z-50)           │
├─────────────────────────────────────────────┤
│  <div class="flex-grow">                    │
│     <Routes>                                │
│        /          → HomePage (Hero +        │
│                     ProductShowcase +        │
│                     TechnicalSection +       │
│                     SpecsTable + Team)       │
│        /store     → Store                   │
│        /product/:id → ProductDetail         │
│        /calculator → Calculator             │
│        /about     → About                   │
│        /contact   → Contact                 │
│     </Routes>                               │
│  </div>                                     │
├─────────────────────────────────────────────┤
│  <Footer />         (sticky-bottom)         │
└─────────────────────────────────────────────┘
```

### Root Container
```html
<div class="font-sans antialiased text-slate-900 bg-white min-h-screen flex flex-col">
  <Navbar />
  <div class="flex-grow"> <!-- route content --> </div>
  <Footer />
</div>
```

---

## 5. Component Specifications

### 5.1 Navbar

**Behavior**: Fixed top, transparent on homepage (`/`), switches to `bg-white/95 backdrop-blur-md shadow-md` on scroll or non-home routes.

| State | Background | Text | Logo |
|---|---|---|---|
| Home, top | `bg-transparent py-6` | `text-slate-200 hover:text-[#92B56B]` | Dark-bg variant |
| Scrolled / Other pages | `bg-white/95 backdrop-blur-md shadow-md py-3` | `text-[#4C4C4C] hover:text-[#63923E]` | White-bg variant |

**Elements**:
- Logo (clickable, navigates to `/`)
- Nav links: Home, Products, Calculator, About, Contact, Support (external)
- "Download App" dropdown (BMS App, Inverter App — external links)
- Cart icon with badge (`bg-[#63923E]` circle, white text count)
- Mobile: hamburger menu → full-width white dropdown

**Cart badge**: `absolute -top-1 -right-1 w-5 h-5 bg-[#63923E] text-white text-xs flex items-center justify-center rounded-full border-2 border-white`

### 5.2 Hero (Homepage only)

- Full-screen height (`h-screen`)
- Canvas particle animation background:
  - Black fill (`#000000`)
  - Grid lines: `#4C4C4C`, `lineWidth: 0.3`, 50px grid
  - 60 floating particles: fill `#92B56B`, stroke connections `#63923E`, max connect distance 150px
  - `opacity-80` on canvas
- Content (centered, z-10):
  - Pill badge: `border border-[#63923E]/30 bg-[#63923E]/10 rounded-full` → `text-[#92B56B] text-sm font-bold tracking-wider uppercase`
  - H1 with Indian tricolour gradient: `bg-gradient-to-r from-[#FF671F] via-[#FFFFFF] to-[#046A38]` applied via `text-transparent bg-clip-text`
  - Subtitle: `text-[#bfbfbf] text-lg md:text-xl font-light`
  - Two CTAs:
    - Primary: `bg-[#63923E] hover:bg-[#527a33] text-white font-bold rounded-lg shadow-[0_0_20px_rgba(99,146,62,0.3)]`
    - Secondary: `bg-transparent border border-white/20 hover:border-[#92B56B] text-white font-semibold rounded-lg backdrop-blur-sm`
- Bottom fade: `bg-gradient-to-t from-[#000000] to-transparent h-24`

### 5.3 PageHeader (Reusable for interior pages)

- Height: `h-[28vh] min-h-[220px]`, with `pt-[76px]` to account for fixed navbar
- Background: `bg-black border-b-4 border-[#63923E]`
- Same particle canvas as Hero but smaller (40 particles, 0.3 speed, 100px connection distance), `opacity-60`
- Content: centered `h1` (white, bold) + green divider line (`h-0.5 w-16 bg-[#63923E] mx-auto rounded-full`) + subtitle (`text-[#bfbfbf] text-sm font-light`)

### 5.4 Product Cards (Store)

```
┌──────────────────────────┐
│  [Image 48h, hover:scale]│
│  ────────────────────────│
│  48V  [▼ Capacity Select]│  ← Specs header row
│  CATEGORY (xs, uppercase)│
│  Product Name (sm, bold) │
│  Description (xs, 2-line)│
│  ────────────────────────│
│  ₹XX,XXX     [Add]      │  ← Price + green button
└──────────────────────────┘
```

- Card: `bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg transition-all duration-300`
- Image container: `h-48 bg-gray-100 rounded-lg overflow-hidden`, image `hover:scale-110 transition-transform duration-500`
- Capacity dropdown: `bg-gray-50 border border-gray-300 rounded-lg focus:ring-[#63923E] focus:border-[#63923E]`
- Add button: `px-4 py-2 bg-[#63923E] hover:bg-[#527a33] text-white rounded-lg text-sm font-medium`

### 5.5 Category Tabs (Store)

Two visual groups ("Batteries" and "Inverters") wrapped in bordered containers:
- Group wrapper: `bg-white p-1.5 rounded-lg border border-red-400 shadow-sm`
- Group label: `text-[10px] font-bold text-red-500 uppercase tracking-wider`
- Tab (active): `bg-[#63923E] text-white`
- Tab (inactive): `text-[#4C4C4C] hover:bg-[#63923E]/10 hover:text-[#63923E]`

### 5.6 Cart Sidebar

- Overlay: `fixed inset-0 bg-black/40 backdrop-blur-sm`
- Drawer: `fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl`, animated with `animate-slideIn`
- Header: `bg-gray-50` with title + close icon
- Cart items: image + name + price + config info + quantity ±buttons + remove link
- Quantity buttons: `w-6 h-6 rounded-full bg-gray-200`
- Footer: `bg-gray-50 border-t`, "Proceed to Checkout" → `bg-[#000000] text-white rounded-xl font-bold hover:bg-[#333333]`

### 5.7 Checkout Modal

- Overlay: `bg-black/60 backdrop-blur-md`
- Modal: `bg-white rounded-2xl max-w-2xl p-8 shadow-2xl`
- Form inputs: `border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#63923E]`
- Labels: `text-xs font-bold text-[#4C4C4C] uppercase tracking-wider`
- Submit: `bg-[#63923E] hover:bg-[#527a33] text-white font-bold rounded-xl shadow-lg shadow-green-900/10`
- Success state: green checkmark circle `bg-[#63923E]/10 text-[#63923E]` + "Payment Successful!" heading

### 5.8 Calculator

**Structure**: 4-column grid input panel → 3-column output panel (Budget / Recommended / Premium)

**Input Panel**: `bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm`
- Mode toggle: pill switcher with `bg-[#000000] text-white` for active, `text-gray-500` for inactive
- Critical inputs highlighted: `border-2 border-[#63923E]/40` (backup hours, load %, appliance grid)
- Range sliders: `accent-[#63923E]`
- Appliance grid: 3×5 icon counter cells with `−/+` buttons (`bg-gray-200` for minus, `bg-[#63923E]` for plus)

**Output — Three-tier comparison**:

| Tier | Style | Badge |
|---|---|---|
| Budget (Lead-Acid) | `opacity-80`, gray tones, red × marks | `bg-gray-100 text-gray-500` |
| Recommended (LFP) | `border-2 border-[#63923E] shadow-lg shadow-[#63923E]/10`, green ✓ marks | `bg-[#63923E] text-white` floating "✦ Recommended" pill |
| Premium (Solar) | `bg-slate-800`, amber accents, amber ✓ marks | `bg-amber-400/20 text-amber-300` |

**Product recommendation cards** (inside Recommended tier):
```
┌────────────────────────────────────┐
│ [img] BATTERY                      │
│       100Ah • 12.8V LFP           │  ← text-base font-extrabold
│       Cnercell NV 12V-100 (link)   │
│                        ₹17,900 🛒 │
└────────────────────────────────────┘
```
- Card: `bg-[#63923E]/5 border border-[#63923E]/20 rounded-lg p-2.5`
- Image: `w-14 h-14 object-contain rounded-md bg-white border border-gray-100 p-1`
- "Add" button: `text-[9px] bg-[#63923E] text-white px-2 py-0.5 rounded`

### 5.9 Footer

- Background: `bg-[#000000] text-[#bfbfbf] py-12 border-t border-[#4C4C4C]`
- Brand name: `text-white text-xl font-bold font-['Rajdhani']`
- Copyright + tagline: `text-sm text-[#bfbfbf]`
- Surcharge notice: `border-t border-[#4C4C4C] pt-6 text-center` → `text-[#63923E] font-bold text-xs uppercase tracking-widest animate-pulse`

### 5.10 About Page

- Mission/Vision cards: `bg-white p-8 rounded-3xl border border-gray-200 hover:border-[#63923E]/50 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`
- Icon container: `w-12 h-12 bg-[#63923E]/10 rounded-xl` with `text-[#63923E]`
- Card headings: `text-2xl font-bold text-[#000000] group-hover:text-[#63923E] transition-colors`

### 5.11 Contact Page

- Two-column layout: Left (contact details + form), Right (Google Maps embed)
- Contact detail items: `p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 border border-transparent hover:border-gray-200`
- Icon badge: `p-2 bg-[#63923E]/10 rounded-lg text-[#63923E]`
- Form inputs: Material-style floating labels (`peer-focus:text-[#63923E]`)
- Submit: `bg-[#000000] text-white font-bold rounded-lg hover:bg-[#333333]`
- Map: `grayscale opacity-90 hover:opacity-100 hover:grayscale-0 transition-all duration-700`
- "Open in Google Maps" button: `bg-white/95 backdrop-blur-md hover:bg-[#63923E] hover:text-white rounded-full shadow-xl`

### 5.12 Team Section

- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Card: `bg-white rounded-none border border-gray-200 hover:shadow-lg`
- Image: `aspect-square` with gradient overlay `from-[#000000]/90 to-transparent` at bottom for name
- Role: `text-[#63923E] text-xs font-bold tracking-wider uppercase`
- Bio: `text-[#4C4C4C] text-sm`

---

## 6. Animation & Interaction Patterns

| Pattern | Implementation |
|---|---|
| Page load spinner | `animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#63923E]` |
| Card hover lift | `hover:-translate-y-1 transition-all duration-300` |
| Image zoom on hover | `hover:scale-110 transition-transform duration-500` |
| Cart slide-in | `animate-slideIn` (custom keyframe — translateX) |
| Nav dropdown | `animate-slideIn` |
| Footer pulse | `animate-pulse` on surcharge notice |
| Backdrop blur | `backdrop-blur-sm` (cart), `backdrop-blur-md` (modals, nav) |
| Button glow | `shadow-[0_0_20px_rgba(99,146,62,0.3)]` on hero CTA |
| Particle network | Canvas-based, 60 nodes, connects within 150px, bounces off edges |

---

## 7. Responsive Breakpoints

Uses Tailwind defaults:
- `sm:` 640px — minor layout adjustments
- `md:` 768px — 2-column grids, desktop nav visible
- `lg:` 1024px — 3–4 column grids, full calculator layout

Mobile-first patterns:
- Navbar collapses to hamburger below `md:`
- Store grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Calculator input: stacks to single column on mobile
- Calculator output: stacks to single column on mobile

---

## 8. Icons

All icons are **inline SVGs** (no icon library dependency):
- Navbar: `IconMenu`, `IconShoppingCart`, `IconX` (from `Icons.tsx`)
- Shared: `IconCircuitBoard`, `IconBatteryCharging`, `IconShieldCheck`, `IconZap`
- Calculator: ~15 custom inline SVG icons for appliances (fan, bulb, TV, fridge, AC, etc.)
- Contact: `MailIcon`, `PhoneIcon`, `MapIcon`, `BuildingIcon`

**Stroke-based, 24×24 viewBox, strokeWidth 1.5–2, `currentColor`**

---

## 9. Data Architecture

### Pricing (Supabase)
- Table: `products_pricing` — columns: `id` (text PK), `price` (numeric)
- ID format: `{productPrefix}:{capacity}` — e.g. `inv-1:100`, `hups-24:2500`
- Fetched once on app boot in `App.tsx`, overwrites local `PRICE_MAP` via `updatePricesFromDB()`
- RLS: public SELECT only, no public writes

### Product Catalog (local `constants.ts`)
- `PRODUCTS` array of typed objects: `id`, `name`, `category`, `description`, `nominalVoltage`, `nominalCapacity`, `availableCapacities`, `unit`, `warranty`, `price` (getter), `image`, `specs`, `features`
- Categories: `Inverter Batteries`, `Lift Backup`, `2W & 3W EVs`, `Solar Lights`, `Home UPS`, `Solar Inverters`, `Lithium Integrated`, `Online UPS`
- Calculator arrays: `NV_12V_PRICES`, `HUPS_PRICES`, `SPWM_PRICES`, `SMPPT_PRICES`, `LI_PRICES`, `SLI_PRICES`
- `calculatePrice()` function: looks up `PRICE_MAP[prefix:capacity]`, falls back to formula

### Cart (React Context)
- `CartContext` provides: `items`, `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `cartTotal`, `itemCount`, `isCartOpen`, `setIsCartOpen`

---

## 10. Image Hosting

All product images and logos are stored on Supabase Storage:
```
https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/
├── DC_Energy_white_bg.png          (navbar — light mode)
├── DC_Energyfull_black_bg_.png     (navbar — dark mode)
└── products/
    ├── Cnercell_NV_series.png
    ├── Cnergen_HUPS_series.png
    ├── Cnergen_SPWM_series.png
    ├── Cnergen_SMPPT_series.png
    ├── Cnergen_Li_series.png
    ├── Cnergen_SLi_series.png
    └── ...
```
Team photos: served from `/members/` relative path.

---

## 11. Key Design Principles

1. **Black + Green + White** — The entire palette revolves around these three. Green is the hero accent. Black is authority. White is clean space.
2. **Industrial minimalism** — Sharp borders, no rounded-full cards (except pills/badges). Team cards are intentionally `rounded-none`.
3. **Particle canvas** — The animated network-graph canvas is the site's visual signature. It appears on the homepage hero AND every interior page header.
4. **Dense data, compact layout** — The calculator is information-dense by design. Small font sizes (`text-[10px]`, `text-[9px]`), tight spacing (`gap-1.5`, `p-2`).
5. **Three-tier comparison** — Calculator output always presents Budget → Recommended → Premium side-by-side so the customer is visually nudged toward the center (Recommended) column.
6. **Indian identity** — Tricolour gradient in the hero headline, "Truly Indian-Made" tagline, "🇮🇳" flag emoji in calculator footer.
7. **No placeholder images** — Every product has a real hosted image. Every team member has a real photo.

---

## 12. Environment Variables

```env
VITE_SUPABASE_URL=https://ncxynrxeabkvlcirspnz.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 13. File Structure

```
├── App.tsx                 # Root layout + Supabase price fetch
├── constants.ts            # All product data, PRICE_MAP, calculator arrays
├── supabaseClient.ts       # Supabase client init
├── types.ts                # TypeScript interfaces (Product, TeamMember, etc.)
├── context/
│   └── CartContext.tsx      # Shopping cart state
├── components/
│   ├── Navbar.tsx           # Fixed nav with dual-mode (dark/light)
│   ├── Hero.tsx             # Full-screen canvas particle hero
│   ├── PageHeader.tsx       # Reusable interior page header with particles
│   ├── ProductShowcase.tsx  # Homepage product category tabs + grid
│   ├── TechnicalSection.tsx # Homepage tech highlights
│   ├── SpecsTable.tsx       # Homepage specs comparison
│   ├── Team.tsx             # Team member grid
│   ├── Store.tsx            # Product catalog + cart + checkout + Razorpay
│   ├── ProductDetail.tsx    # Single product view
│   ├── Calculator.tsx       # Load & backup calculator with 3-tier output
│   ├── About.tsx            # Mission/vision + team + legacy
│   ├── Contact.tsx          # Contact details + form + Google Maps
│   ├── Footer.tsx           # Footer with surcharge notice
│   └── Icons.tsx            # Shared inline SVG icon components
└── public/
    └── members/             # Team member photos
```
