# Requirements Document

## Introduction

Runa users who sign up with email/password do not have a GitHub account linked to their profile. Since the Developer agent pushes code to GitHub on behalf of the user, a GitHub connection is essential for the core workflow. This feature allows authenticated users to link (and unlink) their GitHub account from within the application, reusing the existing GitHub OAuth flow.

## Glossary

- **Runa**: The AI Agentic Agile Team platform
- **Account_Settings_Page**: The frontend page where authenticated users manage their profile and connected accounts
- **Auth_Service**: The backend NestJS service responsible for authentication, token management, and GitHub OAuth operations
- **Auth_Controller**: The backend NestJS controller exposing authentication-related HTTP endpoints
- **User_Entity**: The TypeORM entity representing a user record in the PostgreSQL database, including `githubId` and `githubTokenEncrypted` fields
- **GitHub_Link_API**: The backend endpoint that initiates the GitHub OAuth flow specifically for account linking (as opposed to login)
- **GitHub_Link_Callback_API**: The backend endpoint that receives the OAuth callback during account linking and persists the GitHub connection
- **GitHub_Status_Indicator**: A UI component on the Account Settings Page that displays whether a GitHub account is currently linked
- **Token_Encryption_Service**: The existing service that encrypts and decrypts GitHub access tokens using AES-256-GCM

## Requirements

### Requirement 1: View GitHub Connection Status

**User Story:** As a Runa user, I want to see whether my GitHub account is linked, so that I know if the Developer agent can push code on my behalf.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Account_Settings_Page, THE Auth_Service SHALL return the current user profile including a `githubConnected` boolean field and, when connected, the GitHub username
2. WHILE a GitHub account is linked, THE GitHub_Status_Indicator SHALL display the connected GitHub username and avatar
3. WHILE no GitHub account is linked, THE GitHub_Status_Indicator SHALL display a prompt to connect a GitHub account

### Requirement 2: Initiate GitHub Account Linking

**User Story:** As a Runa user who signed up with email, I want to connect my GitHub account, so that the Developer agent can push code to my repositories.

#### Acceptance Criteria

1. WHEN the user clicks the "Connect GitHub" button on the Account_Settings_Page, THE GitHub_Link_API SHALL redirect the user to the GitHub OAuth authorization page with a `state` parameter that encodes the linking intent
2. THE GitHub_Link_API SHALL request the `repo` and `user:email` OAuth scopes from GitHub
3. THE GitHub_Link_API SHALL include a `state` parameter containing a CSRF token to prevent cross-site request forgery during the OAuth flow

### Requirement 3: Complete GitHub Account Linking via OAuth Callback

**User Story:** As a Runa user, I want the OAuth callback to securely link my GitHub account, so that my GitHub credentials are stored safely.

#### Acceptance Criteria

1. WHEN the GitHub OAuth callback is received with a valid authorization code and state parameter, THE GitHub_Link_Callback_API SHALL exchange the code for a GitHub access token
2. WHEN the access token is obtained, THE Auth_Service SHALL store the encrypted token in the User_Entity `githubTokenEncrypted` field and the GitHub user ID in the `githubId` field using the Token_Encryption_Service
3. IF the GitHub account is already linked to a different Runa user, THEN THE GitHub_Link_Callback_API SHALL return a conflict error indicating the GitHub account is in use by another user
4. IF the `state` parameter is missing or does not match the expected CSRF token, THEN THE GitHub_Link_Callback_API SHALL reject the request with an unauthorized error
5. IF the authorization code exchange with GitHub fails, THEN THE GitHub_Link_Callback_API SHALL return a descriptive error message to the frontend
6. WHEN linking completes successfully, THE Auth_Service SHALL return the updated user profile including the newly linked GitHub username

### Requirement 4: Unlink GitHub Account

**User Story:** As a Runa user, I want to disconnect my GitHub account, so that I can revoke access or switch to a different GitHub account.

#### Acceptance Criteria

1. WHEN the user clicks the "Disconnect GitHub" button on the Account_Settings_Page, THE Auth_Service SHALL remove the `githubId` and `githubTokenEncrypted` values from the User_Entity
2. WHEN unlinking completes successfully, THE Auth_Service SHALL return the updated user profile reflecting the disconnected state
3. IF the user originally signed up via GitHub OAuth and has no password set, THEN THE Auth_Service SHALL reject the unlink request with an error indicating that a password must be set first to avoid account lockout

### Requirement 5: Account Settings Page and Navigation

**User Story:** As a Runa user, I want to access an account settings page, so that I can manage my profile and connected accounts.

#### Acceptance Criteria

1. THE Account_Settings_Page SHALL be accessible from the main application layout via a user menu or settings link
2. THE Account_Settings_Page SHALL display the user's name, email, and GitHub connection status
3. WHILE the user is not authenticated, THE Account_Settings_Page SHALL redirect to the login page

### Requirement 6: Frontend GitHub Linking Flow

**User Story:** As a Runa user, I want a seamless in-app experience when linking my GitHub account, so that I am returned to the settings page after authorization.

#### Acceptance Criteria

1. WHEN the GitHub OAuth flow completes and the callback page receives the authorization code, THE Account_Settings_Page SHALL call the GitHub_Link_Callback_API with the code and state parameters
2. WHEN the linking API returns success, THE Account_Settings_Page SHALL update the GitHub_Status_Indicator to reflect the newly connected account without requiring a full page reload
3. IF the linking API returns an error, THEN THE Account_Settings_Page SHALL display the error message to the user
4. WHEN the user clicks "Disconnect GitHub" and confirms the action, THE Account_Settings_Page SHALL call the unlink API and update the GitHub_Status_Indicator to reflect the disconnected state

### Requirement 7: Security of the Linking Flow

**User Story:** As a Runa user, I want the GitHub linking process to be secure, so that my GitHub credentials are protected.

#### Acceptance Criteria

1. THE GitHub_Link_API SHALL only be accessible to authenticated users with a valid JWT token
2. THE GitHub_Link_Callback_API SHALL only be accessible to authenticated users with a valid JWT token
3. THE Auth_Service SHALL encrypt GitHub access tokens using the Token_Encryption_Service before persisting them to the database
4. THE Auth_Service SHALL transmit GitHub access tokens only in encrypted form and never expose raw tokens in API responses
