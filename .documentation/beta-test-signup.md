# Beta test signup — steps and flow

How to sign up as a beta user in VDAB. This flow is separate from the standard `/signup` path.

## Where to start

| Environment | URL |
| --- | --- |
| Local dev | `https://localhost:5173/beta-signup` |
| Dev / staging | `https://xorbix-vdab-dev.azurewebsites.net/beta-signup` (or `https://app.vdab.ai/beta-signup` when configured) |

You can also open **Sign up** (`/signup`) and use the link to **beta signup** at the bottom of the page.

---

## Step-by-step (tester view)

### 1. Choose plan and beta code

1. Open `/beta-signup`.
2. Select a subscription tier (**Individual** or **Team**).
3. Enter your beta code. The code must match the tier you selected.
4. Click **Continue**. The app validates the code before moving on.

### 2. Create your account

1. Enter first name, last name, and email.
2. Accept the Terms of Service and Privacy Policy.
3. Click **Create beta account**.

   You do **not** set a password on this screen.

4. You should see **Check your email** with beta-specific copy about confirming and setting a password.

To go back and change tier or code, click the completed **✓** step bubble next to **Choose plan & beta code**.

### 3. Confirm your email

1. Open the confirmation email from VDAB.
2. Click the link in the email (lands on `/confirm-email`).
3. After confirmation succeeds, you are sent to **Set password** (`/set-password`).

### 4. Set password and sign in

1. Choose a password on the set-password page.
2. When finished, go to **Login** (`/login`).
3. Sign in with your email and new password.

### 5. Use the app

After login, beta users with a redeemed code **skip** the billing setup wizard (`/account/setup/billing`). You go straight into the app with a no-card trial on the tier you chose.

---

## What happens on the server (general flow)

```text
/beta-signup (UI)
  → POST /api/billing/beta-codes/validate-preview   (anonymous; tier + code check)
  → POST /api/identity/register/beta                (create user + tenant; redeem code)
       → Stripe customer + no-card trial subscription
  → Confirmation email

Email link
  → POST /api/identity/register/confirm-email
  → Set password
  → Login

After login
  → GET account setup status
  → Billing setup skipped when beta redemption exists (trial active, no card required)
```

---

## Dev / local beta codes

Seeded in the database for local and dev testing (see migration `SeedInitialBetaCodes`):

| Code | Tier | Trial |
| --- | --- | --- |
| `VDAB-BETA-IND` | Individual | 30 days, monthly billing interval |
| `VDAB-BETA-TEAM` | Team | 30 days, monthly billing interval |

Codes are case-insensitive at redemption. Tier on the form must match the code.

---

## Beta vs standard signup

| | Beta (`/beta-signup`) | Standard (`/signup`) |
| --- | --- | --- |
| Beta code | Required up front | Optional later in billing setup |
| Password at signup | No — set after email confirm | Yes (on signup form) |
| Billing setup after login | Skipped when beta trial is active | Required until subscription + payment method |
| Payment method | Not required to start trial | Required for standard trial |

---

## After the trial

Beta trials are created **without a payment method**. When the trial ends:

- If no card is on file, the subscription is **paused** and the account is limited until a payment method is added.
- Adding a payment method in account/billing settings resumes normal billing.

---

## Troubleshooting (quick)

- **Invalid beta code** — Check spelling, tier match, and that the code is still active and under its redemption limit.
- **Email already registered** — Use login or password reset. If a prior beta signup failed partway, submitting `/beta-signup` again with the same email and code retries redemption.
- **No confirmation email** — Check spam; confirm local email/Azure Communication Services config for dev.
- **Redirected to billing after login** — Beta redemption or subscription may not have completed; check server logs and tenant subscription status in the database.
