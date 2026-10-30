package com.oruinwan.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Conversation keys for showing message notifications while the app is closed. Messages are
 * end-to-end encrypted, so the server can only say "New message"; the app hands each
 * conversation key it opens to this class (src/native/notifyKeys.js), which keeps it sealed with
 * a key that never leaves the Android Keystore. A message push carries the message still
 * encrypted (ct, iv, kv); decrypt() opens it here, on the phone. Signing out clears them all.
 */
final class NotifyKeys {
    private static final String TAG = "NotifyKeys";
    private static final String ALIAS = "oruinwan.notify.keys";
    private static final String PREFS = "oruinwan_notify_keys";

    private NotifyKeys() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey wrappingKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gen.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return gen.generateKey();
    }

    private static String entryName(String conversationId, String version) {
        return conversationId + "|" + (version == null || version.isEmpty() ? "1" : version);
    }

    /** Keeps a conversation's raw AES key (base64), sealed. */
    static void store(Context ctx, String conversationId, String version, String rawKeyB64) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, wrappingKey());
            byte[] sealed = c.doFinal(Base64.decode(rawKeyB64, Base64.DEFAULT));
            String value = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(sealed, Base64.NO_WRAP);
            prefs(ctx).edit().putString(entryName(conversationId, version), value).apply();
        } catch (Exception e) {
            Log.w(TAG, "Could not keep a conversation key", e);
        }
    }

    static void clear(Context ctx) {
        prefs(ctx).edit().clear().apply();
    }

    private static byte[] open(String value) throws Exception {
        String[] parts = value.split(":", 2);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, wrappingKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.DEFAULT)));
        return c.doFinal(Base64.decode(parts[1], Base64.DEFAULT));
    }

    private static String tryKey(byte[] raw, byte[] iv, byte[] ct) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(raw, "AES"), new GCMParameterSpec(128, iv));
            return new String(c.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** The message's text, or null when no key here opens it. Tries the named version first. */
    static String decrypt(Context ctx, String conversationId, String version, String ctB64, String ivB64) {
        if (conversationId == null || ctB64 == null || ivB64 == null) return null;
        try {
            byte[] ct = Base64.decode(ctB64, Base64.DEFAULT);
            byte[] iv = Base64.decode(ivB64, Base64.DEFAULT);
            SharedPreferences p = prefs(ctx);
            String named = p.getString(entryName(conversationId, version), null);
            if (named != null) {
                String text = tryKey(open(named), iv, ct);
                if (text != null) return text;
            }
            for (Map.Entry<String, ?> e : p.getAll().entrySet()) {
                if (!e.getKey().startsWith(conversationId + "|") || !(e.getValue() instanceof String)) continue;
                String text = tryKey(open((String) e.getValue()), iv, ct);
                if (text != null) return text;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not decrypt a message notification", e);
        }
        return null;
    }
}
