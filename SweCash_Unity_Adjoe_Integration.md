# SweCash — Unity Adjoe & Rewarded Ads Integration Guide

**Project:** SweCash  
**Backend base URL (dev):** `http://localhost:3000/api/v1`  
**Backend base URL (prod):** *(replace with production URL)*  
**Adjoe SDK Hash:** `de49b331f776108c7dcdb2483e220a2a`

---

## Overview

There are two separate earning flows. Both are triggered from Unity but work differently:

```
FLOW 1 — ADJOE PLAYTIME (main earnings)
────────────────────────────────────────
Unity initialises Adjoe SDK with user ID
User plays games inside the Adjoe game wall
Adjoe tracks playtime on their servers
Adjoe calls SweCash backend directly (S2S)
Backend credits user's PENDING balance
Unity polls wallet to show updated balance

FLOW 2 — REWARDED AD BONUS (+10%)
───────────────────────────────────
After an Adjoe reward lands → "Watch Ad" button unlocks
Unity checks eligibility with backend
Unity shows AdMob rewarded ad
Ad completes → Unity calls backend to claim reward
Backend credits AVAILABLE balance instantly
```

---

## Flow 1 — Adjoe Playtime SDK

### How it works

Unity's only job is to **initialise the Adjoe SDK with the correct user ID**.
After that, Adjoe handles everything — it tracks playtime and calls the SweCash
backend automatically. Unity does NOT report rewards.

```
Unity                Adjoe Servers           SweCash Backend
─────                ─────────────           ───────────────
GET /adjoe/init ──────────────────────────► returns { publisherSubId, sdkHash }
AdjoeSDK.Init(publisherSubId, sdkHash)
User plays games
                     tracks playtime
                     POST /adjoe/callback ──► validates token
                                             deduplicates tx
                                             credits wallet (pending)
                                             fires referral commissions
                                             sends push notification
Unity polls GET /users/profile → shows updated pending balance
```

### Step 1 — Backend endpoint

```
GET /api/v1/adjoe/init
Authorization: Bearer <SweCash JWT>

Response:
{
  "publisherSubId": "550e8400-e29b-41d4-a716-446655440000",
  "sdkHash": "de49b331f776108c7dcdb2483e220a2a"
}
```

Call this **once after login**, before showing the game wall.

### Step 2 — Import Adjoe Playtime Studio SDK

Follow the Adjoe Unity SDK documentation to import the `.unitypackage`.  
The SDK Hash above is your identifier — do not hardcode it; always use the value from `/adjoe/init`.

### Step 3 — AdjoeManager.cs

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class AdjoeManager : MonoBehaviour
{
    public static AdjoeManager Instance { get; private set; }

    private bool _initialized = false;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    // Call this right after login, before showing the game wall
    public void InitialiseAdjoe()
    {
        StartCoroutine(FetchSdkConfigAndInit());
    }

    private IEnumerator FetchSdkConfigAndInit()
    {
        var url = ApiClient.BaseUrl + "/adjoe/init";
        var req = UnityWebRequest.Get(url);
        req.SetRequestHeader("Authorization", "Bearer " + AuthManager.Instance.JwtToken);

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning("[Adjoe] Failed to fetch SDK config: " + req.error);
            yield break;
        }

        var response = JsonUtility.FromJson<AdjoeInitResponse>(req.downloadHandler.text);

        // Initialise the Adjoe SDK — replace with actual Adjoe SDK call
        // AdjoeSDK.Init(response.publisherSubId, response.sdkHash);
        Debug.Log($"[Adjoe] SDK initialised — publisherSubId={response.publisherSubId}");

        _initialized = true;
    }

    // Call this to open the Adjoe game wall UI
    public void ShowGameWall()
    {
        if (!_initialized)
        {
            Debug.LogWarning("[Adjoe] SDK not yet initialised. Call InitialiseAdjoe() first.");
            return;
        }

        // AdjoeSDK.ShowGameWall();
        Debug.Log("[Adjoe] Game wall opened.");
    }

    [System.Serializable]
    private class AdjoeInitResponse
    {
        public string publisherSubId;
        public string sdkHash;
    }
}
```

### Step 4 — Call after login

```csharp
// In your login response handler, after storing the JWT:
AuthManager.Instance.StoreJwt(response.accessToken);
NotificationManager.Instance.OnUserLoggedIn();
AdjoeManager.Instance.InitialiseAdjoe();   // <-- add this
```

### Step 5 — Show game wall button

```csharp
// On "Earn" / "Play Games" button press:
public void OnPlayGamesButtonPressed()
{
    AdjoeManager.Instance.ShowGameWall();
}
```

---

## Flow 2 — Rewarded Ad Bonus (+10%)

### How it works

After a user earns from Adjoe gameplay, a "Watch Ad" button unlocks.
Each Adjoe reward unlocks the button **once** — the user must play again to watch another ad.

```
Unity                                   SweCash Backend
─────                                   ───────────────
GET /reward/ad/eligibility ──────────► checks last Adjoe reward
                           ◄──────────  { eligible: true, potentialReward: 0.0005 }

