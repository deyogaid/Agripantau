# Security Specification for TaniTrade

## Data Invariants
- A user can only manage their own profile data (`/users/{userId}`).
- Only the creator of a Listing can update or delete it (`/listings/{listingId}`).
- Only the creator of a PriceReport can update or delete it (`/price_reports/{reportId}`).
- Only the creator of a Transaction can update or delete it (`/transactions/{transactionId}`).
- `userId` fields in all collections must strictly match the authenticated user's UID.
- `createdAt` and `timestamp` fields must use server-side timestamps.
- Only admins (as defined in `/admins/{uid}`) can modify `verified` status or `role`.

## The Dirty Dozen Payloads (Test Cases)

### 1. Identity Spoofing (Listing)
**Payload:** `{ "userId": "attacker_id", "commodity": "Beras", "price": 12000, ... }`
**Target:** `/listings/new_listing` (authenticated as `victim_id`)
**Expected:** `PERMISSION_DENIED` - `userId` must match `request.auth.uid`.

### 2. Privilege Escalation (User Profile)
**Payload:** `{ "role": "admin", ... }`
**Target:** `/users/my_id` (authenticated as `my_id`)
**Expected:** `PERMISSION_DENIED` - Role update restricted to admins.

### 3. Shadow Update (Price Report Verification)
**Payload:** `{ "verified": true, ... }`
**Target:** `/price_reports/report_id` (authenticated as non-admin owner)
**Expected:** `PERMISSION_DENIED` - `verified` field is admin-only.

### 4. State Shortcut (Listing Status)
**Payload:** `{ "status": "sold" }`
**Target:** `/listings/other_user_listing` (authenticated as non-owner)
**Expected:** `PERMISSION_DENIED` - Cannot update other users' listings.

### 5. ID Poisoning (Long ID)
**Target:** `/price_reports/` + "A" * 2048
**Expected:** `PERMISSION_DENIED` - ID size enforcement.

### 6. Type Mismatch (Price as String)
**Payload:** `{ "price": "cheap" }`
**Target:** `/listings/listing_id`
**Expected:** `PERMISSION_DENIED` - Type enforcement.

### 7. Missing Required Keys (User)
**Payload:** `{ "displayName": "John" }` (missing `role`, `createdAt`)
**Target:** `/users/user_id`
**Expected:** `PERMISSION_DENIED` - Schema completeness.

### 8. Extra Keys (Injection)
**Payload:** `{ "commodity": "Beras", ... , "hacked": true }`
**Target:** `/listings/listing_id`
**Expected:** `PERMISSION_DENIED` - No extra fields allowed.

### 9. Immutability Bypass (Listing UserID)
**Payload:** `{ "userId": "new_owner_id" }`
**Target:** `/listings/my_listing` (updating existing)
**Expected:** `PERMISSION_DENIED` - `userId` is immutable.

### 10. Timestamp Fraud (Client Time)
**Payload:** `{ "createdAt": "2020-01-01T00:00:00Z" }`
**Target:** `/listings/listing_id`
**Expected:** `PERMISSION_DENIED` - Must use server timestamp.

### 11. Resource Exhaustion (Massive Description)
**Payload:** `{ "description": "A" * 1000000 }`
**Target:** `/listings/listing_id`
**Expected:** `PERMISSION_DENIED` - Size limits.

### 12. Unauthenticated Write
**Action:** `setDoc(...)`
**Target:** `/price_reports/any`
**Expected:** `PERMISSION_DENIED` - Requires `isSignedIn()`.
