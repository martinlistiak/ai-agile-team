# Button Components — project conventions

All interactive button elements in the frontend must use the shared `Button` component from `@/components/Button`. Do not use raw `<button>` elements with custom styling.

## Setup

The Button component is located at `frontend/src/components/Button.tsx`.

## Usage

```tsx
import { Button } from "@/components/Button";

// Primary button (default)
<Button onClick={handleClick}>Save</Button>

// Secondary button
<Button variant="secondary" onClick={handleCancel}>Cancel</Button>

// Ghost button (no background)
<Button variant="ghost" onClick={handleAction}>Edit</Button>

// Link-style button
<Button variant="link" onClick={handleLink}>Learn more</Button>

// With loading state
<Button loading={isSubmitting}>Submit</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
```

## Available Props

| Prop        | Type                                            | Default     | Description                             |
| ----------- | ----------------------------------------------- | ----------- | --------------------------------------- |
| `variant`   | `"primary" \| "secondary" \| "ghost" \| "link"` | `"primary"` | Visual style of the button              |
| `size`      | `"sm" \| "md" \| "lg"`                          | `"md"`      | Size of the button                      |
| `loading`   | `boolean`                                       | `false`     | Shows loading state and disables button |
| `disabled`  | `boolean`                                       | `false`     | Disables the button                     |
| `className` | `string`                                        | `""`        | Additional CSS classes                  |

## Rules

1. **Always use the Button component** — Never use raw `<button>` elements with inline styles or custom Tailwind classes for interactive buttons.

2. **Choose the right variant**:
   - `primary`: Main actions (Save, Submit, Create)
   - `secondary`: Secondary actions (Cancel, Back)
   - `ghost`: Tertiary actions, toolbar buttons
   - `link`: Text-only actions that look like links

3. **Use loading state** — When a button triggers an async action, use the `loading` prop instead of manually disabling and changing text.

4. **Exceptions** — The following are acceptable uses of raw `<button>`:
   - Icon-only buttons in toolbars (use `ghost` variant when possible)
   - Buttons inside third-party components that require specific markup
   - Menu items in dropdown menus (these are semantically different)

5. **Custom styling** — If you need custom styling, pass it via the `className` prop rather than creating a new button component.
