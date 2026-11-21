# Privacy answers for the stores

Answers for Apple's **App Privacy** ("nutrition label", App Store Connect > App Privacy) and Google's **Data safety**
form (Play Console > App content). They match what the app does today; update them if that changes. The app has no
advertising, no analytics SDKs and no tracking.

## Apple: App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

| Data type (Apple's names) | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info > Email Address | Yes | Yes | No | App Functionality (account, sign-in, password reset) |
| User Content > Photos or Videos | Yes | Yes | No | App Functionality |
| User Content > Other User Content (animal records) | Yes | Yes | No | App Functionality |
| Identifiers > User ID | Yes | Yes | No | App Functionality (account id, also sent to RevenueCat for purchases) |
| Identifiers > Device ID | Yes (push token, only if notifications are on) | Yes | No | App Functionality |
| Purchases > Purchase History | Yes | Yes | No | App Functionality (Pro status via RevenueCat) |

Not collected: location, contacts, health, financial info (Apple handles payment), browsing history, search history,
diagnostics, usage data, advertising data, sensitive info.

**Tracking:** No (no data is used to track users across apps or websites; no App Tracking Transparency prompt needed).

## Google: Data safety

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all of the user data collected by your app encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data is deleted?** Yes (in app, and by email via the support page).

| Data type (Google's names) | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Personal info > Email address | Yes | No | Required | Account management, App functionality |
| Personal info > User IDs | Yes | No | Required | Account management, App functionality |
| Photos and videos > Photos | Yes | No | Optional | App functionality |
| App activity > Other user-generated content | Yes | No | Required | App functionality |
| Device or other IDs | Yes (push token) | No | Optional | App functionality (notifications) |
| Financial info > Purchase history | Yes | No | Optional | App functionality (subscription status) |

"Shared" means transferred to a third party for their own use. Service providers that process data on our behalf
(Supabase, Expo push, RevenueCat) are not "sharing" under Google's definition.
