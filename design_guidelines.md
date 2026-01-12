# Design Guidelines: Twilio SMS Management Dashboard

## Design Approach
**Selected Approach:** Design System - Modern Dashboard Pattern
**Primary Inspiration:** Linear + Notion dashboard aesthetics combined with CRM functionality
**Rationale:** This is a utility-focused productivity tool requiring clear information hierarchy, efficient data display, and professional appearance for business use.

## Core Design Principles
1. **Clarity Over Decoration:** Information-first design with minimal visual noise
2. **Efficient Scanning:** Strong typography and spacing for quick information parsing
3. **Status at a Glance:** Color-coded visual indicators for lead sentiment and conversation status
4. **Professional Polish:** Clean, modern interface suitable for business context

---

## Color Palette

### Dark Mode (Primary)
- **Background Layers:**
  - Primary: 222 15% 9% (deepest background)
  - Secondary: 222 13% 11% (elevated surfaces)
  - Tertiary: 222 12% 14% (cards, conversation items)
  - Hover: 222 12% 16%

- **Brand Colors:**
  - Primary: 258 90% 66% (purple-blue for accents, active states)
  - Primary Hover: 258 90% 72%

- **Text Hierarchy:**
  - Primary: 0 0% 98%
  - Secondary: 0 0% 65%
  - Muted: 0 0% 45%

- **Semantic Colors:**
  - Positive/Success: 142 76% 45% (green for positive sentiment)
  - Negative/Error: 0 72% 58% (red for negative sentiment)
  - Neutral/Warning: 45 93% 58% (amber for neutral sentiment)
  - Info: 210 100% 62% (blue for informational elements)

- **Borders:**
  - Default: 222 12% 18%
  - Subtle: 222 10% 15%

### Light Mode (Secondary)
- **Background Layers:**
  - Primary: 0 0% 100%
  - Secondary: 220 13% 98%
  - Tertiary: 220 13% 96%

- **Text:** Invert dark mode values
- **Semantic Colors:** Adjust lightness for sufficient contrast

---

## Typography

### Font Stack
- **Primary:** Inter (via Google Fonts CDN)
  - Excellent legibility for dashboard interfaces
  - Supports numeric tabular figures for data display
- **Monospace (for phone numbers, timestamps):** JetBrains Mono or system mono stack

### Type Scale
- **Display (Lead name in detail view):** text-2xl font-semibold (24px, 600 weight)
- **Heading (Section titles):** text-lg font-semibold (18px, 600 weight)
- **Body (Messages, content):** text-sm (14px, 400 weight)
- **Small (Metadata, timestamps):** text-xs (12px, 400 weight)
- **Tiny (Labels):** text-xs font-medium uppercase tracking-wide (12px, 500 weight, uppercase)

---

## Layout System

### Spacing Primitives
**Core Units:** 2, 3, 4, 6, 8
- Tight spacing: p-2, gap-2 (8px)
- Standard spacing: p-4, gap-4 (16px)
- Generous spacing: p-6, gap-6 (24px)
- Section spacing: p-8 (32px)

### Grid Structure
**Three-Panel Layout:**
1. **Sidebar Navigation (if needed):** w-16 (64px) - icon-only navigation
2. **Conversation List:** w-80 or w-96 (320-384px) - scrollable list of contacts
3. **Detail Panel:** flex-1 - conversation thread and lead details

### Container Strategy
- Full viewport height: h-screen with overflow-hidden on main container
- Individual panels: overflow-y-auto for independent scrolling
- Max width for content readability: max-w-4xl for message content

---

## Component Library

### Conversation List Item
- **Structure:** Compact card with phone number/name, last message preview, timestamp, sentiment indicator
- **Height:** py-3 px-4
- **Background:** Tertiary background, hover state on interaction
- **Active State:** Primary brand color left border (border-l-2)
- **Typography:** Font-medium for name, text-sm for preview, text-xs text-muted for timestamp
- **Sentiment Badge:** Small circular indicator (w-2 h-2) in top-right corner using semantic colors

### Message Bubble
- **Inbound Messages:** 
  - Background: Tertiary background
  - Alignment: justify-start
  - Max-width: max-w-[75%]
  - Padding: px-4 py-2.5
  - Border-radius: rounded-2xl rounded-tl-md

- **Outbound Messages:**
  - Background: Primary brand color
  - Alignment: justify-end
  - Max-width: max-w-[75%]
  - Text: White
  - Border-radius: rounded-2xl rounded-tr-md

- **Spacing:** gap-3 between messages, gap-6 between message groups

### Lead Assessment Card
- **Layout:** Grid layout (grid-cols-2 lg:grid-cols-4) for metrics
- **Background:** Secondary background with subtle border
- **Padding:** p-6
- **Border-radius:** rounded-lg

**Metric Display:**
- Label: text-xs uppercase tracking-wide text-muted
- Value: text-2xl font-semibold with color coding:
  - Probability: Gradient from red (0%) to green (100%)
  - Est. Value: Primary text color
  - Stage: Color-coded by stage (Lead=blue, Qualified=purple, etc.)
  - Sentiment: Use semantic colors (green/amber/red)

### Input Components

**Text Input (SMS Compose):**
- Multi-line textarea with rounded-lg border
- Background: Tertiary
- Border: Default border color, focus:ring-2 focus:ring-primary
- Padding: p-3
- Placeholder text: text-muted

**Send Button:**
- Primary brand background
- Padding: px-6 py-2.5
- Border-radius: rounded-lg
- Font: text-sm font-medium
- Hover: Slightly lighter shade
- Disabled state: opacity-50 cursor-not-allowed

### Status Badges
- **Pill Shape:** rounded-full px-3 py-1
- **Size:** text-xs font-medium
- **Colors:** Background at 10-15% opacity of semantic color, text at full semantic color
- **Examples:**
  - Positive: bg-green-500/10 text-green-500
  - Negative: bg-red-500/10 text-red-500
  - Neutral: bg-amber-500/10 text-amber-500

---

## Interaction Patterns

### Navigation
- Active conversation: Left accent border + slightly elevated background
- Hover states: Subtle background lightening (4% increase in lightness)
- Click target size: Minimum 44px height for touch accessibility

### Real-time Updates
- New message indicator: Pulsing dot animation on conversation list item
- Smooth scroll to bottom when new messages arrive
- Toast notifications for background conversations (subtle, top-right)

### Loading States
- Skeleton screens for conversation list (pulsing gradient animation)
- Spinner for message sending (inline with send button)
- Optimistic UI updates for sent messages

---

## Animations
**Minimal and Purposeful:**
- Smooth scrolling: scroll-smooth
- Fade-in for new messages: opacity transition (150ms)
- Hover transitions: transition-colors duration-150
- NO complex animations or page transitions

---

## Accessibility
- Keyboard navigation: Focus visible states with 2px ring
- ARIA labels for icon-only buttons
- Sufficient color contrast (WCAG AA minimum)
- Semantic HTML structure
- Screen reader announcements for new messages

---

## Special Considerations

### Timestamp Formatting
Display relative timestamps (e.g., "2 min ago", "Today at 3:45 PM", "Yesterday", "Jan 15")

### Phone Number Display
Format consistently: +1 (555) 123-4567 or use monospace font for raw format

### Empty States
- No conversations: Centered icon + helpful message encouraging first text
- No messages in thread: Placeholder indicating conversation start

### Auto-refresh
Polling interval: 5-10 seconds for new messages
Visual indicator: Small "syncing" text or icon in header (subtle, non-distracting)