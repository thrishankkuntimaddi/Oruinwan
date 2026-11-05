package com.oruinwan.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * The sticker packs prepared for WhatsApp, on this phone only: files/whatsapp-stickers/
 *   contents.json                 [{ identifier, name, publisher, imageDataVersion, animated, stickers: [{ file, emoji, label }] }]
 *   <identifier>/tray.png         96 × 96
 *   <identifier>/NN.webp          512 × 512
 */
final class StickerPacks {

    private StickerPacks() {}

    static File root(Context context) {
        File dir = new File(context.getFilesDir(), "whatsapp-stickers");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    /** Pack ids and file names come from the app, but never trust them as paths. */
    static boolean safe(String name) {
        return name != null && name.matches("[A-Za-z0-9._-]{1,128}") && !name.contains("..");
    }

    static File file(Context context, String packId, String name) {
        if (!safe(packId) || !safe(name)) return null;
        return new File(new File(root(context), packId), name);
    }

    static synchronized JSONArray read(Context context) {
        try {
            File f = new File(root(context), "contents.json");
            if (!f.isFile()) return new JSONArray();
            return new JSONArray(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static synchronized void write(Context context, JSONArray packs) throws Exception {
        File tmp = new File(root(context), "contents.json.tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(packs.toString().getBytes(StandardCharsets.UTF_8));
        }
        File dest = new File(root(context), "contents.json");
        if (!tmp.renameTo(dest)) throw new Exception("Could not save the sticker pack");
    }

    static JSONObject find(JSONArray packs, String id) {
        for (int i = 0; i < packs.length(); i++) {
            JSONObject p = packs.optJSONObject(i);
            if (p != null && id != null && id.equals(p.optString("identifier"))) return p;
        }
        return null;
    }

    /** Store a pack (replacing an older copy), bumping its image version so WhatsApp re-reads it. */
    static synchronized void save(Context context, JSONObject pack, byte[] tray, byte[][] stickers) throws Exception {
        String id = pack.getString("identifier");
        if (!safe(id)) throw new Exception("Bad pack id");
        File dir = new File(root(context), id);
        if (dir.exists()) {
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
        } else if (!dir.mkdirs()) throw new Exception("Could not create the sticker pack");
        writeFile(new File(dir, "tray.png"), tray);
        JSONArray list = pack.getJSONArray("stickers");
        for (int i = 0; i < stickers.length; i++) writeFile(new File(dir, list.getJSONObject(i).getString("file")), stickers[i]);

        JSONArray packs = read(context);
        JSONArray next = new JSONArray();
        int version = 0;
        for (int i = 0; i < packs.length(); i++) {
            JSONObject p = packs.optJSONObject(i);
            if (p == null) continue;
            if (id.equals(p.optString("identifier"))) {
                try { version = Integer.parseInt(p.optString("imageDataVersion", "0")); } catch (NumberFormatException ignored) { }
                continue;
            }
            next.put(p);
        }
        pack.put("imageDataVersion", String.valueOf(version + 1));
        next.put(pack);
        write(context, next);
    }

    private static void writeFile(File f, byte[] data) throws Exception {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
    }
}
