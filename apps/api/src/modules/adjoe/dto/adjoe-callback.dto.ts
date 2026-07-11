/**
 * Adjoe Playtime S2S reward postback.
 *
 * IMPORTANT: Adjoe sends this as an HTTP **GET** with **query-string** params —
 * NOT a POST with a JSON body. The field names below are Adjoe's real macro
 * names, captured from production callback traffic:
 *
 *   GET /api/v1/adjoe/callback
 *       ?coin_amount=1
 *       &currency=USD
 *       &placement=null
 *       &sid=17d610c6dfba2821ee9689a91a420722af7e238b   (SHA1 signature)
 *       &trans_uuid=df881163-d470-4c1b-a7ee-e1ec098ad0b0
 *       &user_uuid=242950bd-3dee-462a-bfac-a21e20b3fa15
 *       &ua_channel=null&ua_network=null
 *       &ua_subpublisher_cleartext=null&ua_subpublisher_encrypted=null
 *
 * This is an INTERFACE, not a validated class DTO, on purpose: the global
 * ValidationPipe runs with forbidNonWhitelisted=true, which would reject the
 * request outright the moment Adjoe includes a param we didn't declare. The
 * controller reads the raw query and the service parses it defensively.
 */
export interface AdjoeCallbackQuery {
  /** Adjoe transaction UUID — unique per reward event; our dedup key. */
  trans_uuid?: string;
  /** Reward amount in Adjoe COINS (integer), e.g. "1". NOT USD. */
  coin_amount?: string;
  /** The publisher user identifier Adjoe echoes back (what we set at SDK init). */
  user_uuid?: string;
  /** Adjoe S2S signature hash (SHA1) used to verify the callback is genuine. */
  sid?: string;
  /** Currency label of the coin balance (informational). */
  currency?: string;
  /** Adjoe placement identifier (informational). */
  placement?: string;
  /** Any other params Adjoe appends (ua_channel, ua_network, …) pass through as metadata. */
  [key: string]: string | undefined;
}
