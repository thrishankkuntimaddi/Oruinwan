package com.oruinwan.app;

import android.os.CancellationSignal;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * "Continue with Google" inside the Android app. Google's web pop-up doesn't run in an app's
 * web view, so this uses Android's own account picker (Credential Manager).
 *
 * The returned ID token is issued to the server's web client id (serverClientId), so the server
 * checks it exactly as it checks a web sign-in. Google only hands out tokens to this app when
 * the Google Cloud project has an Android client for com.oruinwan.app with the release key's
 * SHA-1 fingerprint.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId", "");
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("Google sign-in is not set up on this server", "NOT_CONFIGURED");
            return;
        }

        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(serverClientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager manager = CredentialManager.create(getContext());

        manager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (!(credential instanceof CustomCredential)
                        || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        call.reject("Google didn't return an account", "FAILED");
                        return;
                    }
                    try {
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                        JSObject ret = new JSObject();
                        ret.put("idToken", google.getIdToken());
                        call.resolve(ret);
                    } catch (Exception e) {
                        call.reject("Google didn't return an account", "FAILED");
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("Cancelled", "CANCELLED");
                    } else if (e instanceof NoCredentialException) {
                        call.reject("Add a Google account to this device first, then try again", "NO_ACCOUNT");
                    } else {
                        call.reject(e.getMessage() != null ? e.getMessage() : "Google sign-in failed", "FAILED");
                    }
                }
            }
        );
    }
}
