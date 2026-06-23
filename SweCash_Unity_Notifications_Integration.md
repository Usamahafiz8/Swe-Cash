# SweCash — Unity Push Notifications Integration Guide

**Project:** SweCash (Firebase Project ID: `swecash-ae30e`)  
**Backend base URL (dev):** `http://localhost:3000/api/v1`  
**Backend base URL (prod):** *(replace with production URL)*  
**Notification provider:** Firebase Cloud Messaging (FCM)

---

## Overview

The backend handles all notification delivery. The Unity client's only jobs are:

1. Get the FCM device token from Firebase SDK
2. Send that token to the backend after login
3. Listen for incoming messages and show UI

```
Unity App
  └─ Firebase SDK gives device token
        └─ POST /api/v1/users/update  { fcmToken }
              └─ Backend stores token on user record
                    └─ Backend sends push when events happen
                         (payout approved, reward credited, referral, etc.)
```

---

## Step 1 — Firebase Project Setup

1. Go to **Firebase Console** → project **`swecash-ae30e`**
2. **Project Settings → General → Your apps → Add app**
   - Choose **Android** — enter your Unity bundle ID (e.g. `com.swecash.app`)
   - Choose **iOS** — enter your Unity bundle ID
3. Download **`google-services.json`** → place at `Assets/google-services.json` in Unity
4. Download **`GoogleService-Info.plist`** → place at `Assets/GoogleService-Info.plist` in Unity

---

## Step 2 — Import Firebase Unity SDK

1. Download the **Firebase Unity SDK** from the Firebase Console or the official Firebase release page
2. In Unity: **Assets → Import Package → Custom Package**
3. Import **`FirebaseMessaging.unitypackage`**
4. Also import **`FirebaseApp.unitypackage`** if not already present
5. Resolve Android dependencies: **Assets → External Dependency Manager → Android Resolver → Resolve**

---

## Step 3 — NotificationManager.cs

Create a new script `NotificationManager.cs` and attach it to a **persistent GameObject** (one that lives across all scenes — typically your `AppController` or `GameManager`).

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using Firebase.Messaging;

public class NotificationManager : MonoBehaviour
{
    public static NotificationManager Instance { get; private set; }

    private string _pendingToken;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    void Start()
    {
        Firebase.FirebaseApp.CheckAndFixDependenciesAsync().ContinueWith(task =>
        {
            if (task.Result != Firebase.DependencyStatus.Available)
            {
                Debug.LogError("[FCM] Firebase dependencies unavailable: " + task.Result);
                return;
            }

            FirebaseMessaging.TokenReceived   += OnTokenReceived;
            FirebaseMessaging.MessageReceived += OnMessageReceived;

            // Fetch token in case it was already issued before Start()
            FirebaseMessaging.GetTokenAsync().ContinueWith(t =>
            {
                if (t.IsCompletedSuccessfully) _pendingToken = t.Result;
            });
        });
    }

    // Firebase calls this automatically when a token is issued or rotated
    private void OnTokenReceived(object sender, TokenReceivedEventArgs e)
    {
        _pendingToken = e.Token;

        // If already logged in, register immediately
        if (AuthManager.Instance != null && AuthManager.Instance.IsLoggedIn)
            StartCoroutine(RegisterToken(e.Token));
    }

    // Call this right after a successful login
    public void OnUserLoggedIn()
    {
        if (!string.IsNullOrEmpty(_pendingToken))
            StartCoroutine(RegisterToken(_pendingToken));
    }

    // Handles notifications received while app is OPEN (foreground)
    private void OnMessageReceived(object sender, MessageReceivedEventArgs e)
    {
        var title = e.Message.Notification?.Title ?? string.Empty;
        var body  = e.Message.Notification?.Body  ?? string.Empty;

        Debug.Log($"[FCM] Notification received — {title}: {body}");

        // Show your in-game toast / popup here
        // Example: UIManager.Instance?.ShowToast(title, body);

        // Optional: deep link routing via data payload
        if (e.Message.Data != null && e.Message.Data.TryGetValue("screen", out var screen))
        {
            // Navigate to "wallet", "payout", "referral", etc.
            // Example: NavigationManager.Instance?.GoTo(screen);
            Debug.Log($"[FCM] Deep link screen: {screen}");
        }
    }

