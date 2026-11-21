# Email templates

Branded versions of Supabase's account emails. Paste each into Supabase > Authentication > Emails (Templates):

| Template | Subject | File |
|---|---|---|
| Reset password | Reset your Clutchly password | `reset-password.html` |
| Confirm signup | Confirm your Clutchly account | `confirm-signup.html` |

They use the logo from the website (https://clutchly.com.au/img/logo.png). The sender name and address are set under
Authentication > Emails > SMTP settings once a sending service is connected (see docs/LAUNCH_CHECKLIST.md).
