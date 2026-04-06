# Admin Dropdown - Design Specifications

## 🎨 Visual Design

### Closed State (Trigger Button)
```
┌─────────────────────────────────┐
│ 👥 USUARIOS        ▼             │  ← Closed dropdown
│ (border: 2px solid #1a1a1a)     │  ← Neo-brutalist style
└─────────────────────────────────┘
```

**Properties:**
- Border: 2px solid (dark)
- Padding: 12px (left/right), 8px (top/bottom)
- Background: white
- Text: black, font-bold, uppercase, text-xs/sm
- Icon: 16px, dynamic chevron rotation
- Hover: translate-y -4px, shadow-md
- Active/Click: translate-y 2px, shadow-none
- Focus: ring-2 ring-blue-500

---

### Open State (Dropdown Menu)
```
┌─────────────────────────────────┐
│ 👥 USUARIOS        ▼             │  ← Active (trigger)
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ 👥 USUARIOS              ✓       │  ← Selected (blue bg)
├─────────────────────────────────┤
│ 🏠 CONFIG                        │  ← Hover: light-gray bg
├─────────────────────────────────┤
│ 🛡️ LOGS                          │  ← Unselected (white bg)
└─────────────────────────────────┘
```

**Menu Properties:**
- Width: 192px (w-48)
- Background: white
- Border: 2px solid (dark)
- Shadow: shadow-lg
- Z-index: z-50
- Item height: 48px
- Item padding: 16px (left/right), 12px (top/bottom)

---

## 📐 Dimensions

| Element | Property | Value |
|---------|----------|-------|
| Button Width | min | 192px |
| Button Height | min | 40px |
| Menu Width | static | 192px (w-48) |
| Item Height | min | 48px |
| Touch Target | min | 44x44px ✓ |
| Icon Size | width/height | 16px (w-4 h-4) |
| Border Width | all | 2px |
| Border Radius | all | 0px (square, brutalist) |

---

## 🎯 Responsive Breakpoints

### Mobile (< 768px / < md)
```
HEADER
├─ Title: "Panel Administración"
└─ Dropdown Menu (compact)
     └─ Icon + Chevron (label hidden on xs)
```

**Layout:** Column stack, dropdown full width responsive

### Desktop (≥ 768px / ≥ md)
```
HEADER
├─ Title: "Panel Administración"
└─ Inline Tabs (row)
     ├─ [🏠 USUARIOS]
     ├─ [🏠 CONFIG]
     └─ [🛡️ LOGS]
```

**Layout:** Flex row, original tab layout

---

## 🎨 Color Scheme

### Light Mode (current)
| Element | Color | Hex |
|---------|-------|-----|
| Border | Slate 900 | #0f172a |
| Background | White | #ffffff |
| Text | Black | #000000 |
| Selected BG | Slate 900 | #0f172a |
| Selected Text | White | #ffffff |
| Hover BG | Slate 100 | #f1f5f9 |
| Focus Ring | Blue 500 | #3b82f6 |
| Divider | Slate 200 | #e2e8f0 |

---

## ⌨️ Keyboard Interactions

| Key | Action |
|-----|--------|
| **Tab** | Focus button, navigate menu |
| **Enter** | Open dropdown, select item |
| **Space** | Open dropdown, select item |
| **ArrowDown** | Next menu item |
| **ArrowUp** | Previous menu item |
| **Escape** | Close dropdown, focus button |
| **Click Outside** | Close dropdown |

---

## ♿ Accessibility

### ARIA Attributes
```html
<button
  aria-haspopup="menu"              <!-- Indicates menu element -->
  aria-expanded="true/false"         <!-- Menu open state -->
  aria-label="Menu de navegación"    <!-- Button purpose -->
>

<div role="menu">                     <!-- Menu container -->
  <button role="menuitem"             <!-- Menu item -->
    aria-current="page"               <!-- Current location -->
  >
</div>
```

### Touch Targets
- Minimum 44×44px ✓
- Trigger button: 40px + 4px padding = 44px+
- Menu items: 48px height
- Meets WCAG AAA standards

### Focus Management
- Focus ring: 2px offset, 2px blue ring
- Focus visible on keyboard navigation
- Focus restored after close (return to button)

---

## 🎬 Animation Details

### Chevron Rotation
```css
transition: transform 150ms ease-out;
transform: rotate(0deg);      /* Closed */
transform: rotate(180deg);    /* Open */
```

### Button Hover/Active
```css
/* Hover state */
transition: all 200ms;
transform: translateY(-4px);
box-shadow: 0 10px 15px rgba(0,0,0,0.1);

/* Active/Clicked state */
transform: translateY(2px);
box-shadow: none;
```

### Menu Appearance
- No animation (instant appear)
- Optional: Add fade-in (opacity 0→1, 150ms)

---

## 📋 States & Variants

### Button States
| State | Background | Border | Text | Shadow |
|-------|-----------|--------|------|--------|
| Default | White | 2px black | Black | 2px solid |
| Hover | White | 2px black | Black | md (0 4px 6px) |
| Active | White | 2px black | Black | none |
| Pressed | White | 2px black | Black | translate-y 2px |
| Focus | White | 2px black | Blue ring | 2px ring |

