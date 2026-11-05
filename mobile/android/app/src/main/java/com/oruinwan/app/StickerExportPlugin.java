package com.oruinwan.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Stickers out of Oruinwan (mobile/src/native/stickerExport.js):
 *   whatsApp()              { installed, business }: which WhatsApp apps are on the phone
 *   addToWhatsApp(pack)     store a prepared pack (StickerPacks) and ask WhatsApp to add it
 *   share({ data, mimeType, name })   send one picture to any app (Instagram, Facebook, …)
 * The web code checks Capacitor.isPluginAvailable('StickerExport'): older apps don't have it.
 */
@CapacitorPlugin(name = "StickerExport")
public class StickerExportPlugin extends Plugin {

    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";

    private boolean installed(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void whatsApp(PluginCall call) {
        JSObject out = new JSObject();
        out.put("installed", installed(WHATSAPP));
        out.put("business", installed(WHATSAPP_BUSINESS));
        call.resolve(out);
    }

    @PluginMethod
    public void addToWhatsApp(PluginCall call) {
        boolean consumer = installed(WHATSAPP);
        boolean business = installed(WHATSAPP_BUSINESS);
        if (!consumer && !business) {
            call.reject("WhatsApp isn't installed on this phone", "NO_WHATSAPP");
            return;
        }
        try {
            String id = call.getString("identifier");
            String name = call.getString("name", "Oruinwan stickers");
            JSArray items = call.getArray("stickers");
            String tray = call.getString("tray");
            if (!StickerPacks.safe(id) || items == null || tray == null) {
                call.reject("The sticker pack is incomplete");
                return;
            }
            if (items.length() < 3 || items.length() > 30) {
                call.reject("WhatsApp packs need 3 to 30 stickers", "PACK_SIZE");
                return;
            }
            JSONObject pack = new JSONObject();
            pack.put("identifier", id);
            pack.put("name", name.length() > 128 ? name.substring(0, 128) : name);
            pack.put("publisher", call.getString("publisher", "Oruinwan"));
            pack.put("animated", Boolean.TRUE.equals(call.getBoolean("animated", false)));
            JSONArray list = new JSONArray();
            byte[][] files = new byte[items.length()][];
            for (int i = 0; i < items.length(); i++) {
                JSONObject s = items.getJSONObject(i);
                files[i] = Base64.decode(s.getString("data"), Base64.DEFAULT);
                JSONObject meta = new JSONObject();
                meta.put("file", String.format(java.util.Locale.ROOT, "%02d.webp", i + 1));
                meta.put("emoji", s.optString("emoji", "😀"));
                meta.put("label", s.optString("label", "Sticker"));
                list.put(meta);
            }
            pack.put("stickers", list);
            StickerPacks.save(getContext(), pack, Base64.decode(tray, Base64.DEFAULT), files);
            getContext().getContentResolver().notifyChange(
                Uri.parse("content://" + StickerContentProvider.authority(getContext()) + "/" + StickerContentProvider.METADATA), null);

            Intent intent = new Intent("com.whatsapp.intent.action.ENABLE_STICKER_PACK");
            intent.putExtra("sticker_pack_id", id);
            intent.putExtra("sticker_pack_authority", StickerContentProvider.authority(getContext()));
            intent.putExtra("sticker_pack_name", pack.getString("name"));
            // WhatsApp, or WhatsApp Business when asked for (or when it's the only one).
            boolean toBusiness = business && (!consumer || "business".equals(call.getString("app")));
            intent.setPackage(toBusiness ? WHATSAPP_BUSINESS : WHATSAPP);
            startActivityForResult(call, intent, "whatsAppAnswered");
        } catch (ActivityNotFoundException e) {
            call.reject("This WhatsApp version can't add sticker packs. Update WhatsApp and try again.", "OLD_WHATSAPP");
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Couldn't prepare the sticker pack");
        }
    }

    @ActivityCallback
    private void whatsAppAnswered(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK) {
            out.put("added", true);
            call.resolve(out);
            return;
        }
        Intent data = result.getData();
        String error = data != null ? data.getStringExtra("validation_error") : null;
        if (error != null) {
            call.reject("WhatsApp didn't accept the pack: " + error, "WHATSAPP_REJECTED");
            return;
        }
        out.put("added", false);
        call.resolve(out);
    }

    @PluginMethod
    public void share(PluginCall call) {
        try {
            String data = call.getString("data");
            String mime = call.getString("mimeType", "image/webp");
            String name = call.getString("name", "sticker.webp").replaceAll("[^A-Za-z0-9._-]", "_");
            if (data == null) {
                call.reject("Nothing to share");
                return;
            }
            File dir = new File(getContext().getCacheDir(), "shared");
            if (!dir.exists()) dir.mkdirs();
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            File file = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, call.getString("title", "Share sticker"));
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Couldn't share the sticker");
        }
    }
}