(show Watch Ad button)

AdMob rewarded ad plays in Unity
Ad completes (user watches fully)

POST /reward/ad ─────────────────────► validates eligibility again
                                        credits +10% of last Adjoe reward
                ◄─────────────────────  { reward: 0.0005, instant: true }

(update wallet UI)
```

### Backend endpoints

**Check eligibility (call when entering earn screen):**
```
GET /api/v1/reward/ad/eligibility
Authorization: Bearer <SweCash JWT>

Response when eligible:
{
  "eligible": true,
  "potentialReward": 0.0005,
  "basedOnAdjoeAmount": 0.005,
  "label": "DAILY REWARD",
  "description": "Watch Ad & Earn"
}

Response when not eligible:
{
  "eligible": false,
  "reason": "No gameplay reward found yet. Play a game first."
}
```

**Claim reward (call ONLY after ad fully completes):**
```
POST /api/v1/reward/ad
Authorization: Bearer <SweCash JWT>
(no body required)

Response:
{
  "reward": 0.0005,
  "instant": true,
  "transactionId": "tx_abc123",
  "message": "+$0.0005 instantly added to your balance."
}
```

### RewardedAdManager.cs

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using GoogleMobileAds.Api;

public class RewardedAdManager : MonoBehaviour
{
    public static RewardedAdManager Instance { get; private set; }

    // Replace with your AdMob rewarded ad unit ID
    private const string AdUnitId = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX";

    private RewardedAd _rewardedAd;
    private AdEligibilityResponse _eligibility;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    void Start()
    {
        MobileAds.Initialize(_ => LoadRewardedAd());
    }

    // ─── Step 1: Check eligibility when entering the earn screen ─────────────

    public void CheckEligibility(System.Action<AdEligibilityResponse> callback)
    {
        StartCoroutine(FetchEligibility(callback));
    }

    private IEnumerator FetchEligibility(System.Action<AdEligibilityResponse> callback)
    {
        var url = ApiClient.BaseUrl + "/reward/ad/eligibility";
        var req = UnityWebRequest.Get(url);
        req.SetRequestHeader("Authorization", "Bearer " + AuthManager.Instance.JwtToken);

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning("[Ad] Eligibility check failed: " + req.error);
            callback?.Invoke(new AdEligibilityResponse { eligible = false, reason = "Network error." });
            yield break;
        }

        var result = JsonUtility.FromJson<AdEligibilityResponse>(req.downloadHandler.text);
        _eligibility = result;
        callback?.Invoke(result);
    }

    // ─── Step 2: Load an ad in the background ────────────────────────────────

    private void LoadRewardedAd()
    {
        var adRequest = new AdRequest();
        RewardedAd.Load(AdUnitId, adRequest, (ad, error) =>
        {
            if (error != null || ad == null)
            {
                Debug.LogWarning("[Ad] Failed to load rewarded ad: " + error);
                return;
            }
            _rewardedAd = ad;
            Debug.Log("[Ad] Rewarded ad loaded.");
        });
    }

    // ─── Step 3: Show the ad when user taps the button ───────────────────────

    public void ShowRewardedAd()
    {
        if (_rewardedAd == null || !_rewardedAd.CanShowAd())
        {
            Debug.LogWarning("[Ad] Ad not ready yet.");
            UIManager.Instance?.ShowToast("Ad", "Ad not ready. Please try again.");
            return;
        }

        _rewardedAd.OnAdFullScreenContentClosed += OnAdClosed;
        _rewardedAd.Show(reward =>
        {
            // This fires when the user earns the reward (watched fully)
            Debug.Log($"[Ad] User earned reward: {reward.Amount} {reward.Type}");
            StartCoroutine(ClaimAdReward());
        });
    }

    // Ad dismissed without completing
    private void OnAdClosed()
    {
        Debug.Log("[Ad] Ad closed without completing.");
        _rewardedAd.OnAdFullScreenContentClosed -= OnAdClosed;
        LoadRewardedAd(); // preload next ad
    }

    // ─── Step 4: Claim reward from backend after ad completes ────────────────

    private IEnumerator ClaimAdReward()
    {
        var url = ApiClient.BaseUrl + "/reward/ad";
        var req = new UnityWebRequest(url, "POST");
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Authorization", "Bearer " + AuthManager.Instance.JwtToken);
        req.SetRequestHeader("Content-Type",  "application/json");

        yield return req.SendWebRequest();

        if (req.result == UnityWebRequest.Result.Success)
        {
            var result = JsonUtility.FromJson<AdClaimResponse>(req.downloadHandler.text);
            Debug.Log($"[Ad] Reward claimed: +${result.reward}");

            // Show success toast and refresh wallet balance
            UIManager.Instance?.ShowToast("Reward Earned!", result.message);
            WalletManager.Instance?.RefreshBalance();
        }
        else
        {
            Debug.LogWarning("[Ad] Claim failed: " + req.error);
        }

        LoadRewardedAd(); // preload next ad
    }

    // ─── Data models ─────────────────────────────────────────────────────────

    [System.Serializable]
    public class AdEligibilityResponse
    {
        public bool   eligible;
        public string reason;
        public float  potentialReward;
        public float  basedOnAdjoeAmount;
        public string label;
        public string description;
    }

    [System.Serializable]
    private class AdClaimResponse
    {
        public float  reward;
        public bool   instant;
        public string transactionId;
        public string message;
    }
}
```

