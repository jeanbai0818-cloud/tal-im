/** Personal auth REST API — QR login, session */
export const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';

/** Bot OAPI — access token, IM, calendar, docs, etc. */
export const OAPI_BASE = 'https://yach-oapi.zhiyinlou.com';

/** Prefix for QR scan URL; append sessionId to get the scannable link */
export const QR_URL_PREFIX = 'https://yach.zhiyinlou.com/?from=qrcode&type=1&random=';

/** QR code validity window in ms */
export const QR_EXPIRE_MS = 60_000;

/** Poll interval while waiting for scan confirmation */
export const QR_POLL_MS = 3_000;

/** Grace window past expiry to catch in-flight confirmations */
export const QR_GRACE_MS = 15_000;

/** Refresh bot token this many ms before its server-reported expiry */
export const BOT_TOKEN_REFRESH_EARLY_MS = 3 * 60 * 1_000;

/** MD5 signing key embedded in all CAPI requests */
export const SIGN_KEY = '59266f227cfd7a67797012108df99c9b';

/** AES-128-ECB key for computing the gateway token (exactly 16 bytes) */
export const PLATFORM_CONFIG_KEY = 'SDJ0U#$2io9F&#*J';

/** Plugin version embedded in request headers */
export const PLUGIN_VERSION = '2.1.5';

/** Default account ID used when no multi-account config is present */
export const DEFAULT_ACCOUNT_ID = 'default';

/** Default Channel SDK app ID */
export const DEFAULT_CHANNEL_APP_ID = 'yach20001';