### Menu Item States
| State | Background | Border | Text | Check |
|-------|-----------|--------|------|-------|
| Default | White | bottom 1px slate-200 | Black | — |
| Hover | Slate-100 | bottom 1px slate-200 | Black | — |
| Active | Slate-900 | bottom 1px slate-200 | White | ✓ |
| Focus | Slate-100 | bottom 1px slate-200 | Black | — |

---

## 📱 Mobile vs Desktop Experience

### Mobile Flow
1. User sees dropdown button with current selection
2. Taps button to open menu
3. Taps desired option to select
4. Menu closes, button updates
5. Tab changes to selected section

**Advantages:**
- ✅ Space-efficient (saves horizontal space)
- ✅ Touch-friendly (large tap targets)
- ✅ Clear hierarchy (one action at a time)
- ✅ Reduced cognitive load

### Desktop Flow
1. User sees inline tabs
2. Hovers over desired tab
3. Clicks tab to select
4. Tab activates, content updates

**Advantages:**
- ✅ All options visible at once
- ✅ Fast selection (no modal interaction)
- ✅ Familiar (standard tab pattern)
- ✅ Discoverable (shows all options)

---

## 🔐 Edge Cases Handled

| Case | Behavior |
|------|----------|
| Click outside | Closes dropdown |
| Click trigger while open | Closes dropdown |
| Click same item | Closes dropdown, doesn't re-navigate |
| Keyboard ESC | Closes, focus returns to button |
| Keyboard Arrow (end of list) | Wraps to beginning |
| Tab key away from menu | Closes dropdown |
| Focus on closed button | Shows focus ring |
| Very long labels | Text wraps on mobile |

---

## 🎯 Performance Characteristics

| Metric | Target | Status |
|--------|--------|--------|
| **FCP** (First Contentful Paint) | < 3s | ✅ (No effect) |
| **TTI** (Time to Interactive) | < 5s | ✅ (No effect) |
| **CLS** (Cumulative Layout Shift) | < 0.1 | ✅ (No shift when opening) |
| **Bundle Size Impact** | + 0 KB | ✅ (No dependencies) |
| **JavaScript Runtime** | < 50ms | ✅ (Minimal state updates) |
| **Animation FPS** | 60fps | ✅ (transform only) |

---

## 📦 Component API

```typescript
interface AdminDropdownProps {
  tabs: Array<{
    id: string;           // Unique identifier
    icon: React.ComponentType<{ className?: string }>;  // Icon component
    label: string;        // Display text
  }>;
  activeTab: string;      // Currently selected tab ID
  onTabChange: (tabId: string) => void;  // Selection callback
  showLabel?: boolean;    // Show/hide text (default: true)
}
```

---

## 🚀 Implementation Priority

### Phase 1: Core (MVP)
- [x] Dropdown button with trigger
- [x] Menu open/close
- [x] Tab selection
- [x] Click outside close
- [x] Styling (neo-brutalist)

### Phase 2: Enhancement
- [x] Keyboard navigation
- [x] ARIA labels
- [x] Focus management
- [x] Responsive logic
- [x] Smooth animations

### Phase 3: Polish (Optional)
- [ ] Customizable position (top/bottom)
- [ ] Custom menu width
- [ ] Item grouping with dividers
- [ ] Search filter option
- [ ] Icon in trigger (additional context)

---

## ✅ QA Checklist

- [ ] Opens on click
- [ ] Closes on click item
- [ ] Closes on click outside
- [ ] Closes on ESC key
- [ ] Arrow Up/Down navigates
- [ ] Enter/Space selects
- [ ] Selected item highlighted
- [ ] Checkmark appears on selected
- [ ] Works on mobile (< 768px)
- [ ] Works on desktop (≥ 768px)
- [ ] Focus ring visible
- [ ] No console errors
- [ ] No layout shift
- [ ] Chevron rotates smoothly
- [ ] Color contrast passes WCAG

---

## 🎨 Design Decisions & Rationale

### Why Neo-Brutalist?
- ✓ Matches your Admin style
- ✓ High contrast = better accessibility
- ✓ Distinctive = clear affordance
- ✓ Professional = enterprise feel

### Why Dropdown vs Tabs on Mobile?
- ✓ Saves horizontal space (precious on mobile)
- ✓ Reduces cognitive load (one option at a time)
- ✓ Touch-friendly (44px targets)
- ✓ Scales better (can add more options)
- ✓ Standard pattern (users expect it)

### Why Keep Tabs on Desktop?
- ✓ All options visible = discoverability
- ✓ Faster selection (no modal interaction)
- ✓ Familiar pattern = low learning curve
- ✓ More screen real estate available
- ✓ Better for keyboard power users

---

**Design System:** Neo-Minimalist Brutalism  
**Framework:** React 19 + TypeScript + Tailwind CSS  
**Accessibility:** WCAG 2.1 AA (target AAA)  
**Responsive:** Mobile-first approach  