### EarnScreenController.cs (UI wiring example)

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class EarnScreenController : MonoBehaviour
{
    [SerializeField] private GameObject watchAdButton;
    [SerializeField] private TextMeshProUGUI potentialRewardLabel;
    [SerializeField] private TextMeshProUGUI notEligibleLabel;

    void OnEnable()
    {
        // Every time this screen opens, check eligibility and show/hide the button
        RefreshAdButton();
    }

    private void RefreshAdButton()
    {
        watchAdButton.SetActive(false);
        notEligibleLabel.gameObject.SetActive(false);

        RewardedAdManager.Instance.CheckEligibility(eligibility =>
        {
            // Unity UI must be updated on main thread
            UnityMainThreadDispatcher.Instance().Enqueue(() =>
            {
                if (eligibility.eligible)
                {
                    watchAdButton.SetActive(true);
                    potentialRewardLabel.text = $"+${eligibility.potentialReward:F4}";
                }
                else
                {
                    notEligibleLabel.gameObject.SetActive(true);
                    notEligibleLabel.text = eligibility.reason;
                }
            });
        });
    }

    public void OnWatchAdButtonPressed()
    {
        RewardedAdManager.Instance.ShowRewardedAd();
    }
}
```

> **Note:** `UnityMainThreadDispatcher` is a common Unity utility for dispatching back to the main thread from coroutines/callbacks. Add it to your project if not already present.

---

## Wallet Balance Polling

After an Adjoe reward lands (via S2S from Adjoe's servers), the balance updates on the backend automatically. Unity has no webhook — it needs to poll.

```csharp
// WalletManager.cs — poll balance every 30 seconds while earn screen is open
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class WalletManager : MonoBehaviour
{
    public static WalletManager Instance { get; private set; }

    [SerializeField] private TMPro.TextMeshProUGUI pendingBalanceLabel;
    [SerializeField] private TMPro.TextMeshProUGUI availableBalanceLabel;

    private Coroutine _pollingCoroutine;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void StartPolling()  => _pollingCoroutine = StartCoroutine(PollBalance());
    public void StopPolling()   { if (_pollingCoroutine != null) StopCoroutine(_pollingCoroutine); }
    public void RefreshBalance() => StartCoroutine(FetchBalance());

    private IEnumerator PollBalance()
    {
        while (true)
        {
            yield return FetchBalance();
            yield return new WaitForSeconds(30f);
        }
    }

    private IEnumerator FetchBalance()
    {
        var url = ApiClient.BaseUrl + "/users/profile";
        var req = UnityWebRequest.Get(url);
        req.SetRequestHeader("Authorization", "Bearer " + AuthManager.Instance.JwtToken);

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success) yield break;

        var profile = JsonUtility.FromJson<UserProfile>(req.downloadHandler.text);
        pendingBalanceLabel.text   = $"${profile.wallet.pendingBalance:F2} pending";
        availableBalanceLabel.text = $"${profile.wallet.availableBalance:F2} available";
    }

    [System.Serializable]
    private class UserProfile
    {
        public WalletData wallet;
    }

    [System.Serializable]
    private class WalletData
    {
        public float pendingBalance;
        public float availableBalance;
        public float lifetimeEarnings;
    }
}
```

---

## Full Login Sequence

This is the correct order of calls after a successful login:

```csharp
// AuthManager.cs — after Google login succeeds
IEnumerator OnLoginSuccess(string jwt)
{
    AuthManager.Instance.StoreJwt(jwt);

    // 1. Register FCM token for push notifications
    NotificationManager.Instance.OnUserLoggedIn();

    // 2. Initialise Adjoe SDK (fetches publisherSubId + sdkHash)
    AdjoeManager.Instance.InitialiseAdjoe();

    // 3. Load initial wallet balance
    WalletManager.Instance.RefreshBalance();

    // 4. Navigate to home screen
    SceneManager.LoadScene("HomeScene");

    yield break;
}
```

---

## Rules Summary

| Rule | Detail |
|---|---|
| Adjoe SDK must be initialised with the **user's own ID** | Always fetch from `/adjoe/init` — never hardcode |
| Unity never reports Adjoe rewards | Adjoe calls the backend directly |
| Watch Ad button only appears **after** an Adjoe reward | Backend enforces this — eligibility check returns `false` otherwise |
| Each Adjoe reward unlocks **one** ad watch | Backend blocks a second claim on the same Adjoe tx |
| Adjoe reward → **pending** balance | Needs admin approval to withdraw |
| Ad reward → **available** balance | Instant, no approval needed |
| Never call `POST /reward/ad` unless ad **fully completed** | Backend deduplicates but do not trust the client to retry |

---

## Checklist

- [ ] `AdjoeManager.cs` added to a persistent GameObject
- [ ] `AdjoeManager.Instance.InitialiseAdjoe()` called after login
- [ ] Adjoe Playtime Studio SDK `.unitypackage` imported
- [ ] `RewardedAdManager.cs` added to a persistent GameObject
- [ ] AdMob rewarded ad unit ID filled in (`AdUnitId` constant)
- [ ] `EarnScreenController.cs` wired to the earn screen UI buttons
- [ ] `WalletManager.cs` added — balance polling starts when earn screen opens
- [ ] `POST /reward/ad` only called inside the ad `Show()` reward callback (not on close)
- [ ] End-to-end test: login → game wall opens → simulate S2S callback → ad button appears → watch ad → balance updates

---

## API Reference (Quick)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/adjoe/init` | JWT | Get `publisherSubId` + `sdkHash` to init SDK |
| GET | `/api/v1/reward/ad/eligibility` | JWT | Check if Watch Ad button should be shown |
| POST | `/api/v1/reward/ad` | JWT | Claim +10% ad bonus after ad completes |
| GET | `/api/v1/users/profile` | JWT | Get wallet balances |

---

*Questions? Contact the backend team.*