    // Registers the FCM token with the SweCash backend
    private IEnumerator RegisterToken(string token)
    {
        var url  = ApiClient.BaseUrl + "/users/update";
        var json = $"{{\"fcmToken\":\"{token}\"}}";
        var req  = new UnityWebRequest(url, "POST");

        req.uploadHandler   = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type",  "application/json");
        req.SetRequestHeader("Authorization", "Bearer " + AuthManager.Instance.JwtToken);

        yield return req.SendWebRequest();

        if (req.result == UnityWebRequest.Result.Success)
            Debug.Log("[FCM] Token registered with backend successfully.");
        else
            Debug.LogWarning("[FCM] Token registration failed: " + req.error);
    }
}
```

> **Note:** Replace `ApiClient.BaseUrl`, `AuthManager.Instance.IsLoggedIn`, and `AuthManager.Instance.JwtToken` with your actual API client and auth manager class names.

---

## Step 4 — Trigger After Login

In your login response handler, add one line after storing the JWT:

```csharp
// After receiving JWT from backend and storing it:
AuthManager.Instance.StoreJwt(response.accessToken);
NotificationManager.Instance.OnUserLoggedIn(); // <-- add this
```

---

## Step 5 — Backend Endpoints Reference

### Option A — Pass FCM token during Google login (if token is ready)

```
POST /api/v1/auth/google-login
Content-Type: application/json

{
  "idToken": "<Google ID token>",
  "fcmToken": "<Firebase device token>"    ← optional field
}
```

### Option B — Update token after login (recommended — handles token rotation)

```
POST /api/v1/users/update
Content-Type: application/json
Authorization: Bearer <SweCash JWT>

{
  "fcmToken": "<Firebase device token>"
}
```

**Use Option B** — it is more reliable because Firebase can rotate the token at any time, and this endpoint can be called on every app launch.

---

## Step 6 — Platform-Specific Setup

### Android
No extra steps required. The `google-services.json` file handles all configuration automatically after the External Dependency Manager resolves packages.

### iOS
In Xcode (after Unity build):
1. **Signing & Capabilities → + Capability → Push Notifications**
2. **Signing & Capabilities → + Capability → Background Modes → check Remote notifications**
3. Upload your **APNs Auth Key** or **APNs Certificate** to Firebase Console → Project Settings → Cloud Messaging → iOS app

---

## Notifications the App Will Receive

The backend sends these automatically — no additional Unity code needed beyond the setup above.

| Event | Title | Body |
|---|---|---|
| Payout approved | "Payout Sent!" | "Your $X.XX has been processed via PayPal" |
| Payout rejected | "Payout Declined" | "Your withdrawal was not approved. Tap for details." |
| Adjoe reward credited | "You Earned!" | "$X.XX added from gameplay" |
| Ad reward bonus | "Bonus Earned!" | "+10% bonus added to your balance" |
| Referral commission | "Referral Reward" | "You earned $X.XX from your referral" |
| Signup bonus | "Welcome to SweCash!" | "$0.03 has been added to your wallet" |

Each notification may include a `screen` key in its data payload for deep linking (e.g. `"screen": "wallet"` or `"screen": "payout"`).

---

## Testing

1. Run the backend locally (or point to staging)
2. Log into the app on a real device (FCM does not work on emulators for push)
3. Check backend logs for: `Firebase Admin SDK initialised.` and `FCM Token registered`
4. Use **Firebase Console → Cloud Messaging → Send test message** with your device token to verify delivery
5. Trigger a payout approval from the admin panel and confirm the notification arrives

---

## Checklist

- [ ] `google-services.json` placed in `Assets/`
- [ ] `GoogleService-Info.plist` placed in `Assets/` *(iOS)*
- [ ] `FirebaseMessaging.unitypackage` imported
- [ ] Android dependencies resolved via External Dependency Manager
- [ ] `NotificationManager.cs` attached to a persistent GameObject
- [ ] `NotificationManager.Instance.OnUserLoggedIn()` called after login
- [ ] iOS: Push Notifications + Background Modes enabled in Xcode
- [ ] iOS: APNs key uploaded to Firebase Console
- [ ] End-to-end test on real device passed

---

*Questions? Contact the backend team.*
